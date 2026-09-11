# DropShare infrastructure (AWS CDK)

Serverless deployment of DropShare on AWS. **No EC2, no EFS, no load balancer.**

TypeScript rather than Python, to match the rest of the repository.

## Shape

```
   DNS provider (external)
            │ CNAME
            ▼
   Lightsail Container Service        power=small, scale=1
     managed TLS + custom domain      no ALB, bundled transfer
     Caddy → Next.js SSR + NestJS
     SQLite on ephemeral disk
            │
            ├── litestream ──► s3://bucket/_db/        WAL replication, daily snapshot
            ├── aws s3 sync ─► s3://bucket/_avatars/   every 5 min + on shutdown
            └── presigned  ──► s3://bucket/shares/     uploads go direct
                                   ▲
   browser ──► CloudFront ─────────┘                   downloads, 1 TB/mo free
```

Resources created: S3 bucket, ECR repository, Lightsail certificate, Lightsail
container service, IAM user + access key, Secrets Manager secret. That is the
whole footprint.

## Why it is built this way

**SQLite has no network filesystem.** `schema.prisma` declares
`provider = "sqlite"` and the shipped migration is SQLite DDL. Rather than put
that file on EFS, Litestream streams the write-ahead log to S3 and restores it
on container start. The database lives on fast local disk; S3 is the durable
copy.

**`scale` must stay at 1.** Two nodes means two processes writing the same
SQLite database through two independent replicas, which corrupts it. This
service cannot be scaled horizontally — that is a property of the application,
not a limitation of the infrastructure.

**Avatars are replicated separately.** `user.controller.ts:54` hardcodes
`join(process.cwd(), "data", "avatars")` and never writes them to object
storage, so on ephemeral disk they would vanish on restart. The entrypoint
syncs them both ways.

**One IAM user, not a role.** Lightsail container services have no instance
profile or task role, so the metadata-endpoint trick that works on EC2 and
Fargate is unavailable. A dedicated user's keys are injected as environment
variables at deploy time from Secrets Manager. This is the one real security
downgrade against an instance-based deployment — the keys are scoped to this
bucket alone.

**The deployment is not in CDK.** It carries the image tag and that secret;
neither belongs in a CloudFormation template, and the tag changes on every
push. CDK owns durable resources, `deploy-container.sh` owns rollouts.

## Deploy

The domain is optional. Without one, the service runs on the hostname Lightsail
issues (`https://<service>.<id>.<region>.cs.amazonlightsail.com`), which already
has valid TLS. Deploy that way first, migrate the data, confirm it works, and
add the domain afterwards — nothing else changes when you do.

```bash
cd infra && npm install
npx cdk bootstrap aws://<account>/<region>     # once per account+region

# No domain
npx cdk deploy -c dropshare:region=us-west-2

# ...or with one
npx cdk deploy -c dropshare:region=us-west-2 -c dropshare:domainName=share.example.com
```

Adding a domain later is three commands. `altNames` puts extra hostnames on the
same certificate — worth doing for the apex when the canonical address is `www`,
so the other one does not throw a TLS error, and so you avoid a second
validation round:

```bash
npx cdk deploy -c dropshare:region=$REGION \
  -c dropshare:domainName=www.example.com -c dropshare:altNames=example.com
# add the validation CNAMEs at your DNS provider, wait for ISSUED, then
npx cdk deploy -c dropshare:region=$REGION \
  -c dropshare:domainName=www.example.com -c dropshare:altNames=example.com \
  -c dropshare:attachDomain=true
./scripts/deploy-container.sh dropshare <image> <bucket> $REGION www.example.com
```

Lightsail container services expose a hostname, not an IP, so the site record is
a CNAME. An apex domain therefore needs a provider offering ALIAS/ANAME —
Namecheap, Cloudflare, Route 53 and DNSimple all do.

**Passkeys bind to the registrable domain.** `deploy-container.sh` strips a
leading `www.` when setting `WEBAUTHN_RP_ID`, so credentials enrolled on
`www.example.com` keep working on `example.com` and survive a later move between
the two. Setting it to the full host instead would orphan every enrolled
credential the day you change hostname.

The second pass exists because Lightsail refuses a certificate that is still
`PENDING_VALIDATION`, and the same stack creates it. The third rewrites
`APP_URL`, the WebAuthn settings and the public link base; the `cdk deploy`
before it also narrows the bucket CORS origin from the Lightsail wildcard to
your domain.

Then, in order:

