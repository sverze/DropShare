# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DropShare is a self-hosted file-sharing service (fork of [pingvin-share](https://github.com/stonith404/pingvin-share)). Two independent Node apps — a NestJS backend and a Next.js frontend — that ship as **one** Docker image with Caddy in front of both. SQLite via Prisma. Files land on local disk by default, optionally on any S3-compatible bucket.

## Commands

Both apps use npm with committed lockfiles; the Docker build runs `npm install` against them.

```bash
# backend (NestJS, listens on :8080)
cd backend
npm install
npx prisma generate                 # required after any schema.prisma change
npx prisma migrate dev --name <x>   # create + apply a migration locally
npx prisma db seed                  # runs prisma/seed/config.seed.ts
npm run dev                         # NODE_ENV=development, watch mode
npm run build                       # nest build -> dist/
npm run lint                        # eslint 'src/**/*.ts'
npm run format                      # prettier

# frontend (Next.js pages router, listens on :3000)
cd frontend
npm install
npm run dev
npm run build
npm run lint                        # next lint
npm run format
```

Run both for local development: the frontend's catch-all API route (`frontend/src/pages/api/[...all].tsx`) proxies `/api/*` to `process.env.API_URL || http://localhost:8080`, so browse the app at `http://localhost:3000` and the backend is reached through it. In `NODE_ENV=development` the backend also serves Swagger at `/api/swagger`.

### Tests

There are **no unit tests**. The only automated suite is a Postman/Newman system test that resets the DB and drives the live API:

```bash
cd backend && npm run test:system
```

To run a single request/folder, use newman directly against the collection:

```bash
cd backend && npx newman run ./test/newman-system-tests.json --folder "Create Share"
```

### Docker

```bash
docker compose -f docker-compose.local.yml up --build   # local image on :3001
docker compose -f docker-compose.dev.yml up             # ClamAV only, for scan testing
```

Releases are cut by pushing a `v*.*.*` tag; `.github/workflows/release.yml` builds amd64+arm64 and pushes `:X.Y.Z`, `:X.Y`, `:latest` to GHCR.

### Regenerating `config.example.yaml`

```bash
cd scripts && npm run generate-example-config
```

It reads `backend/prisma/seed/config.seed.ts` for defaults and `frontend/src/i18n/translations/en-US.ts` for the descriptions it emits as YAML comments. Re-run it whenever config variables change.

## Deployment (`infra/`)

An AWS CDK app (TypeScript) deploys this to **Lightsail Container Service** —
no EC2, no EFS, no load balancer. `infra/README.md` has the full walkthrough;
the parts that constrain how you change things:

- **SQLite pins the architecture.** The database is a file needing a real
  filesystem, which rules out Lambda, App Runner and Amplify, and makes EFS a
  bad idea. It lives on the container's ephemeral disk and is replicated to S3
  by **Litestream** (`infra/deploy/`), restored on every container start.
- **`scale` must stay 1.** Two nodes means two writers on one SQLite database
  through independent replicas. This service cannot scale horizontally.
- **Migrations must run before Litestream starts.** Litestream holds a
  long-lived read transaction; `prisma migrate deploy` against an already-
  replicating database fails with `database is locked`. The wrapper entrypoint
  in `infra/deploy/replicated-entrypoint.sh` sequences this, and mirrors
  `scripts/docker/entrypoint.sh` minus its migration step — keep them in sync.
- **Avatars need separate replication.** `user.controller.ts:54` hardcodes
  `join(process.cwd(), "data", "avatars")` and never writes them to object
  storage, so ephemeral disk would lose them. The entrypoint syncs both ways.
- **No local state to manage.** CDK keeps none; the CloudFormation stack in AWS
  is the source of truth. `cdk.out/` and `cdk.context.json` are build output and
  a lookup cache respectively, both gitignored.

## Architecture

### Single container, two servers, Caddy in front

`Dockerfile` builds frontend and backend separately, then combines them into a runner image that also installs `ffmpeg`, `p7zip`, `ghostscript`, `imagemagick`, `poppler-utils`, `libheif-tools` — the preview/thumbnail pipeline shells out to these.

