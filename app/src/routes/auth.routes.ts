import express from "express";
import type { RequestHandler } from "express";

import { loginValidator, registerValidator } from "../validators/auth.validators.js";

interface AuthRouteDeps {
  authLimiter: RequestHandler;
  handleAuthRegister: RequestHandler;
  handleAuthLogin: RequestHandler;
  handleAuthLogout: RequestHandler;
}

export function buildAuthRoutes({
  authLimiter,
  handleAuthRegister,
  handleAuthLogin,
  handleAuthLogout,
}: AuthRouteDeps): express.Router {
  const router = express.Router();

  router.post("/register", authLimiter, ...registerValidator, handleAuthRegister);
  router.post("/login", authLimiter, ...loginValidator, handleAuthLogin);
  router.post("/logout", handleAuthLogout);

  return router;
}
