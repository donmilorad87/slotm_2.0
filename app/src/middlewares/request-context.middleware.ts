import type { NextFunction, Request, Response } from "express";

import { randomId } from "../lib/security.js";

export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  req.requestId = randomId(8);
  res.setHeader("X-Request-Id", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
}
