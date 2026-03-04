import type { SlotUser } from "../types/domain.js";

export interface IUserRepository {
  createUser(email: string, hash: string, salt: string): Promise<number>;
  getUserByEmail(email: string): Promise<SlotUser | null>;
  getUserById(userId: number): Promise<SlotUser | null>;
  updateUserStripeCustomer(userId: number, customerId: string): Promise<void>;
  updateUserDefaultPaymentMethod(userId: number, methodId: string | null): Promise<void>;
  updateUserProfile(userId: number, firstName: string, lastName: string): Promise<void>;
  updateUserPassword(userId: number, hash: string, salt: string): Promise<void>;
  updateUserProfilePicture(userId: number, path: string): Promise<void>;
}
