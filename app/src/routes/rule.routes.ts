import express from "express";
import type { RequestHandler } from "express";

interface RuleRouteDeps {
  requireJwt: RequestHandler;
  handleListRules: RequestHandler;
  handleCreateRule: RequestHandler;
  handleUpdateRule: RequestHandler;
  handleDeleteRule: RequestHandler;
}

export function buildRuleRoutes({
  requireJwt,
  handleListRules,
  handleCreateRule,
  handleUpdateRule,
  handleDeleteRule,
}: RuleRouteDeps): express.Router {
  const router = express.Router();

  router.get("/", requireJwt, handleListRules);
  router.post("/", requireJwt, handleCreateRule);
  router.post("/:id/delete", requireJwt, handleDeleteRule);
  router.post("/:id", requireJwt, handleUpdateRule);

  return router;
}
