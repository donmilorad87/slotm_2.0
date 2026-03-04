# TypeScript Architecture

## Overview

slotm is built with **TypeScript 5.9** in maximum-strictness mode with zero `any` usage. The codebase follows a clean architecture pattern: **Controllers → Services → Repositories**, with dependency injection, typed interfaces, and runtime type guards at all boundaries.

**Source file:** `app/src/`

---

## TypeScript Configuration

### Compiler Options (`tsconfig.json`)

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | ES2022 | Modern JavaScript output |
| `module` | NodeNext | Native ESM modules |
| `moduleResolution` | NodeNext | Node.js ESM resolution |
| `strict` | true | All strict checks enabled |
| `noImplicitAny` | true | No implicit `any` types |
| `noUncheckedIndexedAccess` | true | Array/object index access returns `T \| undefined` |
| `noImplicitOverride` | true | Require `override` keyword on subclass methods |
| `noImplicitReturns` | true | All code paths must return |
| `exactOptionalPropertyTypes` | true | Strict optional property handling |
| `useUnknownInCatchVariables` | true | Catch variables typed as `unknown` |
| `verbatimModuleSyntax` | true | Preserve import/export syntax |
| `isolatedModules` | true | Safe for single-file transpilation |
| `skipLibCheck` | true | Skip type checking in `node_modules` |

### Backend Config (`tsconfig.backend.json`)

Extends the base config and excludes `src/client/**/*` since client files are handled by esbuild.

### Zero-Tolerance Rules

| Rule | Enforcement |
|------|-------------|
| Zero `any` | All values typed or narrowed with type guards |
| Zero `@ts-ignore` | No compiler suppression |
| Zero `@ts-expect-error` | No error suppression |
| Zero non-null assertions (`!`) | Runtime checks instead |
| `as` casts only at library boundaries | Stripe API, JWT, JSON.parse — with runtime validation |
| All catch blocks | Explicit `(_: unknown)` parameter |

---

## Build Pipeline

### Two-Stage Build

```
src/client/*.ts  ──→  esbuild (strip types)  ──→  dist/client/*.js
src/**/*.ts      ──→  tsc (full compile)      ──→  dist/**/*.js
```

**Stage 1 — Client TypeScript** (`scripts/build.mjs`)
- Uses `esbuild.transform()` to strip type annotations
- Target: ES2022, Format: ESM
- Outputs plain JavaScript to `dist/client/`
- Also copies non-TS static files (CSS, images, HTML)

**Stage 2 — Server TypeScript** (`tsc -p tsconfig.backend.json`)
- Full TypeScript compilation with source maps
- Excludes `src/client/` (already handled)
- Outputs to `dist/`

### Build Commands

```bash
npm run build:dist      # Full build (esbuild + tsc)
npm run build:server    # Server-only (tsc)
npm run typecheck       # Type check without emit
npm run dev             # Watch mode (nodemon + auto-rebuild)
```

---

## Directory Structure

