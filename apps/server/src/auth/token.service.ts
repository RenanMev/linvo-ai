import { Inject, Injectable } from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { AppConfig } from "../config/env.schema";
import { APP_CONFIG } from "../config/env.schema";
import type { AuthenticatedUser } from "./auth.types";

interface AccessTokenPayload {
  email: string;
  exp: number;
  sub: string;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function parseJsonBase64Url<T>(value: string): T {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

@Injectable()
export class TokenService {
  readonly accessTokenTtlSeconds = 15 * 60;
  readonly refreshTokenTtlDays = 30;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  createAccessToken(user: AuthenticatedUser): string {
    const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
    const payload = base64UrlJson({
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + this.accessTokenTtlSeconds,
      sub: user.id
    });
    const unsigned = `${header}.${payload}`;

    return `${unsigned}.${sign(unsigned, this.config.JWT_ACCESS_SECRET)}`;
  }

  verifyAccessToken(token: string): AuthenticatedUser | null {
    const [header, payload, signature] = token.split(".");

    if (!header || !payload || !signature) {
      return null;
    }

    const unsigned = `${header}.${payload}`;
    const expected = sign(unsigned, this.config.JWT_ACCESS_SECRET);
    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return null;
    }

    const parsed = parseJsonBase64Url<AccessTokenPayload>(payload);

    if (!parsed.sub || !parsed.email || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      email: parsed.email,
      id: parsed.sub
    };
  }

  createRefreshToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashRefreshToken(refreshToken: string): string {
    return createHmac("sha256", this.config.JWT_REFRESH_SECRET)
      .update(refreshToken)
      .digest("base64url");
  }

  getRefreshTokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenTtlDays);
    return expiresAt;
  }
}
