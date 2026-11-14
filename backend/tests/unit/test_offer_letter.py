import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_offer_letter_rejects_invalid_magic(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user = User(
            id=uuid.uuid4(),
            name="U",
            email="offer@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][user.id] = user
        token = create_access_token(str(user.id), "user")

        # wrong content (not pdf/png/jpg magic) but allowed extension
        files = {"file": ("offer.pdf", b"not-a-real-pdf", "application/pdf")}
        data = {"consent": "true", "keep_file": "false"}
        r = await ac.post(
            "/api/v1/analyze/offer-letter",
            headers=_auth(token),
            files=files,
            data=data,
        )
        assert r.status_code == 400
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_offer_letter_rejects_oversize(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user = User(
            id=uuid.uuid4(),
            name="U",
            email="offer2@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][user.id] = user
        token = create_access_token(str(user.id), "user")

        big = b"%PDF-1.4\n" + (b"a" * (5 * 1024 * 1024 + 10))
        files = {"file": ("offer.pdf", big, "application/pdf")}
        data = {"consent": "true"}
        r = await ac.post(
            "/api/v1/analyze/offer-letter",
            headers=_auth(token),
            files=files,
            data=data,
        )
        assert r.status_code == 413
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_offer_letter_inconclusive_when_unextractable(
    app_and_client, store, tmp_path, monkeypatch
):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        # keep storage isolated
        monkeypatch.setenv("OFFER_STORAGE_DIR", str(tmp_path / "offers"))
        # reset cached settings if any
        try:
            from app.config import get_settings

            get_settings.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            pass

        user = User(
            id=uuid.uuid4(),
            name="U",
            email="offer3@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][user.id] = user
        token = create_access_token(str(user.id), "user")

        # minimal PDF bytes with no text layer; extraction may be inconclusive without OCR libs
        minimal_pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
        files = {"file": ("offer.pdf", minimal_pdf, "application/pdf")}
        data = {"consent": "true", "keep_file": "false"}
        r = await ac.post(
            "/api/v1/analyze/offer-letter",
            headers=_auth(token),
            files=files,
            data=data,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("assessment_type") == "decision_support"
        assert body.get("consent_recorded") is True
        assert body.get("file_retained") is False
        extraction = body.get("extraction") or {}
        assert extraction.get("status") in {"inconclusive", "partial", "extracted"}
        # no raw file contents leaked
        assert "%PDF" not in str(body)
    finally:
        limiter.enabled = True
        try:
            from app.config import get_settings

            get_settings.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            pass
