#!/bin/sh
set -e

# Write pgpass so pgAdmin auto-connects without prompting
echo "172.30.0.11:5432:${POSTGRES_DB}:${POSTGRES_USER}:${POSTGRES_PASSWORD}" > /tmp/pgpass
chmod 600 /tmp/pgpass

export PGPASSFILE=/tmp/pgpass

exec /entrypoint.sh
