import type { RequestHandler } from "express";
import type { ValidationChain } from "express-validator";

import { validateRequest } from "../middlewares/validation.middleware.js";

export function validatorDecorator(chains: ValidationChain[] = []): Array<ValidationChain | RequestHandler> {
  return [...chains, validateRequest];
}
