import {
  executeMinigame,
  type LegacyMiniGameRequest,
  type LegacyMiniGameResult,
} from "../miniGame.js";
import { asObject, toInt, toErrorMessage } from "../../lib/payloadParsers.js";
import { error, success } from "../types.js";
import { AbstractGameEngine, type GameEngineResult } from "./AbstractGameEngine.js";

/** Mapped type: derive untrusted payload shape from validated interface. */
type RawPayload<T> = { [K in keyof T]?: unknown };

type LegacyMiniGamePayload = RawPayload<LegacyMiniGameRequest> & {
  bets?: Array<{ number?: unknown; bet?: unknown }>;
};

function normalizeOldMiniGameRequest(
  payloadRaw: unknown,
  userCoins: number,
): LegacyMiniGameRequest {
  const payload = asObject<LegacyMiniGamePayload>(payloadRaw);
  const bets = Array.isArray(payload.bets)
    ? payload.bets.map((item) => ({
        number: toInt(item?.number, 0),
        bet: toInt(item?.bet, 0),
      }))
    : [];

  return { bets, user_coins: userCoins };
}

export class LegacyMiniGameEngine extends AbstractGameEngine {
  async execute(payload: unknown, userId: number): Promise<GameEngineResult> {
    const userCoins = await this.txRepo.getBalanceCoins(userId);
    const request = normalizeOldMiniGameRequest(payload, userCoins);

    let result: LegacyMiniGameResult;
    try {
      result = executeMinigame(request);
    } catch (validationError: unknown) {
      return {
        statusCode: 400,
        body: error(toErrorMessage(validationError, "Invalid mini-game request")),
      };
    }

    if (result.totalBet > 0) {
      const deductResult = await this.deductBet(userId, result.totalBet);
      if (!deductResult.ok) {
        return { statusCode: 400, body: error(deductResult.message) };
      }

      await this.recordMiniGameBetTransaction(
        userId,
        result.totalBet,
        `Mini-game bet (${result.totalBet} credits)`,
        { mode: "legacy", bets: request.bets },
      );
    }

    if (result.totalPayout > 0) {
      await this.recordMiniGameWinTransaction(
        userId,
        result.totalPayout,
        `Mini-game win (${result.totalPayout} credits)`,
        { mode: "legacy", matches: result.matchesCount },
      );
    }

    const newBalance = await this.txRepo.getBalanceCoins(userId);
    const historyId = await this.gameRepo.consumePendingMiniGame(userId);
    await this.gameRepo.attachMiniGameToHistory(historyId, {
      mode: "legacy",
      played: { number_results: result.numberResults },
      drawnNumbers: result.drawnNumbers,
      totalBet: result.totalBet,
      totalPayout: result.totalPayout,
      netResult: result.netResult,
    });

    return {
      statusCode: 200,
      body: success({
        drawn_numbers: result.drawnNumbers,
        number_results: result.numberResults,
        total_bet: result.totalBet,
        total_payout: result.totalPayout,
        net_result: result.netResult,
        matches_count: result.matchesCount,
        new_balance: newBalance,
        odds_info: result.oddsInfo,
      }),
    };
  }
}
