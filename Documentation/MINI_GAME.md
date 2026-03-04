# Mini Game (Bingo Ticket System)

## Overview

The mini game is a bonus round triggered after winning spins on the slot machine. It uses a bingo-style ticket system where players select numbers on tickets and a random draw determines matches and payouts.

**Client:** `app/src/client/SlotMachine.ts` (BingoMiniGame class)
**Server logic:** `app/src/game/miniGame.ts`
**Types:** `app/src/game/types.ts`

---

## How It Works

### Trigger

- After a winning spin, there is a **50% chance** the mini game is offered
- Player can accept or decline the bonus round
- Mini game overlay appears on top of the slot machine

### Ticket System

```
┌─────────────────────────────────────────────────────┐
│                   MINI GAME                         │
│                                                     │
│  Coin Value: [10 ▾]                                 │
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ Ticket 1│ │ Ticket 2│ │ Ticket 3│               │
│  │         │ │         │ │         │               │
│  │  7  12  │ │  3  18  │ │  21     │               │
│  │  23     │ │  9  25  │ │         │               │
│  │         │ │         │ │         │               │
│  └─────────┘ └─────────┘ └─────────┘               │
│  ┌─────────┐ ┌─────────┐                           │
│  │ Ticket 4│ │ Ticket 5│     [DRAW]                │
│  │         │ │         │                           │
│  │  14  2  │ │  30  6  │     Bet: 700              │
│  │  19  28 │ │  11     │                           │
│  │         │ │         │                           │
│  └─────────┘ └─────────┘                           │
│                                                     │
│  Drawn: 3, 7, 14, 18, 21, 25, 28, 2, 9, 11, 6, 30 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Rules

### 5 Tickets

- Each ticket can hold **1 to 5 numbers**
- Numbers range from **1 to 30**
- **Global uniqueness** — no number can appear on more than one ticket
- Total of up to **30 unique numbers** across all 5 tickets
- Player selects which numbers to place on which tickets

### Drawing

- **12 numbers** are randomly drawn from the pool of 30
- Each number on a ticket that matches a drawn number is a "hit"
- Payouts depend on how many numbers were played and how many matched

### Coin Values

Selectable bet denominator for the mini game:

| Coin Value |
|------------|
| 10 |
| 20 |
| 50 |
| 100 |
| 200 |
| 500 |
| 1,000 |

### Bet Calculation

```
Bet per ticket = numbers_on_ticket × coin_value
Total bet = sum of all ticket bets
```

**Example:** 3 numbers on Ticket 1 at coin value 100 = 300 per ticket.

---

## Odds Table

Complete payout structure for all combinations:

| Numbers Played | Matches | Odds Multiplier | Probability |
|----------------|---------|-----------------|-------------|
| 1 | 1 | 2.50x | 40.00% |
| 2 | 1 | 0.62x | 49.66% |
| 2 | 2 | 6.59x | 15.17% |
| 3 | 1 | 0.27x | 45.22% |
| 3 | 2 | 2.89x | 29.26% |
| 3 | 3 | 18.45x | 5.42% |
| 4 | 1 | 0.15x | 35.73% |
| 4 | 2 | 1.64x | 36.85% |
| 4 | 3 | 10.64x | 14.45% |
| 4 | 4 | 55.36x | 1.81% |
| 5 | 1 | 0.10x | 25.77% |
| 5 | 2 | 1.05x | 37.79% |
| 5 | 3 | 7.33x | 23.62% |
| 5 | 4 | 35.43x | 6.25% |
| 5 | 5 | 179.94x | 0.56% |

### Reading the Odds

- **Numbers Played** — How many numbers the player placed on that ticket
- **Matches** — How many of those numbers were drawn
- **Odds Multiplier** — Payout = ticket bet × multiplier
- **Probability** — Chance of exactly that many matches

### Payout Examples

| Scenario | Coin Value | Numbers | Bet | Matches | Multiplier | Payout |
|----------|------------|---------|-----|---------|------------|--------|
| Small win | 10 | 1 | 10 | 1 | 2.50x | 25 |
| Medium win | 100 | 3 | 300 | 3 | 18.45x | 5,535 |
| Big win | 500 | 5 | 2,500 | 4 | 35.43x | 88,575 |
| Jackpot | 1,000 | 5 | 5,000 | 5 | 179.94x | 899,700 |

---

## Draw Mechanics

### Pool & Selection

```
Pool: 30 numbers (1-30)
Drawn: 12 random numbers from pool (no replacement)
Match rate: 12/30 = 40% per individual number
```

### Match Probabilities

The probability of exactly `k` matches out of `n` played numbers follows the hypergeometric distribution:

```
P(k matches | n played, 12 drawn, 30 total) = C(12,k) × C(18,n-k) / C(30,n)
```

Where:
- 12 = numbers drawn
- 18 = numbers not drawn (30 - 12)
- n = numbers played on the ticket
- k = exact number of matches

---

## Game Flow

```
Win on slot machine (50% trigger chance)
  │
  ├── Mini game overlay appears
  ├── Player places numbers on tickets (1-5 per ticket)
  ├── Player selects coin value
  ├── Total bet calculated and displayed
  │
  ├── Player clicks DRAW
  │   ├── Bet deducted from balance
  │   ├── 12 numbers drawn randomly
  │   ├── Matches calculated per ticket
  │   ├── Payouts calculated per ticket
  │   └── Total winnings summed
  │
  ├── Animation: drawn numbers revealed one by one
  ├── Matching numbers highlighted on tickets
  ├── Payout displayed
  ├── Balance updated
  │
  └── Mini game closes, return to slot machine
```

---

## Client Implementation (BingoMiniGame class)

The `BingoMiniGame` class within `SlotMachine.ts` manages:

- Ticket UI rendering (5 ticket containers)
- Number selection/deselection with uniqueness enforcement
- Coin value dropdown
- Bet calculation and display
- Draw animation sequence
- Match highlighting
- Payout display
- Integration with main SlotMachine balance

---

## Server Implementation

The server-side `miniGame.ts` handles:

- Random number generation (12 from 30)
- Match counting per ticket
- Payout calculation using the odds table
- Balance deduction and credit
- Game history logging
- State validation (preventing duplicate draws)
