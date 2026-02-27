import type { RequestAuthState } from "./domain.js";

interface RequestSecuritySession {
  id: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: RequestAuthState;
      securitySession?: RequestSecuritySession;
      csrfToken?: string;
    }
  }
}

export {};
