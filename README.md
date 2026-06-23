# slotm

A Dockerized Node.js + TypeScript application. It contains two feature areas:

1. **Slot machine** — a credits-based slot/mini-game with JWT auth, wallet/Stripe top-ups, and
   game history (the original app).
2. **Brand Compliance Checker** — upload a client PowerPoint, check it against ACME's brand rules
   (deterministic rules + AI-from-guidelines), review/accept findings per slide, and download a
   corrected deck. See **[Documentation/BRAND_COMPLIENCE_CHECK.md](Documentation/BRAND_COMPLIENCE_CHECK.md)** for the full feature walkthrough.

This README is for **developers** — how the infrastructure is wired and how to run, build, and work
on the project.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 (LTS) |
| Language | TypeScript 5.9 (strict, zero `any`) |
| Web framework | Express 5 |
| ORM | Prisma 7.4 + `@prisma/adapter-pg` |
| Database | PostgreSQL 17 |
| Auth | JWT (cookie) + session/CSRF middleware |
| Payments | Stripe (custom HTTP client, no SDK) |
| Client build | esbuild (type-strip only) |
| Server build | `tsc` |
| Process manager | PM2 (`pm2-runtime`) |
| Reverse proxy | Nginx 1.27 (self-signed SSL) |
| PPTX engine | `jszip` + `fast-xml-parser` (raw OOXML) |
| Slide rendering | LibreOffice (headless) + `poppler-utils` (`pdftoppm`) |
| AI | Claude Code CLI (`@anthropic-ai/claude-code`) installed in the node image |

> The Brand Compliance feature deliberately avoids heavy SDKs: PPTX is read/edited as raw OOXML,
> Stripe is a hand-rolled client, and the views use a tiny custom Handlebars-subset renderer.

---

## Docker infrastructure

Four services on a custom bridge network **`slotm_net` (172.30.0.0/16)**, defined in
`docker-compose.yml`. Each service has a `Dockerfile` under `docker/<service>/`.

| Service | Container | IP | Ports (host) | Purpose |
|---------|-----------|-----|--------------|---------|
| **node** | slotm-node | 172.30.0.10 | 4300 | The Express app (PM2) |
| **postgres** | slotm-postgres | 172.30.0.11 | 5432 | PostgreSQL 17 |
| **nginx** | slotm-nginx | 172.30.0.12 | 80, 443 | SSL reverse proxy + static |
| **pgadmin** | slotm-pgadmin | 172.30.0.13 | 5050 | DB admin UI |

**URLs**

| What | URL |
|------|-----|
| App (via Nginx, SSL) | https://localhost/ |
| App (direct Node) | http://localhost:4300/ |
| pgAdmin (via Nginx) | https://localhost/pgadmin/ |
| pgAdmin (direct) | http://localhost:5050/ |
| PostgreSQL | localhost:5432 |

### The `node` image (important)

`docker/node/Dockerfile` is a `node:22-slim` base plus, beyond the app runtime:

- **LibreOffice + poppler-utils + Carlito fonts** — to render slides to PNGs
  (`soffice --headless --convert-to pdf` → `pdftoppm`). Carlito is metric-compatible with Calibri
  so rendered text geometry matches the brand font.
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`) — the AI engine for the Brand
  Compliance feature, authenticated via the `CLAUDE_CODE_OAUTH_TOKEN` env var.
- **PM2** — runs the app as PID 1 via `pm2-runtime`.

The `entrypoint.sh` runs `prisma generate` + `prisma migrate deploy`, builds `dist/`, then starts
PM2 — so a `docker compose restart node` picks up source changes (it rebuilds on boot).

### Volumes

| Volume | Purpose | Backup |
|--------|---------|--------|
| `pgdata` | PostgreSQL data | **critical** |
| `uploads` (bind under `app/uploads`) | user uploads incl. `compliance/` PPTX + slide PNGs | important |
| `frontend_node_modules` | node_modules cache | regenerable |

`app/` is **bind-mounted** into the node container; `app/.env` is mounted and loaded via `dotenv`.

---

## Quick start

```bash
# 1. Configure environment
cp .env.example .env        # fill in secrets (see Environment below)

# 2. Build + start everything
docker compose up -d

