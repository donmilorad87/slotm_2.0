import { body } from "express-validator";

import { validatorDecorator } from "./decorator.js";

export const registerValidator = validatorDecorator([
  body("email")
    .isString()
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 chars"),
  body("next").optional().isString(),
]);

export const loginValidator = validatorDecorator([
  body("email")
    .isString()
    .trim()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("password")
    .isString()
    .isLength({ min: 1 })
    .withMessage("Password is required"),
  body("next").optional().isString(),
]);
