from __future__ import annotations

import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _mk_user(store, email: str = "rl@example.com") -> tuple[User, str]:
    u = User(
        id=uuid.uuid4(),
        name="RL",
        email=email,
        password_hash=hash_password("password123"),
        role="user",
        is_active=True,
    )
    store["users"][u.id] = u
    return u, create_access_token(str(u.id), "user")


@pytest.mark.asyncio
async def test_rate_limit_chat_message_returns_429_and_retry_after(app_and_client, store):
    app, ac = app_and_client
    _user, token = _mk_user(store, "chat-rl@example.com")
    limiter.enabled = False
    created = await ac.post("/api/v1/chat/sessions", headers=_auth(token), json={})
    assert created.status_code == 201
    sid = created.json()["id"]

    limiter.enabled = True
    try:
        status = None
        last = None
        # route limit is 30/min per user-or-ip
        for i in range(31):
            last = await ac.post(
                f"/api/v1/chat/sessions/{sid}/messages",
                headers=_auth(token),
                json={"message": f"hello {i}"},
            )
            status = last.status_code
            if status == 429:
                break
        assert status == 429
        assert last.headers.get("retry-after") == "60"
        body = last.json()
        assert body.get("code") == "RATE_LIMITED"
        assert body.get("status") == 429
        assert body.get("request_id")
    finally:
        limiter.enabled = False


@pytest.mark.asyncio
async def test_rate_limit_data_exposure_authenticated_user(app_and_client, store):
    app, ac = app_and_client
    _user, token = _mk_user(store, "exp-rl@example.com")
    limiter.enabled = True
    try:
        status = None
        last = None
        # 30/min per user-or-ip
        for _ in range(31):
            last = await ac.post(
                "/api/v1/data-exposure/check",
                headers=_auth(token),
                json={"items": ["email"]},
            )
            status = last.status_code
            if status == 429:
                break
        assert status == 429
        assert last.headers.get("retry-after") == "60"
        assert last.json().get("code") == "RATE_LIMITED"
    finally:
        limiter.enabled = False


@pytest.mark.asyncio
async def test_rate_limit_passport_endpoints_auth_and_public(app_and_client, store):
    app, ac = app_and_client
    user, token = _mk_user(store, "pass-rl@example.com")
    analysis = JobAnalysis(
        id=uuid.uuid4(),
        user_id=user.id,
        job_id=None,
        risk_score=10,
        risk_band="lower",
        assessment_type="decision_support",
        rules_version="rules-2026.11.1",
        result_json={
            "risk_factors": [],
            "verification": [],
            "recommendations": [],
            "unknowns": [],
        },
    )
    store["job_analyses"][analysis.id] = analysis

    # authenticated list endpoint (60/min per user-or-ip)
    limiter.enabled = True
    try:
        status = None
        last = None
        for _ in range(61):
            last = await ac.get("/api/v1/passports", headers=_auth(token))
            status = last.status_code
            if status == 429:
                break
        assert status == 429
        assert last.headers.get("retry-after") == "60"
        assert last.json().get("code") == "RATE_LIMITED"
    finally:
        limiter.enabled = False

    # public passport token view (60/min per IP, anonymous)
    limiter.reset()
    limiter.enabled = True
    try:
        status = None
        last = None
        for _ in range(61):
            last = await ac.get("/api/v1/passports/not-a-real-token")
            status = last.status_code
            if status == 429:
                break
        assert status == 429
        assert last.headers.get("retry-after") == "60"
        assert last.json().get("code") == "RATE_LIMITED"
        # anonymous access to auth-only chat endpoint remains unauthorized (or limited)
        assert (await ac.get("/api/v1/chat/sessions")).status_code in (401, 429)
    finally:
        limiter.enabled = False


@pytest.mark.asyncio
async def test_rate_limit_key_separates_authenticated_users(app_and_client, store):
    app, ac = app_and_client
    _u1, t1 = _mk_user(store, "sep1@example.com")
    _u2, t2 = _mk_user(store, "sep2@example.com")
    limiter.enabled = True
    try:
        # exhaust user 1 (data-exposure 30/min per user-or-ip)
        last1 = None
        for _ in range(31):
            last1 = await ac.post(
                "/api/v1/data-exposure/check", headers=_auth(t1), json={"items": ["email"]}
            )
            if last1.status_code == 429:
                break
        assert last1 is not None and last1.status_code == 429
        # user 2 from same client/IP should still be allowed (separate per-user key)
        r2 = await ac.post(
            "/api/v1/data-exposure/check", headers=_auth(t2), json={"items": ["email"]}
        )
        assert r2.status_code == 200
    finally:
        limiter.enabled = False
