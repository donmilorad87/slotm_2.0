#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/node/app"
RUN_MODE_RAW="${ENV:-${BUILD_ENV:-prod}}"
RUN_MODE="$(printf '%s' "${RUN_MODE_RAW}" | tr '[:upper:]' '[:lower:]')"

if [ "${RUN_MODE}" != "dev" ] && [ "${RUN_MODE}" != "prod" ]; then
    echo "[slotm-node] Unknown ENV='${RUN_MODE_RAW}', expected 'dev' or 'prod'. Falling back to prod."
    RUN_MODE="prod"
fi

echo "[slotm-node] Runtime mode: ${RUN_MODE}"

# ------------------------------------------------
# 1. Fix ownership of bind-mounted app directory
#    (host files may be owned by a different UID)
# ------------------------------------------------
if ! chown -R node:node "${APP_DIR}" 2>/dev/null; then
    echo "[slotm-node] Some files are read-only (for example mounted .env); continuing without full chown"
fi

# ------------------------------------------------
# 2. Source app .env (Node-only secrets) so vars are exported
# ------------------------------------------------
if [ -f "${APP_DIR}/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "${APP_DIR}/.env"
    set +a
    echo "[slotm-node] Loaded .env"
fi

# Map APP_PORT → PORT for the Node server
export PORT="${APP_PORT:-4300}"
export HOST="${APP_HOST:-0.0.0.0}"

# ------------------------------------------------
# 3. Install dependencies if needed (as node user)
# ------------------------------------------------
if [ ! -f "${APP_DIR}/node_modules/.package-lock.json" ]; then
    echo "[slotm-node] Installing npm dependencies..."
    gosu node sh -c "cd ${APP_DIR} && npm install"
fi

# ------------------------------------------------
# 4. Mode switch:
#    - dev: run npm run dev directly (no PM2)
#    - prod: build dist once, then delegate to PM2 CMD
# ------------------------------------------------
if [ "${RUN_MODE}" = "dev" ]; then
    echo "[slotm-node] Starting npm run dev (nodemon, no PM2)..."
    exec gosu node sh -c "cd ${APP_DIR} && npm run dev"
fi

echo "[slotm-node] Building dist (prod mode)..."
gosu node sh -c "cd ${APP_DIR} && npm run build:dist"

echo "[slotm-node] Starting PM2 (prod mode)..."
exec gosu node "$@"
