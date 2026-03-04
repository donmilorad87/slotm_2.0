import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { parseCookies, serializeCookie } from "../lib/cookies.js";
import { isJwtUserPayload, type RequestAuthState, type SlotUser } from "../types/domain.js";

interface JwtMiddlewareStore {
  getUserById(userId: number): Promise<SlotUser | null>;
}

interface CreateJwtAuthMiddlewaresOptions {
  store: JwtMiddlewareStore;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtCookie: string;
  jwtCookieMaxAgeSeconds: number;
  defaultJwtTtlSeconds: number;
  nodeEnv: string;
}

interface JwtAuthMiddlewares {
  optionalJwt: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  requireJwt: (req: Request, res: Response, next: NextFunction) => Promise<void>;
  setJwtCookie: (req: Request, res: Response, token: string) => void;
  clearJwtCookie: (req: Request, res: Response) => void;
}

function normalizeJwtPayload(payloadRaw: string | jwt.JwtPayload): jwt.JwtPayload | null {
  if (typeof payloadRaw === "string") {
    return null;
  }
  return payloadRaw;
}

function appendSetCookieHeader(res: Response, value: string): void {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) {
    res.setHeader("Set-Cookie", value);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader("Set-Cookie", [...prev, value]);
    return;
  }
  res.setHeader("Set-Cookie", [String(prev), value]);
}

export function createJwtAuthMiddlewares({
  store,
  jwtSecret,
  jwtIssuer,
  jwtAudience,
  jwtCookie,
  jwtCookieMaxAgeSeconds,
  defaultJwtTtlSeconds,
  nodeEnv,
}: CreateJwtAuthMiddlewaresOptions): JwtAuthMiddlewares {
  function getCookieSecurity(req: Request): boolean {
    if (nodeEnv !== "production") {
      return false;
    }

    const forwardedProto = req.headers["x-forwarded-proto"];
    const proto = Array.isArray(forwardedProto)
      ? String(forwardedProto[0] || "")
      : String(forwardedProto || req.protocol || "");

    return proto.split(",")[0]?.trim() === "https";
  }

  function setJwtCookie(req: Request, res: Response, token: string): void {
    appendSetCookieHeader(
      res,
      serializeCookie(jwtCookie, token, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: Number.isFinite(jwtCookieMaxAgeSeconds)
          ? jwtCookieMaxAgeSeconds
          : defaultJwtTtlSeconds,
        secure: getCookieSecurity(req),
      }),
    );
  }

  function clearJwtCookie(req: Request, res: Response): void {
    appendSetCookieHeader(
      res,
      serializeCookie(jwtCookie, "", {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 0,
        secure: getCookieSecurity(req),
      }),
    );
  }

  function extractJwtToken(req: Request): string {
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string") {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    }

    const cookies = parseCookies(req.headers.cookie || "");
    return cookies[jwtCookie] || "";
  }

  async function resolveJwtAuth(req: Request): Promise<RequestAuthState> {
    const token = extractJwtToken(req);
    if (!token) {
      return { user: null, token: "", payload: null, invalidToken: false };
    }

    try {
      const payloadRaw = jwt.verify(token, jwtSecret, {
        issuer: jwtIssuer,
        audience: jwtAudience,
      });
      const payload = normalizeJwtPayload(payloadRaw);
      const userId = Number.parseInt(String(payload?.sub || "0"), 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return { user: null, token, payload: null, invalidToken: true };
      }

      const user = await store.getUserById(userId);
      if (!user || !isJwtUserPayload(payload)) {
        return { user: null, token, payload: null, invalidToken: true };
      }

      return {
        user,
        token,
        payload,
        invalidToken: false,
      };
    } catch (_: unknown) {
      return { user: null, token, payload: null, invalidToken: true };
    }
  }

  async function optionalJwt(req: Request, _res: Response, next: NextFunction): Promise<void> {
    req.auth = await resolveJwtAuth(req);
    next();
  }

  async function requireJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
    const auth = await resolveJwtAuth(req);
    req.auth = auth;

    if (auth.user) {
      next();
      return;
    }

    if (auth.invalidToken) {
      clearJwtCookie(req, res);
    }

    if (req.path.startsWith("/api/")) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const nextPath = encodeURIComponent(req.originalUrl || "/");
    res.redirect(`/login?next=${nextPath}`);
  }

  return {
    optionalJwt,
    requireJwt,
    setJwtCookie,
    clearJwtCookie,
  };
}
