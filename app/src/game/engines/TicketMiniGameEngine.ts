import {
  executeTicketMinigame,
  type TicketMiniGameRequest,
  type TicketMiniGameResult,
} from "../miniGame.js";
import { asObject, toInt, toErrorMessage } from "../../lib/payloadParsers.js";
import { error, success } from "../types.js";
import { AbstractGameEngine, type GameEngineResult } from "./AbstractGameEngine.js";

/** Mapped type: derive untrusted payload shape from validated interface. */
type RawPayload<T> = { [K in keyof T]?: unknown };

type TicketMiniGamePayload = RawPayload<TicketMiniGameRequest>;

function normalizeTicketRequest(
  payloadRaw: unknown,
  userCoins: number,
): TicketMiniGameRequest {
  const payload = asObject<TicketMiniGamePayload>(payloadRaw);
  const tickets = Array.isArray(payload.tickets)
    ? payload.tickets.map((ticket) =>
        Array.isArray(ticket) ? ticket.map((value) => toInt(value, 0)) : [],
      )
    : [];

  return {
    tickets,
    coin_value: toInt(payload.coin_value, 0),
    user_coins: userCoins,
  };
}

export class TicketMiniGameEngine extends AbstractGameEngine {
  async execute(payload: unknown, userId: number): Promise<GameEngineResult> {
    const userCoins = await this.txRepo.getBalanceCoins(userId);
    const request = normalizeTicketRequest(payload, userCoins);

    let result: TicketMiniGameResult;
    try {
      result = executeTicketMinigame(request);
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
        `Mini-game ticket bet (${result.totalBet} credits)`,
        { mode: "ticket", tickets: request.tickets, coin_value: request.coin_value },
      );
    }

    if (result.totalPayout > 0) {
      await this.recordMiniGameWinTransaction(
        userId,
        result.totalPayout,
        `Mini-game ticket win (${result.totalPayout} credits)`,
        { mode: "ticket", ticket_results: result.ticketResults },
      );
    }

    const newBalance = await this.txRepo.getBalanceCoins(userId);
    const historyId = await this.gameRepo.consumePendingMiniGame(userId);
    await this.gameRepo.attachMiniGameToHistory(historyId, {
      mode: "ticket",
      played: {
        tickets: request.tickets,
        coin_value: request.coin_value,
        ticket_results: result.ticketResults,
      },
      drawnNumbers: result.drawnNumbers,
      totalBet: result.totalBet,
      totalPayout: result.totalPayout,
      netResult: result.netResult,
    });

    return {
      statusCode: 200,
      body: success({
        drawn_numbers: result.drawnNumbers,
        ticket_results: result.ticketResults,
        total_bet: result.totalBet,
        total_payout: result.totalPayout,
        net_result: result.netResult,
        new_balance: newBalance,
      }),
    };
  }
}
