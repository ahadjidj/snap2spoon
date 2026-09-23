from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    max_frames: int = 8
    frame_max_pixels: int = 768
    work_dir: str = "/tmp/snap2spoon"

    # Speech-to-text (faster-whisper). Spoken quantities rarely appear on screen.
    transcribe_enabled: bool = True
    whisper_model: str = "base"
    whisper_compute_type: str = "int8"
    whisper_cpu_threads: int = 2
    whisper_beam_size: int = 5
    whisper_language: str | None = None  # e.g. "en"; None = auto-detect per video
    whisper_model_dir: str | None = None
    transcribe_max_seconds: int = 300
    transcript_max_chars: int = 8000


settings = Settings()
