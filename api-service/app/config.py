from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://snap2spoon:snap2spoon@postgres:5432/snap2spoon"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_ttl_minutes: int = 60 * 24 * 7
    analyzer_url: str = "http://analyzer:8001"
    cors_origins: str = "*"
    google_client_id: str = ""
    # Average minutes a human spends watching + transcribing one recipe video.
    # Used to compute the "time saved" counter.
    minutes_saved_per_recipe: float = 7.0


settings = Settings()
