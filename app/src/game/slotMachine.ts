import {
  GRID_SIZE,
  JOKER_SYMBOL,
  PAYLINES,
  REEL_COUNT,
  SYMBOL_COUNT,
  type SpinRequest,
  type SpinResult,
  type WinLine,
} from "./types.js";

export function generateSymbols(randomFn: () => number = Math.random): number[] {
  const symbols: number[] = [];
  for (let i = 0; i < REEL_COUNT; i += 1) {
    const value = Math.floor(randomFn() * SYMBOL_COUNT) + 1;
    symbols.push(Math.min(SYMBOL_COUNT, Math.max(1, value)));
  }
  return symbols;
}

export function buildGrid(symbols: readonly number[], jokerPosition: number): string[] {
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

function countConsecutiveMatches(lineSymbols: readonly string[]): [number, number] {
  if (!Array.isArray(lineSymbols) || lineSymbols.length < REEL_COUNT) {
    throw new Error("Payline must have 5 symbols");
  }

  const resolved: number[] = [];
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

function getMultiplier(
  symbol: number,
  matchCount: number,
  kvote: readonly number[],
): number {
  const groupsCount = Math.ceil(SYMBOL_COUNT / 2);
  const multipliersPerGroup = 4;
  const requiredLength = groupsCount * multipliersPerGroup;

  if (!Array.isArray(kvote) || kvote.length < requiredLength || matchCount < 2 || matchCount > 5) {
    return 0;
  }

  const symbolValue = Number.parseInt(String(symbol), 10);
  if (!Number.isFinite(symbolValue) || symbolValue < 1 || symbolValue > SYMBOL_COUNT) {
    return 0;
  }

  const groupIndex = Math.floor((SYMBOL_COUNT - symbolValue) / 2);
  const groupOffset = groupIndex * multipliersPerGroup;

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

function evaluatePayline(
  grid: readonly string[],
  payline: readonly number[],
  lineIndex: number,
  kvote: readonly number[],
  bet: number,
): WinLine | null {
  const lineSymbols = payline.map((gridIndex) => grid[gridIndex] ?? "1");
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

function shouldTriggerMiniGame(totalPayout: number, randomFn: () => number): boolean {
  if (totalPayout <= 0) {
    return false;
  }
  return randomFn() < 0.5;
}

function executeSingleLineSpin(
  request: SpinRequest,
  reels: number[],
  randomFn: () => number,
): SpinResult {
  const lineSymbols = reels.map((symbol) => String(symbol));
  const [symbol, matchCount] = countConsecutiveMatches(lineSymbols);
  const winningLines: WinLine[] = [];
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

function executeMultiLineSpin(
  request: SpinRequest,
  reels: number[],
  randomFn: () => number,
): SpinResult {
  const grid = buildGrid(reels, request.dzoker);
  const winningLines: WinLine[] = [];
  let totalPayout = 0;

  for (let i = 0; i < PAYLINES.length; i += 1) {
    if ((request.brojLinija[i] ?? 0) !== 1) {
      continue;
    }

    const payline = PAYLINES[i];
    if (!payline) {
      continue;
    }

    const win = evaluatePayline(grid, payline, i, request.kvote, request.ulog);
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

export function executeSpin(request: SpinRequest): SpinResult {
  const reels = generateSymbols(Math.random);
  return executeSpinWithReels(request, reels, Math.random);
}

export function executeSpinWithReels(
  request: SpinRequest,
  reels: number[],
  randomFn: () => number = Math.random,
): SpinResult {
  if (request.nacin === 2) {
    return executeSingleLineSpin(request, reels, randomFn);
  }
  return executeMultiLineSpin(request, reels, randomFn);
}
