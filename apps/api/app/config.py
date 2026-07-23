from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Event Bazar API"
    environment: str = "development"
    database_url: str = "sqlite:///./event_bazar.db"
    cors_origins: str = "https://emon095.github.io"
    secret_key: str = "development-only-change-me"
    admin_key: str = ""
    frontend_url: str = "https://emon095.github.io"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "https://jpnhxknzezgizwoqjtcb.supabase.co/auth/v1/callback"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
