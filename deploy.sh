#!/usr/bin/env bash
# Build, push, and deploy snap2spoon to GKE.
# All config is read from .env — copy .env.example and fill in the GKE vars.
#
# Usage:
#   bash deploy.sh            # full deploy (build + push + apply)
#   bash deploy.sh --apply    # skip image build/push, re-apply k8s only

set -euo pipefail

[[ -f .env ]] && { set -a; source .env; set +a; }

# ── Required vars ─────────────────────────────────────────────────────────────
: "${GCP_PROJECT:?Set GCP_PROJECT in .env}"
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY in .env}"
: "${JWT_SECRET:?Set JWT_SECRET in .env}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}"
: "${LETS_ENCRYPT_EMAIL:?Set LETS_ENCRYPT_EMAIL in .env}"

# ── Defaults ──────────────────────────────────────────────────────────────────
GCP_REGION="${GCP_REGION:-us-central1}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${IMAGE_REGISTRY:-${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/snap2spoon}"
export TLS_ISSUER="${TLS_ISSUER:-letsencrypt-staging}"

APPLY_ONLY="${1:-}"

# ── Build & push ──────────────────────────────────────────────────────────────
if [[ "$APPLY_ONLY" != "--apply" ]]; then
  echo "==> Authenticating Docker to Artifact Registry"
  gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

  echo "==> Building images (tag: $IMAGE_TAG)"
  docker build -t "$REGISTRY/api:$IMAGE_TAG" api-service
  docker build -t "$REGISTRY/analyzer:$IMAGE_TAG" analyzer-service
  docker build \
    --build-arg NEXT_PUBLIC_FARO_URL="${NEXT_PUBLIC_FARO_URL:-}" \
    --build-arg NEXT_PUBLIC_FARO_APP_NAME="${NEXT_PUBLIC_FARO_APP_NAME:-snap2spoon}" \
    -t "$REGISTRY/frontend:$IMAGE_TAG" \
    frontend

  echo "==> Pushing images"
  docker push "$REGISTRY/api:$IMAGE_TAG"
  docker push "$REGISTRY/analyzer:$IMAGE_TAG"
  docker push "$REGISTRY/frontend:$IMAGE_TAG"
fi

# ── Kubernetes ────────────────────────────────────────────────────────────────
echo "==> Applying manifests"
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

echo "==> Creating/updating secret"
kubectl -n snap2spoon create secret generic snap2spoon-secrets \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/analyzer-service.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/networkpolicy.yaml

echo "==> Updating image references"
kubectl -n snap2spoon set image deployment/api      api="$REGISTRY/api:$IMAGE_TAG"
kubectl -n snap2spoon set image deployment/analyzer analyzer="$REGISTRY/analyzer:$IMAGE_TAG"
kubectl -n snap2spoon set image deployment/frontend frontend="$REGISTRY/frontend:$IMAGE_TAG"

echo "==> Applying TLS / ingress (issuer: $TLS_ISSUER)"
bash k8s/tls/apply.sh

echo
echo "Done. Watch rollout:  kubectl -n snap2spoon get pods -w"
