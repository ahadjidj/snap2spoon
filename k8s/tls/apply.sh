#!/usr/bin/env bash
# Render and apply the nip.io Ingress + cert-manager ClusterIssuers.
#
# Reads LETS_ENCRYPT_EMAIL and TLS_ISSUER from .env (project root) if present.
# Both can also be exported in the environment before calling this script.
#
# Usage:
#   ./apply.sh                # auto-detect LB IP from ingress-nginx Service
#   ./apply.sh 34.120.0.42    # or pass it explicitly

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"

# Load .env from repo root so LETS_ENCRYPT_EMAIL / TLS_ISSUER are available
# even when calling this script directly (not via deploy.sh).
[[ -f "$root/.env" ]] && { set -a; source "$root/.env"; set +a; }

: "${LETS_ENCRYPT_EMAIL:?Set LETS_ENCRYPT_EMAIL in .env (e.g. you@example.com)}"
export TLS_ISSUER="${TLS_ISSUER:-letsencrypt-staging}"

ip="${1:-}"

if [[ -z "$ip" ]]; then
  ip="$(kubectl -n ingress-nginx get svc ingress-nginx-controller \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)"
fi

if [[ -z "$ip" ]]; then
  echo "Could not determine LoadBalancer IP."
  echo "Install ingress-nginx first, wait for an external IP, or pass one:"
  echo "  $0 <IP>"
  exit 1
fi

dashed="${ip//./-}"
host="snap2spoon-${dashed}.nip.io"

echo "Using LB IP: $ip  (issuer: $TLS_ISSUER)"
echo "  app URL:           https://$host"
echo "  api health (for"
echo "  synthetic monitor): https://$host/api/health"
echo

LETS_ENCRYPT_EMAIL="$LETS_ENCRYPT_EMAIL" envsubst < "$here/cluster-issuer.yaml" | kubectl apply -f -

LB_IP="$dashed" TLS_ISSUER="$TLS_ISSUER" envsubst < "$here/ingress-nipio.template.yaml" | kubectl apply -f -

echo
echo "Applied. Watch cert issuance with:"
echo "  kubectl -n snap2spoon describe certificate snap2spoon-tls"
echo "  kubectl -n snap2spoon get challenge,order"
