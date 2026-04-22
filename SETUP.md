# snap2spoon setup guide

Step-by-step. Start at the section that matches what you want to do.

- [1. Prerequisites](#1-prerequisites) — tools + accounts you need.
- [2. Run it locally](#2-run-it-locally-docker-compose) — for development.
- [3. Deploy to GKE with a trusted HTTPS URL](#3-deploy-to-gke) — what you
  asked about. Ends with a URL you can point synthetic monitoring at.
- [4. Enable Google Sign-In](#4-enable-google-sign-in) — optional, adds
  one-click login.

---

## 1. Prerequisites

You need accounts + tools. Skip anything you already have.

| What | Why | How |
|------|-----|-----|
| **Anthropic API key** | The analyzer calls Claude to read recipes from frames. | https://console.anthropic.com → API Keys → "Create key". Starts with `sk-ant-`. |
| **GCP project** | Where GKE runs. | https://console.cloud.google.com → "New project". Note the project ID. |
| **Billing enabled** | GKE needs it. | GCP console → Billing → link the project. |
| **`gcloud` CLI** | Talk to GCP from your shell. | https://cloud.google.com/sdk/docs/install → `gcloud init` and pick your project. |
| **`kubectl`** | Talk to the Kubernetes cluster. | `gcloud components install kubectl` (or any install method). |
| **`helm`** | Install ingress-nginx + cert-manager. | https://helm.sh/docs/intro/install/ |
| **Docker** (local dev only) | Build + run images. | https://docs.docker.com/get-docker/ |

Enable the GCP APIs you'll need:

```bash
gcloud services enable container.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com
```

---

## 2. Run it locally (Docker Compose)

```bash
# Clone and enter
git clone <this-repo> snap2spoon && cd snap2spoon

# Create .env with your Anthropic key
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...
# Also set JWT_SECRET to a long random string (one easy option: openssl rand -hex 32)

# Build + start everything
docker compose up --build
```

Open http://localhost:3000. Paste an Instagram reel URL. First extract takes
~30 seconds (Claude reads the frames), subsequent ones are faster.

To stop: `Ctrl+C`, then `docker compose down` (add `-v` to also wipe the
database).

---

## 3. Deploy to GKE

End state: you get a URL like `https://snap2spoon-34-120-0-42.nip.io` with a
real Let's Encrypt certificate that every synthetic monitor trusts.

### 3.1 Create a GKE cluster

Any small cluster works. Autopilot is cheapest to run:

```bash
gcloud container clusters create-auto snap2spoon \
  --region=us-central1
```

(Takes ~5 minutes.) Then point `kubectl` at it:

```bash
gcloud container clusters get-credentials snap2spoon --region=us-central1
kubectl get nodes   # should show at least one node
```

### 3.2 Create the Artifact Registry repo (one-time)

```bash
gcloud artifacts repositories create snap2spoon \
  --repository-format=docker \
  --location=us-central1
```

### 3.3 Configure `.env` for GKE

Everything `deploy.sh` needs lives in your `.env`. Add these lines (the
local-dev keys you already set stay unchanged):

```bash
# .env — GKE section
GCP_PROJECT=your-gcp-project-id      # gcloud config get-value project
GCP_REGION=us-central1
LETS_ENCRYPT_EMAIL=you@example.com   # used by cert-manager for renewal alerts
TLS_ISSUER=letsencrypt-staging       # switch to letsencrypt-prod for a trusted cert
```

### 3.4 Install ingress-nginx + cert-manager (one-time per cluster)

```bash
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

Wait for ingress-nginx to get a public IP:

```bash
kubectl -n ingress-nginx get svc ingress-nginx-controller -w
# wait until EXTERNAL-IP is a real number (e.g. 34.120.0.42), then Ctrl+C
```

> **Want the URL to stay the same if the LoadBalancer is ever recreated?**
> Reserve a regional static IP in GCP and pass it to the helm install:
> ```bash
> gcloud compute addresses create snap2spoon-lb --region=us-central1
> IP=$(gcloud compute addresses describe snap2spoon-lb --region=us-central1 --format='value(address)')
> helm upgrade --install ingress-nginx ingress-nginx \
>   --repo https://kubernetes.github.io/ingress-nginx \
>   --namespace ingress-nginx \
>   --set controller.service.loadBalancerIP=$IP
> ```

### 3.5 Deploy everything with one command

```bash
bash deploy.sh
```

This single script:
1. Authenticates Docker to Artifact Registry
2. Builds and pushes the three images
3. Creates/updates the Kubernetes secret from your `.env` values
4. Applies all manifests (namespace, configmap, postgres, api, analyzer, frontend, networkpolicy)
5. Issues the Let's Encrypt certificate via `k8s/tls/apply.sh`

The script prints your URL at the end, e.g.:

```
Using LB IP: 34.120.0.42  (issuer: letsencrypt-staging)
  app URL:           https://snap2spoon-34-120-0-42.nip.io
  api health:        https://snap2spoon-34-120-0-42.nip.io/api/health
```

Watch the cert get issued (usually 30–90 seconds):

```bash
kubectl -n snap2spoon describe certificate snap2spoon-tls
# Look for: Ready: True
```

Visit your URL. The first time, the cert is from Let's Encrypt **Staging** —
your browser will warn it's untrusted. That's expected; it proves the flow works.

### 3.6 Switch to the trusted Let's Encrypt cert

In `.env`, change:

```bash
TLS_ISSUER=letsencrypt-prod
```

Then re-deploy and force a re-issue:

```bash
bash deploy.sh --apply    # skip image rebuild, re-apply k8s only
kubectl -n snap2spoon delete secret snap2spoon-tls
```

cert-manager will request a new cert from Let's Encrypt Production. Watch
`kubectl -n snap2spoon describe certificate snap2spoon-tls` until `Ready: True`.

Now open `https://snap2spoon-<ip>.nip.io` — no browser warning. **This URL is
what you point your synthetic monitor at.**

For a simple health check, use `/api/health` — it returns `{"status":"ok"}`.

### 3.7 (Optional) Point a synthetic monitor at it

**Google Cloud Monitoring synthetics** (easiest on GKE):

```
Console → Monitoring → Synthetic monitoring → Create → Public uptime check
URL: https://snap2spoon-34-120-0-42.nip.io/api/health
Check every: 1 minute
Response contains: "ok"
```

The cert chains to ISRG Root X1, which Cloud Monitoring (and Datadog,
Checkly, Pingdom, etc.) trusts out of the box.

---

## 4. Enable Google Sign-In

Optional. Lets users log in with their Google account instead of creating
a password.

### 4.1 Get a Google OAuth client ID

1. Open https://console.cloud.google.com/apis/credentials (in the same
   project or a different one — doesn't matter).
2. Click **Configure consent screen** if you haven't. Choose **External**,
   fill in the app name "snap2spoon" and your email. You can skip scopes.
3. Go back to **Credentials** → **+ Create credentials** → **OAuth client ID**.
4. Application type: **Web application**.
5. **Authorized JavaScript origins**: add every URL the frontend runs on.
   - For local dev: `http://localhost:3000`
   - For your nip.io URL: `https://snap2spoon-34-120-0-42.nip.io`
6. Save. Copy the **Client ID** — it looks like
   `123456-abcdef.apps.googleusercontent.com`.

### 4.2 Plug it in

**Locally** — put it in your `.env`:

```
GOOGLE_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
```

Then restart `docker compose up`.

**On GKE** — edit `k8s/configmap.yaml`:

```yaml
GOOGLE_CLIENT_ID: "123456-abcdef.apps.googleusercontent.com"
```

then apply and restart the api pods:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl -n snap2spoon rollout restart deployment/api
```

The login + signup pages will now show a "Continue with Google" button.
First-time users get an account created automatically.

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| `kubectl` works but pods are `ImagePullBackOff` | Did you update the `image:` fields in the three Deployments? Are they pushed and can the GKE nodes reach the registry? |
| Certificate stuck in `Not Ready` | `kubectl -n snap2spoon describe challenge` — look for HTTP-01 errors. Usually means the LB IP changed, or the ingress-nginx Service hasn't got an external IP yet. |
| Extractor fails with `URL must be an instagram.com link` | That's the check in `analyzer-service/app/downloader.py`. Paste a full `https://www.instagram.com/...` URL. |
| Extractor fails with a generic Instagram error | Instagram sometimes requires a logged-in session for video downloads. The scaffold uses `yt-dlp` without cookies, so private accounts and some reel variants won't download. |
| "Google sign-in is not configured" | `GOOGLE_CLIENT_ID` isn't set in the api env. See §4.2. |
| Homepage loads but no recipes / stats | Open DevTools → Network. `/api/stats` should return `{"recipes_extracted": 0, ...}`. If it doesn't, the Next.js proxy can't reach the api — check `API_URL_INTERNAL` on the frontend pod (`kubectl -n snap2spoon exec -it deploy/frontend -- env \| grep API`). |
