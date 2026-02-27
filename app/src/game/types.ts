import type { ApiError, ApiSuccess } from "../types/domain.js";

export const REEL_COUNT = 5;
export const SYMBOL_COUNT = 10;
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

export const DEFAULT_KVOTE: readonly number[] = [
  200, 100, 60, 10, // 10/9
  150, 80, 50, 8,   // 8/7
  100, 50, 30, 5,   // 6/5
  50, 30, 20, 4,    // 4/3
  30, 20, 10, 3,    // 2/1
];

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
