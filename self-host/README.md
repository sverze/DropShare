# Self-hosting DropShare

Run your own DropShare instance with Docker, with automatic updates.

## Requirements

- A host with Docker + Docker Compose (a Linux box, a VPS, or a NAS with Docker
  such as UGREEN / Synology / QNAP).
- A domain pointed at the host, and ideally a reverse proxy terminating HTTPS
  (Caddy, nginx, Traefik, or your NAS's built-in reverse proxy). The container
  serves plain HTTP on the port you choose.

## Quick start

```bash
mkdir dropshare && cd dropshare
# download docker-compose.yml and .env.example into this folder, then:
cp .env.example .env
nano .env            # set DROPSHARE_IMAGE, APP_URL, WEBAUTHN_RP_ID
docker compose up -d
```

Open your domain and create the first account - **it becomes the admin**.

## Updates (automatic)

New releases are published to the image tag you pinned (`:latest` by default).

- **Docker / Compose hosts:** the bundled `watchtower` service checks once a day
  and updates the app automatically. Nothing to do.
- **NAS (UGREEN / Synology / QNAP):** delete the `watchtower` service from
  `docker-compose.yml` and turn on your container manager's built-in
  auto-update for the `dropshare` container instead.

To **pin a version** (and opt out of auto-update), set the tag in `.env`:

```
DROPSHARE_IMAGE=ghcr.io/xcided/dropshare:2.0.0
```

### Rollback

Every published version keeps an immutable tag. If an update misbehaves, set
`DROPSHARE_IMAGE` back to the previous version and `docker compose up -d`.

## Your data

Everything lives in two folders next to the compose file, and survives updates:

- `data/` - the SQLite database and user avatars.
- `images/` - your logo / favicon.

**Backups:** before every update the app snapshots the database to
`data/backups/` automatically (keeps the last `DB_BACKUP_KEEP`, default 10). For
off-box safety, also copy the `data/` folder somewhere on a schedule.

## Storage

Uploads are stored on local disk (under `data/`) by default. To use S3-compatible
object storage (Cloudflare R2, Backblaze B2, etc.), set `R2_ENABLED=true` in
`.env` and fill in the `R2_*` values.

## Virus scanning (optional)

Not enabled by default. To turn it on, add a ClamAV container to the compose
file and point `CLAMAV_HOST`/`CLAMAV_PORT` at it, then enable scanning in the
admin settings.

## Troubleshooting

- **Logs:** `docker compose logs -f dropshare`
- **Passkeys not working:** `WEBAUTHN_RP_ID` must be the bare domain (no
  `https://`, no port) and match `APP_URL`.
- **Behind a reverse proxy:** keep `TRUST_PROXY=true` and forward the standard
  `X-Forwarded-*` headers.
