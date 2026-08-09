#!/bin/sh
#
# Wraps the application entrypoint with SQLite replication and avatar sync.
#
# Order matters. The database must be restored before the application starts,
# because the project entrypoint runs `prisma migrate deploy` against it and an
# empty file would look like a fresh install.

set -eu

DATA_DIR=/opt/app/backend/data
DB_PATH="${DATA_DIR}/dropshare.db"
AVATAR_DIR="${DATA_DIR}/avatars"
AVATAR_SYNC_SECONDS="${AVATAR_SYNC_SECONDS:-300}"

: "${S3_BUCKET:?S3_BUCKET must be set}"
: "${AWS_REGION:?AWS_REGION must be set}"

mkdir -p "${DATA_DIR}" "${AVATAR_DIR}"

# ---------------------------------------------------------------------------
# Restore
# ---------------------------------------------------------------------------
if [ -f "${DB_PATH}" ]; then
  echo "[replicated] Database already present on disk, skipping restore."
else
  echo "[replicated] Restoring database from s3://${S3_BUCKET}/_db ..."
  litestream restore -if-replica-exists -config /etc/litestream.yml "${DB_PATH}"

  if [ -f "${DB_PATH}" ]; then
    echo "[replicated] Restore complete."
  else
    # First ever boot. The application will create and migrate a new database;
    # replication starts from there.
    echo "[replicated] No replica found - starting from an empty database."
  fi
fi

# Litestream requires WAL. The setting lives in the database header, so this is
# a no-op on every boot after the first.
if [ -f "${DB_PATH}" ]; then
  MODE="$(sqlite3 "${DB_PATH}" 'PRAGMA journal_mode;' || echo unknown)"
  if [ "${MODE}" != "wal" ]; then
    echo "[replicated] Switching journal_mode from ${MODE} to WAL."
    sqlite3 "${DB_PATH}" 'PRAGMA journal_mode=WAL;' >/dev/null
  fi
fi

echo "[replicated] Restoring avatars from s3://${S3_BUCKET}/_avatars ..."
aws s3 sync "s3://${S3_BUCKET}/_avatars" "${AVATAR_DIR}" --only-show-errors || \
  echo "[replicated] Avatar restore skipped (no objects yet)."

chown -R "${PUID:-1000}:${PGID:-1000}" "${DATA_DIR}" || true

# ---------------------------------------------------------------------------
# Avatar replication
#
# Avatars are written to local disk and never to object storage
# (backend/src/user/user.controller.ts:54), so ephemeral storage would lose
# them on every restart. Push them up on a timer and once more on shutdown.
# Worst case an avatar uploaded seconds before an ungraceful stop is lost.
# ---------------------------------------------------------------------------
sync_avatars() {
  aws s3 sync "${AVATAR_DIR}" "s3://${S3_BUCKET}/_avatars" \
    --delete --only-show-errors 2>/dev/null || true
}

avatar_loop() {
  while true; do
    sleep "${AVATAR_SYNC_SECONDS}"
    sync_avatars
  done
}
avatar_loop &
AVATAR_PID=$!

on_exit() {
  echo "[replicated] Shutting down - final avatar sync."
  kill "${AVATAR_PID}" 2>/dev/null || true
  sync_avatars
}
trap on_exit TERM INT EXIT

# ---------------------------------------------------------------------------
# Migrate BEFORE replication starts.
#
# litestream holds a long-lived read transaction to keep the WAL from being
# checkpointed away, and Prisma's migration engine cannot take the lock it
# needs to initialise while that is open - it fails with "database is locked".
# Running migrations first, with nothing else attached, avoids the contention
# entirely.
# ---------------------------------------------------------------------------
echo "[replicated] Applying migrations before replication starts."
cd /opt/app/backend
npx prisma migrate deploy
cd /opt/app

chown -R "${PUID:-1000}:${PGID:-1000}" "${DATA_DIR}" || true

# ---------------------------------------------------------------------------
# Run
#
# This mirrors scripts/docker/entrypoint.sh minus its migration step, which has
# already happened above. Keep the two in sync if that file changes upstream.
# ---------------------------------------------------------------------------
cp -rn /tmp/img/* /opt/app/frontend/public/img 2>/dev/null || true

if [ "${CADDY_DISABLED:-}" != "true" ]; then
  echo "[replicated] Starting Caddy."
  if [ "${TRUST_PROXY:-}" = "true" ]; then
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile.trust-proxy
  else
    caddy start --adapter caddyfile --config /opt/app/reverse-proxy/Caddyfile
  fi
fi

echo "[replicated] Starting the frontend."
su-exec "${PUID:-1000}:${PGID:-1000}" \
  sh -lc 'cd /opt/app && PORT=3333 HOSTNAME=0.0.0.0 node frontend/server.js' &

echo "[replicated] Starting the backend under litestream."
cd /opt/app/backend
exec litestream replicate -config /etc/litestream.yml -exec "node dist/src/main"
