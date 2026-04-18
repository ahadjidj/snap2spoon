# Kubernetes manifests

```bash
# 1. Namespace + config
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml

# 2. Secrets (do NOT apply secret.example.yaml as-is)
kubectl -n snap2spoon create secret generic snap2spoon-secrets \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-... \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_PASSWORD=$(openssl rand -hex 16)

# 3. Data + services
kubectl apply -f postgres.yaml
kubectl apply -f api-service.yaml
kubectl apply -f analyzer-service.yaml
kubectl apply -f frontend.yaml

# 4. Ingress + network policies
kubectl apply -f ingress.yaml
kubectl apply -f networkpolicy.yaml
```

## Observability

All three services already expose themselves to OpenTelemetry
auto-instrumentation — no code instrumentation needed:

- `api-service` and `analyzer-service` run under `opentelemetry-instrument`
  (Python) which auto-wraps FastAPI, SQLAlchemy, httpx, psycopg, logging.
- `frontend` starts Node with
  `NODE_OPTIONS='--require @opentelemetry/auto-instrumentations-node/register'`
  which auto-wraps Next.js, http, fetch.

Point them at your collector by setting `OTEL_EXPORTER_OTLP_ENDPOINT` in the
ConfigMap (defaults to `http://otel-collector.observability.svc:4318`).

If you run the [OpenTelemetry Operator](https://github.com/open-telemetry/opentelemetry-operator),
the `instrumentation.opentelemetry.io/inject-python` / `inject-nodejs`
annotations on the Deployments enable sidecar-style injection too — but it's
not required: the images already bundle the auto-instrumentation.

## Images

Build and push with whatever tag scheme you prefer, then update the `image:`
fields in each Deployment:

```bash
docker build -t your-registry/snap2spoon-api:latest       api-service
docker build -t your-registry/snap2spoon-analyzer:latest  analyzer-service
docker build -t your-registry/snap2spoon-frontend:latest  frontend
```
