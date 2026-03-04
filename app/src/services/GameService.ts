import type { IGameRepository } from "../interfaces/IGameRepository.js";
import type { ITransactionRepository } from "../interfaces/ITransactionRepository.js";
import { asObject, toInt, type RawObject } from "../lib/payloadParsers.js";
import type { GameEngineRegistry } from "../game/engines/GameEngineRegistry.js";
import type { GameEngineResult } from "../game/engines/AbstractGameEngine.js";
import { error, success } from "../game/types.js";
import type { UserHistoryItem, UserStats } from "../types/domain.js";

export class GameService {
  constructor(
    private readonly txRepo: ITransactionRepository,
    private readonly gameRepo: IGameRepository,
    private readonly registry: GameEngineRegistry,
  ) {}

  async handleAction(payload: unknown, userId: number): Promise<GameEngineResult> {
    const source = asObject(payload);
    const action = typeof source.action === "string" ? source.action : "";

    if (action === "slot_history") {
      return this.handleHistory(source, userId);
    }

    if (action === "slot_stats") {
      return this.handleStats(userId);
    }

    const engine = this.registry.resolve(action, source);
    if (!engine) {
      return { statusCode: 400, body: error("Invalid action") };
    }

    return engine.execute(source, userId);
  }

  private async handleHistory(
    source: RawObject,
    userId: number,
  ): Promise<
    GameEngineResult<{
      total: number;
      history: UserHistoryItem[];
      page: number;
      total_pages: number;
      has_more: boolean;
    }>
  > {
    const page = Math.max(1, toInt(source.page, 1));
    const limit = 16;
    const skip = (page - 1) * limit;

    const { total, items } = await this.gameRepo.getUserHistory(userId, limit, skip);
    const totalPages = Math.ceil(total / limit);

    return {
      statusCode: 200,
      body: success({
        total,
        history: items,
        page,
        total_pages: totalPages,
        has_more: page < totalPages,
      }),
    };
  }

  private async handleStats(
    userId: number,
  ): Promise<GameEngineResult<UserStats>> {
    return {
      statusCode: 200,
      body: success(await this.gameRepo.getUserStats(userId)),
    };
  }
}