# 3. Verify
docker compose ps           # all containers healthy
docker compose logs -f node # watch the app boot (migrate → build → PM2)
```

Open https://localhost/ (accept the self-signed cert), register a user, and you're in.

---

## Environment (`.env` at repo root)

`docker-compose.yml` interpolates these into the containers. **`.env` is gitignored — never commit
secrets.** See `.env.example` for the template.

```bash
# Build / runtime
ENV=dev                      # dev | prod (node container mode)
NODE_ENV=development
APP_HOST=0.0.0.0
APP_PORT=4300

# PostgreSQL
POSTGRES_HOST=172.30.0.11
POSTGRES_PORT=5432
POSTGRES_USER=slotm
POSTGRES_PASSWORD=...
POSTGRES_DB=slotm
DATABASE_URL=postgresql://slotm:...@172.30.0.11:5432/slotm?schema=public

# Auth
JWT_SECRET=...
JWT_EXPIRES_IN=14d

# pgAdmin
PGADMIN_EMAIL=admin@slotm.dev
PGADMIN_PASSWORD=...

# Stripe (wallet top-ups) — optional for slot machine
STRIPE_KEY=...               # publishable
STRIPE_SECRET=...
STRIPE_WEBHOOK_SECRET=...

# Brand Compliance AI (Claude Code CLI in the container)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...   # from `claude setup-token`; required for the AI pass
CLAUDE_MODEL=sonnet                         # haiku | sonnet (default) | opus
```

---

## Build system

Two compilers, split by directory (they must not overlap):

1. **Client** (`src/client/**`) → **esbuild** strips types and emits ES2022 ESM to `dist/client/`
   (`scripts/build.mjs`). No bundling, no type-checking. Each `src/client/<page>.ts` is served at
   `/assets/js/<page>.js` and referenced from its `.hbs` view.
2. **Server** (everything else in `src/`) → **`tsc -p tsconfig.backend.json`** to `dist/`
   (excludes `src/client/**`). Non-`.ts` files (`.hbs`, `.css`, images, seed `.md`) are copied verbatim.

```bash
npm run build:dist     # full build (client + server)
npm run typecheck      # tsc --noEmit (server) — run before committing
```

Imports use **`.js` extensions** in `.ts` source (ESM + `verbatimModuleSyntax`).

---

## Development workflow

```bash
docker compose exec node bash             # shell into the app container
cd /home/node/app

npm run build:dist                        # rebuild dist/ after changes
npx tsc -p tsconfig.backend.json --noEmit # typecheck
docker compose restart node               # apply changes (entrypoint rebuilds + restarts PM2)

docker compose logs -f node               # tail app logs
docker compose exec postgres psql -U slotm -d slotm   # DB shell
```

- **Dev mode** (`ENV=dev`): nodemon watches `src/`, `scripts/`, `prisma/`.
- **Prod mode** (`ENV=prod`): build once + PM2 (`pm2-runtime`); restart the container to redeploy.

### Database & Prisma

Models live in `prisma/schema.prisma`; migrations in `prisma/migrations/NNNN_name/`.

```bash
# Inside the node container:
npx prisma migrate dev --name <change>    # create + apply a migration (dev DB)
npx prisma generate                        # regenerate client into src/generated/prisma/
```

> **Note:** the live DB has some pre-existing index-name drift, so `prisma migrate dev` may want to
> reset. Additive migrations in this repo are applied **non-destructively** (hand-written SQL via
> `psql`, then `prisma migrate resolve --applied <name>`) to avoid wiping data. Follow that pattern
> for additive changes.

---

## Project structure

```
slotm/
├── docker-compose.yml
├── .env / .env.example
├── Documentation/
│   └── BRAND_COMPLIENCE_CHECK.md    # Brand Compliance feature walkthrough
├── docker/
│   ├── node/      (Dockerfile, entrypoint.sh, ecosystem.config.cjs — LibreOffice + Claude CLI + PM2)
│   ├── nginx/     (default.conf.template — SSL, client_max_body_size 35m, proxy timeouts)
│   ├── postgres/  (PostgreSQL 17)
│   └── pgadmin/
└── app/
    ├── prisma/                     # schema + migrations
    └── src/
        ├── server.ts               # composition root (manual DI wires everything)
        ├── config/                 # AppConfig
        ├── routes/                 # per-domain route builders, registered in index.ts
        ├── controllers/            # thin HTTP handlers (extend BaseController)
        ├── services/               # business logic (Auth, Wallet, Game, Profile,
        │                           #   Compliance, ComplianceAi, Guideline, DeterministicRule)
        ├── repositories/           # Prisma data access (the only place Prisma is touched)
        ├── interfaces/             # repo/gateway contracts (services depend on these, not concretes)
        ├── lib/                    # stripe, claudeCli, template engine, cookies, security, env
        ├── compliance/             # PPTX engine: PptxDocument, xml, model, deterministic, renderPreview
        ├── game/                   # slot/mini-game engines + math
        ├── client/                 # browser TS (esbuild) — one file per page
        ├── views/                  # .hbs templates (custom renderer)
        ├── generated/prisma/       # generated client (gitignored)
        └── assets/seed/            # seed data (ACME guidelines markdown)
```

### Architecture

Strict **layered DI**, assembled in `src/server.ts` (the only composition root — no container):

```
routes/ → controllers/ → services/ → repositories/ (Prisma) → PostgreSQL
                                   ↘ compliance/ (PPTX engine), lib/claudeCli (AI)
```

Controllers are thin and extend `BaseController` (uniform JSON error handling, auth helpers).
Services hold the logic and depend on `interfaces/` (so they're unit-testable with mocks).
Repositories are the only code that touches Prisma. Pages render `.hbs` via the custom template
engine in `src/lib/template.ts`.

---

## Feature: Slot machine

JWT cookie auth, wallet credits with Stripe top-ups (`POST /api/wallet/stripe/webhook` uses the
custom Stripe client), a slot engine with paylines/joker/mini-game, and game history. Balances are
stored as integer **units** (`1 coin = 100 units`). Pages: `/`, `/games`, `/games/slot-machine`,
`/wallet`, `/profile`.

## Feature: Brand Compliance Checker

Upload `.pptx` → hybrid scan (deterministic DB rules + AI checking against editable guidelines) →
per-slide review with accept/reject/undo → apply accepted fixes → corrected deck, with
original/annotated/corrected previews and downloads. Pages: `/compliance`, `/compliance/history`,
`/guidelines`, `/rules`. **Full details: [Documentation/BRAND_COMPLIENCE_CHECK.md](Documentation/BRAND_COMPLIENCE_CHECK.md).**

Requires `CLAUDE_CODE_OAUTH_TOKEN` for the AI pass (deterministic rules work without it).

---

## Testing

```bash
# Inside the node container (cd /home/node/app):
npm test                 # Jest unit tests (tests/unit/**)
npm run test:parity      # node --test parity tests (build dist first)
npm run test:e2e         # Playwright end-to-end
npx tsc -p tsconfig.backend.json --noEmit   # typecheck
```

---

## Common commands

```bash
docker compose up -d                 # start all
docker compose restart node          # redeploy app code
docker compose logs -f node          # logs
docker compose build node            # rebuild node image (after Dockerfile change)
docker compose down                  # stop
docker compose down -v               # stop + wipe volumes (DESTROYS DB)
docker compose exec node bash        # app shell
docker compose exec postgres psql -U slotm -d slotm   # DB shell
```

## Admin credentials

- **pgAdmin:** `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` from `.env`
- **PostgreSQL:** `POSTGRES_USER` / `POSTGRES_PASSWORD` from `.env`

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| **Claude chip shows "offline"** | Missing/expired `CLAUDE_CODE_OAUTH_TOKEN`, or rate-limited mid-scan. Re-generate the token, set it in `.env`, `docker compose up -d node`. Test in-container: `claude -p ok --output-format json`. |
| **413 on PPTX upload** | Nginx body limit. `client_max_body_size 35m` is set in the template — rebuild nginx (`docker compose build nginx && docker compose up -d nginx`) if you changed it. |
| **No slide previews** | LibreOffice/poppler missing or render failed (panel still works without images). Confirm `which soffice pdftoppm` in the node container; rebuild the image if absent. |
| **AI scan is slow** | Each slide is one CLI call (API-latency-bound). Use `CLAUDE_MODEL=haiku` for faster runs; deterministic rules + previews are instant regardless. |
| **`prisma migrate dev` wants to reset** | Pre-existing index drift. Apply additive migrations non-destructively (see Database & Prisma). |
| **Code changes not live** | `docker compose restart node` (entrypoint rebuilds `dist/`), or `npm run build:dist` in the container. |
