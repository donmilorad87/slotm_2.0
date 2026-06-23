import express from "express";
import type { RequestHandler } from "express";
import type multer from "multer";

interface ComplianceRouteDeps {
  requireJwt: RequestHandler;
  uploadPptx: multer.Multer;
  handleUpload: RequestHandler;
  handleAnalyze: RequestHandler;
  handleGetReview: RequestHandler;
  handleAcceptFlag: RequestHandler;
  handleRejectFlag: RequestHandler;
  handleApply: RequestHandler;
  handleRescanAi: RequestHandler;
  handleClaudeStatus: RequestHandler;
  handleListSets: RequestHandler;
  handleDeleteSet: RequestHandler;
}

export function buildComplianceRoutes({
  requireJwt,
  uploadPptx,
  handleUpload,
  handleAnalyze,
  handleGetReview,
  handleAcceptFlag,
  handleRejectFlag,
  handleApply,
  handleRescanAi,
  handleClaudeStatus,
  handleListSets,
  handleDeleteSet,
}: ComplianceRouteDeps): express.Router {
  const router = express.Router();

  // Static-path routes must precede the "/:setId" param route.
  router.get("/claude-status", requireJwt, handleClaudeStatus);
  router.get("/sets", requireJwt, handleListSets);
  router.post("/upload", requireJwt, uploadPptx.single("deck"), handleUpload);
  router.post("/flags/:id/accept", requireJwt, handleAcceptFlag);
  router.post("/flags/:id/reject", requireJwt, handleRejectFlag);
  router.post("/:setId/analyze", requireJwt, handleAnalyze);
  router.post("/:setId/apply", requireJwt, handleApply);
  router.post("/:setId/rescan-ai", requireJwt, handleRescanAi);
  router.post("/:setId/delete", requireJwt, handleDeleteSet);
  router.get("/:setId", requireJwt, handleGetReview);

  return router;
}
