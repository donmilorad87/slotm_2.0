import { executeSpin } from "../slotMachine.js";
import {
  BALANCE_TO_COIN_RATIO,
  PAYLINE_COUNT,
  error,
  gameModeName,
  isGameModeId,
  kvoteForGameMode,
  rewardModeName,
  success,
  toPhpResponse,
  totalBet,
  validateJoker,
  type PaylineState,
  type PhpResponse,
  type SpinRequest,
} from "../types.js";
import { asObject, toInt } from "../../lib/payloadParsers.js";
import { AbstractGameEngine, type GameEngineResult } from "./AbstractGameEngine.js";

/** Mapped type: derive untrusted payload shape from validated interface. */
type RawPayload<T> = { [K in keyof T]?: unknown };

type SpinPayload = RawPayload<SpinRequest>;

function normalizeLines(rawLines: unknown): PaylineState[] {
  const lines = Array.isArray(rawLines) ? rawLines : [1, 0, 0, 0, 0, 0, 0];
  const normalized = lines
    .slice(0, PAYLINE_COUNT)
    .map((value): PaylineState => (Number(value) === 1 ? 1 : 0));

  while (normalized.length < PAYLINE_COUNT) {
    normalized.push(0);
  }

  return normalized;
}

function normalizeSpinRequest(payloadRaw: unknown): SpinRequest {
  const payload = asObject<SpinPayload>(payloadRaw);
  const nacin = Number(payload.nacin) === 1 ? 1 : 2;
  const dzoker = toInt(payload.dzoker, 0);
  const igraRaw = toInt(payload.igra, 1);
  const igra = isGameModeId(igraRaw) ? igraRaw : 1;

  return {
    brojKredita: toInt(payload.brojKredita, 0),
    ulog: Math.max(1, toInt(payload.ulog, 1)),
    brojLinija: normalizeLines(payload.brojLinija),
    nacin,
    dzoker: dzoker > 0 ? dzoker : 0,
    vrednostDzokera: Math.max(0, toInt(payload.vrednostDzokera, 0)),
    kvote: kvoteForGameMode(igra),
    igra,
  };
}

export class SlotSpinEngine extends AbstractGameEngine {
  async execute(
    payload: unknown,
    userId: number,
  ): Promise<GameEngineResult<{ result: PhpResponse }>> {
    const request = normalizeSpinRequest(payload);

    if (!validateJoker(request)) {
      return { statusCode: 400, body: error("Invalid joker state for current bet") };
    }

    const totalBetCoins = totalBet(request);
    const deductResult = await this.deductBet(userId, totalBetCoins);
    if (!deductResult.ok) {
      return { statusCode: 400, body: error(deductResult.message) };
    }

    const betTransactionId = await this.recordBetTransaction(
      userId,
      totalBetCoins,
      `Slot spin bet (${totalBetCoins} credits)`,
      {
        reward_mode: request.nacin,
        game_type: request.igra,
        lines: request.brojLinija,
        joker_position: request.dzoker,
      },
    );

    const result = executeSpin(request);
    let winTransactionId: number | null = null;

    if (result.totalPayout > 0) {
      winTransactionId = await this.recordWinTransaction(
        userId,
        result.totalPayout,
        `Slot spin win (${result.totalPayout} credits)`,
        { winning_lines: result.winningLines },
      );
    }

    const newBalance = await this.txRepo.getBalanceCoins(userId);

    await this.gameRepo.saveSpin(userId, {
      betTransactionId,
      winTransactionId,
      reels: result.reels,
      grid: result.grid,
      activeLines: request.brojLinija,
      betPerLine: request.ulog,
      totalBet: totalBetCoins,
      totalPayout: result.totalPayout,
      jokerEnabled: request.dzoker > 0,
      jokerPosition: request.dzoker > 0 ? request.dzoker : null,
      jokerCost: request.vrednostDzokera,
      winningLines: result.winningLines,
      miniGameTriggered: result.miniGameTriggered,
      rewardMode: rewardModeName(request),
      gameMode: gameModeName(request),
    });

    const requestJson = JSON.stringify(request);
    const phpResponse = toPhpResponse(result, requestJson, newBalance);

    return { statusCode: 200, body: success({ result: phpResponse }) };
  }
}
