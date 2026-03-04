import jwt from "jsonwebtoken";

import type { AppConfig } from "../config/AppConfig.js";
import type { IUserRepository } from "../interfaces/IUserRepository.js";
import { hashPassword, verifyPassword } from "../lib/security.js";
import type { SlotUser } from "../types/domain.js";

export interface AuthResult {
  token: string;
  redirect: string;
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly config: AppConfig,
  ) {}

  async register(email: string, password: string, redirectTo: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new AuthValidationError("Valid email is required");
    }
    if (password.length < 6) {
      throw new AuthValidationError("Password must be at least 6 chars");
    }
    if (await this.userRepo.getUserByEmail(normalizedEmail)) {
      throw new AuthValidationError("Email already registered");
    }

    const pw = hashPassword(password);
    const userId = await this.userRepo.createUser(normalizedEmail, pw.hash, pw.salt);
    const user = await this.userRepo.getUserById(userId);
    if (!user) {
      throw new Error("Failed to load created user");
    }

    const token = this.issueJwtToken(user);
    return { token, redirect: redirectTo };
  }

  async login(email: string, password: string, redirectTo: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepo.getUserByEmail(normalizedEmail);

    if (!user || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
      throw new AuthCredentialsError("Invalid credentials");
    }

    const token = this.issueJwtToken(user);
    return { token, redirect: redirectTo };
  }

  issueJwtToken(user: SlotUser): string {
    const signOptions: jwt.SignOptions = {
      issuer: this.config.jwtIssuer,
      audience: this.config.jwtAudience,
    };
    const expiresIn = this.config.jwtExpiresIn;
    if (expiresIn) {
      signOptions.expiresIn = expiresIn as NonNullable<jwt.SignOptions["expiresIn"]>;
    }

    return jwt.sign(
      { sub: String(user.id), email: user.email },
      this.config.jwtSecret,
      signOptions,
    );
  }
}

export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthValidationError";
  }
}

export class AuthCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthCredentialsError";
  }
}
