from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_ENVS = {"development", "dev", "test", "local"}
PLACEHOLDER_SECRETS = {
    "change-me-use-a-long-random-value",
    "change-me-network-hmac-key",
    "change-me",
    "changeme",
    "secret",
}
DEFAULT_DATABASE_URL = "postgresql+asyncpg://veritrust:veritrust@localhost:5432/veritrust"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = DEFAULT_DATABASE_URL
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

    @model_validator(mode="after")
    def _validate_runtime_config(self) -> "Settings":
        env = (self.app_env or "").strip().lower()
        if env in DEV_ENVS:
            return self
        db_url = (self.database_url or "").strip()
        if not db_url or db_url == DEFAULT_DATABASE_URL:
            raise ValueError(
                "DATABASE_URL must be explicitly configured in non-development environments. "
                "Configure a database URL before starting the application."
            )
        placeholders = {p.lower() for p in PLACEHOLDER_SECRETS}
        for name in ("secret_key", "network_hmac_key"):
            val = (getattr(self, name) or "").strip()
            if not val or val.lower() in placeholders:
                raise ValueError(
                    f"Insecure default for {name} in non-development environment. "
                    "Configure a strong secret value before starting the application."
                )
        return self

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def cors_origin_regex(self) -> str | None:
        """Allow any loopback port only in development/test/local environments.

        Vite picks a different port when 5173 is busy, and a browser treats
        ``localhost`` and ``127.0.0.1`` as different origins. Restrict this
        convenience to explicit dev-like environments so staging/production do
        not unintentionally accept localhost origins.
        """
        if self.app_env.strip().lower() in DEV_ENVS:
            return r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?"
        return None


@lru_cache
def get_settings() -> Settings:
    return Settings()
