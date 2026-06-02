import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { TokenService } from "./token.service";

@Injectable()
export class RefreshTokenService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(TokenService)
    private readonly tokenService: TokenService
  ) {}

  async issue(userId: string, userAgent?: string): Promise<string> {
    const refreshToken = this.tokenService.createRefreshToken();
    await this.prisma.refreshSession.create({
      data: {
        expiresAt: this.tokenService.getRefreshTokenExpiry(),
        tokenHash: this.tokenService.hashRefreshToken(refreshToken),
        userAgent: userAgent ?? null,
        userId
      }
    });

    return refreshToken;
  }

  async rotate(refreshToken: string): Promise<{ refreshToken: string; userId: string } | null> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      include: { user: true },
      where: { tokenHash }
    });

    const now = new Date();

    if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== "active") {
      return null;
    }

    const nextRefreshToken = this.tokenService.createRefreshToken();
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.refreshSession.updateMany({
        data: { revokedAt: now },
        where: {
          expiresAt: { gt: now },
          id: session.id,
          revokedAt: null
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      await transaction.refreshSession.create({
        data: {
          expiresAt: this.tokenService.getRefreshTokenExpiry(),
          tokenHash: this.tokenService.hashRefreshToken(nextRefreshToken),
          userAgent: session.userAgent ?? null,
          userId: session.userId
        }
      });

      return {
        refreshToken: nextRefreshToken,
        userId: session.userId
      };
    });

    return rotated;
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(refreshToken);
    await this.prisma.refreshSession.updateMany({
      data: { revokedAt: new Date() },
      where: {
        revokedAt: null,
        tokenHash
      }
    });
  }
}