```
app/src/
├── server.ts              # Application entry point & bootstrap
├── config/
│   └── AppConfig.ts       # Configuration management (ports, JWT, Stripe, paths)
├── controllers/
│   ├── BaseController.ts  # Abstract base with shared utilities
│   ├── AuthController.ts  # Login, register, logout handlers
│   ├── PageController.ts  # HTML page rendering
│   ├── GameController.ts  # Game API (spin, history)
│   ├── WalletController.ts# Balance, Stripe checkout, webhooks
│   └── ProfileController.ts # Profile update, password change, picture upload
├── services/
│   ├── AuthService.ts     # Registration, login, JWT issuance
│   ├── GameService.ts     # Game action routing to engines
│   ├── WalletService.ts   # Balance, Stripe, transactions
│   └── ProfileService.ts  # Profile updates, password change
├── repositories/
│   ├── PrismaConnection.ts# Prisma singleton & connection
│   ├── UserRepository.ts  # User CRUD operations
│   ├── TransactionRepository.ts # Balance & transaction queries
│   └── GameRepository.ts  # Game history & stats
├── interfaces/
│   ├── IUserRepository.ts # User data access contract
│   ├── ITransactionRepository.ts # Transaction contract
│   ├── IGameRepository.ts # Game history contract
│   └── IPaymentGateway.ts # Stripe client contract
├── middlewares/
│   ├── auth.middleware.ts  # JWT extraction, validation, cookie management
│   ├── csrf-session.middleware.ts # Session tracking & CSRF protection
│   ├── request-context.middleware.ts # Request ID generation
│   └── validation.middleware.ts # express-validator error formatting
├── validators/
│   ├── auth.validators.ts # Email/password validation chains
│   ├── game.validators.ts # Game action & history validators
│   ├── wallet.validators.ts # Checkout amount & card validators
│   └── decorator.ts       # Validator middleware wrapper
├── routes/
│   ├── index.ts           # Route registration hub
│   ├── page.routes.ts     # GET page routes
│   ├── auth.routes.ts     # POST auth routes
│   ├── game.routes.ts     # Game API routes
│   ├── wallet.routes.ts   # Wallet API routes
│   └── profile.routes.ts  # Profile API routes
├── game/
│   ├── types.ts           # Constants, odds tables, payline definitions
│   ├── slotMachine.ts     # Spin logic (symbols, grid, payline evaluation)
│   ├── miniGame.ts        # Mini-game logic (bingo draws, payouts)
│   └── engines/
│       ├── AbstractGameEngine.ts  # Base engine (bet/win transactions)
│       ├── SlotSpinEngine.ts      # Slot machine spin handler
│       ├── LegacyMiniGameEngine.ts# Legacy number-pick mini-game
│       ├── TicketMiniGameEngine.ts# Ticket-based bingo mini-game
│       └── GameEngineRegistry.ts  # Engine resolver (action → engine)
├── lib/
│   ├── env.ts             # Environment variable loader
│   ├── security.ts        # Password hashing (PBKDF2), random ID
│   ├── stripe.ts          # Custom Stripe HTTP client (no SDK)
│   ├── stripeWebhook.ts   # Webhook signature verification
│   ├── stripeRedirect.ts  # Checkout return URL builder
│   ├── template.ts        # Handlebars-like template renderer
│   ├── cookies.ts         # Cookie parse/serialize utilities
│   └── payloadParsers.ts  # Safe JSON parsing, type narrowing
├── types/
│   ├── domain.ts          # All domain types, type guards, utility types
│   ├── http.ts            # Express request augmentation
│   └── express.d.ts       # Express module augmentation
├── client/                # Browser-side TypeScript (compiled by esbuild)
│   ├── main.ts            # Slot machine page initialization
│   ├── SlotMachine.ts     # Slot machine UI class (3D reels, animations)
│   ├── auth.ts            # Login/register form handlers
│   ├── wallet.ts          # Wallet page interactions
│   ├── slot-page.ts       # Balance refresh & page bindings
│   ├── http.ts            # Fetch wrapper with CSRF headers
│   ├── opening-crawl.ts   # Star Wars opening crawl animation
│   ├── blazing-background.ts # Space star field + win animations
│   ├── ImageCache.ts      # Symbol image preloader
│   └── types.ts           # Client-side type definitions
└── generated/
    └── prisma/            # Prisma-generated client (gitignored)
```

---

## Server Bootstrap (`server.ts`)

The application boots in a single `main()` function with strict initialization order:

```
1. loadAppEnv()              → Load environment variables
2. connectPrisma()           → Establish database connection
3. new UserRepository()      → Create data access layer
4. new TransactionRepository()
5. new GameRepository()
6. new StripeClient()        → Initialize payment gateway
7. new GameEngineRegistry()  → Register game engines
8. new AuthService()         → Create business logic layer
9. new WalletService()
10. new GameService()
11. new ProfileService()
12. createJwtAuthMiddlewares() → Create auth middleware set
13. createSessionCsrfMiddlewares() → Create session/CSRF middleware
14. new AuthController()     → Create request handlers
15. new PageController()
16. new GameController()
17. new WalletController()
18. new ProfileController()
19. multer()                 → Configure file uploads
20. registerRoutes(app)      → Mount all routes
21. app.listen()             → Start HTTP server
```

