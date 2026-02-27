import { executeSpin } from "./slotMachine.js";
import {
  executeMinigame,
  executeTicketMinigame,
  type LegacyMiniGameRequest,
  type TicketMiniGameRequest,
} from "./miniGame.js";
import type { SlotStore } from "./store.js";
import {
  BALANCE_TO_COIN_RATIO,
  DEFAULT_KVOTE,
  PAYLINE_COUNT,
  error,
  gameModeName,
  rewardModeName,
  success,
  toPhpResponse,
  totalBet,
  validateJoker,
  type PaylineState,
  type PhpResponse,
  type SpinRequest,
} from "./types.js";
import type { ApiError, ApiSuccess } from "../types/domain.js";

type RawObject = Record<string, unknown>;

interface ActionResult<T = unknown> {
  statusCode: number;
  body: ApiSuccess<T> | ApiError;
}

type StoreUserStats = Awaited<ReturnType<SlotStore["getUserStats"]>>;

interface LegacyMiniGamePayload {
  bets?: Array<{ number?: unknown; bet?: unknown }>;
}

interface TicketMiniGamePayload {
  tickets?: unknown;
  coin_value?: unknown;
}

interface SpinPayload {
  brojKredita?: unknown;
  ulog?: unknown;
  brojLinija?: unknown;
  nacin?: unknown;
  dzoker?: unknown;
  vrednostDzokera?: unknown;
  kvote?: unknown;
  igra?: unknown;
}

function toErrorMessage(errorValue: unknown, fallback: string): string {
  if (errorValue instanceof Error && errorValue.message) {
    return errorValue.message;
  }
  return fallback;
}

