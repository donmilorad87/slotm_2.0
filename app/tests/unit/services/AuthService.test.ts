import { describe, it, expect, beforeEach } from "@jest/globals";
import { AuthService, AuthValidationError, AuthCredentialsError } from "../../../src/services/AuthService.js";
import { createMockUserRepo, createTestConfig, createTestUser } from "../helpers/mockFactories.js";
import { hashPassword } from "../../../src/lib/security.js";
import jwt from "jsonwebtoken";

import type { jest } from "@jest/globals";
import type { IUserRepository } from "../../../src/interfaces/IUserRepository.js";
import type { AppConfig } from "../../../src/config/AppConfig.js";

let userRepo: jest.Mocked<IUserRepository>;
let config: AppConfig;
let service: AuthService;

beforeEach(() => {
  userRepo = createMockUserRepo();
  config = createTestConfig();
  service = new AuthService(userRepo, config);
});

describe("AuthService.register", () => {
  it("creates user and returns token + redirect", async () => {
    userRepo.getUserByEmail.mockResolvedValue(null);
    userRepo.createUser.mockResolvedValue(42);
    userRepo.getUserById.mockResolvedValue(createTestUser({ id: 42, email: "new@test.com" }));

    const result = await service.register("new@test.com", "password123", "/home");
    expect(result.redirect).toBe("/home");
    expect(typeof result.token).toBe("string");
    expect(userRepo.createUser).toHaveBeenCalledTimes(1);
  });

  it("normalizes email to lowercase", async () => {
    userRepo.getUserByEmail.mockResolvedValue(null);
    userRepo.createUser.mockResolvedValue(1);
    userRepo.getUserById.mockResolvedValue(createTestUser({ email: "test@example.com" }));

    await service.register("  TEST@EXAMPLE.COM  ", "password123", "/");
    expect(userRepo.getUserByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("throws AuthValidationError for invalid email (no @)", async () => {
    await expect(service.register("invalidemail", "password123", "/")).rejects.toThrow(
      AuthValidationError,
    );
  });

  it("throws AuthValidationError for empty email", async () => {
    await expect(service.register("", "password123", "/")).rejects.toThrow(
      AuthValidationError,
    );
  });

  it("throws AuthValidationError for short password", async () => {
    await expect(service.register("test@test.com", "12345", "/")).rejects.toThrow(
      AuthValidationError,
    );
  });

  it("throws AuthValidationError for duplicate email", async () => {
    userRepo.getUserByEmail.mockResolvedValue(createTestUser());
    await expect(service.register("test@example.com", "password123", "/")).rejects.toThrow(
      AuthValidationError,
    );
  });

  it("throws when created user cannot be loaded", async () => {
    userRepo.getUserByEmail.mockResolvedValue(null);
    userRepo.createUser.mockResolvedValue(99);
    userRepo.getUserById.mockResolvedValue(null);

    await expect(service.register("test@test.com", "password123", "/")).rejects.toThrow(
      "Failed to load created user",
    );
  });
});

describe("AuthService.login", () => {
  it("returns token and redirect for valid credentials", async () => {
    const pw = hashPassword("correctPassword");
    userRepo.getUserByEmail.mockResolvedValue(
      createTestUser({ passwordHash: pw.hash, passwordSalt: pw.salt }),
    );

    const result = await service.login("test@example.com", "correctPassword", "/dashboard");
    expect(result.redirect).toBe("/dashboard");
    expect(typeof result.token).toBe("string");
  });

  it("normalizes email to lowercase", async () => {
    const pw = hashPassword("pass123");
    userRepo.getUserByEmail.mockResolvedValue(
      createTestUser({ passwordHash: pw.hash, passwordSalt: pw.salt }),
    );

    await service.login("  TEST@EXAMPLE.COM  ", "pass123", "/");
    expect(userRepo.getUserByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("throws AuthCredentialsError for unknown email", async () => {
    userRepo.getUserByEmail.mockResolvedValue(null);
    await expect(service.login("nobody@test.com", "password", "/")).rejects.toThrow(
      AuthCredentialsError,
    );
  });

  it("throws AuthCredentialsError for wrong password", async () => {
    const pw = hashPassword("correctPassword");
    userRepo.getUserByEmail.mockResolvedValue(
      createTestUser({ passwordHash: pw.hash, passwordSalt: pw.salt }),
    );
    await expect(service.login("test@example.com", "wrongPassword", "/")).rejects.toThrow(
      AuthCredentialsError,
    );
  });
});

describe("AuthService.issueJwtToken", () => {
  it("produces a valid JWT with correct claims", () => {
    const user = createTestUser({ id: 42, email: "user@test.com" });
    const token = service.issueJwtToken(user);
    const decoded = jwt.verify(token, config.jwtSecret) as Record<string, unknown>;

    expect(decoded.sub).toBe("42");
    expect(decoded.email).toBe("user@test.com");
    expect(decoded.iss).toBe("slotm");
    expect(decoded.aud).toBe("slotm-web");
  });

  it("token is a non-empty string", () => {
    const token = service.issueJwtToken(createTestUser());
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });
});