### Middleware Stack (applied in order)

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `attachRequestContext` | Generate unique request ID |
| 2 | `ensureSession` | Create session + CSRF token if missing |
| 3 | `helmet()` | Security headers (CSP disabled) |
| 4 | `compression()` | Response compression |
| 5 | `morgan()` | HTTP logging with request/user IDs |
| 6 | CORS middleware | Applied only on `/api` routes |
| 7 | `express.json()` | JSON body parsing (1MB limit) |
| 8 | `express.urlencoded()` | Form body parsing |
| 9 | `apiLimiter` | 600 requests / 15 min on API routes |
| 10 | `authLimiter` | 40 requests / 15 min on auth routes |
| 11 | `requireCsrf` | CSRF token validation |
| 12 | Route handlers | Controller methods |

### Static File Serving

| URL Path | Directory | Purpose |
|----------|-----------|---------|
| `/assets/images/` | `dist/client/images/` | Game symbols, UI graphics |
| `/assets/js/` | `dist/client/` | Compiled client JavaScript |
| `/assets/css/` | `dist/client/styles/` | Stylesheets |
| `/assets/uploads/` | `uploads/` | User profile pictures |

---

## Controller Layer

### BaseController (Abstract)

All controllers extend `BaseController`, which provides:

| Method | Purpose |
|--------|---------|
| `jsonHandler(fn)` | Wrap async handler → catch errors → return JSON |
| `pageHandler(fn)` | Wrap async handler → catch errors → render HTML |
| `requireAuthUser(req)` | Validate JWT, return typed `RequestAuthWithUser` |
| `sanitizeRedirectTarget(value, fallback)` | Prevent open redirect attacks |
| `queryString(query, key)` | Safe query parameter extraction |
| `toInt(value, fallback)` | Safe integer conversion |
| `userInitials(user)` | Generate 2-letter avatar initials |
| `userTemplateData(user)` | Map user to template-safe data |

### Controller Methods

| Controller | Method | Route | Purpose |
|-----------|--------|-------|---------|
| **AuthController** | `handleRegister` | POST `/api/auth/register` | Create account |
| | `handleLogin` | POST `/api/auth/login` | Authenticate |
| | `handleLogout` | POST `/api/auth/logout` | Clear session |
| | `handleLogoutPage` | GET `/logout` | Clear & redirect |
| **PageController** | `handleRootPage` | GET `/` | Home page |
| | `handleGamesPage` | GET `/games` | Games listing |
| | `handleGamePage` | GET `/game` | Slot machine |
| | `handleWalletPage` | GET `/wallet` | Wallet page |
| | `handleLoginPage` | GET `/login` | Login form |
| | `handleRegisterPage` | GET `/register` | Register form |
| | `handleProfilePage` | GET `/profile` | User profile |
| **GameController** | `handleApiGames` | POST `/api/games/slot-machine` | Game actions |
| | `handleHistoryApi` | GET `/api/games/slot-machine/history` | Spin history |
| **WalletController** | `handleBalance` | GET `/api/wallet/balance` | Balance query |
| | `handleTransactions` | GET `/api/wallet/transactions` | Transaction list |
| | `handleCreateTopup` | POST `/api/wallet/create-checkout-session` | Stripe checkout |
| | `handleCreateSetup` | POST `/api/wallet/create-setup-session` | Card setup |
| | `handleRemoveCard` | POST `/api/wallet/remove-card` | Detach card |
| | `handleStripeWebhook` | POST `/api/wallet/stripe/webhook` | Webhook handler |
| **ProfileController** | `handleUpdateProfile` | POST `/api/profile/update` | Update name |
| | `handleChangePassword` | POST `/api/profile/change-password` | Change password |
| | `handleUploadProfilePicture` | POST `/api/profile/upload-picture` | Upload picture |

