#!/bin/sh
set -eu

KEYCLOAK_DB_NAME="${KEYCLOAK_DB:-keycloak}"

POSTGRES_HOST="${POSTGRES_HOST:-}"
HOST_ARGS=""
if [ -n "$POSTGRES_HOST" ]; then
  HOST_ARGS="-h $POSTGRES_HOST"
fi

if [ "$(psql $HOST_ARGS -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = '$KEYCLOAK_DB_NAME'")" != "1" ]; then
  psql $HOST_ARGS -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE DATABASE \"$KEYCLOAK_DB_NAME\""
fi
