#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PM2_APP_NAME="${PM2_APP_NAME:-slotm}"

DEFAULT_CONTAINER_ECOSYSTEM="/home/node/ecosystem.config.cjs"
DEFAULT_LOCAL_ECOSYSTEM="${APP_DIR}/../docker/node/ecosystem.config.cjs"
PM2_ECOSYSTEM_FILE="${PM2_ECOSYSTEM_FILE:-}"

if [ -z "${PM2_ECOSYSTEM_FILE}" ]; then
  if [ -f "${DEFAULT_CONTAINER_ECOSYSTEM}" ]; then
    PM2_ECOSYSTEM_FILE="${DEFAULT_CONTAINER_ECOSYSTEM}"
  elif [ -f "${DEFAULT_LOCAL_ECOSYSTEM}" ]; then
    PM2_ECOSYSTEM_FILE="${DEFAULT_LOCAL_ECOSYSTEM}"
  fi
fi

cd "${APP_DIR}"

echo "[slotm] Building client/server output..."
node ./scripts/build.mjs
npm run build:server

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[slotm] pm2 is not installed; skipping PM2 reset."
  exit 0
fi

if [ -z "${PM2_ECOSYSTEM_FILE}" ] || [ ! -f "${PM2_ECOSYSTEM_FILE}" ]; then
  echo "[slotm] PM2 ecosystem config not found. Set PM2_ECOSYSTEM_FILE to continue."
  exit 1
fi

echo "[slotm] Resetting PM2 app '${PM2_APP_NAME}' from '${PM2_ECOSYSTEM_FILE}'..."
pm2 delete "${PM2_APP_NAME}" >/dev/null 2>&1 || true
pm2 start "${PM2_ECOSYSTEM_FILE}" --only "${PM2_APP_NAME}" --update-env >/dev/null
pm2 save >/dev/null 2>&1 || true
echo "[slotm] PM2 app '${PM2_APP_NAME}' reset complete."