function asObject(value: unknown): RawObject {
  if (typeof value === "object" && value !== null) {
    return value as RawObject;
  }
  return {};
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLines(rawLines: unknown): PaylineState[] {
  const lines = Array.isArray(rawLines) ? rawLines : [1, 0, 0, 0, 0, 0, 0];
  const normalized = lines
    .slice(0, PAYLINE_COUNT)
    .map((value) => (Number(value) === 1 ? 1 : 0) as PaylineState);

  while (normalized.length < PAYLINE_COUNT) {
    normalized.push(0);
  }

  return normalized;
}

function normalizeKvote(rawKvote: unknown): number[] {
  if (!Array.isArray(rawKvote) || rawKvote.length === 0) {
    return [...DEFAULT_KVOTE];
  }

  const kvote = rawKvote.map((value) => toInt(value, 0));
  while (kvote.length < DEFAULT_KVOTE.length) {
    kvote.push(DEFAULT_KVOTE[kvote.length] ?? 0);
  }
  return kvote.slice(0, DEFAULT_KVOTE.length);
}

function normalizeSpinRequest(payloadRaw: unknown): SpinRequest {
  const payload = asObject(payloadRaw) as SpinPayload;
  const nacin = Number(payload.nacin) === 1 ? 1 : 2;
  const dzoker = toInt(payload.dzoker, 0);
  const igraRaw = toInt(payload.igra, 1);

  return {
    brojKredita: toInt(payload.brojKredita, 0),
    ulog: Math.max(1, toInt(payload.ulog, 1)),
    brojLinija: normalizeLines(payload.brojLinija),
    nacin,
    dzoker: dzoker > 0 ? dzoker : 0,
    vrednostDzokera: Math.max(0, toInt(payload.vrednostDzokera, 0)),
    kvote: normalizeKvote(payload.kvote),
    igra: igraRaw >= 1 && igraRaw <= 5 ? (igraRaw as SpinRequest["igra"]) : 1,
  };
}

function normalizeOldMiniGameRequest(
  payloadRaw: unknown,
  userCoins: number,
): LegacyMiniGameRequest {
  const payload = asObject(payloadRaw) as LegacyMiniGamePayload;
  const bets = Array.isArray(payload.bets)
    ? payload.bets.map((item) => ({
        number: toInt(item?.number, 0),
        bet: toInt(item?.bet, 0),
      }))
    : [];

  return {
    bets,
    user_coins: userCoins,
  };
}

function normalizeTicketRequest(
  payloadRaw: unknown,
  userCoins: number,
): TicketMiniGameRequest {
  const payload = asObject(payloadRaw) as TicketMiniGamePayload;
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

function makeFraudResponse(request: SpinRequest): PhpResponse {
  return [
    1,
    1,
    1,
    1,
    1,
    JSON.stringify(request),
    "Varali ste, krediti su vam oduzeti",
    0,
    0,
    0,
    ["nema dobitka"],
  ];
}

async function handleSpin(
  payload: unknown,
  store: SlotStore,
  userId: number,
): Promise<ActionResult<{ result: PhpResponse }>> {
  const request = normalizeSpinRequest(payload);

  if (!validateJoker(request)) {
    await store.zeroBalance(userId);
    return {
      statusCode: 200,
      body: success({
        result: makeFraudResponse(request),
      }),
    };
  }

  const totalBetCoins = totalBet(request);
  const totalBetUnits = totalBetCoins * BALANCE_TO_COIN_RATIO;
  const deducted = await store.deductBalanceUnitsIfSufficient(userId, totalBetUnits);
  if (!deducted.ok) {
    return {
      statusCode: 400,
      body: error("Insufficient balance"),
    };
  }

  const balanceAfterBetUnits = await store.getBalanceUnits(userId);
  const betTransactionId = await store.createTransaction({
    userId,
    type: "slot_spin_bet",
    direction: "debit",
    amountUnits: totalBetUnits,
    balanceAfterUnits: balanceAfterBetUnits,
    description: `Slot spin bet (${totalBetCoins} credits)`,
    metadata: {
      reward_mode: request.nacin,
      game_type: request.igra,
      lines: request.brojLinija,
      joker_position: request.dzoker,
    },
  });

  const result = executeSpin(request);
  let winTransactionId: number | null = null;

  if (result.totalPayout > 0) {
    const payoutUnits = result.totalPayout * BALANCE_TO_COIN_RATIO;
    const balanceAfterWinUnits = await store.addBalanceUnits(userId, payoutUnits);
    winTransactionId = await store.createTransaction({
      userId,
      type: "slot_spin_win",
      direction: "credit",
      amountUnits: payoutUnits,
      balanceAfterUnits: balanceAfterWinUnits,
      description: `Slot spin win (${result.totalPayout} credits)`,
      metadata: {
        winning_lines: result.winningLines,
      },
    });
  }

  const newBalance = await store.getBalanceCoins(userId);

  await store.saveSpin(userId, {
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

  return {
    statusCode: 200,
    body: success({ result: phpResponse }),
  };
}

async function handleMiniGameOld(
  payload: unknown,
  store: SlotStore,
  userId: number,
): Promise<
  ActionResult<{
    drawn_numbers: number[];
    number_results: Array<{
      number: number;
      bet: number;
      matched: boolean;
      payout: number;
    }>;
    total_bet: number;
    total_payout: number;
    net_result: number;
    matches_count: number;
    new_balance: number;
    odds_info: {
      probability: number;
      odds: number;
      description: string;
    };
  }>
> {
  const userCoins = await store.getBalanceCoins(userId);
  const request = normalizeOldMiniGameRequest(payload, userCoins);

  let result;
  try {
    result = executeMinigame(request);
  } catch (validationError) {
    return {
      statusCode: 400,
      body: error(toErrorMessage(validationError, "Invalid mini-game request")),
    };
  }

  if (result.totalBet > 0) {
    const deducted = await store.deductBalanceUnitsIfSufficient(
      userId,
      result.totalBet * BALANCE_TO_COIN_RATIO,
    );
    if (!deducted.ok) {
      return {
        statusCode: 400,
        body: error("Insufficient balance"),
      };
    }

    await store.createTransaction({
      userId,
      type: "slot_minigame_bet",
      direction: "debit",
      amountUnits: result.totalBet * BALANCE_TO_COIN_RATIO,
      balanceAfterUnits: await store.getBalanceUnits(userId),
      description: `Mini-game bet (${result.totalBet} credits)`,
      metadata: {
        mode: "legacy",
        bets: request.bets,
      },
    });
  }

  if (result.totalPayout > 0) {
    const balanceAfterWinUnits = await store.addBalanceUnits(
      userId,
      result.totalPayout * BALANCE_TO_COIN_RATIO,
    );
    await store.createTransaction({
      userId,
      type: "slot_minigame_win",
      direction: "credit",
      amountUnits: result.totalPayout * BALANCE_TO_COIN_RATIO,
      balanceAfterUnits: balanceAfterWinUnits,
      description: `Mini-game win (${result.totalPayout} credits)`,
      metadata: {
        mode: "legacy",
        matches: result.matchesCount,
      },
    });
  }

  const newBalance = await store.getBalanceCoins(userId);
  const historyId = await store.consumePendingMiniGame(userId);
  await store.attachMiniGameToHistory(historyId, {
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

async function handleMiniGameTickets(
  payload: unknown,
  store: SlotStore,
  userId: number,
): Promise<
  ActionResult<{
    drawn_numbers: number[];
    ticket_results: Array<{
      numbers_played: number;
      matches: number;
      bet: number;
      payout: number;
    }>;
    total_bet: number;
    total_payout: number;
    net_result: number;
    new_balance: number;
  }>
> {
  const userCoins = await store.getBalanceCoins(userId);
  const request = normalizeTicketRequest(payload, userCoins);

  let result;
  try {
    result = executeTicketMinigame(request);
  } catch (validationError) {
    return {
      statusCode: 400,
      body: error(toErrorMessage(validationError, "Invalid mini-game request")),
    };
  }

  if (result.totalBet > 0) {
    const deducted = await store.deductBalanceUnitsIfSufficient(
      userId,
      result.totalBet * BALANCE_TO_COIN_RATIO,
    );
    if (!deducted.ok) {
      return {
        statusCode: 400,
        body: error("Insufficient balance"),
      };
    }

    await store.createTransaction({
      userId,
      type: "slot_minigame_bet",
      direction: "debit",
      amountUnits: result.totalBet * BALANCE_TO_COIN_RATIO,
      balanceAfterUnits: await store.getBalanceUnits(userId),
      description: `Mini-game ticket bet (${result.totalBet} credits)`,
      metadata: {
        mode: "ticket",
        tickets: request.tickets,
        coin_value: request.coin_value,
      },
    });
  }

  if (result.totalPayout > 0) {
    const balanceAfterWinUnits = await store.addBalanceUnits(
      userId,
      result.totalPayout * BALANCE_TO_COIN_RATIO,
    );
    await store.createTransaction({
      userId,
      type: "slot_minigame_win",
      direction: "credit",
      amountUnits: result.totalPayout * BALANCE_TO_COIN_RATIO,
      balanceAfterUnits: balanceAfterWinUnits,
      description: `Mini-game ticket win (${result.totalPayout} credits)`,
      metadata: {
        mode: "ticket",
        ticket_results: result.ticketResults,
      },
    });
  }

  const newBalance = await store.getBalanceCoins(userId);
  const historyId = await store.consumePendingMiniGame(userId);
  await store.attachMiniGameToHistory(historyId, {
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

async function handleHistory(
  payload: unknown,
  store: SlotStore,
  userId: number,
): Promise<
  ActionResult<{
    total: number;
    history: unknown[];
    page: number;
    total_pages: number;
    has_more: boolean;
  }>
> {
  const source = asObject(payload);
  const page = Math.max(1, toInt(source.page, 1));
  const limit = 16;
  const skip = (page - 1) * limit;

  const { total, items } = await store.getUserHistory(userId, limit, skip);
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

async function handleStats(
  store: SlotStore,
  userId: number,
): Promise<ActionResult<StoreUserStats>> {
  return {
    statusCode: 200,
    body: success(await store.getUserStats(userId)),
  };
}

export async function handleSlotMachineAction(
  payload: unknown,
  store: SlotStore,
  userId: number,
): Promise<ActionResult> {
  const source = asObject(payload);
  const action = typeof source.action === "string" ? source.action : "";

  switch (action) {
    case "slot_spin":
      return handleSpin(source, store, userId);
    case "slot_minigame":
      if (Object.prototype.hasOwnProperty.call(source, "tickets")) {
        return handleMiniGameTickets(source, store, userId);
      }
      return handleMiniGameOld(source, store, userId);
    case "slot_history":
      return handleHistory(source, store, userId);
    case "slot_stats":
      return handleStats(store, userId);
    default:
      return {
        statusCode: 400,
        body: error("Invalid action"),
      };
  }
}
