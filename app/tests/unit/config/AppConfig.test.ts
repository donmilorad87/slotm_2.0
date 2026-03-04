import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { AppConfig } from "../../../src/config/AppConfig.js";
import type { AppEnv } from "../../../src/lib/env.js";

function createTestEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    STRIPE_KEY: "",
    STRIPE_SECRET: "",
    STRIPE_WEBHOOK_SECRET: "",
    JWT_SECRET: "test-jwt-secret-at-least-32-characters",
    JWT_EXPIRES_IN: "14d",
    JWT_COOKIE_MAX_AGE_SECONDS: "",
    CORS_ALLOWED_ORIGINS: "",
    SESSION_TTL_SECONDS: "",
    NODE_ENV: "test",
    ...overrides,
  };
}

describe("AppConfig", () => {
  const envBackup: Record<string, string | undefined> = {};

  beforeEach(() => {
    envBackup.PORT = process.env.PORT;
    envBackup.HOST = process.env.HOST;
    delete process.env.PORT;
    delete process.env.HOST;
  });

  afterEach(() => {
    if (envBackup.PORT === undefined) delete process.env.PORT;
    else process.env.PORT = envBackup.PORT;
    if (envBackup.HOST === undefined) delete process.env.HOST;
    else process.env.HOST = envBackup.HOST;
  });

  it("sets default port to 4300", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.port).toBe(4300);
  });

  it("reads PORT from process.env", () => {
    process.env.PORT = "5000";
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.port).toBe(5000);
  });

  it("sets default host to 0.0.0.0", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.host).toBe("0.0.0.0");
  });

  it("reads HOST from process.env", () => {
    process.env.HOST = "127.0.0.1";
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.host).toBe("127.0.0.1");
  });

  it("sets JWT properties from env", () => {
    const config = new AppConfig(createTestEnv({ JWT_SECRET: "my-secret" }), "/tmp/dist");
    expect(config.jwtSecret).toBe("my-secret");
    expect(config.jwtIssuer).toBe("slotm");
    expect(config.jwtAudience).toBe("slotm-web");
  });

  it("uses fallback JWT secret when not provided", () => {
    const consoleSpy = { warn: console.warn };
    console.warn = () => {};
    const config = new AppConfig(createTestEnv({ JWT_SECRET: "" }), "/tmp/dist");
    expect(config.jwtSecret).toBe("dev-jwt-secret-change-me");
    console.warn = consoleSpy.warn;
  });

  it("sets cookie names", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.jwtCookie).toBe("slotm_jwt");
    expect(config.sessionCookie).toBe("slotm_sid");
    expect(config.csrfCookie).toBe("slotm_csrf");
  });

  it("sets stripe properties from env", () => {
    const config = new AppConfig(
      createTestEnv({
        STRIPE_KEY: "pk_test",
        STRIPE_SECRET: "sk_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
      }),
      "/tmp/dist",
    );
    expect(config.stripePublicKey).toBe("pk_test");
    expect(config.stripeSecret).toBe("sk_test");
    expect(config.stripeWebhookSecret).toBe("whsec_test");
  });

  it("derives directory paths from distDir", () => {
    const config = new AppConfig(createTestEnv(), "/app/dist");
    expect(config.distDir).toBe("/app/dist");
    expect(config.templateDir).toBe("/app/dist/views");
    expect(config.clientDir).toBe("/app/dist/client");
    expect(config.clientStylesDir).toBe("/app/dist/client/styles");
    expect(config.clientImagesDir).toBe("/app/dist/client/images");
    expect(config.uploadsDir).toBe("/app/uploads");
  });

  it("sets page sizes", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.historyPageSize).toBe(20);
    expect(config.walletTxPageSize).toBe(20);
  });

  it("sets upload limits", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.maxUploadSize).toBe(2 * 1024 * 1024);
    expect(config.allowedMimeTypes.has("image/jpeg")).toBe(true);
    expect(config.allowedMimeTypes.has("image/png")).toBe(true);
    expect(config.allowedMimeTypes.has("image/gif")).toBe(true);
    expect(config.allowedMimeTypes.has("image/webp")).toBe(true);
    expect(config.allowedMimeTypes.has("application/pdf")).toBe(false);
  });

  it("parses JWT_COOKIE_MAX_AGE_SECONDS", () => {
    const config = new AppConfig(
      createTestEnv({ JWT_COOKIE_MAX_AGE_SECONDS: "7200" }),
      "/tmp/dist",
    );
    expect(config.jwtCookieMaxAgeSeconds).toBe(7200);
  });

  it("uses default JWT TTL when not specified", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.defaultJwtTtlSeconds).toBe(60 * 60 * 24 * 14);
  });

  it("parses SESSION_TTL_SECONDS", () => {
    const config = new AppConfig(
      createTestEnv({ SESSION_TTL_SECONDS: "1800" }),
      "/tmp/dist",
    );
    expect(config.sessionTtlSeconds).toBe(1800);
  });
});

describe("AppConfig.normalizeOrigin", () => {
  it("removes trailing slashes", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.normalizeOrigin("https://example.com/")).toBe("https://example.com");
  });

  it("removes multiple trailing slashes", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.normalizeOrigin("https://example.com///")).toBe("https://example.com");
  });

  it("trims whitespace", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.normalizeOrigin("  https://example.com  ")).toBe("https://example.com");
  });

  it("returns unchanged origin without trailing slash", () => {
    const config = new AppConfig(createTestEnv(), "/tmp/dist");
    expect(config.normalizeOrigin("https://example.com")).toBe("https://example.com");
  });
});

describe("AppConfig.resolveDistDir", () => {
  it("resolves dist directory from meta URL", () => {
    const result = AppConfig.resolveDistDir(import.meta.url);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns directory path (not file path)", () => {
    const result = AppConfig.resolveDistDir(import.meta.url);
    expect(result).not.toMatch(/\.ts$/);
  });
});

describe("AppConfig CORS parsing", () => {
  it("includes default origins when CORS_ALLOWED_ORIGINS is empty", () => {
    const config = new AppConfig(createTestEnv({ CORS_ALLOWED_ORIGINS: "" }), "/tmp/dist");
    expect(config.corsAllowedOrigins.has("https://blazingsun.local")).toBe(true);
    expect(config.corsAllowedOrigins.has("http://blazingsun.local")).toBe(true);
  });

  it("includes custom origins alongside defaults", () => {
    const config = new AppConfig(
      createTestEnv({ CORS_ALLOWED_ORIGINS: "https://custom.com,https://another.com" }),
      "/tmp/dist",
    );
    expect(config.corsAllowedOrigins.has("https://custom.com")).toBe(true);
    expect(config.corsAllowedOrigins.has("https://another.com")).toBe(true);
    expect(config.corsAllowedOrigins.has("https://blazingsun.local")).toBe(true);
  });

  it("normalizes origins (removes trailing slashes)", () => {
    const config = new AppConfig(
      createTestEnv({ CORS_ALLOWED_ORIGINS: "https://custom.com/" }),
      "/tmp/dist",
    );
    expect(config.corsAllowedOrigins.has("https://custom.com")).toBe(true);
  });
});
