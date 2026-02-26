#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/node/app"

# ------------------------------------------------
# 1. Fix ownership of bind-mounted app directory
#    (host files may be owned by a different UID)
# ------------------------------------------------
if ! chown -R node:node "${APP_DIR}" 2>/dev/null; then
    echo "[slotm-node] Some files are read-only (for example mounted .env); continuing without full chown"
fi

# ------------------------------------------------
# 2. Source the root .env so all vars are exported
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
# 4. Build TypeScript → dist/ (as node user)
# ------------------------------------------------
echo "[slotm-node] Building..."
gosu node sh -c "cd ${APP_DIR} && npm run build"

# ------------------------------------------------
# 5. Delegate to CMD (pm2-runtime) as node user
# ------------------------------------------------
echo "[slotm-node] Starting PM2..."
exec gosu node "$@"
