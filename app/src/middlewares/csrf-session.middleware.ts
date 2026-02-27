import type { NextFunction, Request, RequestHandler, Response } from "express";

import { parseCookies, serializeCookie } from "../lib/cookies.js";
import { randomId } from "../lib/security.js";

interface SecuritySessionStoreItem {
  id: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

interface CreateSessionCsrfMiddlewaresOptions {
  nodeEnv: string;
  sessionCookieName: string;
  csrfCookieName: string;
  sessionTtlSeconds: number;
}

interface SessionCsrfMiddlewares {
  ensureSession: RequestHandler;
  requireCsrf: RequestHandler;
  clearSessionCookies: (req: Request, res: Response) => void;
}

const sessionStore = new Map<string, SecuritySessionStoreItem>();
let cleanupTick = 0;

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

function isHttpsRequest(req: Request, nodeEnv: string): boolean {
  if (nodeEnv !== "production") {
    return false;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(forwardedProto)
    ? String(forwardedProto[0] || "")
    : String(forwardedProto || req.protocol || "");
  return proto.split(",")[0]?.trim() === "https";
}

function createSession(nowMs: number, ttlMs: number): SecuritySessionStoreItem {
  return {
    id: randomId(24),
    csrfToken: randomId(32),
    createdAt: nowMs,
    expiresAt: nowMs + ttlMs,
  };
}

function maybeCleanupExpiredSessions(nowMs: number): void {
  cleanupTick += 1;
  if (cleanupTick % 200 !== 0) {
    return;
  }

  for (const [sessionId, session] of sessionStore.entries()) {
    if (session.expiresAt <= nowMs) {
      sessionStore.delete(sessionId);
    }
  }
}

export function createSessionCsrfMiddlewares({
  nodeEnv,
  sessionCookieName,
  csrfCookieName,
  sessionTtlSeconds,
}: CreateSessionCsrfMiddlewaresOptions): SessionCsrfMiddlewares {
  const ttlSeconds = Number.isFinite(sessionTtlSeconds) && sessionTtlSeconds > 0
    ? Math.floor(sessionTtlSeconds)
    : 60 * 60 * 12;
  const ttlMs = ttlSeconds * 1000;

  function setSessionCookies(req: Request, res: Response, session: SecuritySessionStoreItem): void {
    const secure = isHttpsRequest(req, nodeEnv);

    appendSetCookieHeader(
      res,
      serializeCookie(sessionCookieName, session.id, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
        maxAge: ttlSeconds,
      }),
    );

    appendSetCookieHeader(
      res,
      serializeCookie(csrfCookieName, session.csrfToken, {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        secure,
        maxAge: ttlSeconds,
      }),
    );
  }

  const ensureSession: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const nowMs = Date.now();
    maybeCleanupExpiredSessions(nowMs);

    const cookies = parseCookies(req.headers.cookie || "");
    const cookieSessionId = String(cookies[sessionCookieName] || "");

    let session = cookieSessionId ? sessionStore.get(cookieSessionId) || null : null;
    if (!session || session.expiresAt <= nowMs) {
      if (session) {
        sessionStore.delete(session.id);
      }
      session = createSession(nowMs, ttlMs);
      sessionStore.set(session.id, session);
    } else {
      session.expiresAt = nowMs + ttlMs;
    }

    req.securitySession = {
      id: session.id,
      csrfToken: session.csrfToken,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
    };
    req.csrfToken = session.csrfToken;

    setSessionCookies(req, res, session);
    next();
  };

  const requireCsrf: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    const session = req.securitySession;
    if (!session?.csrfToken) {
      res.status(403).json({
        success: false,
        message: "Missing security session",
      });
      return;
    }

    const cookies = parseCookies(req.headers.cookie || "");
    const cookieToken = String(cookies[csrfCookieName] || "");

    const headerTokenRaw = req.headers["x-csrf-token"] || req.headers["csrf-token"];
    const headerToken = Array.isArray(headerTokenRaw)
      ? String(headerTokenRaw[0] || "")
      : String(headerTokenRaw || "");

    if (!cookieToken || !headerToken) {
      res.status(403).json({
        success: false,
        message: "Missing CSRF token",
      });
      return;
    }

    if (cookieToken !== session.csrfToken || headerToken !== session.csrfToken) {
      res.status(403).json({
        success: false,
        message: "Invalid CSRF token",
      });
      return;
    }

    next();
  };

  function clearSessionCookies(req: Request, res: Response): void {
    const secure = isHttpsRequest(req, nodeEnv);
    const cookies = parseCookies(req.headers.cookie || "");
    const sid = String(cookies[sessionCookieName] || "");
    if (sid) {
      sessionStore.delete(sid);
    }

    appendSetCookieHeader(
      res,
      serializeCookie(sessionCookieName, "", {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
        maxAge: 0,
      }),
    );
    appendSetCookieHeader(
      res,
      serializeCookie(csrfCookieName, "", {
        path: "/",
        httpOnly: false,
        sameSite: "Lax",
        secure,
        maxAge: 0,
      }),
    );
  }

  return {
    ensureSession,
    requireCsrf,
    clearSessionCookies,
  };
}

