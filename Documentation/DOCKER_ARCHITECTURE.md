# Docker Architecture

## Overview

slotm runs as a 4-service Docker Compose stack on a custom bridge network. The architecture uses a 3-phase startup sequence with healthcheck dependencies to ensure services start in the correct order.

---

## Network

**Network name:** `slotm_net`
**Driver:** bridge
**Subnet:** `172.30.0.0/16`
**Gateway:** `172.30.0.1`

| Service | Container Name | IP Address | Port(s) |
|---------|---------------|------------|---------|
| PostgreSQL | `slotm-postgres` | 172.30.0.11 | 5432 |
| Node.js | `slotm-node` | 172.30.0.10 | 4300 |
| Nginx | `slotm-nginx` | 172.30.0.12 | 80, 443 |
| pgAdmin | `slotm-pgadmin` | 172.30.0.13 | 5050 |

---

## Startup Sequence

```
Phase 1: Infrastructure
  └── PostgreSQL (healthcheck: pg_isready)
        ↓ service_healthy
Phase 2: Application
  └── Node.js (healthcheck: HTTP fetch /login)
        ↓ service_healthy
Phase 3: Proxy & Management
  ├── Nginx (healthcheck: HTTPS wget /)
  └── pgAdmin (healthcheck: HTTP wget /pgadmin/misc/ping)
```

Each phase waits for the previous phase's healthchecks to pass before starting.

---

## Services

### PostgreSQL

**Dockerfile:** `docker/postgres/Dockerfile`
**Base image:** `postgres:17`

| Setting | Value |
|---------|-------|
| Version | PostgreSQL 17 |
| User | Configurable via `POSTGRES_USER` |
| Database | Configurable via `POSTGRES_DB` |
| Data volume | `pgdata:/var/lib/postgresql/data` |
| Healthcheck | `pg_isready -U $POSTGRES_USER -d $POSTGRES_DB` |
| Check interval | 5s (10 retries, 10s start period) |

**Custom entrypoint** (`docker/postgres/entrypoint.sh`):
- Runs `envsubst` on `postgresql.conf.template` to substitute environment variables
- Delegates to official PostgreSQL entrypoint with custom config

**Configuration template** applies environment-specific PostgreSQL settings (memory, connections, logging).

---

### Node.js Application

**Dockerfile:** `docker/node/Dockerfile`
**Base image:** `node:22-slim`

| Setting | Value |
|---------|-------|
| Node.js version | 22 LTS |
| Process manager | PM2 (production) / nodemon (development) |
| Working directory | `/home/node/app` |
| App volume | Bind mount `./app:/home/node/app` |
| Env file | `./app/.env:/home/node/app/.env` (read-only) |
| node_modules | Named volume `node_modules:/home/node/app/node_modules` |
| Healthcheck | `fetch('http://127.0.0.1:$APP_PORT/login')` |
| Check interval | 10s (10 retries, 30s start period) |

**Installed packages:**
- `gosu` — Run processes as non-root user
- `openssl` — SSL certificate generation
- `pm2` — Production process manager

**Entrypoint** (`docker/node/entrypoint.sh`):

```
1. Detect runtime mode: ENV=dev or ENV=prod (defaults to prod)
2. Fix ownership of bind-mounted app directory
3. Source .env file
4. Export PORT and HOST environment variables
5. Check if node_modules exists, run npm install if missing
6. Run: prisma generate (generate Prisma client)
7. Run: prisma migrate deploy (apply pending migrations)
8. Branch:
   ├── DEV MODE:  Run "npm run dev" (nodemon watches src/, auto-rebuilds)
   └── PROD MODE: Run "npm run build:dist", then delegate to PM2
```

---

### Nginx Reverse Proxy

**Dockerfile:** `docker/nginx/Dockerfile`
**Base image:** `nginx:1.27-alpine`

| Setting | Value |
|---------|-------|
| HTTP port | 80 (redirects to HTTPS) |
| HTTPS port | 443 |
| SSL | Self-signed certificate (2048-bit RSA, 10-year validity) |
| Healthcheck | `wget -qO /dev/null --no-check-certificate https://127.0.0.1/` |
| Check interval | 10s (5 retries, 10s start period) |

