import { SignJWT } from "jose";

import { TokenService } from "../src/auth/token.service";
import type { AppConfig } from "../src/config/env.schema";

const config: AppConfig = {
  AI_BASE_URL: "https://example.test",
  AI_MODEL: "test-model",
  CORS_ALLOWED_ORIGINS: ["http://localhost:*"],
  DATABASE_URL: "postgresql://example",
  IDENTIFICATION_CONFIDENCE_MIN: 0.72,
  IDENTITY_HASH_SECRET: "identity-secret-for-tests",
  JWT_ACCESS_SECRET: "access-secret-for-tests",
  JWT_AUDIENCE: "linvo-ai-extension",
  JWT_ISSUER: "linvo-ai-server",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests",
  NODE_ENV: "test",
  PASSWORD_PEPPER: "password-pepper-for-tests",
  PORT: 8791
};

const secret = new TextEncoder().encode(config.JWT_ACCESS_SECRET);

describe("TokenService", () => {
  it("verifies a valid access token", async () => {
    const service = new TokenService(config);
    const token = await service.createAccessToken({
      email: "user@example.com",
      id: "user-1"
    });

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      email: "user@example.com",
      id: "user-1"
    });
  });

  it("rejects tampered access tokens", async () => {
    const service = new TokenService(config);
    const token = await service.createAccessToken({
      email: "user@example.com",
      id: "user-1"
    });
    const tampered = `${token.slice(0, -1)}x`;

    await expect(service.verifyAccessToken(tampered)).resolves.toBeNull();
  });

  it("rejects expired access tokens", async () => {
    const service = new TokenService(config);
    const token = await new SignJWT({ email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("user-1")
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);

    await expect(service.verifyAccessToken(token)).resolves.toBeNull();
  });

  it("rejects access tokens with the wrong audience or issuer", async () => {
    const service = new TokenService(config);
    const token = await new SignJWT({ email: "user@example.com" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject("user-1")
      .setIssuer("wrong-issuer")
      .setAudience("wrong-audience")
      .setExpirationTime("15m")
      .sign(secret);

    await expect(service.verifyAccessToken(token)).resolves.toBeNull();
  });
});
