import { body, query } from "express-validator";

import { validatorDecorator } from "./decorator.js";

export const createCheckoutSessionValidator = validatorDecorator([
  body("amountCoins")
    .isInt({ min: 1, max: 100000 })
    .withMessage("Invalid top-up amount")
    .toInt(),
  body("returnTo").optional().isString(),
]);

export const createSetupSessionValidator = validatorDecorator([
  body("returnTo").optional().isString(),
]);

export const removeCardValidator = validatorDecorator([
  body("paymentMethodId")
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage("paymentMethodId is required"),
]);

export const walletTransactionsQueryValidator = validatorDecorator([
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be an integer >= 1")
    .toInt(),
]);
