import { body, query } from "express-validator";

import { validatorDecorator } from "./decorator.js";

export const slotActionValidator = validatorDecorator([
  body("action")
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage("action is required"),
]);

export const slotHistoryQueryValidator = validatorDecorator([
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be an integer >= 1")
    .toInt(),
]);
