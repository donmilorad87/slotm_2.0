# Games Page

## Overview

The games page serves as the hub for all available games on the platform. Currently it features the Slot Machine as the primary game.

**View:** `app/src/views/games.hbs`
**Route:** `GET /games`
**Route file:** `app/src/routes/page.routes.ts`

---

## Page Layout

```
┌─────────────────────────────────────────────┐
│  Topbar (Logo + Navigation + User Info)     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────┐                        │
│  │  🎰 Slot Machine │                        │
│  │                  │                        │
│  │  [Play Now]      │                        │
│  └─────────────────┘                        │
│                                             │
│  (Space star field background)              │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Available Games

### Slot Machine

- **Route:** `/games/slot-machine`
- **Description:** Full-featured slot machine with 5 game modes
- **Game types:** 1x5 single-line and 3x5 multi-line (7 paylines)
- **Features:** Joker wildcards, mini game bonus, win animations

See [SLOT_MACHINE.md](SLOT_MACHINE.md) for full documentation.

---

## Page Features

- **Authentication required** — User must be logged in to access games
- **Space background** — Full star field animation runs behind the game cards
- **Responsive cards** — Game cards display with the Blazing Sun gold theme
- **Balance display** — Current wallet balance shown in the navigation bar

---

## Navigation

From the games page, users can navigate to:

| Destination | Path | Description |
|-------------|------|-------------|
| Slot Machine | `/games/slot-machine` | Play the slot machine |
| Wallet | `/wallet` | Manage balance and payments |
| Profile | `/profile` | Account settings |
| Home | `/` | Landing page with opening crawl |
