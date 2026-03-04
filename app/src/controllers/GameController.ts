import type { Request, RequestHandler, Response } from "express";

import type { AppConfig } from "../config/AppConfig.js";
import type { IGameRepository } from "../interfaces/IGameRepository.js";
import type { GameService } from "../services/GameService.js";
import type { PaginatedPageData, UserHistoryItem } from "../types/domain.js";
import { BaseController, toErrorMessage } from "./BaseController.js";

export class GameController extends BaseController {
  constructor(
    private readonly gameService: GameService,
    private readonly gameRepo: IGameRepository,
    private readonly config: AppConfig,
  ) {
    super();
  }

  get handleApiGames(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      const auth = this.requireAuthUser(req);
      const result = await this.gameService.handleAction(req.body || {}, auth.user.id);
      res.status(result.statusCode).json(result.body);
    });
  }

  get handleHistoryApi(): RequestHandler {
    return this.jsonHandler(async (req: Request, res: Response) => {
      try {
        const auth = this.requireAuthUser(req);
        const requestedPage = Math.max(
          1,
          this.toInt(this.queryString(req.query, "page"), 1),
        );
        const { total } = await this.gameRepo.getUserHistory(auth.user.id, 1, 0);
        const totalPages = Math.max(1, Math.ceil(total / this.config.historyPageSize));
        const page = Math.min(requestedPage, totalPages);
        const skip = (page - 1) * this.config.historyPageSize;
        const full = await this.gameRepo.getUserHistory(
          auth.user.id,
          this.config.historyPageSize,
          skip,
        );

        const data: PaginatedPageData<UserHistoryItem> = {
          total: full.total,
          items: full.items,
          page,
          total_pages: totalPages,
          has_more: page < totalPages,
        };
        res.status(200).json({ success: true, data });
      } catch (error: unknown) {
        res.status(400).json({
          success: false,
          message: toErrorMessage(error, "Could not load history"),
        });
      }
    });
  }
}
