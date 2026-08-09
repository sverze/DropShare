#!/usr/bin/env bash
#
# Seed the Litestream replica in S3 from your local database.
#
# There is no instance to copy a file onto: the container restores from S3 on
# every start, so "uploading the database" means creating the first Litestream
# generation. Run this BEFORE the first container deployment, otherwise the
# application will create an empty database and start replicating that instead.
#
#   ./upload-database.sh ../../data/dropshare.db my-bucket eu-west-2

set -euo pipefail

DB_PATH="${1:?usage: upload-database.sh <dropshare.db> <bucket> <region>}"
BUCKET="${2:?bucket required}"
REGION="${3:?region required}"
IMAGE="${DEPLOY_IMAGE:-}"

if [ ! -f "$DB_PATH" ]; then
  echo "No such database: $DB_PATH" >&2
  exit 1
fi

echo "==> Integrity check"
RESULT="$(sqlite3 "$DB_PATH" 'PRAGMA integrity_check;')"
if [ "$RESULT" != "ok" ]; then
  echo "Refusing to seed from a database that fails integrity_check: $RESULT" >&2
  exit 1
fi

cp "$DB_PATH" "${DB_PATH}.pre-seed.$(date +%Y%m%d-%H%M%S)"

echo "==> Switching to WAL (required by litestream; persists in the file header)"
sqlite3 "$DB_PATH" 'PRAGMA journal_mode=WAL;'

if [ -z "$IMAGE" ]; then
  echo "Set DEPLOY_IMAGE to the image built by build-and-push-image.sh, e.g." >&2
  echo "  DEPLOY_IMAGE=<acct>.dkr.ecr.${REGION}.amazonaws.com/dropshare:latest $0 ..." >&2
  exit 1
fi

WORK_DIR="$(cd "$(dirname "$DB_PATH")" && pwd)"
DB_FILE="$(basename "$DB_PATH")"

# Reuse the deployment image so the litestream version that seeds the replica
# is exactly the one that will later read it.
echo "==> Seeding s3://${BUCKET}/_db"
docker run --rm \
  -v "${WORK_DIR}:/seed" \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
  -e AWS_REGION="$REGION" \
  --entrypoint sh \
  "$IMAGE" -c "
    set -e
    cat > /tmp/seed.yml <<EOF
dbs:
  - path: /seed/${DB_FILE}
    replicas:
      - type: s3
        bucket: ${BUCKET}
        path: _db
        region: ${REGION}
EOF
    litestream replicate -config /tmp/seed.yml -exec 'sleep 15'
  "

echo
echo "==> Replica contents"
aws s3 ls "s3://${BUCKET}/_db/" --recursive --region "$REGION" | head -5

echo
echo "Seeded. The next container start will restore from this replica."
echo "Verify afterwards with:"
echo "  aws lightsail get-container-log --service-name <service> --container-name dropshare --region $REGION | grep replicated"
