#!/usr/bin/env bash
#
# Restore share content from the export archive into S3.
#
# Extracts and uploads one share at a time, deleting each after it lands, so
# peak disk usage is the size of the largest single share rather than the 44 GB
# the whole archive would need. That matters: extracting the lot requires more
# free space than most laptops have spare.
#
# The export is already in the layout the application expects -
# shares/<shareId>/<fileId>, exactly what R2StorageService.getFileKey() builds -
# so nothing is renamed or transformed.
#
# Resumable. Completed shares are recorded in a manifest next to the archive;
# rerun after an interruption and it picks up where it stopped.
#
#   ./upload-shares.sh ../../data/shares.zip my-bucket eu-west-2

set -euo pipefail

ZIP_PATH="${1:?usage: upload-shares.sh <shares.zip> <bucket> <region>}"
BUCKET="${2:?bucket required}"
REGION="${3:?region required}"

ZIP_DIR="$(cd "$(dirname "$ZIP_PATH")" && pwd)"
ZIP_FILE="${ZIP_DIR}/$(basename "$ZIP_PATH")"
WORK_DIR="${WORK_DIR:-${ZIP_DIR}/.restore-work}"
MANIFEST="${ZIP_DIR}/.restore-done"

[ -f "$ZIP_FILE" ] || { echo "No such archive: $ZIP_FILE" >&2; exit 1; }

command -v unzip >/dev/null || { echo "unzip is required" >&2; exit 1; }
command -v aws   >/dev/null || { echo "aws cli is required" >&2; exit 1; }

mkdir -p "$WORK_DIR"
touch "$MANIFEST"

echo "==> Reading share list from the archive"
SHARE_IDS="$(unzip -Z1 "$ZIP_FILE" | sed -n 's|^shares/\([^/]*\)/..*|\1|p' | sort -u)"
TOTAL="$(printf '%s\n' "$SHARE_IDS" | grep -c . || true)"
DONE_ALREADY="$(grep -c . "$MANIFEST" || true)"

echo "    ${TOTAL} shares in the archive, ${DONE_ALREADY} already uploaded"
echo "    Free space here: $(df -h "$ZIP_DIR" | awk 'NR==2 {print $4}')"
echo

N=0
SKIPPED=0
for SHARE_ID in $SHARE_IDS; do
  N=$((N + 1))

  if grep -qxF "$SHARE_ID" "$MANIFEST"; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  printf '[%4d/%4d] %s ' "$N" "$TOTAL" "$SHARE_ID"

  # -o overwrites a partial extraction left by an interrupted run.
  unzip -o -q "$ZIP_FILE" "shares/${SHARE_ID}/*" -d "$WORK_DIR"

  SIZE="$(du -sh "${WORK_DIR}/shares/${SHARE_ID}" 2>/dev/null | cut -f1)"
  printf '(%s) ' "${SIZE:-?}"

  aws s3 sync "${WORK_DIR}/shares/${SHARE_ID}" "s3://${BUCKET}/shares/${SHARE_ID}" \
    --region "$REGION" --only-show-errors --no-progress

  rm -rf "${WORK_DIR:?}/shares/${SHARE_ID}"
  echo "$SHARE_ID" >> "$MANIFEST"
  printf 'ok\n'
done

rm -rf "$WORK_DIR"

echo
echo "==> Uploaded $((N - SKIPPED)) shares this run, ${SKIPPED} already present"
echo "==> Objects now in the bucket:"
aws s3 ls "s3://${BUCKET}/shares/" --recursive --summarize --region "$REGION" | tail -2
echo
echo "Cross-check against the database:"
echo "  sqlite3 ${ZIP_DIR}/dropshare.db 'SELECT COUNT(*) FROM File;'"
echo
echo "Delete ${MANIFEST} to force a full re-upload."
