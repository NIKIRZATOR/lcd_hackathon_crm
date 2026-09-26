#!/bin/sh
set -eu

root=/backups
stamp=$(date -u +%Y-%m-%d_%H-%M-%S)
daily_days=${BACKUP_RETENTION_DAILY:-7}
weekly_days=$((${BACKUP_RETENTION_WEEKLY:-4} * 7))
monthly_days=$((${BACKUP_RETENTION_MONTHLY:-3} * 31))

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
ensure_root() {
  for component in postgres minio keycloak; do
    mkdir -p "$root/$component/daily" "$root/$component/weekly" "$root/$component/monthly"
  done
}
checksum() { sha256sum "$1" > "$1.sha256"; }
prune() { find "$1" -mindepth 1 -maxdepth 1 -mtime +"$2" -exec rm -rf {} +; }

promote_file() {
  source=$1 component=$2
  if test "$(date -u +%u)" = 7; then
    cp "$source" "$root/$component/weekly/"
    cp "$source.sha256" "$root/$component/weekly/"
    test ! -f "$source.json" || cp "$source.json" "$root/$component/weekly/"
  fi
  if test "$(date -u +%d)" = 01; then
    cp "$source" "$root/$component/monthly/"
    cp "$source.sha256" "$root/$component/monthly/"
    test ! -f "$source.json" || cp "$source.json" "$root/$component/monthly/"
  fi
  prune "$root/$component/daily" "$daily_days"
  prune "$root/$component/weekly" "$weekly_days"
  prune "$root/$component/monthly" "$monthly_days"
}

backup_postgres() {
  ensure_root
  target="$root/postgres/daily/postgres_${stamp}.dump"
  temporary="${target}.partial"
  log "Starting PostgreSQL backup"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -Fc -f "$temporary" "$POSTGRES_DB"
  test -s "$temporary" || fail "PostgreSQL dump is empty"
  mv "$temporary" "$target"
  checksum "$target"
  printf '{"created_at":"%s","component":"postgres","format":"pg_dump custom"}\n' "$(date -u +%FT%TZ)" > "$target.json"
  promote_file "$target" postgres
  log "PostgreSQL backup completed: $(basename "$target")"
}

backup_minio() {
  ensure_root
  target="$root/minio/daily/minio_${stamp}"
  log "Starting MinIO backup"
  mc alias set source "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
  mc ls --json source | jq -r 'select(.type == "folder") | .key | rtrimstr("/")' | while IFS= read -r bucket; do
    test -n "$bucket" || continue
    mc mirror --overwrite "source/$bucket" "$target/$bucket"
  done
  find "$target" -type f -print0 | sort -z | xargs -0 sha256sum > "$target.sha256"
  printf '{"created_at":"%s","component":"minio","method":"mc mirror"}\n' "$(date -u +%FT%TZ)" > "$target/manifest.json"
  if test "$(date -u +%u)" = 7; then cp -R "$target" "$root/minio/weekly/"; cp "$target.sha256" "$root/minio/weekly/"; fi
  if test "$(date -u +%d)" = 01; then cp -R "$target" "$root/minio/monthly/"; cp "$target.sha256" "$root/minio/monthly/"; fi
  prune "$root/minio/daily" "$daily_days"
  prune "$root/minio/weekly" "$weekly_days"
  prune "$root/minio/monthly" "$monthly_days"
  log "MinIO backup completed: $(basename "$target")"
}

backup_keycloak() {
  ensure_root
  target="$root/keycloak/daily/keycloak_${stamp}.json"
  log "Starting Keycloak realm export"
  token=$(curl -fsS -X POST "$KEYCLOAK_URL_INTERNAL/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode grant_type=password \
    --data-urlencode client_id=admin-cli \
    --data-urlencode username="$KEYCLOAK_ADMIN" \
    --data-urlencode password="$KEYCLOAK_ADMIN_PASSWORD" | jq -r '.access_token')
  test "$token" != null && test -n "$token" || fail "Unable to get Keycloak admin token"
  curl -fsS -X POST "$KEYCLOAK_URL_INTERNAL/admin/realms/$KEYCLOAK_REALM/partial-export" \
    -H "Authorization: Bearer $token" -H 'Content-Type: application/json' \
    -d '{"exportClients":true,"exportGroupsAndRoles":true}' > "$target.partial"
  test -s "$target.partial" || fail "Keycloak export is empty"
  mv "$target.partial" "$target"
  checksum "$target"
  promote_file "$target" keycloak
  log "Keycloak realm export completed: $(basename "$target")"
}

verify() {
  log "Verifying backup checksums"
  find "$root" -name '*.sha256' -type f -print0 | xargs -0 -r -n1 sh -c 'cd "$(dirname "$1")" && sha256sum -c "$(basename "$1")"' sh
}

restore_postgres() {
  archive=${1:?Backup archive path is required}
  case "$archive" in "$root"/postgres/*) ;; *) fail "Backup path must be inside $root/postgres" ;; esac
  test -f "$archive" || fail "PostgreSQL archive not found"
  PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists "$archive"
}

restore_minio() {
  archive=${1:?Backup directory path is required}
  case "$archive" in "$root"/minio/*) ;; *) fail "Backup path must be inside $root/minio" ;; esac
  test -d "$archive" || fail "MinIO backup directory not found"
  mc alias set target "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY" >/dev/null
  for bucket_path in "$archive"/*; do
    test -d "$bucket_path" || continue
    mc mirror --overwrite "$bucket_path" "target/$(basename "$bucket_path")"
  done
}

schedule() {
  interval=${BACKUP_INTERVAL_SECONDS:-86400}
  case "$interval" in *[!0-9]*|'') fail "BACKUP_INTERVAL_SECONDS must be a positive integer" ;; esac
  test "$interval" -gt 0 || fail "BACKUP_INTERVAL_SECONDS must be positive"
  while true; do
    backup_postgres
    backup_minio
    backup_keycloak
    sleep "$interval"
  done
}

case "${1:-all}" in
  all) backup_postgres; backup_minio; backup_keycloak ;;
  postgres) backup_postgres ;;
  minio) backup_minio ;;
  keycloak) backup_keycloak ;;
  verify) verify ;;
  restore-postgres) restore_postgres "${2:-}" ;;
  restore-minio) restore_minio "${2:-}" ;;
  schedule) schedule ;;
  *) fail "Unknown command: $1" ;;
esac
