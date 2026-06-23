# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Despite living under a `rust/` parent directory, **slotm is a Node.js + TypeScript app**, not Rust. The "parity" tests (see Testing) verify behavioral equivalence with an earlier Rust implementation — that history is why the slot engine uses Serbian domain vocabulary (`brojKredita`, `ulog`, `brojLinija`, `nacin`, `dzoker`, `kvote`, `igra`).

All application code lives in `app/`. Run every command below from `app/`.

## Commands

```bash
# Build (two stages: esbuild for client, tsc for server — see Build System)
npm run build:dist        # full build into dist/
npm run typecheck         # tsc --noEmit on tsconfig.backend.json (server only)

# Run
npm run dev               # nodemon: prisma generate+migrate, build, start; watches src/scripts/prisma
npm run dev:once          # single build + start, no watch
npm start                 # run prebuilt dist/server.js

# Prisma
npm run prisma:generate   # regenerate client into src/generated/prisma/ after schema edits
npm run prisma:migrate    # prisma migrate deploy

# Tests
npm test                  # Jest unit tests (tests/unit/**, ts-jest + ESM)
npm run test:unit         # same, --verbose
npm run test:parity       # builds dist/, then node --test on tests/parity/*.test.mjs
npm run test:e2e          # Playwright (tests/e2e/**)

# Run a single test
NODE_OPTIONS='--experimental-vm-modules' npx jest tests/unit/game/slotMachine.test.ts
node --test tests/parity/slot-engine.parity.test.mjs   # after build:dist
npx playwright test tests/e2e/auth.spec.ts
```

Docker: `docker compose up -d` (from repo root) brings up node/postgres/nginx/pgadmin on the `slotm_net` bridge. App is served at `https://localhost/` via Nginx, direct Node at `http://localhost:4300/`. See `README.md` for the full service table and Docker commands.

## Build System (important nuance)

There are **two compilers**, split by directory, and they must not overlap:

- **`src/client/**`** (browser code) → `esbuild` strips types only and emits ES2022 ESM to `dist/client/` (`scripts/build.mjs`). No bundling, no type-checking.
- **everything else in `src/`** (server) → `tsc -p tsconfig.backend.json`, which **excludes `src/client/**`**.

`build.mjs` copies non-`.ts` assets (`.css`, `.hbs`, images) verbatim and skips non-client `.ts` (tsc handles those). Imports use `.js` extensions even in `.ts` source (ESM + `verbatimModuleSyntax`). Client code is therefore type-checked only by your editor / a manual `tsc` over `tsconfig.client.json`, not by the build.

## Architecture

Request flow is a strict layered pipeline, all wired by **manual dependency injection in `src/server.ts`** (the only composition root — there is no DI container):

```
routes/ → controllers/ → services/ → repositories/ (Prisma)  ┐
                       ↘ game/engines/ → repositories/         ┘→ PostgreSQL
```

- **`routes/`** — `registerRoutes()` (routes/index.ts) mounts per-domain route builders. Each builder receives only the specific handler functions + middleware it needs (not whole controllers), keeping coupling explicit.
- **`controllers/`** extend `BaseController`, which provides `jsonHandler`/`pageHandler` wrappers (uniform try/catch → 400/500 JSON), `requireAuthUser`, and input coercion helpers. Controllers are thin; business logic lives in services.
- **`services/`** hold business logic and depend on **`interfaces/` (`IUserRepository`, `ITransactionRepository`, `IGameRepository`, `IPaymentGateway`)**, never on concrete repos — this is what makes services unit-testable with mocks (`tests/unit/helpers/mockFactories.ts`).
- **`repositories/`** are the only place Prisma is touched. `PrismaConnection.ts` owns the singleton client (`connectPrisma`/`getPrisma`/`disconnectPrisma`).

### Game engine pattern

Slot/mini-game logic is dispatched through `GameEngineRegistry`:
- `SlotSpinEngine`, `LegacyMiniGameEngine`, `TicketMiniGameEngine` all extend `AbstractGameEngine`, which centralizes bet deduction and transaction recording.
- The registry maps an `action` string to an engine; the `slot_minigame` action is resolved at runtime by a **resolver** (registered in server.ts) that picks Ticket vs Legacy based on whether the payload has a `tickets` field.
- Pure game math lives in `src/game/slotMachine.ts` and `src/game/miniGame.ts` (deterministic given an RNG function — that's what parity tests pin).

### Money convention

Balances are stored as integer **units**; `1 coin = BALANCE_TO_COIN_RATIO (100) units` (`src/game/types.ts`). Repositories and transactions deal in units (`amountUnits`, `balanceAfterUnits`, `*UnitsIfSufficient`); convert at the engine/service boundary. Never store fractional coins.

## Conventions

- **Strict TypeScript, zero escape hatches.** `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`. No `any`, no `@ts-ignore`/`@ts-expect-error`, no non-null `!`. `as` is allowed only at library boundaries (Stripe, JWT, `JSON.parse`) and must be paired with a runtime check. Catch blocks are `unknown`. Shared types + type guards (`isTransactionType`, `isGameModeName`, `isJwtUserPayload`, …) live in `src/types/domain.ts`.
- **No heavyweight SDKs.** Stripe is a hand-rolled HTTP client (`src/lib/stripe.ts`, + `stripeWebhook.ts`, `stripeRedirect.ts`) — do not add the Stripe npm SDK. Views use a tiny custom Handlebars-subset renderer (`src/lib/template.ts`) over `src/views/*.hbs` — there is no Handlebars dependency; only `{{var}}`, `{{{raw}}}`, and `{{#if}}/{{else}}/{{/if}}` are supported.
- **Middleware order in server.ts is load-bearing.** The Stripe webhook route is registered with `express.raw()` **before** the global `express.json()` (signature needs the raw body). CORS allow-list, origin check, and CSRF (`requireCsrf`) all gate `/api` — preserve this ordering when adding routes.
- `src/generated/prisma/` is generated (gitignored) — never edit by hand; regenerate after editing `prisma/schema.prisma`.

## Testing

Three distinct suites — pick the right one:
- **`tests/unit/`** (Jest, `.test.ts`): services, lib, game math, controllers, type guards. Use mock repos from `tests/unit/helpers/mockFactories.ts`.
- **`tests/parity/`** (`node --test`, `.test.mjs`): import from built `dist/` and assert the TS slot/mini-game/Stripe output matches the original **Rust** behavior. Run `build:dist` first. When changing game math or Stripe logic, keep these green or update them deliberately.
- **`tests/e2e/`** (Playwright): full-stack flows (auth, game, wallet, profile) against a running server.

Follow TDD per the global instructions: write/extend tests before changing game math, money handling, or auth.