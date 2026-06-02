import { Inject, Injectable } from "@nestjs/common";
import { createHmac, randomBytes, randomInt } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import type { AuthenticatedUser } from "./auth.types";

@Injectable()
export class TokenService {
  readonly accessTokenTtlSeconds = 15 * 60;
  readonly passwordResetTokenTtlMinutes = 30;
  readonly refreshTokenTtlDays = 30;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async createAccessToken(user: AuthenticatedUser): Promise<string> {
    return new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuedAt()
      .setIssuer(this.config.JWT_ISSUER)
      .setAudience(this.config.JWT_AUDIENCE)
      .setExpirationTime(`${this.accessTokenTtlSeconds}s`)
      .sign(this.accessTokenSecret);
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.accessTokenSecret, {
        algorithms: ["HS256"],
        audience: this.config.JWT_AUDIENCE,
        issuer: this.config.JWT_ISSUER
      });

      if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
        return null;
      }

      return {
        email: payload.email,
        id: payload.sub
      };
    } catch {
      return null;
    }
  }

  createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  createPasswordResetCode(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  hashRefreshToken(refreshToken: string): string {
    return createHmac("sha256", this.config.JWT_REFRESH_SECRET)
      .update(refreshToken)
      .digest("base64url");
  }

  hashPasswordResetCode(resetCode: string): string {
    return createHmac("sha256", this.config.JWT_REFRESH_SECRET)
      .update(`password-reset:${resetCode}`)
      .digest("base64url");
  }

  getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    return expiresAt;
  }

  getPasswordResetTokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.passwordResetTokenTtlMinutes);
    return expiresAt;
  }

  private get accessTokenSecret(): Uint8Array {
    return new TextEncoder().encode(this.config.JWT_ACCESS_SECRET);
  }
}
