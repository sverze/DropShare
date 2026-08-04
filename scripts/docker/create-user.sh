[ "$(id -u)" -ne 0 ] && exec "$@"

echo "Creating user and group..."

PUID=${PUID:-1000}
PGID=${PGID:-1000}

if ! getent group dropshare-group > /dev/null 2>&1; then
    addgroup -g "$PGID" dropshare-group
fi

if ! id -u dropshare > /dev/null 2>&1; then
    if ! getent passwd "$PUID" > /dev/null 2>&1; then
        adduser -u "$PUID" -G dropshare-group dropshare > /dev/null 2>&1
    else
        existing_user=$(getent passwd "$PUID" | cut -d: -f1)
        echo "Using existing user: $existing_user"
    fi
fi

mkdir -p /opt/app/backend/data
find /opt/app/backend/data \( ! -group "${PGID}" -o ! -user "${PUID}" \) -exec chown "${PUID}:${PGID}" {} +
find /opt/app/frontend/public \( ! -group "${PGID}" -o ! -user "${PUID}" \) -exec chown "${PUID}:${PGID}" {} +

# Continue with the configured command as root so the main entrypoint can
# perform privileged setup (like DB migrations) before dropping privileges.
exec "$@"
