import type { Request, RequestHandler, Response } from "express";
import type { ParsedQs } from "qs";

import { toErrorMessage } from "../lib/payloadParsers.js";
import type { RequestAuthWithUser, SlotUser } from "../types/domain.js";

export { toErrorMessage };

/** Derived type: the shape returned by userTemplateData(). */
export type UserTemplateData = ReturnType<BaseController["userTemplateData"]>;

export abstract class BaseController {
  protected jsonHandler(
    fn: (req: Request, res: Response) => Promise<void>,
  ): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Request failed"),
        });
      }
    };
  }

  protected pageHandler(
    fn: (req: Request, res: Response) => Promise<void>,
  ): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        await fn(req, res);
      } catch (error: unknown) {
        res.status(500).json({
          success: false,
          message: toErrorMessage(error, "Failed to render page"),
        });
      }
    };
  }

  protected requireAuthUser(req: Request): RequestAuthWithUser {
    const auth = req.auth;
    if (!auth?.user || !auth.payload || auth.invalidToken) {
      throw new Error("Unauthorized");
    }
    return { user: auth.user, token: auth.token, payload: auth.payload, invalidToken: false };
  }

  protected sanitizeRedirectTarget(value: unknown, fallback = "/"): string {
    if (!value || typeof value !== "string") {
      return fallback;
    }
    if (!value.startsWith("/")) {
      return fallback;
    }
    if (value.startsWith("//")) {
      return fallback;
    }
    return value;
  }

  protected queryString(
    query: ParsedQs | Record<string, unknown> | undefined,
    key: string,
  ): string {
    const value = query?.[key];
    if (Array.isArray(value)) {
      return String(value[0] || "");
    }
    return String(value || "");
  }

  protected toInt(value: unknown, fallback = 0): number {
    const parsed = Number.parseInt(String(value ?? fallback), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  protected userInitials(user: SlotUser): string {
    const first = (user.firstName || "").trim();
    const last = (user.lastName || "").trim();
    if (first.length > 0 && last.length > 0) {
      return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }
    if (first.length > 0) {
      return first.slice(0, 2).toUpperCase();
    }
    return (user.email || "?").slice(0, 2).toUpperCase();
  }

  protected userTemplateData(user: SlotUser): Record<string, string> {
    return {
      user_email: user.email,
      user_first_name: user.firstName || "",
      user_last_name: user.lastName || "",
      user_profile_picture: user.profilePicture || "",
      user_initials: this.userInitials(user),
    };
  }
}