**SSL certificate generation** (during image build):
```
openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/selfsigned.key \
  -out /etc/nginx/ssl/selfsigned.crt \
  -subj "/CN=localhost"
```

**Configuration template** (`docker/nginx/default.conf.template`):

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl;

    # SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    X-Frame-Options: SAMEORIGIN
    X-Content-Type-Options: nosniff
    X-XSS-Protection: 1; mode=block
    Referrer-Policy: strict-origin-when-cross-origin

    # Upstreams
    upstream slotm_app    → 172.30.0.10:${APP_PORT}
    upstream slotm_pgadmin → 172.30.0.13:5050

    # Routing
    /pgadmin/* → proxy to pgAdmin
    /          → proxy to Node.js

    # Static assets cached 7 days
    ~* \.(css|js|png|jpg|gif|svg|woff2|ico)$ → expires 7d

    # Gzip compression level 6
    # WebSocket support (Upgrade + Connection headers)
}
```

---

### pgAdmin

**Dockerfile:** `docker/pgadmin/Dockerfile`
**Base image:** `dpage/pgadmin4:latest`

| Setting | Value |
|---------|-------|
| Listen port | 5050 |
| Base path | `/pgadmin` |
| Auto-connect | Pre-configured PostgreSQL connection |
| Healthcheck | `wget -qO /dev/null http://127.0.0.1:5050/pgadmin/misc/ping` |
| Check interval | 15s (5 retries, 30s start period) |

**Custom entrypoint** (`docker/pgadmin/entrypoint.sh`):
- Writes `~/.pgpass` file for automatic PostgreSQL authentication
- Sets `PGPASSFILE` environment variable
- Delegates to official pgAdmin entrypoint

**Pre-configured connection** (`docker/pgadmin/servers.json`):
- Server: `172.30.0.11:5432`
- Username: from `POSTGRES_USER`
- Database: from `POSTGRES_DB`

---

## Volumes

| Volume | Mount Point | Purpose | Backup Priority |
|--------|-------------|---------|-----------------|
| `pgdata` | PostgreSQL `/var/lib/postgresql/data` | Database files | **CRITICAL** |
| `node_modules` | `/home/node/app/node_modules` | npm packages | Low (regenerable) |

---

## Environment Variables

All environment variables are defined in the root `.env` file.

### Application

| Variable | Default | Description |
|----------|---------|-------------|
| `ENV` | `dev` | Runtime mode: `dev` or `prod` |
| `BUILD_ENV` | `dev` | Build environment |
| `APP_HOST` | `0.0.0.0` | Listen address |
| `APP_PORT` | `4300` | Listen port |
| `NODE_ENV` | `development` | Node.js environment |

### PostgreSQL

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `172.30.0.11` | Database host (container IP) |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_USER` | `slotm` | Database user |
| `POSTGRES_PASSWORD` | — | Database password |
| `POSTGRES_DB` | `slotm` | Database name |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | JWT signing secret |
| `JWT_EXPIRES_IN` | `14d` | JWT token expiration |

### pgAdmin

| Variable | Default | Description |
|----------|---------|-------------|
| `PGADMIN_EMAIL` | `admin@slotm.dev` | pgAdmin login email |
| `PGADMIN_PASSWORD` | — | pgAdmin login password |

### Stripe (in `app/.env`)

| Variable | Description |
|----------|-------------|
| `STRIPE_KEY` | Publishable key |
| `STRIPE_SECRET` | Secret key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret |

### Computed Variables

```
DATABASE_URL = postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public
```

This is constructed in `docker-compose.yml` and passed to the Node.js container.

---

## Development Mode vs Production Mode

### Development Mode (`ENV=dev`)

```
Node.js entrypoint:
  1. prisma generate + prisma migrate deploy
  2. npm run dev → nodemon
  3. nodemon watches: src/, scripts/, prisma/, tsconfig.backend.json
  4. Ignores: src/client/**, src/generated/**
  5. On file change: rebuild dist + restart server
  6. No PM2 involved
```

| Feature | Behavior |
|---------|----------|
| Process manager | nodemon (auto-restart on changes) |
| File watching | `src/`, `scripts/`, `prisma/` |
| Watch delay | 0.4 seconds |
| Auto-rebuild | Full `build:dist` on every change |
| Auto-migration | Prisma generate + migrate on each restart |
| Logging | morgan with request IDs |

### Production Mode (`ENV=prod`)

```
Node.js entrypoint:
  1. prisma generate + prisma migrate deploy
  2. npm run build:dist (one-time build)
  3. Delegate to CMD: pm2-runtime ecosystem.config.cjs
```

| Feature | Behavior |
|---------|----------|
| Process manager | PM2 |
| Instances | 1 (fork mode) |
| Watch mode | Watches `dist/` directory |
| Watch delay | 1000ms |
| Max memory restart | 256MB |
| Restart delay | 2000ms |
| Max restarts | 10 |
| Auto-restart | Yes |

### PM2 Ecosystem Config (`docker/node/ecosystem.config.cjs`)

```javascript
{
  apps: [{
    name: "slotm",
    script: "/home/node/app/dist/server.js",
    cwd: "/home/node/app",
    instances: 1,
    exec_mode: "fork",
    watch: NODE_ENV !== "production" ? ["/home/node/app/dist"] : false,
    watch_delay: 1000,
    ignore_watch: ["node_modules", "data", ".git"],
    max_memory_restart: "256M",
    restart_delay: 2000,
    max_restarts: 10,
    autorestart: true
  }]
}
```

---

## Common Docker Commands

### Basic Operations

```bash
# Start all services
docker compose up -d

# View application logs
docker compose logs -f node

# Restart application
docker compose restart node

# Stop all services
docker compose down

# Enter Node.js container
docker compose exec node bash
```

### Database Operations

```bash
# PostgreSQL CLI
docker compose exec postgres psql -U slotm -d slotm

# Run Prisma migrations
docker compose exec node bash -c "cd /home/node/app && npx prisma migrate deploy"

# Generate Prisma client
docker compose exec node bash -c "cd /home/node/app && npx prisma generate"
```

### Build & Rebuild

```bash
# Manual application rebuild (inside container)
docker compose exec node bash -c "cd /home/node/app && npm run build:dist"

# Full rebuild (removes volumes — destroys data)
docker compose down -v
docker compose build --no-cache
docker compose up -d

# PM2 reload (production mode)
docker compose exec node pm2 reload slotm
```

### Debugging

```bash
# Check service health
docker compose ps

# View Nginx access logs
docker compose logs -f nginx

# View PostgreSQL logs
docker compose logs -f postgres

# Check PM2 process list
docker compose exec node pm2 list

# Check PM2 logs
docker compose exec node pm2 logs slotm
```

---

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Application | https://localhost/ | User account |
| Application (direct) | http://localhost:4300/ | User account |
| pgAdmin | http://localhost:5050/pgadmin/ | `PGADMIN_EMAIL` / `PGADMIN_PASSWORD` |
| PostgreSQL | localhost:5432 | `POSTGRES_USER` / `POSTGRES_PASSWORD` |

---

## Architecture Diagram

```
                    ┌──────────────────────────────┐
                    │          Internet             │
                    └──────────────┬───────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │     Nginx (172.30.0.12)     │
                    │     :80 → :443 redirect     │
                    │     :443 SSL termination    │
                    ├─────────────┬──────────────┤
                    │  /pgadmin/* │  /*           │
                    └──────┬──────┴──────┬───────┘
                           │             │
              ┌────────────▼──┐   ┌──────▼────────────┐
              │   pgAdmin     │   │   Node.js App      │
              │ (172.30.0.13) │   │  (172.30.0.10)     │
              │   :5050       │   │   :4300             │
              └───────┬───────┘   │                    │
                      │           │  Express + PM2     │
                      │           │  Prisma ORM        │
                      │           └──────┬─────────────┘
                      │                  │
              ┌───────▼──────────────────▼───────┐
              │       PostgreSQL (172.30.0.11)    │
              │       :5432                       │
              │       pgdata volume               │
              └──────────────────────────────────┘
```
