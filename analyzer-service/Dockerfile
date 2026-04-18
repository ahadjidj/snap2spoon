FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_PROGRESS_BAR=off

RUN mkdir -p /var/cache/apt/archives/partial \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --progress-bar off -r requirements.txt && \
    PIP_PROGRESS_BAR=off opentelemetry-bootstrap -a install

COPY app ./app

EXPOSE 8001

CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
