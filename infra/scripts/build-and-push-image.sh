#!/usr/bin/env bash
#
# Build the DropShare image with replication baked in, and push it to ECR.
#
# Two stages: the project Dockerfile unchanged, then the Litestream overlay on
# top. Built for linux/amd64 because Lightsail container services run x86_64.
#
#   ./build-and-push-image.sh <ecr-repo-uri> <region> [tag]

set -euo pipefail

REPO_URI="${1:?usage: build-and-push-image.sh <ecr-repo-uri> <region> [tag]}"
REGION="${2:?region required}"
TAG="${3:-latest}"
REGISTRY="${REPO_URI%%/*}"
ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/infra/deploy"

echo "==> Building base image from ${ROOT_DIR}"
docker build --platform linux/amd64 -t dropshare:base "${ROOT_DIR}"

echo "==> Layering Litestream + avatar sync"
docker build --platform linux/amd64 \
  -t "${REPO_URI}:${TAG}" \
  -f "${DEPLOY_DIR}/Dockerfile.litestream" \
  --build-arg BASE_IMAGE=dropshare:base \
  --build-arg TARGETARCH=amd64 \
  "${DEPLOY_DIR}"

echo "==> Pushing"
aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "$REGISTRY"
docker push "${REPO_URI}:${TAG}"

echo
echo "Pushed ${REPO_URI}:${TAG}"
echo "Roll it out with: ./deploy-container.sh <service-name> ${REPO_URI}:${TAG} <bucket> <domain> ${REGION}"
