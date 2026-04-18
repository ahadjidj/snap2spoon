from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"
    max_frames: int = 8
    frame_max_pixels: int = 768
    work_dir: str = "/tmp/snap2spoon"


settings = Settings()