---

## Service Layer

Services contain all business logic and are injected with repository and gateway interfaces.

### AuthService

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `register` | email, password, redirectTo | `{ token, redirect }` | Validate → hash password → create user → issue JWT |
| `login` | email, password, redirectTo | `{ token, redirect }` | Validate → verify password → issue JWT |
| `issueJwtToken` | user | JWT string | Sign token with `{ sub, email }` claims |

**Custom errors:** `AuthValidationError` (400), `AuthCredentialsError` (401)

### GameService

| Method | Input | Output | Description |
|--------|-------|--------|-------------|
| `handleAction` | payload, userId | `GameEngineResult` | Route action to engine (spin, mini-game, history, stats) |

**Supported actions:** `slot_spin`, `slot_minigame`, `slot_history`, `slot_stats`

### WalletService

| Method | Description |
|--------|-------------|
| `getBalanceCoins(userId)` | Return balance in coins |
| `ensureStripeCustomer(user)` | Create Stripe customer if missing |
| `createTopupSession(user, amount, urls)` | Create Stripe checkout session |
| `createSetupSession(user, urls)` | Create card setup session |
| `listCards(user)` | List saved payment methods |
| `removeCard(userId, methodId)` | Detach payment method |
| `handleWebhookCheckoutCompleted(session, webhookId)` | Process checkout.session.completed |
| `finalizeStripeFromQuery(user, queryParams)` | Handle Stripe return redirect |

### ProfileService

| Method | Description |
|--------|-------------|
| `updateProfile(userId, firstName, lastName)` | Update name (max 100 chars) |
| `changePassword(userId, current, new, confirm)` | Validate old password → hash new |
| `uploadProfilePicture(userId, filename)` | Store uploaded picture path |

---

## Repository Layer

Repositories implement typed interfaces and use Prisma ORM for all database access.

### UserRepository (`IUserRepository`)

| Method | SQL Operation |
|--------|---------------|
| `createUser(email, hash, salt)` | `prisma.user.create()` |
| `getUserByEmail(email)` | `prisma.user.findFirst()` (case-insensitive) |
| `getUserById(userId)` | `prisma.user.findUnique()` |
| `updateUserStripeCustomer(userId, id)` | `prisma.user.update()` |
| `updateUserDefaultPaymentMethod(userId, id)` | `prisma.user.update()` |
| `updateUserProfile(userId, first, last)` | `prisma.user.update()` |
| `updateUserPassword(userId, hash, salt)` | `prisma.user.update()` |
| `updateUserProfilePicture(userId, path)` | `prisma.user.update()` |

### TransactionRepository (`ITransactionRepository`)

| Method | SQL Operation |
|--------|---------------|
| `getBalanceUnits(userId)` | `prisma.user.findUnique()` → select `balanceUnits` |
| `getBalanceCoins(userId)` | `getBalanceUnits() / 100` |
| `deductBalanceUnitsIfSufficient(userId, units)` | Raw SQL with CTE (atomic deduction) |
| `addBalanceUnits(userId, units)` | `prisma.user.update()` → increment |
| `hasTransactionByProviderRef(provider, ref)` | `prisma.transaction.count()` |
| `createTransaction(input)` | `prisma.transaction.create()` |
| `listTransactions(userId, limit)` | `prisma.transaction.findMany()` |
| `listTransactionsPage(userId, limit, skip)` | `prisma.$transaction()` (count + findMany) |

### GameRepository (`IGameRepository`)

| Method | SQL Operation |
|--------|---------------|
| `saveSpin(userId, data)` | `prisma.gameHistory.create()` + optional `pendingMiniGame.create()` |
| `consumePendingMiniGame(userId)` | `prisma.pendingMiniGame.findFirst()` + update `consumedAt` |
| `attachMiniGameToHistory(id, data)` | `prisma.gameHistory.update()` |
| `getUserHistory(userId, limit, skip)` | `prisma.$transaction()` (count + findMany) |
| `getUserStats(userId)` | `prisma.gameHistory.aggregate()` |

