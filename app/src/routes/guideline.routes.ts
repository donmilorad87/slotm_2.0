import express from "express";
import type { RequestHandler } from "express";

interface GuidelineRouteDeps {
  requireJwt: RequestHandler;
  handleGetGuidelines: RequestHandler;
  handleUpdateGuidelines: RequestHandler;
}

export function buildGuidelineRoutes({
  requireJwt,
  handleGetGuidelines,
  handleUpdateGuidelines,
}: GuidelineRouteDeps): express.Router {
  const router = express.Router();

  router.get("/", requireJwt, handleGetGuidelines);
  router.post("/", requireJwt, handleUpdateGuidelines);

  return router;
}
