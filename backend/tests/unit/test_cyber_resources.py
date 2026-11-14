import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import get_settings
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.main import create_app
from tests.conftest import FakeSession, make_store

EXPECTED = {
    "country": "IN",
    "disclaimer_key": "cyber.not_official_portal",
    "resources": [
        {
            "id": "ncrp",
            "type": "portal",
            "label": "National Cyber Crime Reporting Portal",
            "url": "https://cybercrime.gov.in/",
            "primary": True,
        },
        {
            "id": "helpline_1930",
            "type": "phone",
            "label": "Cybercrime helpline (financial cyber fraud)",
            "tel": "1930",
            "href": "tel:1930",
            "primary": True,
        },
        {
            "id": "certin",
            "type": "website",
            "label": "CERT-In",
            "url": "https://www.cert-in.org.in/",
        },
        {
            "id": "certin_contact",
            "type": "website",
            "label": "CERT-In incident response contact",
            "url": "https://www.cert-in.org.in/s2cMainServlet?pageid=CONTACTUS",
        },
        {
            "id": "certin_email",
            "type": "email",
            "label": "CERT-In incident email",
            "email": "incident@cert-in.org.in",
        },
        {
            "id": "certin_tollfree",
            "type": "phone",
            "label": "CERT-In toll-free",
            "tel": "1800-11-4949",
        },
    ],
}


def _clear_settings_cache():
    get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_cyber_resources_exact_and_disclaimer(monkeypatch):
    _clear_settings_cache()
    limiter.reset()
    app = create_app()

    async def override_db():
        yield FakeSession(make_store())

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/v1/resources/cybercrime")
    assert r.status_code == 200
    body = r.json()
    assert body["country"] == EXPECTED["country"]
    assert body["disclaimer_key"] == EXPECTED["disclaimer_key"]
    assert "reviewed_at" in body
    assert body["resources"] == EXPECTED["resources"]
    # no claim that VeriTrust files complaints
    text = json.dumps(body).lower()
    assert "files complaints" not in text
    assert "file complaints on" not in text


@pytest.mark.asyncio
async def test_swapping_config_changes_response(tmp_path, monkeypatch):
    alt = tmp_path / "cyber.json"
    alt.write_text(
        json.dumps(
            {
                "country": "IN",
                "disclaimer_key": "cyber.not_official_portal",
                "reviewed_at": "2026-01-01",
                "resources": [
                    {
                        "id": "ncrp",
                        "type": "portal",
                        "label": "Portal",
                        "url": "https://cybercrime.gov.in/",
                        "primary": True,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("CYBERCRIME_RESOURCES_FILE", str(alt))
    _clear_settings_cache()
    limiter.reset()
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/api/v1/resources/cybercrime")
    assert r.status_code == 200
    body = r.json()
    assert body["reviewed_at"] == "2026-01-01"
    assert len(body["resources"]) == 1
    assert body["resources"][0]["id"] == "ncrp"
    # cleanup
    monkeypatch.delenv("CYBERCRIME_RESOURCES_FILE", raising=False)
    _clear_settings_cache()


def test_startup_fails_on_malformed_config(tmp_path, monkeypatch):
    from pydantic import ValidationError

    bad = tmp_path / "bad.json"
    bad.write_text("{not valid json", encoding="utf-8")
    monkeypatch.setenv("CYBERCRIME_RESOURCES_FILE", str(bad))
    _clear_settings_cache()
    with pytest.raises(
        (json.JSONDecodeError, ValidationError, FileNotFoundError, ValueError, OSError)
    ):
        create_app()
    monkeypatch.delenv("CYBERCRIME_RESOURCES_FILE", raising=False)
    _clear_settings_cache()
