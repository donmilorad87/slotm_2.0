import { executeSpin } from "./slotMachine.js";
import {
  executeMinigame,
  executeTicketMinigame,
} from "./miniGame.js";
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
} from "./types.js";

function toInt(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLines(rawLines) {
  const lines = Array.isArray(rawLines) ? rawLines : [1, 0, 0, 0, 0, 0, 0];
  const normalized = lines
    .slice(0, PAYLINE_COUNT)
    .map((value) => (Number(value) === 1 ? 1 : 0));

  while (normalized.length < PAYLINE_COUNT) {
    normalized.push(0);
  }

  return normalized;
}

function normalizeKvote(rawKvote) {
  if (!Array.isArray(rawKvote) || rawKvote.length === 0) {
    return [...DEFAULT_KVOTE];
  }

  const kvote = rawKvote.map((value) => toInt(value, 0));
  while (kvote.length < DEFAULT_KVOTE.length) {
    kvote.push(DEFAULT_KVOTE[kvote.length]);
  }
  return kvote.slice(0, DEFAULT_KVOTE.length);
}

function normalizeSpinRequest(payload) {
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
    igra: igraRaw >= 1 && igraRaw <= 5 ? igraRaw : 1,
  };
}

function normalizeOldMiniGameRequest(payload, userCoins) {
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

function normalizeTicketRequest(payload, userCoins) {
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

function makeFraudResponse(request) {
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

async function handleSpin(payload, store, userId) {
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
  let winTransactionId = null;

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

async function handleMiniGameOld(payload, store, userId) {
  const userCoins = await store.getBalanceCoins(userId);
  const request = normalizeOldMiniGameRequest(payload, userCoins);

  let result;
  try {
    result = executeMinigame(request);
  } catch (validationError) {
    return {
      statusCode: 400,
      body: error(validationError.message || "Invalid mini-game request"),
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

async function handleMiniGameTickets(payload, store, userId) {
  const userCoins = await store.getBalanceCoins(userId);
  const request = normalizeTicketRequest(payload, userCoins);

  let result;
  try {
    result = executeTicketMinigame(request);
  } catch (validationError) {
    return {
      statusCode: 400,
      body: error(validationError.message || "Invalid mini-game request"),
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

async function handleHistory(payload, store, userId) {
  const page = Math.max(1, toInt(payload.page, 1));
  const limit = 16;
  const skip = (page - 1) * limit;

  const { total, items } = await store.getUserHistory(userId, limit, skip);
  const totalPages = Math.ceil(total / limit);

  return {
    statusCode: 200,
    body: success({
      history: items,
      page,
      total_pages: totalPages,
      has_more: page < totalPages,
    }),
  };
}

async function handleStats(store, userId) {
  return {
    statusCode: 200,
    body: success(await store.getUserStats(userId)),
  };
}

export async function handleSlotMachineAction(payload, store, userId) {
  const action = typeof payload?.action === "string" ? payload.action : "";

  switch (action) {
    case "slot_spin":
      return await handleSpin(payload, store, userId);
    case "slot_minigame":
      if (payload && Object.prototype.hasOwnProperty.call(payload, "tickets")) {
        return await handleMiniGameTickets(payload, store, userId);
      }
      return await handleMiniGameOld(payload, store, userId);
    case "slot_history":
      return await handleHistory(payload, store, userId);
    case "slot_stats":
      return await handleStats(store, userId);
    default:
      return {
        statusCode: 400,
        body: error("Invalid action"),
      };
  }
}
