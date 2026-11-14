from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://veritrust:veritrust@localhost:5432/veritrust"
    secret_key: str = Field(default="change-me-use-a-long-random-value", min_length=16)
    access_token_ttl_minutes: int = 30
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    rate_limit_default: str = "60/minute"
    llm_enabled: bool = False
    llm_provider: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_api_key: str = ""
    search_api_key: str = ""
    cybercrime_resources_file: str = "app/config/cyber_resources_in.json"
    network_hmac_key: str = "change-me-network-hmac-key"
    offer_storage_dir: str = "backend/storage/offer_letters"
    offer_file_ttl_hours: int = 24
    offer_max_upload_mb: int = 5

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        """Allow any loopback port outside production.

        Vite picks a different port when 5173 is busy, and a browser treats
        ``localhost`` and ``127.0.0.1`` as different origins. Restricting this
        to non-production keeps deployed CORS as tight as the explicit list.
        """
        if self.app_env.strip().lower() in {"production", "prod"}:
            return None
        return r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?"


@lru_cache
def get_settings() -> Settings:
    return Settings()
