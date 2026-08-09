#!/usr/bin/env bash
#
# Set the admin password in a DropShare SQLite database.
#
# The hash is produced by the application's own argon2 build, so the
# parameters match exactly what AuthService verifies against.
#
#   ./set-admin-password.sh ../../data/dropshare.db
#   ./set-admin-password.sh ../../data/dropshare.db 'my-chosen-password'
#
# With no password argument a strong one is generated and printed once.

set -euo pipefail

DB_PATH="${1:?usage: set-admin-password.sh <path-to-dropshare.db> [password]}"
PASSWORD="${2:-}"
IMAGE="${DROPSHARE_IMAGE:-dropshare-dropshare:latest}"

if [ ! -f "$DB_PATH" ]; then
  echo "No such database: $DB_PATH" >&2
  exit 1
fi

if [ -z "$PASSWORD" ]; then
  # 24 URL-safe characters, no shell metacharacters to escape later.
  #
  # Bounded read first: piping /dev/urandom straight into `head -c` makes head
  # close the pipe, which lands SIGPIPE on tr and trips `set -o pipefail`.
  # 512 random bytes yields well over 24 alphanumerics.
  PASSWORD="$(head -c 512 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | cut -c1-24)"
  GENERATED=1
fi

ADMIN_ID="$(sqlite3 "$DB_PATH" "SELECT id FROM User WHERE isAdmin=1 LIMIT 1;")"
if [ -z "$ADMIN_ID" ]; then
  echo "No admin user found in $DB_PATH" >&2
  exit 1
fi

echo "Hashing with the application's argon2 build ($IMAGE)..."
# --entrypoint is required: the image's own entrypoint is the container
# bootstrap script, which would otherwise swallow these arguments.
HASH="$(docker run --rm -w /opt/app/backend --entrypoint node "$IMAGE" \
  -e "require('argon2').hash(process.argv[1]).then(h=>console.log(h))" \
  "$PASSWORD")"

case "$HASH" in
  '$argon2id$'*) ;;
  *) echo "Unexpected hash output: $HASH" >&2; exit 1 ;;
esac

cp "$DB_PATH" "${DB_PATH}.bak.$(date +%Y%m%d-%H%M%S)"

# TOTP is cleared alongside the password: a restored database carries the old
# instance's enrolled secret, which nobody holds an authenticator for.
sqlite3 "$DB_PATH" <<SQL
UPDATE User
   SET password = '$HASH',
       totpEnabled = 0,
       totpVerified = 0,
       totpSecret = NULL
 WHERE id = '$ADMIN_ID';
SQL

sqlite3 -header -column "$DB_PATH" \
  "SELECT username, email, isAdmin, totpEnabled FROM User WHERE id='$ADMIN_ID';"

echo
if [ "${GENERATED:-0}" = "1" ]; then
  echo "Generated admin password: $PASSWORD"
  echo "Store it now - it is not written anywhere and cannot be recovered."
else
  echo "Admin password updated."
fi
echo "Re-enrol two-factor auth from Account settings once you have signed in."
