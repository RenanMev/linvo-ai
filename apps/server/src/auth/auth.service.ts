import { Inject, Injectable } from "@nestjs/common";

import {
  type AuthLoginRequest,
  type AuthPasswordResetConfirmRequest,
  type AuthPasswordResetRequest,
  type AuthPasswordResetRequestResponse,
  type AuthRegisterRequest,
  type AuthSessionResponse,
  type AuthTokens,
  type AuthUser
} from "@linvo-ai/shared";

import { ApiHttpException } from "../http-error";
import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(APP_CONFIG)
    private readonly config: AppConfig,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(RefreshTokenService)
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async register(input: AuthRegisterRequest, userAgent?: string): Promise<AuthSessionResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existing) {
      throw new ApiHttpException(409, "EMAIL_ALREADY_EXISTS", "Este email ja esta cadastrado.");
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name ?? null,
        passwordHash: await this.passwordService.hashPassword(input.password)
      }
    });

    return {
      status: "ok",
      tokens: await this.createTokens({ email: user.email, id: user.id }, userAgent),
      user: this.toAuthUser(user)
    };
  }

  async login(input: AuthLoginRequest, userAgent?: string): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user || !(await this.passwordService.verifyPassword(input.password, user.passwordHash))) {
      throw new ApiHttpException(401, "INVALID_CREDENTIALS", "Email ou senha invalidos.");
    }

    if (user.status !== "active") {
      throw new ApiHttpException(403, "USER_DISABLED", "Este usuario esta desativado.");
    }

    return {
      status: "ok",
      tokens: await this.createTokens({ email: user.email, id: user.id }, userAgent),
      user: this.toAuthUser(user)
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await this.refreshTokenService.rotate(refreshToken);

    if (!rotated) {
      throw new ApiHttpException(401, "REFRESH_TOKEN_INVALID", "Sessao expirada. Entre novamente.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotated.userId }
    });

    return {
      accessToken: await this.tokenService.createAccessToken({
        email: user.email,
        id: user.id
      }),
      expiresIn: this.tokenService.accessTokenTtlSeconds,
      refreshToken: rotated.refreshToken
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revoke(refreshToken);
  }

  async requestPasswordReset(
    input: AuthPasswordResetRequest
  ): Promise<AuthPasswordResetRequestResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email }
    });

    if (!user || user.status !== "active") {
      return { status: "ok" };
    }

    const resetCode = this.tokenService.createPasswordResetCode();

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        data: { usedAt: new Date() },
        where: {
          userId: user.id,
          usedAt: null
        }
      }),
      this.prisma.passwordResetToken.create({
        data: {
          expiresAt: this.tokenService.getPasswordResetTokenExpiry(),
          tokenHash: this.tokenService.hashPasswordResetCode(resetCode),
          userId: user.id
        }
      })
    ]);

    return this.config.NODE_ENV === "production"
      ? { status: "ok" }
      : { resetCode, status: "ok" };
  }

  async resetPassword(input: AuthPasswordResetConfirmRequest): Promise<void> {
    const tokenHash = this.tokenService.hashPasswordResetCode(input.resetCode);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      include: { user: true },
      where: { tokenHash }
    });
    const now = new Date();

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      resetToken.user.status !== "active"
    ) {
      throw new ApiHttpException(
        401,
        "PASSWORD_RESET_TOKEN_INVALID",
        "Link de redefinicao expirado ou invalido."
      );
    }

    const passwordHash = await this.passwordService.hashPassword(input.password);

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.passwordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          expiresAt: { gt: now },
          id: resetToken.id,
          usedAt: null
        }
      });

      if (updated.count !== 1) {
        throw new ApiHttpException(
          401,
          "PASSWORD_RESET_TOKEN_INVALID",
          "Link de redefinicao expirado ou invalido."
        );
      }

      await transaction.user.update({
        data: { passwordHash },
        where: { id: resetToken.userId }
      });

      await transaction.refreshSession.updateMany({
        data: { revokedAt: now },
        where: {
          revokedAt: null,
          userId: resetToken.userId
        }
      });
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.status !== "active") {
      throw new ApiHttpException(401, "AUTH_REQUIRED", "Entre novamente.");
    }

    return this.toAuthUser(user);
  }

  private async createTokens(user: { email: string; id: string }, userAgent?: string): Promise<AuthTokens> {
    return {
      accessToken: await this.tokenService.createAccessToken(user),
      expiresIn: this.tokenService.accessTokenTtlSeconds,
      refreshToken: await this.refreshTokenService.issue(user.id, userAgent)
    };
  }

  private toAuthUser(user: { email: string; id: string; name: string | null }): AuthUser {
    return {
      email: user.email,
      id: user.id,
      ...(user.name ? { name: user.name } : {})
    };
  }
}