```bash
# 1. Let Lightsail pull from the private ECR repository
aws lightsail update-container-service --service-name dropshare \
  --private-registry-access ecrImagePullerRole={isActive=true} --region <region>
#    then grant the printed principal pull rights on the ECR repo

# 3. Build and push (linux/amd64 - Lightsail containers are x86_64)
./scripts/build-and-push-image.sh <EcrRepositoryUri> <region>

# 4. Set a real admin password BEFORE the database goes anywhere public
./scripts/set-admin-password.sh ../data/dropshare.db

# 5. Seed the Litestream replica - must precede the first deployment
DEPLOY_IMAGE=<EcrRepositoryUri>:latest \
  ./scripts/upload-database.sh ../data/dropshare.db <bucket> <region>

# 6. Upload share content (~44 GB, resumable, no ingress charge)
./scripts/upload-shares.sh ../data/shares.zip <bucket> <region>

# 7. Deploy the container (domain optional - omitted, it uses the Lightsail host)
./scripts/deploy-container.sh dropshare <EcrRepositoryUri>:latest <bucket> <region>
```

If you deployed with a domain, point it at the service URL from step 7 with a
CNAME. An apex domain needs a provider supporting ALIAS/ANAME.

**Step 4 is not optional.** The working database currently carries the
throwaway password `admin1234` with two-factor disabled. Fine on a laptop,
unacceptable on a public host holding 1,272 shares.

**Step 5 must precede step 7.** If the container starts first it will create an
empty database, migrate it, and begin replicating *that* — which then becomes
the copy restored on every subsequent start.

## Cost

| | Monthly |
|---|---|
| Lightsail container service (`small`: 1 GB / 0.5 vCPU) | $15 |
| S3, 44 GB + replica | ~$1 |
| Secrets Manager | ~$0.40 |
| CloudFront (downloads) | $0 under 1 TB/month |
| **Fixed** | **~$16** |

Bundled transfer covers traffic through the container service. Downloads go
browser-to-CloudFront and draw on its permanent 1 TB/month free egress
allowance; CloudFront's fetches from S3 cost nothing. Beyond 1 TB, CloudFront
is ~$0.085/GB against S3's ~$0.09 — the free terabyte is the saving, not the
per-GB rate, so watch the volume rather than assuming it is solved forever.

This was learned the expensive way: downloads originally went browser-to-S3 on
presigned URLs, with no free allowance, and reached 560 GB and $41 in a single
month.

Actual tiers, from `aws lightsail get-container-service-powers`:

| power | vCPU | RAM | $/month |
|---|---|---|---|
| nano | 0.25 | 0.5 GB | 7 |
| micro | 0.25 | 1 GB | 10 |
| **small** | **0.5** | **1 GB** | **15** |
| medium | 1.0 | 2 GB | 40 |
| large | 2.0 | 4 GB | 80 |

The container idles at ~165 MB with the application, Caddy and the database
loaded, so `small` leaves roughly 800 MB of headroom. That is comfortable for
serving and uploads; ffmpeg transcoding of large videos is what would push it.
Start on `small` and move to `medium` if the service restarts under memory
pressure — it is a one-line context change plus a redeploy.

Note the jump from `small` to `medium` is $15 to $40. There is no tier between
them.

## Operating

```bash
# Status and public URL
aws lightsail get-container-services --service-name dropshare --region <region> \
  --query 'containerServices[0].{state:state,url:url}'

# Logs (the replication wrapper prefixes its lines with [replicated])
aws lightsail get-container-log --service-name dropshare \
  --container-name dropshare --region <region>

# Restore the database locally from the replica
litestream restore -o ./restored.db s3://<bucket>/_db
```

## Migrating from another instance

A bucket export drops straight in — the layout `shares/<shareId>/<fileId>` is
exactly what `R2StorageService.getFileKey()` builds, so `upload-shares.sh` is a
sync with no renaming.

Two things to expect afterwards:

**Per-share zip archives are not in a bucket export.** They live at
`shares/<shareId>/archive.zip` and are generated artefacts, so a typical export
omits them. Individual file downloads work fine; "download all as zip" returns
`404 Zip file not found - it may still be generating` until they are rebuilt:

```
POST /api/shares/admin/regenerate-zips          # all shares
POST /api/shares/admin/:shareId/regenerate-zip  # one share
GET  /api/shares/admin/zip-status
```

Be careful with the bulk call. Rebuilding every archive pulls the entire
dataset from S3 through the container and writes the zips back — the heaviest
thing this deployment can be asked to do, and a plausible way to exhaust a
1 GB tier. Regenerate one share first, or temporarily raise `power` for the job.

**Orphaned objects are normal.** An export usually carries a few directories
whose share rows no longer exist. They upload as unreferenced objects and cost
pennies; filtering them is not worth the effort.

## Known limitations

- **~1 second of writes can be lost** on an ungraceful stop. Litestream's sync
  interval. For share metadata that window is acceptable; it is not zero.
- **Redeploys cause a short outage.** One node, stopped before the replacement
  starts. Unavoidable with single-writer SQLite.
- **0.5 vCPU on the small tier** makes video preview transcoding slow. The
  large uploads themselves are unaffected — they bypass the container entirely
  via presigned multipart.
- **No ClamAV.** Scanning stays inert; `VIRUS_SCAN_AUTO_START` defaults off.
- **An avatar uploaded seconds before an ungraceful stop can be lost**, since
  that sync is on a 5-minute timer rather than continuous.