`scripts/docker/entrypoint.sh` is the real boot sequence and worth reading before debugging any startup problem: start Caddy (`reverse-proxy/Caddyfile`, or `Caddyfile.trust-proxy` when `TRUST_PROXY=true`) → start the Next.js standalone server on :3333 as `PUID:PGID` → **snapshot the SQLite DB to `data/backups/`** → `prisma migrate deploy` → exec the backend on :8080. Caddy on :3000 routes `/api/*` to :8080 and everything else to :3333.

`DATABASE_URL` is set as an `ENV` in the Dockerfile because the Prisma CLI (running migrations from the entrypoint) and `PrismaService` (falling back to `backend/src/constants.ts`) must resolve to the same file. A local `backend/prisma/.env` silently overrides it, which is why `.dockerignore` excludes that path.

### Configuration is database-backed, not env-backed

This is the central design decision and the most common source of confusion.

- `backend/prisma/seed/config.seed.ts` is the **schema of all config variables**, grouped by category (`general`, `share`, `smtp`, `oauth`, `ldap`, `s3`, `legal`, `email`, `cache`, `donations`, `banners`, `access`, `internal`). Each entry declares `type`, `defaultValue`, and flags `secret` / `obscured` / `locked`.
- The seed **deletes any `Config` row not present in the seed file** and updates the rest. Renaming a variable therefore drops the operator's stored value.
- `ConfigService` (`backend/src/config/config.service.ts`) loads rows at boot into memory, exposes `get("category.name")` with type coercion, and is an `EventEmitter` — `emit("update", key, value)` on every write. Services that cache derived state (e.g. `R2StorageService`) subscribe to it: `configService.on("update", ...)`.
- The module is `@Global()`, so `ConfigService` is injectable anywhere without importing `ConfigModule`.
- If a `config.yaml` exists (`CONFIG_FILE`, default `../config.yaml`), it overrides DB values **and locks the admin UI** — `isEditAllowed()` returns false and every write throws. See `config.example.yaml`.
- `general.appUrl` falls back to the `APP_URL` env var when unset. It drives OAuth callbacks, WebAuthn RP ID, error redirects, and email links.
- Config variables marked `secret` are excluded from the public `/api/configs` response.

**Adding a config variable** means: add it to `config.seed.ts`, add its `admin.config.<category>.<name>` label/description to `frontend/src/i18n/translations/en-US.ts`, and regenerate `config.example.yaml`.

### Authorization: admin / manager / user + capabilities

`backend/src/auth/capabilities.ts` is the single source of truth. `isAdmin` grants everything; `role === "manager"` grants only the capabilities enabled in the `access.managerCapabilities` config variable (a JSON map); everyone else gets nothing. `CAPABILITY_GROUPS` drives both the enforcement list and the Access Levels admin UI, so a new capability is added there and nowhere else. `CONFIG_CATEGORY_CAPABILITIES` maps each config category to the capability that gates it.

Enforcement is via guards and decorators in `backend/src/auth/`: `JwtGuard`, `CapabilityGuard` + `@RequireCapability()`, `IsAdminGuard`, `AdminOrManagerGuard`, `ConfigCategoryGuard`. The frontend mirrors this in `frontend/src/utils/capabilities.util.ts` for route/menu visibility — it is UX only, never the boundary.

Auth itself is JWT in an `access_token` **cookie** (not a bearer header — see `JwtStrategy.extractJWT`), with refresh tokens, TOTP, passkeys (`@simplewebauthn`), OAuth (GitHub/Google/Discord/Microsoft/generic OIDC, `backend/src/oauth/provider/`), and LDAP.

### Share access control

Public share endpoints are guarded by `ShareSecurityGuard` (extends `JwtGuard`), which resolves the share, enforces expiration, and accepts a password either via the `x-share-password` header or a `share_<shareId>_token` cookie issued by `POST /shares/:id/token`. Ownership-scoped routes use `ShareOwnerGuard`. `ShareSecurityMiddleware` (wired in `AdminModule`) runs across `shares` routes alongside `RequestLoggerMiddleware`, which populates the admin request log.

### Storage: local vs S3, decided per file

`FileService` is a thin facade that delegates everything to `LocalFileService` (`backend/src/file/local.service.ts`, ~3k lines) — that file, not `file.service.ts`, is where the logic lives. It branches on `R2StorageService.isEnabled()` and on each `File` row's `storageLocation` column (`"local"` or `"s3"`), so a single install can hold both.

