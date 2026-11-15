import pytest

from app.config import DEFAULT_DATABASE_URL, Settings

STRONG_SECRET = "a-strong-test-secret-value-123456"
STRONG_HMAC = "a-strong-test-hmac-value-1234567"
EXPLICIT_DB = "postgresql+asyncpg://app_user:app_password@db.example:5432/app_db"


def test_dev_like_envs_allow_default_database_url() -> None:
    for env in ("development", "dev", "test", "local"):
        settings = Settings(
            _env_file=None,
            APP_ENV=env,
            DATABASE_URL=DEFAULT_DATABASE_URL,
            SECRET_KEY="change-me-use-a-long-random-value",
            NETWORK_HMAC_KEY="change-me-network-hmac-key",
        )
        assert settings.database_url == DEFAULT_DATABASE_URL


def test_non_dev_env_rejects_missing_database_url() -> None:
    with pytest.raises(ValueError) as exc:
        Settings(
            _env_file=None,
            APP_ENV="staging",
            DATABASE_URL="",
            SECRET_KEY=STRONG_SECRET,
            NETWORK_HMAC_KEY=STRONG_HMAC,
        )
    assert "DATABASE_URL must be explicitly configured" in str(exc.value)
    assert STRONG_SECRET not in str(exc.value)
    assert STRONG_HMAC not in str(exc.value)


def test_non_dev_env_rejects_default_development_database_url() -> None:
    with pytest.raises(ValueError) as exc:
        Settings(
            _env_file=None,
            APP_ENV="production",
            DATABASE_URL=DEFAULT_DATABASE_URL,
            SECRET_KEY=STRONG_SECRET,
            NETWORK_HMAC_KEY=STRONG_HMAC,
        )
    msg = str(exc.value)
    assert "DATABASE_URL must be explicitly configured" in msg
    assert "veritrust:veritrust" not in msg
    assert "localhost:5432/veritrust" not in msg


def test_non_dev_env_accepts_explicit_database_url_with_strong_secrets() -> None:
    settings = Settings(
        _env_file=None,
        APP_ENV="staging",
        DATABASE_URL=EXPLICIT_DB,
        SECRET_KEY=STRONG_SECRET,
        NETWORK_HMAC_KEY=STRONG_HMAC,
    )
    assert settings.database_url == EXPLICIT_DB


def test_non_dev_env_still_rejects_placeholder_secrets_with_explicit_database_url() -> None:
    with pytest.raises(ValueError) as exc:
        Settings(
            _env_file=None,
            APP_ENV="production",
            DATABASE_URL=EXPLICIT_DB,
            SECRET_KEY="change-me-use-a-long-random-value",
            NETWORK_HMAC_KEY=STRONG_HMAC,
        )
    assert "Insecure default for secret_key" in str(exc.value)
