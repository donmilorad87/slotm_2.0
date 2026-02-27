import express from "express";
import type { RequestHandler } from "express";

import {
  slotActionValidator,
  slotHistoryQueryValidator,
} from "../validators/game.validators.js";

interface GameRouteDeps {
  requireJwt: RequestHandler;
  handleApiGames: RequestHandler;
  handleHistoryApi: RequestHandler;
}

export function buildGameRoutes({
  requireJwt,
  handleApiGames,
  handleHistoryApi,
}: GameRouteDeps): express.Router {
  const router = express.Router();

  router.post("/slot-machine", requireJwt, ...slotActionValidator, handleApiGames);
  router.get(
    "/slot-machine/history",
    requireJwt,
    ...slotHistoryQueryValidator,
    handleHistoryApi,
  );

  return router;
}
