import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    next();
    return;
  }

  const list = errors.array({ onlyFirstError: true });
  const first = list[0];

  res.status(400).json({
    success: false,
    message: first?.msg || "Validation failed",
    errors: list,
  });
}
