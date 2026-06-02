import { ApiHttpException } from "../src/http-error";
import { AuthService } from "../src/auth/auth.service";
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

function createService(overrides: Record<string, unknown> = {}) {
  const passwordService = {
    hashPassword: vi.fn().mockResolvedValue("hashed-password"),
    verifyPassword: vi.fn()
  };
  const tokenService = {
    accessTokenTtlSeconds: 900,
    createAccessToken: vi.fn(),
    createPasswordResetCode: vi.fn().mockReturnValue("123456"),
    getPasswordResetTokenExpiry: vi.fn().mockReturnValue(new Date("2030-01-01T00:00:00.000Z")),
    hashPasswordResetCode: vi.fn().mockReturnValue("hashed-reset-code")
  };
  const prisma = {
    $transaction: vi.fn(async (input: unknown) =>
      Array.isArray(input)
        ? Promise.all(input)
        : (input as (transaction: typeof prisma) => Promise<unknown>)(prisma)
    ),
    passwordResetToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    refreshSession: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 })
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn().mockResolvedValue({})
    },
    ...overrides
  };
  const service = new AuthService(
    passwordService as never,
    config,
    prisma as never,
    {} as never,
    tokenService as never
  );

  return { passwordService, prisma, service, tokenService };
}

describe("AuthService password reset", () => {
  it("returns ok without revealing whether the email exists", async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.requestPasswordReset({ email: "missing@example.com" }))
      .resolves
      .toEqual({ status: "ok" });
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("creates a reset code and returns it outside production", async () => {
    const { prisma, service } = createService();
    prisma.user.findUnique.mockResolvedValue({
      email: "user@example.com",
      id: "user-1",
      status: "active"
    });

    await expect(service.requestPasswordReset({ email: "user@example.com" }))
      .resolves
      .toEqual({
        resetCode: "123456",
        status: "ok"
      });
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      data: { usedAt: expect.any(Date) },
      where: {
        usedAt: null,
        userId: "user-1"
      }
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
        tokenHash: "hashed-reset-code",
        userId: "user-1"
      }
    });
  });

  it("resets the password and revokes active sessions", async () => {
    const { passwordService, prisma, service } = createService();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      id: "reset-token-1",
      usedAt: null,
      user: { status: "active" },
      userId: "user-1"
    });

    await expect(service.resetPassword({
      password: "new-password",
      resetCode: "123456"
    })).resolves.toBeUndefined();

    expect(passwordService.hashPassword).toHaveBeenCalledWith("new-password");
    expect(prisma.user.update).toHaveBeenCalledWith({
      data: { passwordHash: "hashed-password" },
      where: { id: "user-1" }
    });
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: {
        revokedAt: null,
        userId: "user-1"
      }
    });
  });

  it("rejects invalid or expired reset tokens", async () => {
    const { prisma, service } = createService();
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);

    await expect(service.resetPassword({
      password: "new-password",
      resetCode: "000000"
    })).rejects.toBeInstanceOf(ApiHttpException);
  });
});
