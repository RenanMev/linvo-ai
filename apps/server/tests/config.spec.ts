import { isAllowedCorsOrigin } from "../src/config/cors";
import { createAppConfig } from "../src/config/env.schema";

const baseEnv = {
  DATABASE_URL: "postgresql://example",
  IDENTITY_HASH_SECRET: "identity-secret-for-tests",
  JWT_ACCESS_SECRET: "access-secret-for-tests",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests",
  PASSWORD_PEPPER: "password-pepper-for-tests"
};

describe("server config", () => {
  it("uses safe development CORS defaults", () => {
    const config = createAppConfig(baseEnv);

    expect(isAllowedCorsOrigin(config, "http://localhost:5173")).toBe(true);
    expect(isAllowedCorsOrigin(config, "http://127.0.0.1:3000")).toBe(true);
    expect(isAllowedCorsOrigin(config, "chrome-extension://abc123")).toBe(true);
    expect(isAllowedCorsOrigin(config, "https://evil.example.com")).toBe(false);
  });

  it("requires explicit CORS origins in production", () => {
    expect(() =>
      createAppConfig({
        ...baseEnv,
        NODE_ENV: "production"
      })
    ).toThrow();
  });

  it("allows configured production origins", () => {
    const config = createAppConfig({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: "https://app.example.com,chrome-extension://abc123",
      NODE_ENV: "production"
    });

    expect(isAllowedCorsOrigin(config, "https://app.example.com/some/path")).toBe(true);
    expect(isAllowedCorsOrigin(config, "chrome-extension://abc123")).toBe(true);
    expect(isAllowedCorsOrigin(config, "chrome-extension://other")).toBe(false);
  });
});
