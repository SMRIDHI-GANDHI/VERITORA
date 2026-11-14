import uuid
from datetime import UTC, datetime

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_api_e2e_register_analyze_verify_report_moderate_public(
    app_and_client, store, monkeypatch
):
    # register -> analyze -> verify company -> submit report -> moderator approves -> public visible
    from app.services.verification import company as company_mod
    from app.services.verification.types import VerificationResult

    async def fake_safe_fetch_check(website):
        if not website:
            return VerificationResult(
                check_type="safe_fetch",
                status="not_checked",
                unknown_fields=["website"],
                checked_at=datetime.now(UTC),
                details={"reason": "No website provided"},
            )
        return VerificationResult(
            check_type="safe_fetch",
            status="inconclusive",
            unknown_fields=["website_content"],
            source_url=website,
            checked_at=datetime.now(UTC),
            details={"error_class": "NetworkBlocked"},
        )

    monkeypatch.setattr(company_mod, "safe_fetch_check", fake_safe_fetch_check)

    app, ac = app_and_client
    limiter.enabled = False
    try:
        # register
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "E2E User", "email": "e2e@example.com", "password": "password123"},
        )
        assert r.status_code == 201
        token = r.json()["access_token"]

        # analyze
        a = await ac.post(
            "/api/v1/analyze/job",
            headers=_auth(token),
            json={
                "title": "Developer",
                "description": (
                    "Please pay Rs 1500 registration fee to confirm your selection for this role."
                ),
                "company_name": "Acme Demo",
            },
        )
        assert a.status_code == 200
        assert a.json().get("id")

        # verify company
        v = await ac.post(
            "/api/v1/verify/company",
            headers=_auth(token),
            json={"company_name": "Acme Demo", "website": "https://acme-demo.example"},
        )
        assert v.status_code == 200
        assert v.json().get("overall_status")

        # submit report
        rep = await ac.post(
            "/api/v1/reports",
            headers=_auth(token),
            json={
                "company_name": "Acme Demo",
                "category": "payment_request",
                "description": (
                    "They asked for a registration fee during the hiring process. "
                    "This felt concerning to me."
                ),
            },
        )
        assert rep.status_code == 201
        rid = rep.json()["id"]
        assert rep.json()["moderation_status"] == "pending_review"

        # moderator approves
        mod = User(
            id=uuid.uuid4(),
            name="Mod",
            email="e2e-mod@example.com",
            password_hash=hash_password("password123"),
            role="moderator",
            is_active=True,
        )
        store["users"][mod.id] = mod
        mod_token = create_access_token(str(mod.id), "moderator")
        m = await ac.patch(
            f"/api/v1/admin/reports/{rid}",
            headers=_auth(mod_token),
            json={
                "action": "approve",
                "reason": "Reviewed and summarized",
                "public_summary": "A user reported being asked for a payment during hiring.",
            },
        )
        assert m.status_code == 200

        # public summary visible with neutral label
        lst = await ac.get("/api/v1/reports", headers=_auth(token))
        assert lst.status_code == 200
        items = [i for i in lst.json()["items"] if i["id"] == rid]
        assert len(items) == 1
        assert items[0]["label"] == "user_submitted_report"
        assert (
            items[0]["public_summary"]
            == "A user reported being asked for a payment during hiring."
        )
        assert "description" not in items[0]
    finally:
        limiter.enabled = True
