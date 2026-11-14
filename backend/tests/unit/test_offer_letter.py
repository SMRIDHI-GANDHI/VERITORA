import os
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
        # default path: uploaded file should not be retained in storage dir
        storage_dir = tmp_path / "offers"
        if storage_dir.exists():
            assert list(storage_dir.iterdir()) == []
    finally:
        limiter.enabled = True
        try:
            from app.config import get_settings

            get_settings.cache_clear()  # type: ignore[attr-defined]
        except Exception:
            pass


@pytest.mark.asyncio
async def test_offer_letter_requires_consent(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user = User(
            id=uuid.uuid4(),
            name="U",
            email="offer-consent@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][user.id] = user
        token = create_access_token(str(user.id), "user")
        minimal_pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
        files = {"file": ("offer.pdf", minimal_pdf, "application/pdf")}
        r = await ac.post(
            "/api/v1/analyze/offer-letter",
            headers=_auth(token),
            files=files,
            data={"consent": "false", "keep_file": "false"},
        )
        assert r.status_code == 400
    finally:
        limiter.enabled = True


def test_offer_storage_cleanup_and_path_safety(tmp_path, monkeypatch):
    monkeypatch.setenv("OFFER_STORAGE_DIR", str(tmp_path / "offers"))
    from app.services.offer_letter import storage

    # expired file is removed
    stored = storage.save_upload(b"%PDF-test", suffix=".pdf", ttl_seconds=1)
    assert stored.path.exists()
    old = stored.path.stat().st_mtime - 3600
    os.utime(stored.path, (old, old))
    removed = storage.cleanup_expired(ttl_seconds=1)
    assert removed >= 1
    assert not stored.path.exists()

    # delete_file must not remove files outside storage dir
    outside = tmp_path / "outside.txt"
    outside.write_text("keep")
    storage.delete_file(outside)
    assert outside.exists()

    # save_upload keeps file under storage dir
    stored2 = storage.save_upload(b"hello", suffix=".png", ttl_seconds=3600)
    assert str(storage.get_storage_dir()) in str(stored2.path)
    storage.delete_file(stored2.path)
    assert not stored2.path.exists()
