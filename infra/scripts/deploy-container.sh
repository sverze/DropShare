#!/usr/bin/env bash
#
# Create a Lightsail container service deployment.
#
# Kept out of CDK deliberately. The deployment carries the image tag and the
# IAM secret; the tag changes on every push, and the secret has no business in
# a CloudFormation template. CDK owns the durable resources, this owns the
# rollout.
#
# The domain is optional. Leave it off and the deployment configures itself
# against the hostname Lightsail issued for the service, which already has TLS.
#
#   ./deploy-container.sh dropshare <ecr-uri>:latest <bucket> us-west-2
#   ./deploy-container.sh dropshare <ecr-uri>:latest <bucket> us-west-2 share.example.com

set -euo pipefail

SERVICE="${1:?usage: deploy-container.sh <service> <image> <bucket> <region> [domain]}"
IMAGE="${2:?image required}"
BUCKET="${3:?bucket required}"
REGION="${4:?region required}"
DOMAIN="${5:-}"
SECRET_NAME="${SECRET_NAME:-${SERVICE}/app-credentials}"

if [ -z "$DOMAIN" ]; then
  echo "==> No domain given, reading the Lightsail hostname for ${SERVICE}"
  SERVICE_URL="$(aws lightsail get-container-services \
    --service-name "$SERVICE" --region "$REGION" \
    --query 'containerServices[0].url' --output text)"

  if [ -z "$SERVICE_URL" ] || [ "$SERVICE_URL" = "None" ]; then
    echo "Could not read the service URL. Is the stack deployed yet?" >&2
    exit 1
  fi

  # https://name.id.region.cs.amazonlightsail.com/ -> bare host
  DOMAIN="${SERVICE_URL#https://}"
  DOMAIN="${DOMAIN%/}"
  echo "    Using ${DOMAIN}"
fi

echo "==> Reading credentials from Secrets Manager (${SECRET_NAME})"
CREDS="$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_NAME" --region "$REGION" \
  --query SecretString --output text)"

ACCESS_KEY_ID="$(printf '%s' "$CREDS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["accessKeyId"])')"
SECRET_ACCESS_KEY="$(printf '%s' "$CREDS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["secretAccessKey"])')"

# Note there is no R2_ACCESS_KEY_ID here on purpose. The storage service omits
# the SDK credentials object when those are unset, which lets the default
# provider chain pick up AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY below - so
# one pair of keys serves the application, litestream and the aws CLI.
CONTAINERS="$(python3 - "$IMAGE" "$BUCKET" "$DOMAIN" "$REGION" "$ACCESS_KEY_ID" "$SECRET_ACCESS_KEY" <<'PY'
import json, sys
image, bucket, domain, region, key_id, key_secret = sys.argv[1:7]
site = f"https://{domain}"

# Passkeys are bound to the relying-party id, and credentials enrolled under
# one are worthless under another. Use the registrable domain rather than the
# host, so a later move between www and the apex does not orphan them.
rp_id = domain[4:] if domain.startswith("www.") else domain
print(json.dumps({
    "dropshare": {
        "image": image,
        "ports": {"3000": "HTTP"},
        "environment": {
            "APP_URL": site,
            "PUBLIC_DROPSHARE_URL": site,
            "PUBLIC_AUTH_URL": site,
            "WEBAUTHN_RP_ID": rp_id,
            "WEBAUTHN_RP_NAME": "DropShare",
            "WEBAUTHN_ORIGINS": site,
            "TRUST_PROXY": "true",
            "DATABASE_URL": "file:../data/dropshare.db?connection_limit=1",
            "R2_ENABLED": "true",
            "R2_ENDPOINT": f"https://s3.{region}.amazonaws.com",
            "R2_BUCKET": bucket,
            "R2_REGION": region,
            "R2_FORCE_PATH_STYLE": "false",
            "S3_BUCKET": bucket,
            "AWS_REGION": region,
            "AWS_DEFAULT_REGION": region,
            "AWS_ACCESS_KEY_ID": key_id,
            "AWS_SECRET_ACCESS_KEY": key_secret,
            "LITESTREAM_ACCESS_KEY_ID": key_id,
            "LITESTREAM_SECRET_ACCESS_KEY": key_secret,
            "PUID": "1000",
            "PGID": "1000",
        },
    }
}))
PY
)"

PUBLIC_ENDPOINT="$(python3 -c '
import json
print(json.dumps({
  "containerName": "dropshare",
  "containerPort": 3000,
  "healthCheck": {
    "path": "/api/health",
    "successCodes": "200-299",
    "intervalSeconds": 10,
    "timeoutSeconds": 5,
    "healthyThreshold": 2,
    "unhealthyThreshold": 3,
  },
}))')"

echo "==> Deploying ${IMAGE} to ${SERVICE}"
aws lightsail create-container-service-deployment \
  --region "$REGION" \
  --service-name "$SERVICE" \
  --containers "$CONTAINERS" \
  --public-endpoint "$PUBLIC_ENDPOINT" \
  --query 'containerService.{State:state,Url:url,NextDeployment:nextDeployment.version}' \
  --output table

echo
echo "Deployments take a few minutes. Watch with:"
echo "  aws lightsail get-container-services --service-name $SERVICE --region $REGION \\"
echo "    --query 'containerServices[0].{state:state,url:url}'"
echo
echo "Logs:"
echo "  aws lightsail get-container-log --service-name $SERVICE --container-name dropshare --region $REGION"
