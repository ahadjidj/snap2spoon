# snap2spoon

Turn Instagram recipe videos into structured written recipes you can search, rate, comment on, and bookmark.

> **New here?** Follow [**SETUP.md**](SETUP.md) for a detailed step-by-step
> walkthrough — local dev, GKE deploy with a trusted HTTPS URL, and Google
> Sign-In.

## Architecture

Three services, all OpenTelemetry auto-instrumentation ready (no manual spans):

| Service            | Language / Framework     | Purpose                                                                 |
|--------------------|--------------------------|-------------------------------------------------------------------------|
| `frontend`         | Next.js 14 (TypeScript)  | UI, auth flow, pasting links, browsing/rating/commenting on recipes.    |
| `api-service`      | Python 3.12 / FastAPI    | Users, recipes, ratings, comments, bookmarks, time-saved stats.         |
| `analyzer-service` | Python 3.12 / FastAPI    | Downloads the Instagram video, extracts frames, calls Claude, returns a structured recipe. |

Postgres holds persistent data. Services communicate over HTTP inside the cluster.

### Why these languages?

All three are first-class for OTel auto-instrumentation:

- Node.js: `@opentelemetry/auto-instrumentations-node` (zero-code via `NODE_OPTIONS='--require @opentelemetry/auto-instrumentations-node/register'`).
- Python: `opentelemetry-instrument` CLI wraps the process and instruments FastAPI, SQLAlchemy, requests, httpx, psycopg, etc.

You drop the OTel collector endpoint into env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`) and traces/metrics/logs flow out with no code changes.

## Local development

```bash
cp .env.example .env         # set ANTHROPIC_API_KEY + JWT_SECRET
docker compose up --build
# frontend: http://localhost:3000
# api:      http://localhost:8000/docs
# analyzer: http://localhost:8001/docs
```

## Kubernetes

Everything needed to deploy lives in `k8s/`:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl -n snap2spoon create secret generic snap2spoon-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 16)
kubectl apply -f k8s/
```

See `k8s/README.md` for details.

## Google Sign-In

Users can sign up / log in with a Google account, no password needed.

1. In Google Cloud Console, create an **OAuth 2.0 Client ID** (type: *Web
   application*). Authorized JavaScript origins must include every domain the
   frontend is served from (e.g. `http://localhost:3000`,
   `https://snap2spoon.example.com`).
2. Put the client ID in the `GOOGLE_CLIENT_ID` env var for both `api-service`
   (for token verification) and the frontend (via `/config` — fetched at
   runtime, so no rebuild needed).
3. The `api-service` exposes `POST /users/google` which accepts a Google ID
   token and returns a snap2spoon JWT. First-time users are auto-provisioned.

Only the ID token is verified server-side; the client ID itself is public
and lives in the `snap2spoon-config` ConfigMap (not in Secrets).

## Observability

All instrumentation is bundled and running in every service but exports nothing by default. Each layer is activated independently via environment variables — no code changes needed.

### Backend traces, metrics, and logs (OTel)

All three services run under OTel auto-instrumentation:

| Service | Instrumented libraries |
|---|---|
| `api-service` | FastAPI, SQLAlchemy, httpx, psycopg, logging |
| `analyzer-service` | FastAPI, httpx, logging |
| `frontend` (SSR) | Node.js HTTP, fetch (outgoing SSR requests) |

W3C `traceparent` headers are propagated automatically between services — the `api-service → analyzer-service` leg is connected without any code changes.

**To enable** (local or K8s): set these env vars and restart/redeploy:

```bash
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://<alloy-or-collector>:4318   # OTLP HTTP
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
# Optional — enable metrics and logs too:
OTEL_METRICS_EXPORTER=otlp
OTEL_LOGS_EXPORTER=otlp
```

For **Kubernetes**, update `k8s/configmap.yaml`:
- Change `OTEL_TRACES_EXPORTER` (and metrics/logs) from `"none"` to `"otlp"`
- Update `OTEL_EXPORTER_OTLP_ENDPOINT` to your Alloy receiver address

### Browser observability (Grafana Faro)

The frontend includes [Grafana Faro](https://grafana.com/oss/faro/) for browser-side monitoring: page load performance, web vitals, JS errors, console logs, and browser-to-server distributed traces.

Faro is **inactive by default** — it initialises only when `NEXT_PUBLIC_FARO_URL` is set.

**To enable:**

1. In Grafana Cloud, go to **Frontend Observability** → create or open your app → **Setup** → copy the collector URL.

2. Set the vars **before building** the frontend image (`NEXT_PUBLIC_*` vars are baked into the JS bundle at build time):

   ```bash
   # .env
   NEXT_PUBLIC_FARO_URL=https://faro-collector-xxx.grafana.net/collect/xxx
   NEXT_PUBLIC_FARO_APP_NAME=snap2spoon   # optional, defaults to "snap2spoon"
   ```

3. Rebuild the frontend:
   ```bash
   docker compose up --build frontend
   ```

   For **Kubernetes**, pass the vars as Docker build args when building and pushing the image:
   ```bash
   docker build \
     --build-arg NEXT_PUBLIC_FARO_URL=https://... \
     --build-arg NEXT_PUBLIC_FARO_APP_NAME=snap2spoon \
     -t your-registry/snap2spoon-frontend:latest ./frontend
   ```

Once both layers are active, a single user action (e.g. pasting a recipe URL) produces a trace that spans the browser → Next.js SSR → api-service → analyzer-service.

## Claude API key

Set `ANTHROPIC_API_KEY` in the `snap2spoon-secrets` Secret. The analyzer calls
`claude-sonnet-4-6` with sampled video frames and a structured JSON schema
prompt to detect whether the clip is a recipe and, if so, extract ingredients,
quantities, steps, prep/cook time, and servings.
