#!/bin/sh

set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Copy default logo to the frontend public folder if it doesn't exist
cp -rn /tmp/img/* /opt/app/frontend/public/img

if [ "$CADDY_DISABLED" != "true" ]; then
  # Start Caddy
  echo "Starting Caddy..."
  if [ "$TRUST_PROXY" = "true" ]; then
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile.trust-proxy &
  else
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile &
  fi
else
  echo "Caddy is disabled. Skipping..."
fi

# Run the frontend server
su-exec "$PUID:$PGID" sh -lc 'cd /opt/app && PORT=3333 HOSTNAME=0.0.0.0 node frontend/server.js' &

# Back up the SQLite database before applying migrations. Auto-updates recreate
# the container with no human present, so this snapshot is the safety net if a
# migration ever goes wrong: the previous state is kept under data/backups/.
# Skipped on a brand-new install (no DB yet). Only applies to local SQLite.
DATA_DIR=/opt/app/backend/data
BACKUP_DIR="$DATA_DIR/backups"
KEEP_BACKUPS=${DB_BACKUP_KEEP:-10}
# Each pattern is tested on its own: `ls a b` exits non-zero when either
# pattern matches nothing, so testing both together silently skipped the backup
# for every install, since the database is .db and *.sqlite never matched.
if ls "$DATA_DIR"/*.db >/dev/null 2>&1 || ls "$DATA_DIR"/*.sqlite >/dev/null 2>&1; then
  mkdir -p "$BACKUP_DIR"
  STAMP=$(date +%Y%m%d-%H%M%S)
  for f in "$DATA_DIR"/*.db "$DATA_DIR"/*.sqlite; do
    [ -e "$f" ] || continue
    cp "$f" "$BACKUP_DIR/$(basename "$f").$STAMP" 2>/dev/null || true
  done
  echo "Backed up database before migrations ($STAMP)."
  # Prune all but the most recent $KEEP_BACKUPS snapshots.
  ls -1t "$BACKUP_DIR"/*.[0-9]* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while read -r old; do
    rm -f "$old"
  done
fi

# Run database migrations before starting backend
echo "Running database migrations..."
cd backend && npx prisma migrate deploy

# Run the backend server
echo "Starting backend..."
cd /opt/app/backend
exec node dist/src/main

# Wait for all processes to finish
wait -n
