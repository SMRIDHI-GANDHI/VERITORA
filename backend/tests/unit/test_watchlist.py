import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_watchlist_transitions_and_public_neutral(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        mod = User(
            id=uuid.uuid4(),
            name="M",
            email="modw@example.com",
            password_hash=hash_password("password123"),
            role="moderator",
            is_active=True,
        )
        user = User(
            id=uuid.uuid4(),
            name="U",
            email="uw@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][mod.id] = mod
        store["users"][user.id] = user
        mtoken = create_access_token(str(mod.id), "moderator")
        utoken = create_access_token(str(user.id), "user")

        # create
        r = await ac.post(
            "/api/v1/admin/watchlist",
            headers=_auth(mtoken),
            json={"entity_reference": "company:acme", "status": "unverified_signal"},
        )
        assert r.status_code == 201
        eid = r.json()["id"]

        # invalid transition
        r_bad = await ac.patch(
            f"/api/v1/admin/watchlist/{eid}",
            headers=_auth(mtoken),
            json={"status": "confirmed_pattern"},  # must go via under_review
        )
        assert r_bad.status_code == 409

        # valid: unverified -> under_review
        r2 = await ac.patch(
            f"/api/v1/admin/watchlist/{eid}",
            headers=_auth(mtoken),
            json={"status": "under_review", "reason": "reviewing"},
        )
        assert r2.status_code == 200
        assert r2.json()["status"] == "under_review"

        # under_review -> confirmed_pattern (moderator)
        r3 = await ac.patch(
            f"/api/v1/admin/watchlist/{eid}",
            headers=_auth(mtoken),
            json={"status": "confirmed_pattern", "reason": "evidence-backed"},
        )
        assert r3.status_code == 200
        assert r3.json()["status"] == "confirmed_pattern"

        # public status is neutral only
        pub = await ac.get("/api/v1/watchlist/status", params={"entity_reference": "company:acme"})
        assert pub.status_code == 200
        items = pub.json()["items"]
        assert items and items[0]["flag"] == "additional_verification_recommended"
        assert "confirmed_pattern" not in str(pub.json())

        # appeal reopens to under_review
        rap = await ac.post(
            f"/api/v1/watchlist/{eid}/appeals",
            headers=_auth(utoken),
            json={"message": "Please review this entry again."},
        )
        assert rap.status_code == 201
        assert rap.json()["entry_status"] == "under_review"
    finally:
        limiter.enabled = True