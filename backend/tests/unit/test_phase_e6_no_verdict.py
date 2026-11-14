from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.core.rate_limit import limiter


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _register(ac, email: str) -> str:
    r = await ac.post(
        "/api/v1/auth/register",
        json={"name": "NV User", "email": email, "password": "password123"},
    )
    assert r.status_code == 201
    return str(r.json()["access_token"])


FORBIDDEN_VERDICT = re.compile(r"\b(fake|genuine)\b", re.IGNORECASE)


@pytest.mark.asyncio
async def test_chat_responses_have_no_verdict_language(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        token = await _register(ac, "noverdict-chat@example.com")
        created = await ac.post("/api/v1/chat/sessions", headers=_auth(token), json={})
        sid = created.json()["id"]
        prompts = [
            "Is this job offer fake or genuine?",
            "What should I do next?",
            "How do I report a cybercrime?",
        ]
        for msg in prompts:
            posted = await ac.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                headers=_auth(token),
                json={"message": msg},
            )
            assert posted.status_code == 200
            body = posted.json()
            # User message may echo input; assistant/system outputs must not contain verdicts.
            assistant = json.dumps(body.get("assistant_message") or {}, ensure_ascii=False)
            warning = json.dumps(body.get("warning"), ensure_ascii=False)
            assert not FORBIDDEN_VERDICT.search(assistant), (
                f"verdict language found in assistant response: {assistant[:400]}"
            )
            assert not FORBIDDEN_VERDICT.search(warning), (
                f"verdict language found in warning: {warning[:400]}"
            )
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_error_and_exposure_responses_have_no_verdict_language(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        token = await _register(ac, "noverdict-exp@example.com")
        r = await ac.post(
            "/api/v1/data-exposure/check", headers=_auth(token), json={"items": ["email"]}
        )
        assert r.status_code == 200
        assert not FORBIDDEN_VERDICT.search(json.dumps(r.json(), ensure_ascii=False))

        # common error/problem responses remain decision-support safe
        bad = await ac.get("/api/v1/passports/not-a-real-token")
        assert bad.status_code == 404
        assert not FORBIDDEN_VERDICT.search(json.dumps(bad.json(), ensure_ascii=False))
    finally:
        limiter.enabled = True


def test_frontend_user_facing_sources_have_no_fake_genuine_words():
    """Regression guard for verdict language in frontend UI source strings."""
    root = Path(__file__).resolve().parents[3] / "frontend" / "src"
    assert root.exists(), f"frontend src not found at {root}"
    hits = []
    for p in root.rglob("*"):
        if p.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".json"}:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        for i, line in enumerate(text.splitlines(), 1):
            if FORBIDDEN_VERDICT.search(line):
                hits.append(f"{p}:{i}:{line.strip()}")
    assert hits == [], "prohibited verdict words found in frontend sources:\n" + "\n".join(hits)
