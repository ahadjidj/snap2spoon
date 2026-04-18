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

## Claude API key

Set `ANTHROPIC_API_KEY` in the `snap2spoon-secrets` Secret. The analyzer calls
`claude-sonnet-4-6` with sampled video frames and a structured JSON schema
prompt to detect whether the clip is a recipe and, if so, extract ingredients,
quantities, steps, prep/cook time, and servings.
