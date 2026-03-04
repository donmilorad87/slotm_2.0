import { describe, it, expect, beforeEach } from "@jest/globals";
import { ProfileService, ProfileValidationError } from "../../../src/services/ProfileService.js";
import { createMockUserRepo, createTestUser } from "../helpers/mockFactories.js";
import { hashPassword } from "../../../src/lib/security.js";

import type { jest } from "@jest/globals";
import type { IUserRepository } from "../../../src/interfaces/IUserRepository.js";

let userRepo: jest.Mocked<IUserRepository>;
let service: ProfileService;

beforeEach(() => {
  userRepo = createMockUserRepo();
  service = new ProfileService(userRepo);
});

describe("ProfileService.updateProfile", () => {
  it("trims and updates names", async () => {
    const result = await service.updateProfile(1, "  John  ", "  Doe  ");
    expect(result.firstName).toBe("John");
    expect(result.lastName).toBe("Doe");
    expect(userRepo.updateUserProfile).toHaveBeenCalledWith(1, "John", "Doe");
  });

  it("truncates names to 100 chars", async () => {
    const longName = "A".repeat(200);
    const result = await service.updateProfile(1, longName, "Short");
    expect(result.firstName).toHaveLength(100);
    expect(result.lastName).toBe("Short");
  });

  it("handles empty strings", async () => {
    const result = await service.updateProfile(1, "", "");
    expect(result.firstName).toBe("");
    expect(result.lastName).toBe("");
  });

  it("calls repo with trimmed values", async () => {
    await service.updateProfile(1, "Alice", "Bob");
    expect(userRepo.updateUserProfile).toHaveBeenCalledTimes(1);
  });
});

describe("ProfileService.changePassword", () => {
  it("changes password when all validations pass", async () => {
    const pw = hashPassword("currentPass");
    userRepo.getUserById.mockResolvedValue(
      createTestUser({ passwordHash: pw.hash, passwordSalt: pw.salt }),
    );

    await service.changePassword(1, "currentPass", "newPassword", "newPassword");
    expect(userRepo.updateUserPassword).toHaveBeenCalledTimes(1);
  });

  it("throws for empty current password", async () => {
    await expect(
      service.changePassword(1, "", "newPassword", "newPassword"),
    ).rejects.toThrow(ProfileValidationError);
  });

  it("throws for short new password", async () => {
    await expect(
      service.changePassword(1, "current", "12345", "12345"),
    ).rejects.toThrow(ProfileValidationError);
  });

  it("throws when new passwords do not match", async () => {
    await expect(
      service.changePassword(1, "current", "newPassword", "differentPassword"),
    ).rejects.toThrow(ProfileValidationError);
  });

  it("throws when user not found", async () => {
    userRepo.getUserById.mockResolvedValue(null);
    await expect(
      service.changePassword(1, "current", "newPassword", "newPassword"),
    ).rejects.toThrow(ProfileValidationError);
  });

  it("throws when current password is incorrect", async () => {
    const pw = hashPassword("actualPassword");
    userRepo.getUserById.mockResolvedValue(
      createTestUser({ passwordHash: pw.hash, passwordSalt: pw.salt }),
    );
    await expect(
      service.changePassword(1, "wrongPassword", "newPass123", "newPass123"),
    ).rejects.toThrow(ProfileValidationError);
  });
});

describe("ProfileService.uploadProfilePicture", () => {
  it("stores path with /assets/uploads/ prefix", async () => {
    const result = await service.uploadProfilePicture(1, "photo.jpg");
    expect(result.profilePicture).toBe("/assets/uploads/photo.jpg");
    expect(userRepo.updateUserProfilePicture).toHaveBeenCalledWith(1, "/assets/uploads/photo.jpg");
  });

  it("calls repo with correct userId", async () => {
    await service.uploadProfilePicture(42, "img.png");
    expect(userRepo.updateUserProfilePicture).toHaveBeenCalledWith(42, "/assets/uploads/img.png");
  });
});
