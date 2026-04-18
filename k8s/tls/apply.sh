#!/usr/bin/env bash
# Render and apply the nip.io Ingress + cert-manager ClusterIssuers.
#
# Usage:
#   ./apply.sh                # auto-detect LB IP from ingress-nginx Service
#   ./apply.sh 34.120.0.42    # or pass it explicitly

set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
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

echo "Using LB IP: $ip"
echo "  app URL:           https://$host"
echo "  api health (for"
echo "  synthetic monitor): https://$host/api/health"
echo

kubectl apply -f "$here/cluster-issuer.yaml"

LB_IP="$dashed" envsubst < "$here/ingress-nipio.template.yaml" | kubectl apply -f -

echo
echo "Applied. Watch cert issuance with:"
echo "  kubectl -n snap2spoon describe certificate snap2spoon-tls"
echo "  kubectl -n snap2spoon get challenge,order"
