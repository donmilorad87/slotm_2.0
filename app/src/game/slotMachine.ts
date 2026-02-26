import {
  GRID_SIZE,
  JOKER_SYMBOL,
  PAYLINES,
  REEL_COUNT,
  SYMBOL_COUNT,
} from "./types.js";

export function generateSymbols(randomFn = Math.random) {
  const symbols = [];
  for (let i = 0; i < REEL_COUNT; i += 1) {
    const value = Math.floor(randomFn() * SYMBOL_COUNT) + 1;
    symbols.push(Math.min(SYMBOL_COUNT, Math.max(1, value)));
  }
  return symbols;
}

export function buildGrid(symbols, jokerPosition) {
  if (!Array.isArray(symbols) || symbols.length < REEL_COUNT) {
    throw new Error("Need at least 5 symbols");
  }

  const grid = new Array(GRID_SIZE).fill("1");

  for (let i = 0; i < REEL_COUNT; i += 1) {
    const symbol = Number(symbols[i]) || 1;
    const top = symbol === SYMBOL_COUNT ? 1 : symbol + 1;
    const mid = symbol;
    const bot = symbol === 1 ? SYMBOL_COUNT : symbol - 1;

    grid[i] = String(top);
    grid[i + 5] = String(mid);
    grid[i + 10] = String(bot);
  }

  if (jokerPosition > 0 && jokerPosition <= GRID_SIZE) {
    grid[jokerPosition - 1] = JOKER_SYMBOL;
  }

  return grid;
}

function countConsecutiveMatches(lineSymbols) {
  if (!Array.isArray(lineSymbols) || lineSymbols.length < REEL_COUNT) {
    throw new Error("Payline must have 5 symbols");
  }

  const resolved = [];
  for (let i = 0; i < lineSymbols.length; i += 1) {
    const symbol = lineSymbols[i];
    if (symbol === JOKER_SYMBOL) {
      if (i === 0) {
        const nextValue = Number.parseInt(lineSymbols[1], 10);
        resolved.push(Number.isFinite(nextValue) ? nextValue : 1);
      } else {
        resolved.push(resolved[resolved.length - 1] ?? 1);
      }
    } else {
      const value = Number.parseInt(symbol, 10);
      resolved.push(Number.isFinite(value) ? value : 1);
    }
  }

  const firstSymbol = resolved[0] ?? 1;
  let matchCount = 1;
  for (let i = 1; i < resolved.length; i += 1) {
    if (resolved[i] === firstSymbol) {
      matchCount += 1;
    } else {
      break;
    }
  }

  return [firstSymbol, matchCount];
}

function getMultiplier(symbol, matchCount, kvote) {
  if (!Array.isArray(kvote) || kvote.length < 12 || matchCount < 2 || matchCount > 5) {
    return 0;
  }

  let groupOffset = -1;
  if (symbol === 5 || symbol === 6) {
    groupOffset = 0;
  } else if (symbol === 3 || symbol === 4) {
    groupOffset = 4;
  } else if (symbol === 1 || symbol === 2) {
    groupOffset = 8;
  }

  if (groupOffset < 0) {
    return 0;
  }

  const offsets = new Map([
    [5, 0],
    [4, 1],
    [3, 2],
    [2, 3],
  ]);
  const matchOffset = offsets.get(matchCount);
  if (matchOffset === undefined) {
    return 0;
  }

  return Number(kvote[groupOffset + matchOffset]) || 0;
}

function evaluatePayline(grid, payline, lineIndex, kvote, bet) {
  const lineSymbols = payline.map((gridIndex) => grid[gridIndex]);
  const [symbol, matchCount] = countConsecutiveMatches(lineSymbols);

  if (matchCount < 2) {
    return null;
  }

  const multiplier = getMultiplier(symbol, matchCount, kvote);
  if (multiplier <= 0) {
    return null;
  }

  const payout = bet * multiplier;
  return {
    symbol,
    matchCount,
    multiplier,
    bet,
    payout,
    lineIndex,
  };
}

function shouldTriggerMiniGame(totalPayout, randomFn) {
  if (totalPayout <= 0) {
    return false;
  }
  return randomFn() < 0.5;
}

function executeSingleLineSpin(request, reels, randomFn) {
  const lineSymbols = reels.map((symbol) => String(symbol));
  const [symbol, matchCount] = countConsecutiveMatches(lineSymbols);
  const winningLines = [];
  let totalPayout = 0;

  if (matchCount >= 2) {
    const multiplier = getMultiplier(symbol, matchCount, request.kvote);
    if (multiplier > 0) {
      const payout = request.ulog * multiplier;
      totalPayout = payout;
      winningLines.push({
        symbol,
        matchCount,
        multiplier,
        bet: request.ulog,
        payout,
        lineIndex: 0,
      });
    }
  }

  return {
    reels,
    grid: null,
    winningLines,
    totalPayout,
    miniGameTriggered: shouldTriggerMiniGame(totalPayout, randomFn),
    status: "Sve ok3",
  };
}

function executeMultiLineSpin(request, reels, randomFn) {
  const grid = buildGrid(reels, request.dzoker);
  const winningLines = [];
  let totalPayout = 0;

  for (let i = 0; i < PAYLINES.length; i += 1) {
    if ((request.brojLinija[i] ?? 0) !== 1) {
      continue;
    }

    const win = evaluatePayline(grid, PAYLINES[i], i, request.kvote, request.ulog);
    if (!win) {
      continue;
    }

    totalPayout += win.payout;
    winningLines.push(win);
  }

  return {
    reels,
    grid,
    winningLines,
    totalPayout,
    miniGameTriggered: shouldTriggerMiniGame(totalPayout, randomFn),
    status: request.dzoker > 0 ? "Sve ok1" : "Sve ok2",
  };
}

export function executeSpin(request) {
  const reels = generateSymbols(Math.random);
  return executeSpinWithReels(request, reels, Math.random);
}

export function executeSpinWithReels(request, reels, randomFn = Math.random) {
  if (request.nacin === 2) {
    return executeSingleLineSpin(request, reels, randomFn);
  }
  return executeMultiLineSpin(request, reels, randomFn);
}