---

## Type System (`types/domain.ts`)

### Core Domain Types

| Type | Description |
|------|-------------|
| `SlotUser` | Full user model (id, email, hash, salt, balance, stripe, profile, timestamps) |
| `PublicSlotUser` | User without password fields |
| `SlotSession` | Session record (id, userId, userAgent, ip, timestamps) |
| `SessionWithUser` | Tuple: `[SlotSession, SlotUser]` |
| `JwtUserPayload` | JWT claims: `{ sub, email }` |
| `RequestAuthState` | Auth state: `{ user?, token?, payload? }` |
| `RequestAuthWithUser` | Narrowed auth state with guaranteed user |

### Transaction Types

| Type | Description |
|------|-------------|
| `TransactionDirection` | `"credit" \| "debit"` |
| `TransactionType` | `"spin_bet" \| "spin_win" \| "minigame_bet" \| "minigame_win" \| "topup"` |
| `BetTransactionType` | Extract types ending in `_bet` |
| `WinTransactionType` | Extract types ending in `_win` |
| `TopupTransactionType` | Exclude bets and wins |
| `DirectionForType<T>` | Conditional type: bet → debit, win/topup → credit |
| `CreateTransactionInput` | Input shape for `createTransaction()` |
| `WalletTransaction` | Full transaction record for API responses |

### Game Types

| Type | Description |
|------|-------------|
| `GameModeName` | `"numbers" \| "roman" \| "fruits" \| "animals" \| "emoji"` |
| `RewardModeName` | `"single" \| "multi"` |
| `SaveSpinInput` | Spin data to persist |
| `MiniGameHistoryAttachment` | Mini-game result metadata |
| `UserHistoryItem` | Single spin history entry |
| `UserStats` | Aggregate statistics |

### API Response Types

| Type | Description |
|------|-------------|
| `ApiSuccess<T>` | `{ readonly success: true, readonly data: T }` |
| `ApiError` | `{ readonly success: false, readonly message: string }` |
| `ApiResponse<T>` | `ApiSuccess<T> \| ApiError` |
| `PaginatedPageData<T>` | `{ readonly total, page, total_pages, has_more, items: readonly T[] }` |

### Type Guards

All type guards validate `unknown` values at runtime before narrowing:

| Guard | Validates |
|-------|-----------|
| `isGameModeName(value)` | String is a valid game mode |
| `isRewardModeName(value)` | String is a valid reward mode |
| `isTransactionType(value)` | String is a valid transaction type |
| `isTransactionDirection(value)` | String is `"credit"` or `"debit"` |
| `isJwtUserPayload(value)` | Object has `sub` (number) and `email` (string) |
| `isStripeWebhookEvent(value)` | Object matches Stripe webhook shape |

### Utility Types

| Type | Description |
|------|-------------|
| `Nullable<T>` | `T \| null` |
| `NullableKeys<T extends object>` | Extract keys where value includes `null` |
| `NullableFields<T extends object>` | Pick nullable fields from object |
| `WithRequiredNullables<T extends object>` | Make nullable fields required |
| `JsonPrimitive` | `string \| number \| boolean \| null` |
| `JsonValue` | Recursive JSON value type |
| `JsonInput` | Permissive JSON input type |

---

## Game Engine Architecture

### Engine Registry Pattern

```
GameController.handleApiGames(payload)
  └── GameService.handleAction(payload, userId)
      └── GameEngineRegistry.resolve(action, payload)
          ├── "slot_spin"     → SlotSpinEngine.execute()
          ├── "slot_minigame" → resolver(payload) → LegacyMiniGameEngine | TicketMiniGameEngine
          ├── "slot_history"  → GameService.handleHistory()
          └── "slot_stats"    → GameService.handleStats()
```

### AbstractGameEngine (Base)

All game engines extend this abstract class:

