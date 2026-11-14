from app.config import Settings


def test_config_defaults_and_cors_parsing():
    s = Settings(secret_key="a-very-long-secret-key", cors_origins="http://a.com, http://b.com")
    assert s.app_env == "development"
    assert s.cors_origins_list == ["http://a.com", "http://b.com"]
    assert s.llm_enabled is False
