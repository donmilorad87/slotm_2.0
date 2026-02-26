export const REEL_COUNT = 5;
export const SYMBOL_COUNT = 6;
export const GRID_SIZE = 15;
export const PAYLINE_COUNT = 7;
export const BALANCE_TO_COIN_RATIO = 100;
export const JOKER_COST_MULTIPLIER = 5;
export const JOKER_SYMBOL = "jok";

export const PAYLINES = [
  [5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4],
  [10, 11, 12, 13, 14],
  [5, 11, 7, 3, 9],
  [5, 1, 7, 13, 9],
  [0, 6, 12, 8, 4],
  [10, 6, 2, 8, 14],
];

export const DEFAULT_KVOTE = [100, 50, 30, 5, 50, 30, 20, 4, 30, 20, 10, 3];

export function activeLineCount(request) {
  return request.brojLinija.filter((line) => line === 1).length;
}

export function totalBet(request) {
  if (request.nacin === 2) {
    return request.ulog;
  }
  return activeLineCount(request) * request.ulog + request.vrednostDzokera;
}

export function validateJoker(request) {
  if (request.dzoker > 0) {
    return request.vrednostDzokera === request.ulog * JOKER_COST_MULTIPLIER;
  }
  return request.vrednostDzokera === 0;
}

export function gameModeName(request) {
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

export function rewardModeName(request) {
  if (request.nacin === 1) {
    return "multi";
  }
  return "single";
}

export function winLineToPhpArray(winLine) {
  return [
    winLine.symbol,
    winLine.matchCount,
    winLine.multiplier,
    winLine.bet,
    winLine.payout,
    winLine.lineIndex,
  ];
}

export function toPhpResponse(result, requestJson, newBalance) {
  const winDetails =
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

export function success(data) {
  return { success: true, data };
}

export function error(message) {
  return { success: false, message: String(message) };
}
