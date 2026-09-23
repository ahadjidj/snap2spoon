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
GKE_REGION="${GKE_REGION:-us-central1}"
AR_REGION="${AR_REGION:-us-central1}"
GKE_CLUSTER="${GKE_CLUSTER:-snap2spoon}"
# Unique tag per build content so every change triggers a rollout (re-applying
# the same tag is a no-op, and nodes keep the cached image). Uncommitted
# changes get a hash of the diff so two dirty builds never share a tag.
if git diff --quiet HEAD; then
  DEFAULT_TAG="$(git rev-parse --short HEAD)"
else
  DEFAULT_TAG="$(git rev-parse --short HEAD)-dirty-$(git diff HEAD | shasum | cut -c1-7)"
fi
IMAGE_TAG="${IMAGE_TAG:-$DEFAULT_TAG}"
REGISTRY="${IMAGE_REGISTRY:-${AR_REGION}-docker.pkg.dev/${GCP_PROJECT}/snap2spoon}"
export TLS_ISSUER="${TLS_ISSUER:-letsencrypt-staging}"

APPLY_ONLY="${1:-}"

# ── Refuse to deploy into the wrong cluster ──────────────────────────────────
CONTEXT="$(kubectl config current-context)"
if [[ "$CONTEXT" != gke_"${GCP_PROJECT}"_*_"${GKE_CLUSTER}" ]]; then
  echo "kubectl context is '$CONTEXT', expected gke_${GCP_PROJECT}_<location>_${GKE_CLUSTER}." >&2
  echo "Run: gcloud container clusters get-credentials $GKE_CLUSTER --location=<location>" >&2
  exit 1
fi
echo "==> Deploying to $CONTEXT"

# --apply re-uses whatever images are already running instead of the HEAD tag.
if [[ "$APPLY_ONLY" == "--apply" ]]; then
  current="$(kubectl -n snap2spoon get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || true)"
  [[ -n "$current" ]] || { echo "No existing deployment found; run a full deploy first." >&2; exit 1; }
  IMAGE_TAG="${current##*:}"
fi

# ── Build & push ──────────────────────────────────────────────────────────────
if [[ "$APPLY_ONLY" != "--apply" ]]; then
  echo "==> Authenticating Docker to Artifact Registry"
  gcloud auth configure-docker "${AR_REGION}-docker.pkg.dev" --quiet

  echo "==> Building images (tag: $IMAGE_TAG)"
  # GKE nodes are amd64; without --platform an Apple Silicon Mac builds arm64
  # images that crash with "exec format error".
  docker build --platform linux/amd64 -t "$REGISTRY/api:$IMAGE_TAG" api-service
  docker build --platform linux/amd64 -t "$REGISTRY/analyzer:$IMAGE_TAG" analyzer-service
  docker build --platform linux/amd64 \
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
sed "s#replace-me.apps.googleusercontent.com#${GOOGLE_CLIENT_ID:-replace-me.apps.googleusercontent.com}#" \
  k8s/configmap.yaml | kubectl apply -f -

echo "==> Creating/updating secret"
kubectl -n snap2spoon create secret generic snap2spoon-secrets \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f k8s/postgres.yaml
echo "==> Deploying images (tag: $IMAGE_TAG)"
# Manifests reference snap2spoon/<svc>:latest; point them at the pushed tag.
for pair in api:api-service analyzer:analyzer-service frontend:frontend; do
  svc="${pair%%:*}" file="${pair##*:}"
  sed "s#image: snap2spoon/${svc}:latest#image: ${REGISTRY}/${svc}:${IMAGE_TAG}#" \
    "k8s/${file}.yaml" | kubectl apply -f -
done
kubectl apply -f k8s/networkpolicy.yaml

# Same image tag means no rollout, so restart to pick up config/secret changes.
if [[ "$APPLY_ONLY" == "--apply" ]]; then
  kubectl -n snap2spoon rollout restart deployment/api deployment/analyzer deployment/frontend
fi

echo "==> Applying TLS / ingress (issuer: $TLS_ISSUER)"
bash k8s/tls/apply.sh

echo
echo "Done. Watch rollout:  kubectl -n snap2spoon get pods -w"
