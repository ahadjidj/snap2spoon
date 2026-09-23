import logging
import subprocess
import threading
import time
from pathlib import Path

from opentelemetry import trace

from .config import settings

logger = logging.getLogger("analyzer.transcribe")
tracer = trace.get_tracer(__name__)

_model = None
_model_lock = threading.Lock()


def _get_model():
    """Load the Whisper model once per process; it is reused across requests."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel

                _model = WhisperModel(
                    settings.whisper_model,
                    device="cpu",
                    compute_type=settings.whisper_compute_type,
                    cpu_threads=settings.whisper_cpu_threads,
                    download_root=settings.whisper_model_dir,
                )
    return _model


def extract_audio(video_path: Path, out_path: Path, max_seconds: int) -> Path | None:
    """Extract the first audio track as 16 kHz mono WAV. Returns None if the video has no audio."""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-map", "0:a:0",
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-t", str(max_seconds),
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0 or not out_path.exists() or out_path.stat().st_size == 0:
        return None
    return out_path


def transcribe(video_path: Path, out_dir: Path) -> str | None:
    """Best-effort speech-to-text for the video's audio track.

    Returns None when transcription is disabled, the video has no audio, nothing
    intelligible was said, or anything goes wrong — the caller falls back to
    frames + caption only.
    """
    if not settings.transcribe_enabled:
        return None
    with tracer.start_as_current_span("transcribe") as span:
        span.set_attribute("whisper.model", settings.whisper_model)
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            audio = extract_audio(video_path, out_dir / "audio.wav", settings.transcribe_max_seconds)
            if audio is None:
                span.set_attribute("transcribe.has_audio", False)
                return None
            span.set_attribute("transcribe.has_audio", True)

            started = time.monotonic()
            segments, info = _get_model().transcribe(
                str(audio),
                beam_size=settings.whisper_beam_size,
                language=settings.whisper_language,
                vad_filter=True,
                condition_on_previous_text=False,
            )
            # `segments` is a lazy generator; decoding happens while iterating.
            text = " ".join(s.text.strip() for s in segments if s.text.strip()).strip()
            elapsed = time.monotonic() - started

            span.set_attribute("transcribe.language", info.language)
            span.set_attribute("transcribe.audio_seconds", info.duration)
            span.set_attribute("transcribe.chars", len(text))
            logger.info(
                "transcribed %.1fs of audio (lang=%s, p=%.2f) in %.1fs, %d chars",
                info.duration, info.language, info.language_probability, elapsed, len(text),
            )
            if not text:
                return None
            return text[: settings.transcript_max_chars]
        except Exception as exc:  # noqa: BLE001 — transcription must never fail the job
            span.record_exception(exc)
            logger.warning("transcription failed, continuing without it: %s", exc)
            return None
