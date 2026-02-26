export const NUMBER_POOL_SIZE = 30;
export const DRAWN_NUMBERS_COUNT = 12;
export const MAX_BETS = 30;
export const BET_AMOUNTS = [10, 50, 100, 200, 300, 500, 1000];
export const COIN_VALUES = [10, 20, 50, 100, 200, 500, 1000];
export const MAX_TICKETS = 5;
export const MAX_NUMBERS_PER_TICKET = 5;
export const PAYOUT_ODDS = 2.5;
export const MATCH_PROBABILITY = 40.0;

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function drawNumbers() {
  const pool = Array.from({ length: NUMBER_POOL_SIZE }, (_, index) => index + 1);
  return shuffle(pool).slice(0, DRAWN_NUMBERS_COUNT);
}

function calculatePayout(bet) {
  return Math.round(bet * PAYOUT_ODDS);
}

function buildOddsInfo() {
  return {
    probability: MATCH_PROBABILITY,
    odds: PAYOUT_ODDS,
    description: `Each number has ${MATCH_PROBABILITY}% chance to match. Matched numbers pay ${PAYOUT_ODDS}x the bet.`,
  };
}

export function validateRequest(request) {
  if (!request || !Array.isArray(request.bets) || request.bets.length === 0) {
    throw new Error("Must place at least one bet");
  }

  if (request.bets.length > MAX_BETS) {
    throw new Error(`Maximum ${MAX_BETS} bets allowed, got ${request.bets.length}`);
  }

  const seen = new Set();
  let totalBet = 0;

  for (const item of request.bets) {
    const number = Number(item.number);
    const bet = Number(item.bet);

    if (!Number.isInteger(number) || number < 1 || number > NUMBER_POOL_SIZE) {
      throw new Error(`Invalid number ${item.number}, must be 1-${NUMBER_POOL_SIZE}`);
    }

    if (seen.has(number)) {
      throw new Error(`Duplicate number ${number} - each number can only be selected once`);
    }
    seen.add(number);

    if (!BET_AMOUNTS.includes(bet)) {
      throw new Error(`Invalid bet amount ${bet}. Valid amounts: ${BET_AMOUNTS.join(", ")}`);
    }

    totalBet += bet;
  }

  if (totalBet > Number(request.user_coins || 0)) {
    throw new Error(
      `Total bet (${totalBet}) exceeds available coins (${Number(request.user_coins || 0)})`,
    );
  }
}

export function executeMinigame(request) {
  validateRequest(request);

  const drawnNumbers = drawNumbers();
  const numberResults = [];
  let totalBet = 0;
  let totalPayout = 0;
  let matchesCount = 0;

  for (const item of request.bets) {
    const number = Number(item.number);
    const bet = Number(item.bet);
    const matched = drawnNumbers.includes(number);
    const payout = matched ? calculatePayout(bet) : 0;

    if (matched) {
      matchesCount += 1;
    }

    totalBet += bet;
    totalPayout += payout;

    numberResults.push({
      number,
      bet,
      matched,
      payout,
    });
  }

  return {
    drawnNumbers,
    numberResults,
    totalBet,
    totalPayout,
    netResult: totalPayout - totalBet,
    matchesCount,
    oddsInfo: buildOddsInfo(),
  };
}

export function betMultiplier(numbersCount) {
  if (numbersCount >= 1 && numbersCount <= 5) {
    return numbersCount;
  }
  return 0;
}

export function findOdds(played, matches) {
  const key = `${played}-${matches}`;
  const table = {
    "1-1": 2.5,
    "2-1": 0.62,
    "2-2": 6.59,
    "3-1": 0.27,
    "3-2": 2.89,
    "3-3": 18.45,
    "4-1": 0.15,
    "4-2": 1.64,
    "4-3": 10.64,
    "4-4": 55.36,
    "5-1": 0.1,
    "5-2": 1.05,
    "5-3": 7.33,
    "5-4": 35.43,
    "5-5": 179.94,
  };

  return table[key] || 0;
}

export function calculateTicketTotalBet(tickets, coinValue) {
  return tickets
    .filter((ticket) => ticket.length > 0)
    .reduce((sum, ticket) => sum + betMultiplier(ticket.length) * coinValue, 0);
}

export function validateTicketRequest(request) {
  const coinValue = Number(request.coin_value);
  if (!COIN_VALUES.includes(coinValue)) {
    throw new Error(`Invalid coin value ${coinValue}. Valid values: ${COIN_VALUES.join(", ")}`);
  }

  if (!Array.isArray(request.tickets)) {
    throw new Error("tickets must be an array");
  }

  const hasAnyNumbers = request.tickets.some((ticket) => Array.isArray(ticket) && ticket.length > 0);
  if (!hasAnyNumbers) {
    throw new Error("Must have at least one number selected");
  }

  if (request.tickets.length > MAX_TICKETS) {
    throw new Error(`Maximum ${MAX_TICKETS} tickets allowed, got ${request.tickets.length}`);
  }

  const allUsed = new Set();

  for (let i = 0; i < request.tickets.length; i += 1) {
    const ticket = Array.isArray(request.tickets[i]) ? request.tickets[i] : [];

    if (ticket.length > MAX_NUMBERS_PER_TICKET) {
      throw new Error(`Ticket ${i + 1} exceeds maximum of ${MAX_NUMBERS_PER_TICKET} numbers`);
    }

    for (const value of ticket) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 1 || number > NUMBER_POOL_SIZE) {
        throw new Error(
          `Invalid number ${value} in ticket ${i + 1}. Must be 1-${NUMBER_POOL_SIZE}`,
        );
      }

      if (allUsed.has(number)) {
        throw new Error(
          `Number ${number} is used multiple times - each number can only appear once across all tickets`,
        );
      }
      allUsed.add(number);
    }
  }

  const totalBet = calculateTicketTotalBet(request.tickets, coinValue);
  if (totalBet > Number(request.user_coins || 0)) {
    throw new Error(
      `Insufficient balance. Need ${totalBet} coins, have ${Number(request.user_coins || 0)}`,
    );
  }
}

export function executeTicketMinigame(request) {
  validateTicketRequest(request);

  const coinValue = Number(request.coin_value);
  const drawnNumbers = drawNumbers();
  const ticketResults = [];
  let totalPayout = 0;

  for (const ticketRaw of request.tickets) {
    const ticket = Array.isArray(ticketRaw) ? ticketRaw.map((value) => Number(value)) : [];

    if (ticket.length === 0) {
      ticketResults.push({ numbers_played: 0, matches: 0, bet: 0, payout: 0 });
      continue;
    }

    const played = ticket.length;
    const matches = ticket.filter((number) => drawnNumbers.includes(number)).length;
    const bet = betMultiplier(played) * coinValue;
    const odds = findOdds(played, matches);
    const payout = matches > 0 && odds > 0 ? Math.round(bet * odds) : 0;

    totalPayout += payout;
    ticketResults.push({
      numbers_played: played,
      matches,
      bet,
      payout,
    });
  }

  const totalBet = calculateTicketTotalBet(request.tickets, coinValue);

  return {
    drawnNumbers,
    ticketResults,
    totalBet,
    totalPayout,
    netResult: totalPayout - totalBet,
  };
}
