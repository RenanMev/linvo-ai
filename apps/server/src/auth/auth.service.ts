import { Inject, Injectable } from "@nestjs/common";

import {
  type AuthLoginRequest,
  type AuthRegisterRequest,
  type AuthSessionResponse,
  type AuthTokens,
  type AuthUser
} from "@linvo-ai/shared";

import { ApiHttpException } from "../http-error";
import { PrismaService } from "../prisma/prisma.service";
import { PasswordService } from "./password.service";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
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
      accessToken: this.tokenService.createAccessToken({
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
      accessToken: this.tokenService.createAccessToken(user),
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
