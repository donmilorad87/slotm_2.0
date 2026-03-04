# slotm

Dockerized Node.js slot machine application built with strict TypeScript and Prisma ORM.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
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
| Reverse proxy | Nginx (SSL) | — |

## Features

- User registration/login with JWT cookie auth
- Slot machine with 5 game modes, 7 paylines, joker system
- Mini-game (legacy number pick + ticket mode)
- Stripe wallet top-up and card management
- Transaction and game history with pagination
- Profile management (name, password, picture upload)
- Helmet, CORS, rate limiting, CSRF protection

## TypeScript Configuration

The codebase uses maximum strictness with zero `any` usage:

```jsonc
// tsconfig.json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitReturns": true,
  "exactOptionalPropertyTypes": true,
  "useUnknownInCatchVariables": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true
}
```

**Key practices:**
- Zero `any` — all values typed or narrowed with type guards
- Zero `@ts-ignore` / `@ts-expect-error` — no compiler suppression
- Zero non-null assertions (`!`) — runtime checks instead
- Type assertions (`as`) only at library boundaries (Stripe API, JWT, JSON.parse) with runtime validation
- All catch blocks use explicit `unknown` typing
- Custom type guards: `isTransactionType()`, `isTransactionDirection()`, `isJwtUserPayload()`, `isGameModeName()`, `isRewardModeName()`, `isGameModeId()`
- Shared domain types in `src/types/domain.ts` with `as const satisfies`, template literal types, conditional types, and mapped types

## Prisma ORM

Prisma 7 with the PostgreSQL adapter replaces raw SQL queries.

**Schema** (`prisma/schema.prisma`):

| Model | Table | Purpose |
|-------|-------|---------|
| `User` | `users` | Accounts, balance, Stripe customer link |
| `Session` | `sessions` | JWT session tracking |
| `Transaction` | `transactions` | Wallet credits/debits with metadata |
| `GameHistory` | `game_history` | Spin results, mini-game attachments |
| `PendingMiniGame` | `pending_minigame` | Unconsumed mini-game triggers |

**Generated client** outputs to `src/generated/prisma/` and is auto-generated on `npm install` via the `postinstall` hook.

**Commands:**

```bash
# Generate Prisma client after schema changes
npm run prisma:generate

# Deploy migrations
npm run prisma:migrate

# Generate + migrate (used in dev mode)
npm run dev:prisma
```

## Quick Start

```bash
# 1. Copy and fill in environment variables
cp .env.example .env

# 2. Build and start all services
docker compose up -d

# 3. Verify all containers are healthy
docker compose ps
```

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| App | https://localhost/ | Slot machine (via Nginx) |
| App direct | http://localhost:4300/ | Direct Node access |
| pgAdmin | https://localhost/pgadmin/ | PostgreSQL admin (via Nginx) |
| pgAdmin direct | http://localhost:5050/ | PostgreSQL admin (direct) |
| PostgreSQL | localhost:5432 | Database |

## Network

Custom bridge: `slotm_net` (172.30.0.0/16)

| Service | IP | Port(s) |
|---------|-----|---------|
| node | 172.30.0.10 | 4300 |
| postgres | 172.30.0.11 | 5432 |
| nginx | 172.30.0.12 | 80/443 |
| pgadmin | 172.30.0.13 | 5050 |

## Build System

The build has two stages:

1. **Client TypeScript** — `esbuild` strips type annotations from `src/client/*.ts` and outputs plain ES2022 JavaScript to `dist/client/`
2. **Server TypeScript** — `tsc` compiles `src/**/*.ts` (excluding `src/client/`) to `dist/` with source maps

```bash
# Full build (client + server)
npm run build:dist

# Type-check only (no emit)
npm run typecheck
```

The `tsconfig.backend.json` extends the base config and excludes `src/client/**/*` since client files are handled by esbuild.

## Stripe Configuration

Set these in `app/.env`:

- `STRIPE_KEY` — Publishable key
- `STRIPE_SECRET` — Secret key
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret

Webhook endpoint: `POST /api/wallet/stripe/webhook`

The Stripe integration uses a custom HTTP client (`src/lib/stripe.ts`) instead of the official SDK to minimize dependencies.

## Docker Commands

```bash
# View logs
docker compose logs -f node

# Restart application
docker compose restart node

# PostgreSQL CLI
docker compose exec postgres psql -U slotm -d slotm

# Full rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Development

The `app/` directory is bind-mounted into the container.
The `app/.env` file is mounted into the node container at `/home/node/app/.env`, and loaded at startup via `dotenv`.

- **Dev mode** (`ENV=dev`): nodemon watches `src/`, `scripts/`, and `prisma/` — runs `prisma generate`, `prisma migrate deploy`, builds `dist/`, then starts the server. Auto-restarts on file changes.
- **Prod mode** (`ENV=prod`): builds `dist/` once and starts PM2.

```bash
# Enter node container
docker compose exec node bash

# Manual rebuild
cd /home/node/app && npm run build:dist

# Manual app reload (prod mode)
pm2 reload slotm

# Run tests
cd /home/node/app && npm run test:parity
```

## Application URLs

- Login: https://localhost/login
- Register: https://localhost/register
- Game: https://localhost/games/slot-machine
- Wallet: https://localhost/wallet
- Profile: https://localhost/profile
- pgAdmin: https://localhost/pgadmin/

## Admin Credentials

- pgAdmin: email/password from `PGADMIN_EMAIL`/`PGADMIN_PASSWORD` in `.env`
- PostgreSQL: credentials from `POSTGRES_USER`/`POSTGRES_PASSWORD` in `.env`

## Project Structure

```
slotm/
├── docker-compose.yml
├── .env / .env.example
├── docker/
│   ├── node/              # Node.js + PM2
│   ├── nginx/             # SSL reverse proxy
│   ├── postgres/          # PostgreSQL 17
│   └── pgadmin/           # PostgreSQL admin UI
├── app/
│   ├── prisma/
│   │   ├── schema.prisma  # Prisma schema (models, relations)
│   │   └── migrations/    # Prisma migration history
│   ├── src/
│   │   ├── client/        # Browser TypeScript (esbuild)
│   │   ├── config/        # AppConfig
│   │   ├── controllers/   # Express request handlers
│   │   ├── game/          # Slot engine, mini-game, odds
│   │   ├── generated/     # Prisma generated client (gitignored)
│   │   ├── interfaces/    # Repository + gateway contracts
│   │   ├── lib/           # Utilities (cookies, security, stripe, template)
│   │   ├── middlewares/    # Auth, CSRF, rate limiting
│   │   ├── repositories/  # Prisma data access layer
│   │   ├── routes/        # Express route definitions
│   │   ├── services/      # Business logic (auth, wallet)
│   │   ├── types/         # Domain types, type guards
│   │   └── server.ts      # Application entry point
│   ├── dist/              # Built JavaScript (gitignored)
│   ├── scripts/           # Build scripts
│   ├── tests/             # Test suites
│   └── package.json
└── data/                  # Docker volumes (gitignored)
```

## Dependencies

**Runtime** (11 packages):
`@prisma/adapter-pg`, `@prisma/client`, `compression`, `cors`, `dotenv`, `express`, `express-rate-limit`, `express-validator`, `helmet`, `jsonwebtoken`, `morgan`, `multer`

**Dev** (8 packages):
`@types/compression`, `@types/cors`, `@types/express`, `@types/jsonwebtoken`, `@types/morgan`, `@types/multer`, `@types/node`, `esbuild`, `prisma`, `typescript`

No Stripe SDK — the app uses a custom lightweight HTTP client to minimize bundle size.
