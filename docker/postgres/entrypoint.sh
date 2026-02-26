#!/usr/bin/env bash
set -euo pipefail

# Substitute env vars into postgresql.conf template
envsubst < /etc/postgresql/postgresql.conf.template \
         > /etc/postgresql/postgresql.conf

echo "[slotm-postgres] Config generated → /etc/postgresql/postgresql.conf"

# Delegate to the official postgres entrypoint with our custom config
exec docker-entrypoint.sh "$@" -c config_file=/etc/postgresql/postgresql.conf
