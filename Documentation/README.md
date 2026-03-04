# Blazing Sun — Documentation

## Application Overview

Blazing Sun is a slot machine platform with a space-themed UI, multiple game modes, and a bonus mini game. The application features real-time canvas animations, 3D CSS effects, Stripe payment integration, and a full user account system.

---

## Documentation Index

### Animations & Effects

| Document | Description |
|----------|-------------|
| [SPACE_CONTROLS.md](SPACE_CONTROLS.md) | Star field background system — dual-layer particle engine with 12 configurable settings (star count, speed, gravity, drift, turbulence, perspective, brightness) |
| [WIN_ANIMATION.md](WIN_ANIMATION.md) | Win celebration effects — Magic Stars (rainbow particles) and Confetti (physics-based chunks) with 15+ configurable settings |
| [OPENING_CRAWL.md](OPENING_CRAWL.md) | Star Wars-style opening crawl — 3-phase animation (intro text, logo shrink, perspective crawl) with CSS 3D transforms |

### Game Documentation

| Document | Description |
|----------|-------------|
| [SLOT_MACHINE.md](SLOT_MACHINE.md) | Slot machine game — 1x5 single-line and 3x5 multi-line layouts, 5 game themes, 7 paylines, joker wildcards, full screen space wheels animation, odds & payout system |
| [MINI_GAME.md](MINI_GAME.md) | Bonus mini game — 5 bingo tickets with 1-5 numbers each (1-30 range), 12-number draw, odds table with payouts up to 179.94x |

### Pages

| Document | Description |
|----------|-------------|
| [GAMES_PAGE.md](GAMES_PAGE.md) | Games hub — available games listing and navigation |
| [PROFILE_PAGE.md](PROFILE_PAGE.md) | User profile — picture upload, name editing, password change |
| [WALLET_PAGE.md](WALLET_PAGE.md) | Wallet — balance management, Stripe payments, quick add, transaction history |

---

## Quick Reference

### Routes

| Path | Page | Auth Required |
|------|------|---------------|
| `/` | Home (Opening Crawl) | No |
| `/games` | Games Listing | Yes |
| `/games/slot-machine` | Slot Machine | Yes |
| `/wallet` | Wallet | Yes |
| `/profile` | Profile | Yes |
| `/login` | Login | No |
| `/register` | Register | No |

### Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (stored procedures) |
| Payments | Stripe |
| Frontend | Vanilla TypeScript + ES6 Classes |
| Animations | HTML5 Canvas + CSS 3D Transforms |
| Styling | CSS with Blazing Sun gold theme |
| Auth | JWT (cookie-based) + CSRF tokens |

### Key Source Files

| File | Purpose |
|------|---------|
| `app/src/client/SlotMachine.ts` | Slot machine + mini game client |
| `app/src/client/blazing-background.ts` | Space star field + win animations |
| `app/src/client/opening-crawl.ts` | Opening crawl animation |
| `app/src/game/slotMachine.ts` | Server-side game logic |
| `app/src/game/miniGame.ts` | Mini game draw + payout logic |
| `app/src/game/types.ts` | Game constants + odds tables |
