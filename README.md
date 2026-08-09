# DropShare

Simple & Self-hosted file share service. Upload files or folders, get one link, and share.

Runs as a single Docker container with an SQLite DB. No external services or object storage required. Point to S3-compatible object storage later if your needs outgrow the local disk.

---

## Quick Start

```bash
mkdir dropshare && cd dropshare
# download the docker-compose.yml and .env.example files within self-host/
curl -fsSLO https://raw.githubusercontent.com/xcided/DropShare/main/self-host/docker-compose.yml
curl -fsSLO https://raw.githubusercontent.com/xcided/DropShare/main/self-host/.env.example
cp .env.example .env
nano .env    # set DROPSHARE_IMAGE, APP_URL, WEBAUTHN_RP_ID
docker compose up -d
```

The container serves plain HTTP. To reach it over HTTPS on your domain, put a reverse proxy in front of it: see [Reverse proxy](self-host/README.md#reverse-proxy).

Open your domain and create your first user account. This will become the site admin.

Full instructions, updates, backups, and troubleshooting: [`self-host/README.md`](self-host/README.md).

## Hosting on AWS

[`infra/`](infra/README.md) holds an AWS CDK app that deploys DropShare without
running a server: Lightsail Container Service for the application, S3 for share
content, and Litestream replicating the SQLite database to S3 so nothing is
lost when a container restarts. No EC2, no EFS, no load balancer. Roughly $21 a
month plus download egress.

```bash
cd infra && npm install
npx cdk bootstrap aws://<account>/<region>
npx cdk deploy -c dropshare:domainName=share.example.com -c dropshare:region=<region>
```

Then build and push the image, seed the database replica, upload share content,
and create the container deployment. Each step is a script under
[`infra/scripts/`](infra/scripts) and the order matters — the database replica
has to exist before the first container starts, or the application will create
an empty one and replicate that instead.

Full walkthrough, cost breakdown and known limitations:
[`infra/README.md`](infra/README.md).

Migrating an existing instance? `infra/scripts/upload-shares.sh` restores a
bucket export into S3, and `infra/scripts/upload-database.sh` seeds the replica
from a `dropshare.db` file.

## Features

**File Shares** - Drag and drop uploading, reverse shares, bulk uploading, custom share slug, share expiration management, theme customization, view and download limits, send share over email (requires external SMTP server), and password protection.

**Browser Previews** - view audio, photos, videos, PDFs, and browse zips before you download.

**Accounts** - Local accounts with the ability to set TOTP, passkeys, and OAuth. Create user groups under admin -> users for organization and monitoring. LDAP compatible.

**Admin** - View statistics, request logs, edit email templates, user and security management, and more.

## Configuration

Most settings are configurable on the admin pages, and changes made there take effect immediately. The `.env` file covers what has to be known before the app boots: the public URL, the passkey domain, the host port and bind address, file ownership, and object storage credentials if you use it.

Uploaded files are stored on the local disk by default. Any S3-compatible provider works: Amazon S3, Cloudflare R2, Backblaze B2, MinIO via the `R2_*` variables, despite the prefix being Cloudflare specific. This can also be configured entirely on the admin -> config -> S3 page within the app. Use one or the other: storage switches on as soon as either the `R2_*` variables or the admin page is complete.

## File system structure

```
dropshare/
├── docker-compose.yml
├── .env                             your configuration
│
├── data/                            everything the backend writes
│   ├── dropshare.db                 SQLite database
│   ├── backups/                     DB snapshots taken before every migration
│   ├── uploads/
│   │   └── shares/                  uploaded files
│   ├── avatars/                     user profile images
│   ├── upload-temp/                 in-flight upload chunks
│   ├── zip-temp/                    workspace for building archive downloads
│   ├── archive-cache/               unpacked .zip/.7z archives for in-browser viewing
│   ├── storage-source-cache/        source files pulled from object storage
│   ├── video-preview-cache/         HLS renditions
│   ├── video-preview-object-cache/  preview segments pulled from object storage
│   └── video-thumbnail-cache/       video preview thumbnails
│
└── images/                          site branding
    ├── icons/                       PWA icons
    ├── favicon.ico
    └── logo.png
```

Only `data/dropshare.db`, `data/uploads/`, `data/avatars/` and `images/` need backing up. Everything else is a cache, rebuilt on demand.

The whole `data/` directory is gitignored — it holds the database, uploaded
files and local backups, none of which belong in version control.

On the AWS deployment this layout differs: `data/` sits on ephemeral container
storage, the database is replicated to S3 by Litestream, avatars are synced to
S3 on a timer, and uploads live in the bucket rather than on disk. See
[`infra/README.md`](infra/README.md).

## Built with

NestJS and Prisma on the backend, Next.js and Mantine on the frontend, Caddy in front, SQLite for storage.

## Updating

The bundled watchtower service checks daily and pulls new images automatically.
The database is snapshotted to `data/backups` before every migration, and version tags are immutable, so a bad update can be rolled back by pinning the previous tag.

## Version history

* 2.0.1
  * Fixed ClamAV host default
  * Added reverse proxy info and download commands to documentation

* 2.0.0 - Picking up from pingvin-share
  * Initial release

## License

BSD 2-Clause. Originally derived from
[pingvin-share](https://github.com/stonith404/pingvin-share) by Elias Schneider.
