# snap2spoon

Turn Instagram recipe videos into structured written recipes you can search, rate, comment on, and bookmark.

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

## Claude API key

Set `ANTHROPIC_API_KEY` in the `snap2spoon-secrets` Secret. The analyzer calls
`claude-sonnet-4-6` with sampled video frames and a structured JSON schema
prompt to detect whether the clip is a recipe and, if so, extract ingredients,
quantities, steps, prep/cook time, and servings.
