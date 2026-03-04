# slotm — Documentation

## Application Overview

slotm is a slot machine platform with a space-themed UI, multiple game modes, and a bonus mini game. Built with **TypeScript 5.9** (strict mode, zero `any`), **Express 5**, **Prisma 7.4** ORM, and **PostgreSQL 17**. The application features real-time canvas animations, 3D CSS effects, Stripe payment integration, and a full user account system.

---

## Documentation Index

### Architecture & Infrastructure

| Document | Description |
|----------|-------------|
| [TYPESCRIPT_ARCHITECTURE.md](TYPESCRIPT_ARCHITECTURE.md) | Full TypeScript architecture — directory structure, build pipeline (esbuild + tsc), controllers, services, repositories, type system, type guards, game engine architecture, client modules, dependency list |
| [DOCKER_ARCHITECTURE.md](DOCKER_ARCHITECTURE.md) | Docker infrastructure — 4-service stack (PostgreSQL, Node.js, Nginx, pgAdmin), 3-phase startup, dev vs prod modes, PM2 configuration, Nginx reverse proxy, SSL, environment variables |
| [DATABASE.md](DATABASE.md) | Database architecture — Prisma 7.4 ORM, 5 models (User, Session, Transaction, GameHistory, PendingMiniGame), entity-relationship diagram, column definitions, indexes, repository patterns, atomic operations |

### Authentication

| Document | Description |
|----------|-------------|
| [LOGIN_REGISTER.md](LOGIN_REGISTER.md) | Authentication system — JWT cookie auth, registration/login flow, PBKDF2 password hashing, CSRF protection, rate limiting, session management, page templates, security measures |

### Animations & Effects

| Document | Description |
|----------|-------------|
| [SPACE_CONTROLS.md](SPACE_CONTROLS.md) | Star field background system — dual-layer particle engine with 12 configurable settings (star count, speed, gravity, drift, turbulence, perspective, brightness) |
| [WIN_ANIMATION.md](WIN_ANIMATION.md) | Win celebration effects — Magic Stars (rainbow particles) and Confetti (physics-based chunks), 18 configurable controls, real-time configurator panel with localStorage persistence |
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
| `/game` | Slot Machine | Yes |
| `/wallet` | Wallet | Yes |
| `/profile` | Profile | Yes |
| `/login` | Login | No |
| `/register` | Register | No |
| `/logout` | Logout | No |

### API Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login | No |
| POST | `/api/auth/logout` | Logout | No |
| POST | `/api/games/slot-machine` | Game actions (spin, mini-game) | Yes |
| GET | `/api/games/slot-machine/history` | Spin history | Yes |
| GET | `/api/wallet/balance` | Get balance | Yes |
| GET | `/api/wallet/transactions` | Transaction history | Yes |
| POST | `/api/wallet/create-checkout-session` | Stripe checkout | Yes |
| POST | `/api/wallet/create-setup-session` | Card setup | Yes |
| POST | `/api/wallet/remove-card` | Remove card | Yes |
| POST | `/api/wallet/stripe/webhook` | Stripe webhook | No (signature) |
| POST | `/api/profile/update` | Update name | Yes |
| POST | `/api/profile/change-password` | Change password | Yes |
| POST | `/api/profile/upload-picture` | Upload picture | Yes |

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Runtime | Node.js | 22 LTS |
| Language | TypeScript | 5.9 (strict mode) |
| Framework | Express | 5 |
| ORM | Prisma | 7.4 |
| Database | PostgreSQL | 17 |
| Auth | JWT (jsonwebtoken) | 9 |
| Payments | Stripe (custom client) | — |
| Client build | esbuild | 0.27 |
| Server build | tsc | 5.9 |
| Process manager | PM2 | — |
| Reverse proxy | Nginx (SSL) | 1.27 |
| Animations | HTML5 Canvas + CSS 3D | — |

### Key Source Files

| File | Purpose |
|------|---------|
| `app/src/server.ts` | Application entry point & bootstrap |
| `app/src/controllers/` | HTTP request handlers |
| `app/src/services/` | Business logic layer |
| `app/src/repositories/` | Prisma data access layer |
| `app/src/game/` | Slot machine engine, odds, mini-games |
| `app/src/types/domain.ts` | All domain types & type guards |
| `app/src/client/SlotMachine.ts` | Slot machine + mini game client |
| `app/src/client/blazing-background.ts` | Space star field + win animations |
| `app/src/client/opening-crawl.ts` | Opening crawl animation |
| `app/prisma/schema.prisma` | Database schema (5 models) |
| `docker-compose.yml` | 4-service Docker stack |
