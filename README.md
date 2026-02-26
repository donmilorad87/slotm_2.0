# slotm

Dockerized Node.js slot machine with:

- User registration/login with session auth
- PostgreSQL persistence (stored procedures)
- Stripe wallet top-up / card setup
- Transaction + game history
- PM2 process management
- Nginx reverse proxy with SSL

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

| Service   | URL                       | Purpose              |
|-----------|---------------------------|----------------------|
| App       | https://localhost/        | Slot machine (via Nginx) |
| App direct| http://localhost:4300/    | Direct Node access   |
| pgAdmin   | http://localhost:5050/    | PostgreSQL admin     |
| PostgreSQL| localhost:5432            | Database             |

## Network

Custom bridge: `slotm_net` (172.30.0.0/16)

| Service  | IP           | Port(s) |
|----------|-------------|---------|
| node     | 172.30.0.10 | 4300    |
| postgres | 172.30.0.11 | 5432    |
| nginx    | 172.30.0.12 | 80/443  |
| pgadmin  | 172.30.0.13 | 5050    |

## Data Model

PostgreSQL database: `slotm`

Tables:
- `users`
- `sessions`
- `transactions`
- `game_history`
- `pending_minigame`

All database operations use stored procedures (see `app/migrations/001_init.sql`).

## Stripe Configuration

Set these in `.env`:

- `STRIPE_KEY` - Publishable key
- `STRIPE_SECRET` - Secret key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret

Webhook endpoint: `POST /api/wallet/stripe/webhook`

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

The `app/` directory is bind-mounted into the container. PM2 watches `dist/` for changes in dev mode.
The repo root `.env` is also mounted into the node container at `/home/node/app/.env`, and loaded at startup.

```bash
# Enter node container
docker compose exec node bash

# Run build manually inside container
cd /home/appuser/app && npm run build

# Run tests
cd /home/appuser/app && npm run test:parity
```

## Application URLs

- Login: https://localhost/login
- Register: https://localhost/register
- Game: https://localhost/games/slot-machine
- Wallet: https://localhost/wallet

## Admin Credentials

- pgAdmin: email/password from `PGADMIN_EMAIL`/`PGADMIN_PASSWORD` in `.env`
- PostgreSQL: credentials from `POSTGRES_USER`/`POSTGRES_PASSWORD` in `.env`

## Project Structure

```
slotm/
├── docker-compose.yml
├── .env / .env.example
├── docker/
│   ├── node/          # Node.js + PM2
│   ├── nginx/         # SSL reverse proxy
│   ├── postgres/      # PostgreSQL 17
│   └── pgadmin/       # PostgreSQL admin UI
├── app/
│   ├── src/           # TypeScript source
│   ├── dist/          # Built JavaScript
│   ├── scripts/       # Build scripts
│   ├── tests/         # Test suites
│   ├── migrations/    # PostgreSQL migrations
│   └── package.json
└── data/              # gitignored
```

## Notes

- `pg` is the only npm runtime dependency (native PostgreSQL driver)
- Self-signed SSL certificates are generated at Nginx build time
- Migrations run automatically on app startup via `store.init()`
