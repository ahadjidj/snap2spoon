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

### 3.2 Build and push the three images

Easiest registry: Artifact Registry in the same project.

```bash
# Create a Docker repo (one-time)
gcloud artifacts repositories create snap2spoon \
  --repository-format=docker \
  --location=us-central1

# Auth docker to it
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build + push
PROJECT=$(gcloud config get-value project)
REGISTRY=us-central1-docker.pkg.dev/$PROJECT/snap2spoon

docker build -t $REGISTRY/api:v1       api-service
docker build -t $REGISTRY/analyzer:v1  analyzer-service
docker build -t $REGISTRY/frontend:v1  frontend

docker push $REGISTRY/api:v1
docker push $REGISTRY/analyzer:v1
docker push $REGISTRY/frontend:v1
```

Now update the three Deployments to use your images. Edit `k8s/api-service.yaml`,
`k8s/analyzer-service.yaml`, `k8s/frontend.yaml` and change each `image:` line:

```yaml
# Before
image: snap2spoon/api:latest
# After (example)
image: us-central1-docker.pkg.dev/your-project/snap2spoon/api:v1
```

### 3.3 Apply the base manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Create your secrets. DO NOT edit secret.example.yaml — run this instead:
kubectl -n snap2spoon create secret generic snap2spoon-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-YOUR_KEY \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 16)

kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/api-service.yaml
kubectl apply -f k8s/analyzer-service.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/networkpolicy.yaml
```

Check the pods come up:

```bash
kubectl -n snap2spoon get pods -w
# wait until every pod is Running / 1/1 Ready, then Ctrl+C
```

**Do not** apply `k8s/ingress.yaml` — we're using the nip.io ingress from
the `tls/` overlay instead.

### 3.4 Install ingress-nginx + cert-manager

One-time per cluster.

```bash
# ingress-nginx
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# cert-manager (includes its CRDs)
helm upgrade --install cert-manager cert-manager \
  --repo https://charts.jetstack.io \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true
```

Wait for ingress-nginx to get a public IP — this is what your nip.io URL
will be built from:

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

### 3.5 Issue the HTTPS certificate

Open `k8s/tls/cluster-issuer.yaml` and replace both `you@example.com`
placeholders with your real email (Let's Encrypt uses this to notify you if
renewal ever breaks).

Then:

```bash
cd k8s/tls
./apply.sh
```

The script prints your URL, e.g.:

```
Using LB IP: 34.120.0.42
  app URL:           https://snap2spoon-34-120-0-42.nip.io
  api health:        https://snap2spoon-34-120-0-42.nip.io/api/health
```

Watch the cert get issued (usually 30–90 seconds):

```bash
kubectl -n snap2spoon describe certificate snap2spoon-tls
# Look for: Status: ... Ready: True
```

Visit your URL. You should see the snap2spoon homepage. The first time, the
cert is from Let's Encrypt **Staging** — your browser will warn it's
untrusted. That's expected; it proves the flow works.

### 3.6 Switch to the real (trusted) Let's Encrypt cert

Edit `k8s/tls/ingress-nipio.template.yaml` and change:

```yaml
cert-manager.io/cluster-issuer: "letsencrypt-staging"
# to:
cert-manager.io/cluster-issuer: "letsencrypt-prod"
```

Then re-apply and force a re-issue:

```bash
./apply.sh
kubectl -n snap2spoon delete secret snap2spoon-tls
```

cert-manager will request a new cert from Let's Encrypt Production. Watch
`kubectl -n snap2spoon describe certificate snap2spoon-tls` again until
`Ready: True`.

Now open `https://snap2spoon-<ip>.nip.io` — no browser warning. **This URL is
what you point your synthetic monitor at.**

For a simple health check, use `/api/health` — it returns
`{"status":"ok"}`.

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
