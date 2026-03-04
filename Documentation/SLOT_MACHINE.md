# Slot Machine

## Overview

The slot machine is the primary game on the platform. It supports two game layouts (1x5 single-line and 3x5 multi-line), five visual themes, joker wildcards, and a bonus mini game. The game runs with a space-themed background and animated win effects.

**Client:** `app/src/client/SlotMachine.ts`
**Game logic:** `app/src/game/slotMachine.ts`
**Types & constants:** `app/src/game/types.ts`
**View:** `app/src/views/slot-machine.hbs`
**Markup:** `app/src/views/slot-machine-markup.html`

---

## Game Layouts

### 1x5 Single-Line Game

```
┌─────────────────────────────────────────┐
│                                         │
│   [ 🍒 ]  [ 🍊 ]  [ 🍋 ]  [ 🍇 ]  [ 🍒 ]   │
│                                         │
│   ──────── 1 Payline (center) ───────── │
│                                         │
└─────────────────────────────────────────┘
```

- **Reels:** 5 columns, 1 visible row
- **Paylines:** 1 (center line only)
- **Reward mode:** Single-line (mode 2)
- Features animated spinning space wheels
- Full visual effect visible in full screen mode

### 3x5 Multi-Line Game

```
┌─────────────────────────────────────────┐
│                                         │
│   [ 🍒 ]  [ 🍊 ]  [ 🍋 ]  [ 🍇 ]  [ 🍉 ]   │  Row 0 (top)
│   [ 🍋 ]  [ 🍒 ]  [ 🍇 ]  [ 🍊 ]  [ 🍒 ]   │  Row 1 (middle)
│   [ 🍊 ]  [ 🍋 ]  [ 🍒 ]  [ 🍉 ]  [ 🍇 ]   │  Row 2 (bottom)
│                                         │
│   ──────── 7 Paylines ─────────         │
│                                         │
└─────────────────────────────────────────┘
```

- **Reels:** 5 columns, 3 visible rows (15 total symbols)
- **Paylines:** Up to 7 (individually toggled)
- **Reward mode:** Multi-line (mode 1)

---

## 7 Paylines (3x5 Grid)

Grid positions are numbered 0-14:

```
 0   1   2   3   4       (top row)
 5   6   7   8   9       (middle row)
10  11  12  13  14       (bottom row)
```

| Line | Pattern | Positions | Shape |
|------|---------|-----------|-------|
| 1 | Middle straight | 5, 6, 7, 8, 9 | ───── |
| 2 | Top straight | 0, 1, 2, 3, 4 | ───── |
| 3 | Bottom straight | 10, 11, 12, 13, 14 | ───── |
| 4 | Down-up diagonal | 5, 11, 7, 3, 9 | ╲╱ |
| 5 | Up-down diagonal | 5, 1, 7, 13, 9 | ╱╲ |
| 6 | Zigzag 1 | 0, 6, 12, 8, 4 | ╲╱╲ |
| 7 | Zigzag 2 | 10, 6, 2, 8, 14 | ╱╲╱ |

Each payline can be toggled on/off. Active lines multiply the bet cost.

---

## Game Modes (Themes)

Five visual themes with different odds multipliers:

| Mode | Theme | Symbols | Odds Multiplier |
|------|-------|---------|-----------------|
| 1 | Numbers | 1-22 as digits | 1.00x (baseline) |
| 2 | Roman | I-XXII Roman numerals | 0.94x (harder) |
| 3 | Fruits | Fruit emoji symbols | 1.08x (easier) |
| 4 | Animals | Animal emoji symbols | 1.03x |
| 5 | Emoji | Mixed emoji symbols | 0.98x |

Switching modes changes the visual symbols on the reels and adjusts the payout odds accordingly.

---

## Game Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `REEL_COUNT` | 5 | Number of reels |
| `SYMBOL_COUNT` | 22 | Unique symbols per mode |
| `GRID_SIZE` | 15 | 3x5 grid positions |
| `PAYLINE_COUNT` | 7 | Maximum paylines |
| `BALANCE_TO_COIN_RATIO` | 100 | Currency conversion |
| `JOKER_COST_MULTIPLIER` | 5 | Joker bet increase |
| `JOKER_SYMBOL` | "jok" | Joker identifier |

