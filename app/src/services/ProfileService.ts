import type { IUserRepository } from "../interfaces/IUserRepository.js";
import { hashPassword, verifyPassword } from "../lib/security.js";

export class ProfileService {
  constructor(private readonly userRepo: IUserRepository) {}

  async updateProfile(
    userId: number,
    firstName: string,
    lastName: string,
  ): Promise<{ firstName: string; lastName: string }> {
    const trimmedFirst = firstName.trim().slice(0, 100);
    const trimmedLast = lastName.trim().slice(0, 100);

    await this.userRepo.updateUserProfile(userId, trimmedFirst, trimmedLast);
    return { firstName: trimmedFirst, lastName: trimmedLast };
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<void> {
    if (!currentPassword) {
      throw new ProfileValidationError("Current password is required");
    }
    if (newPassword.length < 6) {
      throw new ProfileValidationError("New password must be at least 6 characters");
    }
    if (newPassword !== confirmPassword) {
      throw new ProfileValidationError("New passwords do not match");
    }

    const freshUser = await this.userRepo.getUserById(userId);
    if (!freshUser) {
      throw new ProfileValidationError("User not found");
    }

    if (!verifyPassword(currentPassword, freshUser.passwordSalt, freshUser.passwordHash)) {
      throw new ProfileValidationError("Current password is incorrect");
    }

    const pw = hashPassword(newPassword);
    await this.userRepo.updateUserPassword(userId, pw.hash, pw.salt);
  }

  async uploadProfilePicture(
    userId: number,
    filename: string,
  ): Promise<{ profilePicture: string }> {
    const picturePath = `/assets/uploads/${filename}`;
    await this.userRepo.updateUserProfilePicture(userId, picturePath);
    return { profilePicture: picturePath };
  }
}

export class ProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationError";
  }
}
