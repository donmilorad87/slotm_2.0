import type { RequestAuthState } from "./domain.js";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: RequestAuthState;
    }
  }
}

export {};
