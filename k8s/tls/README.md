# TLS on GKE with nip.io + Let's Encrypt

Gives you **publicly-trusted HTTPS endpoints** without owning a domain —
perfect for synthetic monitoring.

After this, your URLs look like:

```
https://app-34-120-0-42.nip.io   # frontend
https://api-34-120-0-42.nip.io   # api
```

Both served with a real Let's Encrypt certificate (auto-renewed every 60 days
by cert-manager).

## Why not GKE's ManagedCertificate?
Google-managed certs require you to prove domain ownership. `nip.io` isn't
yours, so that path is closed. Let's Encrypt doesn't care — HTTP-01 just
checks that whatever the hostname resolves to can serve a file, which
nginx-ingress does.

## Prereqs

```bash
# 1. ingress-nginx (this is what your k8s/ingress.yaml uses)
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 2. cert-manager
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

Wait until the ingress-nginx Service shows an external IP:

```bash
kubectl -n ingress-nginx get svc ingress-nginx-controller -w
```

(Tip for stable URLs: reserve a regional static IP in GCP and pass
`--set controller.service.loadBalancerIP=<IP>` to the helm install. Otherwise
the IP — and your nip.io hostname — will change if the LB is recreated.)

## Apply

Edit `cluster-issuer.yaml` and replace `you@example.com` with a real email
(Let's Encrypt sends expiry notices there if renewal ever stops working),
then:

```bash
# Auto-detects the LB IP from ingress-nginx:
./apply.sh

# Or pass it explicitly:
./apply.sh 34.120.0.42
```

The script renders the Ingress template, applies the ClusterIssuers, and
triggers cert-manager to request a cert.

## Verify

```bash
kubectl -n snap2spoon describe certificate snap2spoon-tls
kubectl -n snap2spoon get challenge,order
```

When `READY=True` on the Certificate, visit `https://app-<dashed-ip>.nip.io`.

## Switch staging → prod

Staging certs are not browser-trusted (they're issued by "Fake LE Intermediate
X1"), which means your synthetics will fail cert validation. Once you've
verified the flow works, switch the annotation in
`ingress-nipio.template.yaml`:

```yaml
cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

then re-run `./apply.sh` and delete the staging Secret so cert-manager
re-issues from prod:

```bash
kubectl -n snap2spoon delete secret snap2spoon-tls
```

## Synthetic monitoring

Point your synthetic check at `https://api-<dashed-ip>.nip.io/health` — the
api exposes a `/health` endpoint that returns `{"status":"ok"}`. The cert
chains to ISRG Root X1, which every monitoring provider trusts out of the box.
