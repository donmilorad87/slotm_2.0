import type { Request, RequestHandler, Response } from "express";

import type { ProfileService } from "../services/ProfileService.js";
import { asObject } from "../lib/payloadParsers.js";
import { BaseController, toErrorMessage } from "./BaseController.js";

interface ProfileUpdateBody {
  firstName?: unknown;
  lastName?: unknown;
}

interface PasswordChangeBody {
  currentPassword?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
}

export class ProfileController extends BaseController {
  constructor(private readonly profileService: ProfileService) {
    super();
  }

  get handleUpdateProfile(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const payload = asObject<ProfileUpdateBody>(req.body);
        const result = await this.profileService.updateProfile(
          auth.user.id,
          String(payload.firstName || ""),
          String(payload.lastName || ""),
        );
        res.status(200).json({ success: true, data: result });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to update profile"),
        });
      }
    });
  }

  get handleChangePassword(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const payload = asObject<PasswordChangeBody>(req.body);
        await this.profileService.changePassword(
          auth.user.id,
          String(payload.currentPassword || ""),
          String(payload.newPassword || ""),
          String(payload.confirmPassword || ""),
        );
        res.status(200).json({
          success: true,
          data: { message: "Password changed successfully" },
        });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to change password"),
        });
      }
    });
  }

  get handleUploadProfilePicture(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const file = req.file;
        if (!file) {
          res.status(400).json({ success: false, message: "No file uploaded" });
          return;
        }
        const result = await this.profileService.uploadProfilePicture(
          auth.user.id,
          file.filename,
        );
        res.status(200).json({ success: true, data: result });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Failed to upload profile picture"),
        });
      }
    });
  }
}