| Protected Method | Purpose |
|-----------------|---------|
| `deductBet(userId, betCoins)` | Atomic balance deduction, returns ok/error |
| `recordBetTransaction(userId, betCoins, desc, meta)` | Create debit transaction |
| `recordWinTransaction(userId, payoutCoins, desc, meta)` | Create credit transaction |
| `recordMiniGameBetTransaction(...)` | Create mini-game debit |
| `recordMiniGameWinTransaction(...)` | Create mini-game credit |

### SlotSpinEngine

1. Normalize spin request from untrusted payload
2. Validate joker bet
3. Deduct total bet (atomic)
4. Record bet transaction
5. Execute spin logic (`executeSpin()`)
6. Record win transaction (if payout > 0)
7. Save spin to game history
8. Check for mini-game trigger
9. Return PHP-compatible response

### Game Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `REEL_COUNT` | 5 | Number of reel columns |
| `SYMBOL_COUNT` | 22 | Total symbol types |
| `GRID_SIZE` | 15 | Grid positions (3×5) |
| `PAYLINE_COUNT` | 7 | Number of paylines |
| `BALANCE_TO_COIN_RATIO` | 100 | Units → coins conversion |
| `JOKER_COST_MULTIPLIER` | 5 | Joker costs 5× bet per line |

---

## Client-Side TypeScript

### Module Structure

| File | Purpose | Loaded On |
|------|---------|-----------|
| `main.ts` | Slot machine initialization | `/game` page |
| `SlotMachine.ts` | Slot machine UI class (3D reels, hit detection) | `/game` page |
| `auth.ts` | Login/register form handlers | `/login`, `/register` |
| `wallet.ts` | Wallet page interactions | `/wallet` |
| `slot-page.ts` | Balance refresh, page bindings | `/game` page |
| `http.ts` | Fetch wrapper with CSRF headers | All pages |
| `opening-crawl.ts` | Star Wars opening crawl | `/` home page |
| `blazing-background.ts` | Space stars + win animations | All pages |
| `ImageCache.ts` | Symbol image preloader | `/game` page |

### CSRF Integration (`http.ts`)

All client-side API calls use the `fetchWithCsrf()` wrapper:

```typescript
// Reads CSRF token from cookie
getCsrfToken() → reads "slotm_csrf" cookie

// Adds headers to every request
withCsrfHeaders(headers) → adds X-CSRF-Token + X-Requested-With

// Wrapped fetch
fetchWithCsrf(url, init) → fetch with CSRF headers + credentials

// JSON POST helper
postJson<T>(url, payload) → POST JSON, parse response, throw on error
```

---

## Dependencies

### Runtime (12 packages)

| Package | Version | Purpose |
|---------|---------|---------|
| `@prisma/adapter-pg` | 7.4 | PostgreSQL adapter for Prisma |
| `@prisma/client` | 7.4 | Prisma ORM client |
| `compression` | 1.8 | Response compression |
| `cors` | 2.8 | CORS middleware |
| `dotenv` | 17.3 | Environment variable loading |
| `express` | 5.2 | HTTP framework |
| `express-rate-limit` | 8.2 | Rate limiting |
| `express-validator` | 7.3 | Request validation |
| `helmet` | 8.1 | Security headers |
| `jsonwebtoken` | 9.0 | JWT signing/verification |
| `morgan` | 1.10 | HTTP logging |
| `multer` | 2.1 | File upload handling |

### Dev (10 packages)

| Package | Version | Purpose |
|---------|---------|---------|
| `@types/compression` | 1.8 | Type definitions |
| `@types/cors` | 2.8 | Type definitions |
| `@types/express` | 5.0 | Type definitions |
| `@types/jsonwebtoken` | 9.0 | Type definitions |
| `@types/morgan` | 1.9 | Type definitions |
| `@types/multer` | 2.0 | Type definitions |
| `@types/node` | 25.3 | Node.js type definitions |
| `esbuild` | 0.27 | Client TypeScript transpiler |
| `prisma` | 7.4 | Prisma CLI |
| `typescript` | 5.9 | TypeScript compiler |

**No Stripe SDK** — the application uses a custom lightweight HTTP client (`src/lib/stripe.ts`) to minimize bundle size and dependencies.
