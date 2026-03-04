import type { PrismaClient } from "./PrismaConnection.js";
import type { User as PrismaUser } from "../generated/prisma/client.js";

import type { IUserRepository } from "../interfaces/IUserRepository.js";
import type { SlotUser } from "../types/domain.js";

export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(email: string, passwordHash: string, passwordSalt: string): Promise<number> {
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        passwordSalt,
        balanceUnits: 0,
      },
    });
    return user.id;
  }

  async getUserByEmail(email: string): Promise<SlotUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? this.mapUser(user) : null;
  }

  async getUserById(userId: number): Promise<SlotUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return user ? this.mapUser(user) : null;
  }

  async updateUserStripeCustomer(userId: number, stripeCustomerId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });
  }

  async updateUserDefaultPaymentMethod(
    userId: number,
    paymentMethodId: string | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { defaultPaymentMethodId: paymentMethodId },
    });
  }

  async updateUserProfile(userId: number, firstName: string, lastName: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName },
    });
  }

  async updateUserPassword(userId: number, passwordHash: string, passwordSalt: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordSalt },
    });
  }

  async updateUserProfilePicture(userId: number, picturePath: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePicture: picturePath },
    });
  }

  private mapUser(user: PrismaUser): SlotUser {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      balanceUnits: user.balanceUnits,
      stripeCustomerId: user.stripeCustomerId,
      defaultPaymentMethodId: user.defaultPaymentMethodId,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