---

## Joker Wildcard

- **Cost:** 5x the base bet
- **Function:** Substitutes the symbol immediately before it on the payline
- **Placement:** Player selects joker position on the grid before spinning
- **Effect:** Extends winning combinations by acting as a match

---

## Odds & Payout System

### Base Configuration

- **RTP (Return to Player):** 86%
- **Symbol groups:** 11 groups with decreasing coefficients
- **Group coefficients:** [1.85, 1.75, 1.65, 1.55, 1.45, 1.35, 1.25, 1.15, 1.05, 0.95, 0.85]

### Match Payout Ranges

| Match Count | Probability Range | Multiplier Range |
|-------------|-------------------|------------------|
| 5 of a kind | 0.1% – 0.56% | Up to 179.94x |
| 4 of a kind | 1.8% – 14.5% | Up to 55.36x |
| 3 of a kind | 5.4% – 23.6% | Up to 18.45x |
| 2 of a kind | 15% – 49.7% | Up to 6.59x |

### Payout Calculation

```
multiplier = kvoteTable[groupIndex * 4 + matchOffset]
linePayout = bet × multiplier
totalPayout = sum(linePayout for each winning line)
```

The `kvoteTable` is a pre-computed array of odds based on group coefficients, RTP, and match counts.

---

## Spin Flow

```
Player clicks SPIN
  │
  ├── Validate: sufficient balance, valid bet
  ├── Deduct bet from balance (server-side)
  │
  ├── Generate random symbols (server)
  │   ├── 5 random numbers (1-22) per reel
  │   └── Build grid (1x5 or 3x5)
  │
  ├── Evaluate paylines (server)
  │   ├── For each active payline:
  │   │   ├── Read symbols at payline positions
  │   │   ├── Count consecutive matches (left to right)
  │   │   ├── Apply joker substitution
  │   │   └── Calculate payout if 2+ matches
  │   └── Sum all line payouts
  │
  ├── Check mini game trigger (50% chance if win > 0)
  │
  ├── Return result to client
  │
  └── Client animation
      ├── Spin reel carousel (3D CSS transforms)
      ├── Reveal symbols one by one
      ├── Highlight winning lines
      ├── Show win amount
      ├── Trigger win animation (if win > 0)
      └── Offer mini game (if triggered)
```

---

## Full Screen Mode

Entering full screen mode on the 1x5 game reveals the complete space animation experience:

- Star field expands to fill the entire viewport
- Reel animations use full-width 3D carousel transforms
- Win animations (magic stars or confetti) fill the screen
- Space control settings (gravity, drift, turbulence) become much more visible
- The combination of spinning space wheels and the deep star field creates the full immersive effect

---

## UI Components

### Game Menu Tabs

Horizontal tab bar to switch between the 5 game modes (Numbers, Roman, Fruits, Animals, Emoji).

### Payline Toggles

7 toggle buttons (3x5 mode only) to enable/disable individual paylines. Each active line adds to the bet cost.

### Bet Controls

- **Coin value selector** — Sets the base bet amount
- **Spin button** — Executes the spin
- **Balance display** — Shows current credits
- **Win display** — Shows last win amount

### Reel Display

- 3D CSS carousel transforms for reel spinning animation
- Symbol images cached via `ImageCache.ts` for smooth rendering
- Symbols styled with CSS variables:
  - `--symbol-text` for symbol color
  - `--symbol-glow` for glow effects

### Toast Notifications

In-game messages for:
- Insufficient balance warnings
- Win announcements
- Mini game triggers
- Error messages

---

## CSS Theme Variables

```css
--slot-bg-gradient     /* Reel background */
--card-bg              /* Card backgrounds */
--input-bg             /* Input fields */
--text-primary         /* Primary text (gold) */
--symbol-text          /* Symbol color */
--symbol-glow          /* Symbol glow effect */
--success-color        /* Win highlights (green) */
--danger-color         /* Error/loss (red) */
--warning-color        /* Warnings (orange) */
```
