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

# Bake the Whisper model into the image so pods don't download it from
# Hugging Face on the first request (and work without egress to HF).
# Override with --build-arg WHISPER_MODEL=small for better accuracy (slower, ~2x RAM).
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL} \
    WHISPER_MODEL_DIR=/opt/whisper-models
RUN python -c "import os; from faster_whisper.utils import download_model; \
download_model(os.environ['WHISPER_MODEL'], cache_dir=os.environ['WHISPER_MODEL_DIR'])"

COPY app ./app

EXPOSE 8001

CMD ["opentelemetry-instrument", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