`R2StorageService` (`backend/src/r2-storage/`) wraps the AWS SDK and is used for **any** S3-compatible provider despite the `R2_` prefix. It resolves its settings from the admin config (`s3.*`) with env-var fallback, re-initializes clients on config change, forces IPv4 DNS resolution, and maintains local caches under `data/storage-source-cache/`.

Two upload paths exist:
- **Chunked through the backend** (`frontend/src/utils/chunkedUpload.util.ts`) — the only path that works with no object storage, and the fallback when it is enabled. The client chunk size **must** equal the server's `share.chunkSize`; the server derives the expected chunk index from bytes already on disk and fails with `unexpected_chunk_index` otherwise.
- **Presigned multipart direct to the bucket** (`backend/src/r2-storage/multipart-upload.controller.ts`), used when `share.multipartThreshold` is exceeded. Both `share.chunkSize` and `share.multipartThreshold` are validated to be ≥ 5 MB because S3 requires it.

Everything under `data/` except `dropshare.db`, `uploads/`, `avatars/` and `images/` is a rebuildable cache (zip temp, archive cache, video preview/HLS caches, thumbnails).

### Lyrics providers

`backend/src/file/lyrics.service.ts` queries **two** providers concurrently and
merges the results, each tagged with a `provider`. A failure of one is not
fatal — only a failure of both raises.

- **Genius** has by far the better catalogue, especially for unreleased and
  leaked material, but it serves **403 to any request from a hosting
  provider's IP range**. It works from a residential connection and fails from
  every cloud. Nothing in the code can fix that; the block is on source IP.
- **LRCLIB** is free, keyless, and does not block cloud hosts, but its
  crowd-sourced catalogue covers released tracks only. Its entries have no web
  page, so they are addressed by the pseudo-URL `lrclib:<id>`, which
  `importFromUrl()` routes on.

`lyricsText` is stored as plain text with only `<b> <strong> <i> <em> <u>`
permitted — see `keepSafeLyricsFormatting()`. LRC timestamps are stripped
before storage. Upstream failures are mapped to actionable messages by
`toUpstreamException()` rather than surfacing as a bare 500.

### Scheduled jobs

`backend/src/jobs/jobs.service.ts` holds all `@Cron` work: expiring shares and reverse shares, deleting unfinished shares, pruning temp chunks, expired tokens, request logs (retention from `general.requestLogRetentionDays`) and email logs. `DISABLE_SCHEDULED_JOBS=true` turns the whole set off — check this first when "nothing is being cleaned up".

### Frontend structure

Next.js **pages** router with Mantine v6. `_app.tsx` is doing a lot: it fetches config and current user server-side, provides `ConfigContext` / `UserContext` (consumed via `useConfig()` / `useUser()`), builds the runtime theme from `general.theme*` config variables (`src/theme/theme.util.ts`), sets up `react-intl`, and decides layout per route (embed routes bypass the default chrome). Data access goes through `src/services/*.service.ts`, all built on the shared axios instance in `api.service.ts` with `baseURL: "/api"`.

`next.config.js` sets a strict CSP for all routes and a relaxed variant (`frame-ancestors *`, no `X-Frame-Options`) for `/embed/*` so shares can be embedded.

i18n: 29 locales under `src/i18n/translations/`. `en-US.ts` is the source of truth — add keys there first. Admin config labels and descriptions live in the same file under `admin.config.*`, which is also what the example-config generator reads.

## Things that bite

- **TypeScript strictness differs between the two apps.** Backend has `strictNullChecks: false` and `noImplicitAny: false`; frontend is fully `strict`. Don't assume backend patterns compile in the frontend.
- `npx prisma generate` after every `schema.prisma` edit, or the backend won't compile.
- `frontend`'s dev proxy means the backend must be running for anything beyond static pages to work.
- Version numbers are duplicated in `backend/package.json`, `frontend/package.json` (the frontend exposes it as `process.env.VERSION`) and the README changelog — bump all of them together.
- The default `CLAMAV_HOST` is `clamav` in production and `127.0.0.1` in development (`backend/src/constants.ts`); `docker-compose.yml` overrides it to `dropshare-clamav` on an external `clamav-scan` network.
