#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PM2_APP_NAME="${PM2_APP_NAME:-slotm}"

cd "${APP_DIR}"

echo "[slotm] Building client/server output..."
node ./scripts/build.mjs
npm run build:server

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[slotm] pm2 is not installed; skipping pm2 reload."
  exit 0
fi

if pm2 describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
  echo "[slotm] Reloading PM2 app '${PM2_APP_NAME}'..."
  pm2 reload "${PM2_APP_NAME}" >/dev/null
  echo "[slotm] PM2 app '${PM2_APP_NAME}' reloaded."
else
  echo "[slotm] PM2 app '${PM2_APP_NAME}' not found; skipping reload."
fi
