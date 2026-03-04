# Database Architecture

## Overview

slotm uses **PostgreSQL 17** as its database, accessed through **Prisma 7.4** ORM with the `@prisma/adapter-pg` PostgreSQL adapter. The schema consists of 5 models covering user accounts, sessions, financial transactions, game history, and pending mini-games.

**Schema file:** `app/prisma/schema.prisma`
**Migrations:** `app/prisma/migrations/`
**Generated client:** `app/src/generated/prisma/` (gitignored)

---

## Prisma Configuration

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

- **Provider:** `prisma-client` (Prisma 7.x format)
- **Output:** Generated to `src/generated/prisma/` for TypeScript imports
- **Database URL:** Set via `DATABASE_URL` environment variable
- **Auto-generation:** Runs automatically via `postinstall` hook in `package.json`

### Prisma Commands

```bash
npm run prisma:generate     # Generate client after schema changes
npm run prisma:migrate      # Deploy pending migrations
npm run dev:prisma          # Generate + migrate (used in dev mode)
```

---

## Entity-Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐
│      User       │       │     Session      │
│─────────────────│       │──────────────────│
│ id (PK)         │◄──┐   │ id (PK, UUID)    │
│ email (UNIQUE)  │   │   │ user_id (FK)     │──┐
│ password_hash   │   │   │ user_agent       │  │
│ password_salt   │   │   │ ip_address       │  │
│ balance_units   │   │   │ created_at       │  │
│ stripe_*        │   │   │ expires_at       │  │
│ first_name      │   └───│──────────────────│  │
│ last_name       │       └──────────────────┘  │
│ profile_picture │                              │
│ created_at      │       ┌──────────────────┐   │
│ updated_at      │       │   Transaction    │   │
│                 │◄──────│──────────────────│   │
│                 │       │ id (PK)          │   │
│                 │       │ user_id (FK)     │───┘
│                 │       │ type             │
│                 │       │ direction        │
│                 │       │ amount_units     │
│                 │       │ balance_after    │
│                 │       │ description      │
│                 │       │ provider         │
│                 │       │ provider_ref     │
│                 │       │ metadata_json    │
│                 │       │ created_at       │
│                 │       └────────┬─────────┘
│                 │                │ (bet/win FK)
│                 │       ┌────────▼─────────┐
│                 │◄──────│  GameHistory     │
│                 │       │──────────────────│
│                 │       │ id (PK)          │
│                 │       │ user_id (FK)     │
│                 │       │ bet_tx_id (FK)   │
│                 │       │ win_tx_id (FK)   │
│                 │       │ reels/grid JSON  │
│                 │       │ paylines JSON    │
│                 │       │ game config      │
│                 │       │ mini-game fields │
│                 │       │ created_at       │
│                 │       └────────┬─────────┘
│                 │                │
│                 │       ┌────────▼─────────┐
│                 │◄──────│ PendingMiniGame  │
│                 │       │──────────────────│
│                 │       │ id (PK)          │
│                 │       │ user_id (FK)     │
│                 │       │ game_history_id  │
│                 │       │ created_at       │
│                 │       │ consumed_at      │
└─────────────────┘       └──────────────────┘
```

---

## Models

### User (`users` table)

The central account model. Stores credentials, balance, Stripe customer link, and profile information.

| Column | Prisma Field | Type | Constraints | Description |
|--------|-------------|------|-------------|-------------|
| `id` | `id` | `Int` | PK, autoincrement | User ID |
| `email` | `email` | `String` | UNIQUE | Login email |
| `password_hash` | `passwordHash` | `String` | NOT NULL | PBKDF2 password hash |
| `password_salt` | `passwordSalt` | `String` | NOT NULL | Random salt for hashing |
| `balance_units` | `balanceUnits` | `Int` | DEFAULT 0 | Balance in units (÷100 = coins) |
| `stripe_customer_id` | `stripeCustomerId` | `String?` | NULLABLE | Stripe customer ID |
| `default_payment_method_id` | `defaultPaymentMethodId` | `String?` | NULLABLE | Stripe default payment method |
| `first_name` | `firstName` | `String?` | NULLABLE | First name |
| `last_name` | `lastName` | `String?` | NULLABLE | Last name |
| `profile_picture` | `profilePicture` | `String?` | NULLABLE | Profile picture file path |
| `created_at` | `createdAt` | `DateTime` | DEFAULT now(), TIMESTAMPTZ | Account creation time |
| `updated_at` | `updatedAt` | `DateTime` | DEFAULT now(), auto-update, TIMESTAMPTZ | Last modification time |

**Relations:**
- `sessions` → Session[] (one-to-many)
- `transactions` → Transaction[] (one-to-many)
- `gameHistories` → GameHistory[] (one-to-many)
- `pendingMiniGames` → PendingMiniGame[] (one-to-many)

**Balance system:** Balance is stored in **units** (integer). 100 units = 1 coin. This avoids floating-point precision issues in financial calculations.

---

### Session (`sessions` table)

Tracks active JWT sessions for audit and revocation.

| Column | Prisma Field | Type | Constraints | Description |
|--------|-------------|------|-------------|-------------|
| `id` | `id` | `String` | PK | Session UUID |
| `user_id` | `userId` | `Int` | FK → users.id, CASCADE | Owning user |
| `user_agent` | `userAgent` | `String?` | NULLABLE | Browser user agent |
| `ip_address` | `ipAddress` | `String?` | NULLABLE | Client IP address |
| `created_at` | `createdAt` | `DateTime` | TIMESTAMPTZ | Session start |
| `expires_at` | `expiresAt` | `DateTime` | TIMESTAMPTZ | Session expiry |

**Indexes:**
- `@@index([userId])` — Fast lookup by user
- `@@index([expiresAt])` — Fast expired session cleanup

**Relations:**
- `user` → User (many-to-one, CASCADE delete)

---

### Transaction (`transactions` table)

Immutable ledger of all financial movements: bets, wins, and top-ups.

| Column | Prisma Field | Type | Constraints | Description |
|--------|-------------|------|-------------|-------------|
| `id` | `id` | `Int` | PK, autoincrement | Transaction ID |
| `user_id` | `userId` | `Int` | FK → users.id, CASCADE | Owning user |
| `type` | `type` | `String` | NOT NULL | Transaction type |
| `direction` | `direction` | `String` | NOT NULL | `"credit"` or `"debit"` |
| `amount_units` | `amountUnits` | `Int` | NOT NULL | Amount in units |
| `balance_after_units` | `balanceAfterUnits` | `Int?` | NULLABLE | Balance snapshot after transaction |
| `description` | `description` | `String?` | NULLABLE | Human-readable description |
| `provider` | `provider` | `String?` | NULLABLE | Payment provider (e.g., "stripe") |
| `provider_ref` | `providerRef` | `String?` | NULLABLE | External reference ID |
| `metadata_json` | `metadataJson` | `String?` | NULLABLE | JSON metadata blob |
| `created_at` | `createdAt` | `DateTime` | DEFAULT now(), TIMESTAMPTZ | Transaction timestamp |

**Transaction Types:**

| Type | Direction | Description |
|------|-----------|-------------|
| `spin_bet` | debit | Slot machine bet |
| `spin_win` | credit | Slot machine win payout |
| `minigame_bet` | debit | Mini-game bet |
| `minigame_win` | credit | Mini-game win payout |
| `topup` | credit | Stripe wallet top-up |

**Indexes:**
- `@@index([userId])` — Fast lookup by user

**Relations:**
- `user` → User (many-to-one, CASCADE delete)
- `betHistories` → GameHistory[] (one-to-many, named "BetTransaction")
- `winHistories` → GameHistory[] (one-to-many, named "WinTransaction")

---

### GameHistory (`game_history` table)

Complete record of every slot machine spin, including reel state, payline results, and optional mini-game attachment.

| Column | Prisma Field | Type | Constraints | Description |
|--------|-------------|------|-------------|-------------|
| `id` | `id` | `Int` | PK, autoincrement | History ID |
| `user_id` | `userId` | `Int` | FK → users.id, CASCADE | Player |
| `bet_transaction_id` | `betTransactionId` | `Int?` | FK → transactions.id | Bet transaction reference |
| `win_transaction_id` | `winTransactionId` | `Int?` | FK → transactions.id | Win transaction reference |
| `reels_json` | `reelsJson` | `String` | NOT NULL | JSON array of 5 reel symbols |
| `grid_json` | `gridJson` | `String?` | NULLABLE | JSON 3×5 grid with joker |
| `active_lines_json` | `activeLinesJson` | `String` | NOT NULL | JSON array of active paylines |
| `winning_lines_json` | `winningLinesJson` | `String` | NOT NULL | JSON array of winning payline results |
| `reward_mode` | `rewardMode` | `String` | NOT NULL | `"single"` or `"multi"` |
| `game_type` | `gameType` | `String` | NOT NULL | Game theme name |
| `bet_per_line_coins` | `betPerLineCoins` | `Int` | NOT NULL | Bet per payline in coins |
| `total_bet_coins` | `totalBetCoins` | `Int` | NOT NULL | Total bet (lines × bet + joker cost) |
| `total_payout_coins` | `totalPayoutCoins` | `Int` | NOT NULL | Total payout from winning lines |
| `net_result_coins` | `netResultCoins` | `Int` | NOT NULL | Payout − bet (can be negative) |
| `joker_enabled` | `jokerEnabled` | `Boolean` | DEFAULT false | Whether joker was used |
| `joker_position` | `jokerPosition` | `Int?` | NULLABLE | Grid cell index (0-14) |
| `joker_cost_coins` | `jokerCostCoins` | `Int` | DEFAULT 0 | Joker cost in coins |
| `mini_game_triggered` | `miniGameTriggered` | `Boolean` | DEFAULT false | Whether spin triggered mini-game |
| `mini_game_mode` | `miniGameMode` | `String?` | NULLABLE | Mini-game type |
| `mini_game_played_json` | `miniGamePlayedJson` | `String?` | NULLABLE | Mini-game player input JSON |
| `mini_game_drawn_json` | `miniGameDrawnJson` | `String?` | NULLABLE | Mini-game drawn numbers JSON |
| `mini_game_total_bet_coins` | `miniGameTotalBetCoins` | `Int?` | NULLABLE | Mini-game total bet |
| `mini_game_total_payout_coins` | `miniGameTotalPayoutCoins` | `Int?` | NULLABLE | Mini-game total payout |
| `mini_game_net_result_coins` | `miniGameNetResultCoins` | `Int?` | NULLABLE | Mini-game net result |
| `created_at` | `createdAt` | `DateTime` | DEFAULT now(), TIMESTAMPTZ | Spin timestamp |

**Indexes:**
- `@@index([userId])` — Fast lookup by user

**Relations:**
- `user` → User (many-to-one, CASCADE delete)
- `betTransaction` → Transaction? (named "BetTransaction")
- `winTransaction` → Transaction? (named "WinTransaction")
- `pendingMiniGames` → PendingMiniGame[] (one-to-many)

**JSON columns** store serialized game state:
- `reelsJson`: `[14, 7, 3, 19, 11]` (5 symbol IDs)
- `gridJson`: `[15, 14, 13, 8, 7, 6, 4, 3, 2, 20, 19, 18, 12, 11, 10]` (3×5 grid)
- `activeLinesJson`: `[1, 1, 1, 0, 0, 0, 0]` (7 paylines, 1=active)
- `winningLinesJson`: `[{"symbol":14,"count":3,"multiplier":2.5,...}]`

---

### PendingMiniGame (`pending_minigame` table)

Tracks unconsumed mini-game triggers. When a spin triggers a mini-game, a pending record is created. It is consumed when the player plays the mini-game.

| Column | Prisma Field | Type | Constraints | Description |
|--------|-------------|------|-------------|-------------|
| `id` | `id` | `Int` | PK, autoincrement | Pending ID |
| `user_id` | `userId` | `Int` | FK → users.id, CASCADE | Player |
| `game_history_id` | `gameHistoryId` | `Int` | FK → game_history.id, CASCADE | Triggering spin |
| `created_at` | `createdAt` | `DateTime` | DEFAULT now(), TIMESTAMPTZ | Trigger time |
| `consumed_at` | `consumedAt` | `DateTime?` | NULLABLE, TIMESTAMPTZ | Consumption time (null = pending) |

**Indexes:**
- `@@index([userId])` — Fast lookup by user

**Relations:**
- `user` → User (many-to-one, CASCADE delete)
- `gameHistory` → GameHistory (many-to-one, CASCADE delete)

**Lifecycle:**
1. Spin triggers mini-game → `INSERT` with `consumed_at = NULL`
2. Player plays mini-game → `UPDATE consumed_at = NOW()`
3. Results attached to GameHistory record

---

## Repository Patterns

### Connection Management (`PrismaConnection.ts`)

```typescript
// Singleton Prisma client
getPrisma(): PrismaClient        // Get or create singleton
connectPrisma(): Promise<void>   // Establish connection
disconnectPrisma(): Promise<void> // Close connection
```

Uses `PrismaPg` adapter for PostgreSQL, reading `DATABASE_URL` from environment.

### Atomic Balance Operations

The `TransactionRepository.deductBalanceUnitsIfSufficient()` method uses a raw SQL CTE for atomic balance deduction:

```sql
WITH attempt AS (
  UPDATE users
  SET balance_units = balance_units - $2, updated_at = NOW()
  WHERE id = $1 AND balance_units >= $2
  RETURNING balance_units
)
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM attempt) THEN TRUE ELSE FALSE END AS ok,
  COALESCE(
    (SELECT balance_units FROM attempt),
    (SELECT balance_units FROM users WHERE id = $1)
  ) AS current_balance
