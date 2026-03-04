import type { Request, RequestHandler, Response } from "express";

import type { AuthService } from "../services/AuthService.js";
import { AuthCredentialsError } from "../services/AuthService.js";
import { asObject } from "../lib/payloadParsers.js";
import type { AuthRedirectData } from "../types/domain.js";
import { BaseController, toErrorMessage } from "./BaseController.js";

interface SetJwtCookieFn {
  (req: Request, res: Response, token: string): void;
}

interface ClearCookiesFn {
  (req: Request, res: Response): void;
}

interface AuthRequestBody {
  email?: unknown;
  password?: unknown;
  next?: unknown;
}

export class AuthController extends BaseController {
  constructor(
    private readonly authService: AuthService,
    private readonly setJwtCookie: SetJwtCookieFn,
    private readonly clearJwtCookie: ClearCookiesFn,
    private readonly clearSessionCookies: ClearCookiesFn,
  ) {
    super();
  }

  get handleRegister(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const payload = asObject<AuthRequestBody>(req.body);
        const email = String(payload.email || "");
        const password = String(payload.password || "");
        const next = this.sanitizeRedirectTarget(payload.next, "/");

        const result = await this.authService.register(email, password, next);
        this.setJwtCookie(req, res, result.token);
        const data: AuthRedirectData = { redirect: result.redirect, token: result.token };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Register failed"),
        });
      }
    });
  }

  get handleLogin(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const payload = asObject<AuthRequestBody>(req.body);
        const email = String(payload.email || "");
        const password = String(payload.password || "");
        const next = this.sanitizeRedirectTarget(payload.next, "/");

        const result = await this.authService.login(email, password, next);
        this.setJwtCookie(req, res, result.token);
        const data: AuthRedirectData = { redirect: result.redirect, token: result.token };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        const status = error instanceof AuthCredentialsError ? 401 : 400;
        res.status(status).json({
          success: false,
          message: toErrorMessage(error, "Login failed"),
        });
      }
    });
  }

  get handleLogout(): RequestHandler {
    return (req: Request, res: Response) => {
      this.clearJwtCookie(req, res);
      this.clearSessionCookies(req, res);
      res.status(200).json({ success: true, data: { redirect: "/login" } });
    };
  }

  get handleLogoutPage(): RequestHandler {
    return (req: Request, res: Response) => {
      this.clearJwtCookie(req, res);
      this.clearSessionCookies(req, res);
      res.redirect("/login");
    };
  }
}
