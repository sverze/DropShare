# Self-hosting DropShare

Run your own DropShare instance with Docker, with automatic updates.

## Requirements

- A host with Docker + Docker Compose (a Linux box, a VPS, or a NAS with Docker
  such as UGREEN / Synology / QNAP).
- A domain pointed at the host, and a reverse proxy terminating HTTPS (Caddy,
  nginx, Traefik, or your NAS's built-in reverse proxy). The container serves
  plain HTTP on the port you choose, so see [Reverse proxy](#reverse-proxy).

## Quick start

```bash
mkdir dropshare && cd dropshare
# download the docker-compose.yml and .env.example files within self-host/
curl -fsSLO https://raw.githubusercontent.com/xcided/DropShare/main/self-host/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/xcided/DropShare/main/self-host/.env.example
cp .env.example .env
nano .env            # set DROPSHARE_IMAGE, APP_URL, WEBAUTHN_RP_ID
docker compose up -d
```

Open your domain and create the first account - **it becomes the admin**.

## Reverse proxy

The image does run Caddy internally, but only as a router: it listens on plain
HTTP inside the container and splits traffic between the backend and the
frontend. It holds no certificate and knows nothing about your domain.

So you still need a proxy on the host to terminate HTTPS and forward to the
container. Point `APP_URL` at the public address, leave `TRUST_PROXY=true`, and
set `BIND_ADDR=127.0.0.1` in `.env` so the app is reachable only through the
proxy and not directly on `HOST_PORT`.

Caddy, which obtains certificates on its own:

```
share.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Using something else, check its upload size limit before you blame the app:
nginx caps request bodies at 1 MB by default and rejects anything larger with a
413, which looks like a broken upload rather than a proxy setting
(`client_max_body_size 0` lifts it). Also forward the standard `X-Forwarded-*`
headers, which Caddy does on its own.

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

Off by default. Add a ClamAV service under `services:` in `docker-compose.yml`:

```yaml
  clamav:
    image: clamav/clamav:stable
    container_name: clamav
    restart: unless-stopped
```

Then set `VIRUS_SCAN_AUTO_START=true` in `.env` and turn on **Virus scanning**
under Admin -> Config -> Share. Both are required; neither does anything alone.
`CLAMAV_HOST` in `.env` has to match the service name above.

Two things to expect on first run: ClamAV wants roughly 2 GB of RAM for its
signature database, and it spends several minutes downloading definitions before
it will answer. Scans fail until that finishes.

## Troubleshooting

- **Logs:** `docker compose logs -f dropshare`
- **Passkeys not working:** `WEBAUTHN_RP_ID` must be the bare domain (no
  `https://`, no port) and match `APP_URL`.
- **Behind a reverse proxy:** see [Reverse proxy](#reverse-proxy).
