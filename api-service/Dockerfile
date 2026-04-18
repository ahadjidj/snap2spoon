FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --progress-bar off -r requirements.txt && \
    PIP_PROGRESS_BAR=off opentelemetry-bootstrap -a install

COPY app ./app

EXPOSE 8000

# opentelemetry-instrument wraps uvicorn with zero-code instrumentation
# (FastAPI, SQLAlchemy, httpx, psycopg, logging, ...). Config via env vars:
#   OTEL_SERVICE_NAME, OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_RESOURCE_ATTRIBUTES
CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
