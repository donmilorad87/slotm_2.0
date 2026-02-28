import type { ApiError, ApiSuccess } from "../types/domain.js";

export const REEL_COUNT = 5;
export const SYMBOL_COUNT = 22;
export const GRID_SIZE = 15;
export const PAYLINE_COUNT = 7;
export const BALANCE_TO_COIN_RATIO = 100;
export const JOKER_COST_MULTIPLIER = 5;
export const JOKER_SYMBOL = "jok";

export type RewardModeId = 1 | 2;
export type GameModeId = 1 | 2 | 3 | 4 | 5;
export type PaylineState = 0 | 1;
export type GameModeName = "numbers" | "roman" | "fruits" | "animals" | "emoji";
export type RewardModeName = "single" | "multi";
type OddsMatchCount = 2 | 3 | 4 | 5;

export interface SpinRequest {
  brojKredita: number;
  ulog: number;
  brojLinija: PaylineState[];
  nacin: RewardModeId;
  dzoker: number;
  vrednostDzokera: number;
  kvote: number[];
  igra: GameModeId;
}

export interface WinLine {
  symbol: number;
  matchCount: number;
  multiplier: number;
  bet: number;
  payout: number;
  lineIndex: number;
}

export interface SpinResult {
  reels: number[];
  grid: string[] | null;
  winningLines: WinLine[];
  totalPayout: number;
  miniGameTriggered: boolean;
  status: string;
}

export type PhpWinLine = [number, number, number, number, number, number];
export type PhpWinDetails = ["nema dobitka"] | PhpWinLine[];
export type PhpResponse = [
  number,
  number,
  number,
  number,
  number,
  string,
  string,
  number,
  number,
  0 | 1,
  PhpWinDetails,
];

export const PAYLINES: readonly number[][] = [
  [5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4],
  [10, 11, 12, 13, 14],
  [5, 11, 7, 3, 9],
  [5, 1, 7, 13, 9],
  [0, 6, 12, 8, 4],
  [10, 6, 2, 8, 14],
];

const ODDS_MATCH_ORDER: readonly OddsMatchCount[] = [5, 4, 3, 2];
const NUMBERS_TARGET_RTP = 0.86;
const NUMBERS_GROUP_COEFFICIENTS: readonly number[] = [
  1.85, 1.75, 1.65, 1.55, 1.45, 1.35, 1.25, 1.15, 1.05, 0.95, 0.85,
];
const GAME_MODE_ODDS_COEFFICIENT: Readonly<Record<GameModeId, number>> = {
  1: 1.0,
  2: 0.94,
  3: 1.08,
  4: 1.03,
  5: 0.98,
};

function exactMatchProbability(symbolCount: number, matchCount: OddsMatchCount): number {
  if (matchCount === 5) {
    return 1 / (symbolCount ** 5);
  }
  return (symbolCount - 1) / (symbolCount ** (matchCount + 1));
}

function symbolsInGroup(symbolCount: number, groupIndex: number): number {
  const remaining = symbolCount - (groupIndex * 2);
  if (remaining <= 0) {
    return 0;
  }
  return remaining >= 2 ? 2 : 1;
}

function resolveGroupCoefficients(groupCount: number): number[] {
  if (groupCount <= 0) {
    return [];
  }
  if (groupCount === NUMBERS_GROUP_COEFFICIENTS.length) {
    return [...NUMBERS_GROUP_COEFFICIENTS];
  }
  if (groupCount === 1) {
    return [NUMBERS_GROUP_COEFFICIENTS[0] ?? 1];
  }

  const top = NUMBERS_GROUP_COEFFICIENTS[0] ?? 1;
  const bottom = NUMBERS_GROUP_COEFFICIENTS[NUMBERS_GROUP_COEFFICIENTS.length - 1] ?? top;
  return Array.from({ length: groupCount }, (_, index) => {
    const ratio = index / (groupCount - 1);
    return top + ((bottom - top) * ratio);
  });
}

function buildBaseNumbersKvote(symbolCount: number): number[] {
  const groupCount = Math.ceil(symbolCount / 2);
  const groupCoefficients = resolveGroupCoefficients(groupCount);
  const coefficientSum = groupCoefficients.reduce((sum, value) => sum + value, 0);
  const scaleDenominator = ODDS_MATCH_ORDER.length * coefficientSum;
  const scale = scaleDenominator > 0 ? (NUMBERS_TARGET_RTP / scaleDenominator) : 0;
  const kvote: number[] = [];

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupCoefficient = groupCoefficients[groupIndex] ?? 1;
    const groupSymbolCount = symbolsInGroup(symbolCount, groupIndex);

    for (const matchCount of ODDS_MATCH_ORDER) {
      const probability = groupSymbolCount * exactMatchProbability(symbolCount, matchCount);
      const multiplier = probability > 0 ? Math.round((scale * groupCoefficient) / probability) : 0;
      kvote.push(Math.max(1, multiplier));
    }
  }

  return kvote;
}

export const DEFAULT_KVOTE: readonly number[] = buildBaseNumbersKvote(SYMBOL_COUNT);

export function kvoteForGameMode(gameMode: GameModeId): number[] {
  const coefficient = GAME_MODE_ODDS_COEFFICIENT[gameMode] ?? 1;
  if (coefficient === 1) {
    return [...DEFAULT_KVOTE];
  }
  return DEFAULT_KVOTE.map((value) => Math.max(1, Math.round(value * coefficient)));
}

export function activeLineCount(request: SpinRequest): number {
  return request.brojLinija.filter((line) => line === 1).length;
}

export function totalBet(request: SpinRequest): number {
  if (request.nacin === 2) {
    return request.ulog;
  }
  return activeLineCount(request) * request.ulog + request.vrednostDzokera;
}

export function validateJoker(request: SpinRequest): boolean {
  if (request.dzoker > 0) {
    return request.vrednostDzokera === request.ulog * JOKER_COST_MULTIPLIER;
  }
  return request.vrednostDzokera === 0;
}

export function gameModeName(request: SpinRequest): GameModeName {
  switch (request.igra) {
    case 2:
      return "roman";
    case 3:
      return "fruits";
    case 4:
      return "animals";
    case 5:
      return "emoji";
    case 1:
    default:
      return "numbers";
  }
}

export function rewardModeName(request: SpinRequest): RewardModeName {
  if (request.nacin === 1) {
    return "multi";
  }
  return "single";
}

export function winLineToPhpArray(winLine: WinLine): PhpWinLine {
  return [
    winLine.symbol,
    winLine.matchCount,
    winLine.multiplier,
    winLine.bet,
    winLine.payout,
    winLine.lineIndex,
  ];
}

export function toPhpResponse(
  result: SpinResult,
  requestJson: string,
  newBalance: number,
): PhpResponse {
  const winDetails: PhpWinDetails =
    result.winningLines.length === 0
      ? ["nema dobitka"]
      : result.winningLines.map((winLine) => winLineToPhpArray(winLine));

  return [
    result.reels[0] ?? 1,
    result.reels[1] ?? 1,
    result.reels[2] ?? 1,
    result.reels[3] ?? 1,
    result.reels[4] ?? 1,
    requestJson,
    result.status,
    result.totalPayout,
    newBalance,
    result.miniGameTriggered ? 1 : 0,
    winDetails,
  ];
}

export function success<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function error(message: unknown): ApiError {
  return { success: false, message: String(message) };
}
