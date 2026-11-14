import json
import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.user import User
from app.services.verification.company import lookalike_domain_check, run_company_verification


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_lookalike_rn_vs_m_detected():
    # "rn" in domain label can be confused with "m"
    r = await lookalike_domain_check("https://payparn.com", "Paypal")
    assert r.status == "mismatch"
    assert "domain_similarity" in r.mismatched_fields or r.mismatched_fields


@pytest.mark.asyncio
async def test_lookalike_cyrillic_homoglyph_detected():
    # Cyrillic 'а' and 'е' in domain label
    r = await lookalike_domain_check("https://exаmple.com", "Example")
    assert r.status == "mismatch"
    assert "domain_characters" in r.mismatched_fields


@pytest.mark.asyncio
async def test_company_verification_no_website_not_checked_and_no_genuine(monkeypatch):
    # avoid network in safe_fetch by ensuring no website -> not_checked paths
    res = await run_company_verification(company_name="Acme", website=None, email_domain=None)
    assert res["overall_status"] in {"not_checked", "inconclusive", "information_found"}
    blob = json.dumps(res).lower()
    assert "verified genuine" not in blob
    assert "genuine" not in blob.split()
    # each check has fields
    for c in res["checks"]:
        assert c["status"] in {
            "information_found",
            "consistent",
            "mismatch",
            "inconclusive",
            "not_checked",
        }
        assert "matched_fields" in c and "mismatched_fields" in c and "unknown_fields" in c
        assert "checked_at" in c


@pytest.mark.asyncio
async def test_verify_company_endpoint_persists_and_get(app_and_client, store, monkeypatch):
    # stub safe_fetch to avoid network
    from app.services.verification import company as company_mod

    async def fake_safe_fetch_check(website):
        from datetime import UTC, datetime

        from app.services.verification.types import VerificationResult

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
        u = User(
            id=uuid.uuid4(),
            name="U",
            email="cv@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][u.id] = u
        token = create_access_token(str(u.id), "user")

        r = await ac.post(
            "/api/v1/verify/company",
            headers=_auth(token),
            json={
                "company_name": "Acme Corp",
                "website": "https://acme.example",
                "email_domain": "acme.example",
            },
        )
        assert r.status_code == 200
        body = r.json()
        assert "company_id" in body
        assert body["overall_status"] in {
            "information_found",
            "consistent",
            "mismatch",
            "inconclusive",
            "not_checked",
        }
        assert isinstance(body.get("checks"), list)
        assert "community" in body
        assert "verified genuine" not in json.dumps(body).lower()

        gid = await ac.get(f"/api/v1/companies/{body['company_id']}", headers=_auth(token))
        assert gid.status_code == 200
        g = gid.json()
        assert g["id"] == body["company_id"]
        assert isinstance(g.get("checks"), list)

        # missing auth
        r0 = await ac.post("/api/v1/verify/company", json={"company_name": "X"})
        assert r0.status_code == 401
    finally:
        limiter.enabled = True
