import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { loadAppEnv } from "../../../src/lib/env.js";

describe("loadAppEnv", () => {
  const envBackup: Record<string, string | undefined> = {};
  const envKeys = [
    "STRIPE_KEY",
    "STRIPE_SECRET",
    "STRIPE_WEBHOOK_SECRET",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "JWT_COOKIE_MAX_AGE_SECONDS",
    "CORS_ALLOWED_ORIGINS",
    "SESSION_TTL_SECONDS",
    "NODE_ENV",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (envBackup[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = envBackup[key];
      }
    }
  });

  it("returns defaults when env vars are not set", () => {
    const env = loadAppEnv();
    expect(env.STRIPE_KEY).toBe("");
    expect(env.STRIPE_SECRET).toBe("");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("");
    expect(env.JWT_SECRET).toBe("");
    expect(env.JWT_EXPIRES_IN).toBe("14d");
    expect(env.JWT_COOKIE_MAX_AGE_SECONDS).toBe("");
    expect(env.CORS_ALLOWED_ORIGINS).toBe("");
    expect(env.SESSION_TTL_SECONDS).toBe("");
    expect(env.NODE_ENV).toBe("development");
  });

  it("reads JWT_SECRET from process.env", () => {
    process.env.JWT_SECRET = "my-super-secret";
    const env = loadAppEnv();
    expect(env.JWT_SECRET).toBe("my-super-secret");
  });

  it("reads STRIPE_KEY from process.env", () => {
    process.env.STRIPE_KEY = "pk_test_123";
    const env = loadAppEnv();
    expect(env.STRIPE_KEY).toBe("pk_test_123");
  });

  it("reads NODE_ENV from process.env", () => {
    process.env.NODE_ENV = "production";
    const env = loadAppEnv();
    expect(env.NODE_ENV).toBe("production");
  });

  it("reads all values when all env vars are set", () => {
    process.env.STRIPE_KEY = "pk_live_abc";
    process.env.STRIPE_SECRET = "sk_live_abc";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_abc";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.JWT_EXPIRES_IN = "7d";
    process.env.JWT_COOKIE_MAX_AGE_SECONDS = "604800";
    process.env.CORS_ALLOWED_ORIGINS = "https://example.com";
    process.env.SESSION_TTL_SECONDS = "3600";
    process.env.NODE_ENV = "production";

    const env = loadAppEnv();
    expect(env.STRIPE_KEY).toBe("pk_live_abc");
    expect(env.STRIPE_SECRET).toBe("sk_live_abc");
    expect(env.STRIPE_WEBHOOK_SECRET).toBe("whsec_abc");
    expect(env.JWT_SECRET).toBe("jwt-secret");
    expect(env.JWT_EXPIRES_IN).toBe("7d");
    expect(env.JWT_COOKIE_MAX_AGE_SECONDS).toBe("604800");
    expect(env.CORS_ALLOWED_ORIGINS).toBe("https://example.com");
    expect(env.SESSION_TTL_SECONDS).toBe("3600");
    expect(env.NODE_ENV).toBe("production");
  });

  it("returns AppEnv interface with all expected keys", () => {
    const env = loadAppEnv();
    const keys = Object.keys(env);
    expect(keys).toContain("STRIPE_KEY");
    expect(keys).toContain("STRIPE_SECRET");
    expect(keys).toContain("STRIPE_WEBHOOK_SECRET");
    expect(keys).toContain("JWT_SECRET");
    expect(keys).toContain("JWT_EXPIRES_IN");
    expect(keys).toContain("JWT_COOKIE_MAX_AGE_SECONDS");
    expect(keys).toContain("CORS_ALLOWED_ORIGINS");
    expect(keys).toContain("SESSION_TTL_SECONDS");
    expect(keys).toContain("NODE_ENV");
  });
});
