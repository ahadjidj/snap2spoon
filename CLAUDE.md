# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Local Development

All services run via Docker Compose. Always use `http://localhost:3000` (not `0.0.0.0`) — Google OAuth rejects non-localhost origins.

```bash
# Start everything (requires ANTHROPIC_API_KEY in .env)
docker compose up --build

# Restart a single service after code changes
docker compose up --build -d api
docker compose up --build -d analyzer
docker compose up --build -d frontend

# Wipe the database and restart fresh
docker compose down -v && docker compose up --build -d
```

**Frontend dev (outside Docker):**
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
npm run build                               # production build
npm run lint                               # ESLint
```

**Python services (outside Docker):**
```bash
cd api-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

cd analyzer-service && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Architecture

Three services + PostgreSQL, all in the `snap2spoon` Docker network:

```
browser → frontend:3000 → /api/* (Next.js rewrite) → api:8000
                                                         ↓
                                               analyzer:8001
                                                         ↓
                                               Claude API (Anthropic)
api:8000 ← → postgres:5432
```

**frontend** — Next.js 14 App Router. Server components fetch data directly from `http://api:8000` (via `API_URL_INTERNAL`). Client components use `/api/*` which Next.js rewrites to the same target. Auth token lives in localStorage via `AuthProvider`.

**api-service** — FastAPI. Owns all persistence (users, recipes, ratings, comments, bookmarks, stats). Proxies analyze requests to the analyzer service. JWT auth (HS256, 7-day TTL). Google OAuth verified server-side via google-auth.

**analyzer-service** — FastAPI. Accepts a URL, downloads the Instagram video with yt-dlp, extracts up to 8 frames with ffmpeg, sends frames + metadata to Claude, returns structured JSON. No auth — internal only, called exclusively by api-service. Temp files at `/tmp/snap2spoon/{uuid}/` are cleaned up after each job.

## Key Design Constraints

**Database schema:** `ingredients`, `steps`, and `tags` are stored as PostgreSQL JSON columns. URL columns (`source_url`, `thumbnail_url`, `avatar_url`) are `Text` (unbounded) — Instagram CDN URLs exceed VARCHAR(512).

**Thumbnail proxy:** Browser `<img>` tags cannot load Instagram CDN URLs directly (IP-signed). All thumbnails are routed through `/api/thumbnail?url=…` (`frontend/app/api/thumbnail/route.ts`) which proxies with an Instagram `Referer` header.

**Stats singleton:** The `stats` table has exactly one row (id=1), seeded at startup in `api-service/app/main.py`. The `minutes_saved_per_recipe` setting (default 7.0) drives the "time saved" counter.

**httpx version:** Pinned to `0.27.2` in both Python services. `anthropic==0.39.0` passes a `proxies` kwarg that was removed in httpx 0.28.0.

**pip in Docker:** Python Dockerfiles use `--progress-bar off` and `PIP_PROGRESS_BAR=off` to prevent the rich progress bar from spawning threads that hit Docker's container thread limit.

**Base images:** All images use glibc-based Debian (not Alpine) for Beyla eBPF compatibility. Python services use `python:3.12-slim-bookworm`; frontend uses `node:20-slim`.

## Observability (OTel)

Both Python services run under `opentelemetry-instrument` (zero-code auto-instrumentation for FastAPI, SQLAlchemy, httpx, psycopg, logging). The frontend loads `@opentelemetry/auto-instrumentations-node` via `NODE_OPTIONS`.

All exporters default to `none` in docker-compose. Enable by setting env vars:
```
OTEL_TRACES_EXPORTER=otlp
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector.observability.svc:4318
```

## Kubernetes (GKE)

Manifests in `k8s/`. See `SETUP.md` for the full provisioning walkthrough.

- All resources in the `snap2spoon` namespace
- PostgreSQL runs as a StatefulSet with a 10Gi PVC
- Services scale via HPA (CPU threshold 70% for api/frontend, 65% for analyzer)
- TLS via cert-manager + ingress-nginx + Let's Encrypt (`k8s/tls/apply.sh`)
- Sensitive config in a Kubernetes Secret (see `k8s/secret.example.yaml`); public config in ConfigMap
- The analyzer-service is not exposed outside the cluster

## Analyzer Pipeline (Claude Integration)

`analyzer-service/app/claude_client.py` — system prompt instructs Claude to detect whether a video is a recipe and return a strict JSON schema. The model is configurable (`ANTHROPIC_MODEL`, default `claude-sonnet-4-6`). Response parsing strips markdown code fences before JSON decoding.

`analyzer-service/app/downloader.py` — only accepts `instagram.com` URLs (validated by regex). Uses yt-dlp with `format=mp4/best`, 30s socket timeout.

`analyzer-service/app/frames.py` — extracts up to `MAX_FRAMES` (default 8) frames evenly spaced through the video, resized to `FRAME_MAX_PIXELS` (default 768px on the long side).

## Google OAuth Notes

- Client ID is served from `GET /config` (api-service reads `GOOGLE_CLIENT_ID` env var)
- `GoogleSignInButton` uses Google Identity Services (`accounts.id.renderButton`), not the redirect flow
- For local dev, `http://localhost:3000` must be in **Authorized JavaScript origins** AND **Authorized redirect URIs** for the OAuth 2.0 client in Google Cloud Console
- Internal Workspace apps restrict sign-in to org accounts only; use External + test user for personal Gmail accounts