```

This ensures:
- No race conditions between balance check and deduction
- Returns current balance whether deduction succeeded or not
- Single round-trip to the database

### Prisma Transactions

Multi-step operations use `prisma.$transaction()`:

```typescript
// Paginated queries: count + findMany in single transaction
const [total, rows] = await this.prisma.$transaction([
  this.prisma.transaction.count({ where: { userId } }),
  this.prisma.transaction.findMany({ ... }),
]);
```

### Column Mapping

All Prisma fields use `@map()` to translate between TypeScript camelCase and PostgreSQL snake_case:

```prisma
passwordHash  String  @map("password_hash")
balanceUnits  Int     @map("balance_units")
createdAt     DateTime @map("created_at")
```

Table names are mapped with `@@map()`:

```prisma
model User { @@map("users") }
model Session { @@map("sessions") }
model Transaction { @@map("transactions") }
model GameHistory { @@map("game_history") }
model PendingMiniGame { @@map("pending_minigame") }
```

---

## Migrations

Migrations are stored in `app/prisma/migrations/` and deployed automatically:
- **Dev mode:** On every nodemon restart (`prisma migrate deploy`)
- **Prod mode:** On container startup (`prisma migrate deploy`)
- **Manual:** `npm run prisma:migrate`

### Initial Migration (`0001_init`)

Creates all 5 tables with:
- Primary keys (autoincrement integers, UUID for sessions)
- Foreign keys with `ON DELETE CASCADE`
- Indexes on `user_id` and `expires_at`
- Default values for `balance_units`, `created_at`, timestamps
- `TIMESTAMPTZ` for all timestamp columns

---

## Database Access Commands

```bash
# PostgreSQL CLI (from host)
docker compose exec postgres psql -U slotm -d slotm

# Common queries
SELECT id, email, balance_units FROM users;
SELECT * FROM transactions WHERE user_id = 1 ORDER BY id DESC LIMIT 10;
SELECT * FROM game_history WHERE user_id = 1 ORDER BY id DESC LIMIT 5;
SELECT * FROM pending_minigame WHERE user_id = 1 AND consumed_at IS NULL;

# pgAdmin web interface
# URL: http://localhost:5050/pgadmin/
# Credentials: PGADMIN_EMAIL / PGADMIN_PASSWORD from .env
```
