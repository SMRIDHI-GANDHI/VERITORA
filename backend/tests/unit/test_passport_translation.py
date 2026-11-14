import hashlib
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User
from app.services.translation import explain_wording, translate_recommendations


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_recommendation_translations_have_original_and_hindi():
    recs = [
        {"code": "DO_NOT_PAY", "priority": 1, "text_key": "rec.do_not_pay"},
        {
            "code": "NEVER_SHARE_CREDENTIALS",
            "priority": 3,
            "text_key": "rec.never_share_credentials",
        },
    ]
    hi = translate_recommendations(recs, "hi")
    assert len(hi) == 2
    for item in hi:
        assert item.get("text_original")
        assert item.get("text")
        assert item.get("language") == "hi"
        assert item["text"] != item["text_original"]  # Hindi catalog present
        assert "translation" in item


def test_explain_wording_rule_based():
    out = explain_wording("You must pay a non-refundable processing fee within 24 hours.")
    assert out.get("original_text")
    assert isinstance(out.get("explanations"), list)
    assert len(out["explanations"]) >= 1


@pytest.mark.asyncio
async def test_passport_create_get_revoke_and_expiry(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user = User(
            id=uuid.uuid4(),
            name="U",
            email="p@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        other = User(
            id=uuid.uuid4(),
            name="O",
            email="o@example.com",
            password_hash=hash_password("password123"),
            role="user",
            is_active=True,
        )
        store["users"][user.id] = user
        store["users"][other.id] = other
        token = create_access_token(str(user.id), "user")
        other_token = create_access_token(str(other.id), "user")

        analysis = JobAnalysis(
            id=uuid.uuid4(),
            user_id=user.id,
            job_id=None,
            risk_score=60,
            risk_band="high_concern",
            assessment_type="decision_support",
            summary="s",
            rules_version="rules-2026.11.1",
            result_json={
                "assessment_type": "decision_support",
                "rules_version": "rules-2026.11.1",
                "risk_score": 60,
                "risk_band": "high_concern",
                "risk_factors": [],
                "verification": [],
                "unknowns": ["x"],
                "recommendations": [
                    {
                        "code": "NEVER_SHARE_CREDENTIALS",
                        "priority": 3,
                        "text_key": "rec.never_share_credentials",
                    }
                ],
                "community": {
                    "approved_report_count": 0,
                    "labels": [],
                    "note": "User-submitted; not verified facts.",
                },
                "disclaimer_key": "disclaimer.decision_support",
            },
        )
        store["job_analyses"][analysis.id] = analysis

        r = await ac.post(
            "/api/v1/passports",
            headers=_auth(token),
            json={"analysis_id": str(analysis.id), "expires_in_days": 30},
        )
        assert r.status_code == 201
        body = r.json()
        pub_token = body.get("token")
        pid = body.get("id")
        assert pub_token and pid

        # token hash only in DB
        passport_obj = None
        for p in store["trust_passports"].values():
            if str(p.id) == pid:
                passport_obj = p
                break
        assert passport_obj is not None
        assert passport_obj.public_token_hash != pub_token
        expected_hash = hashlib.sha256(pub_token.encode("utf-8")).hexdigest()
        assert passport_obj.public_token_hash == expected_hash

        # public get
        g = await ac.get(f"/api/v1/passports/{pub_token}")
        assert g.status_code == 200
        snap = g.json()
        assert "user_id" not in str(snap)
        assert "email" not in str(snap)
        assert snap.get("rules_version") == "rules-2026.11.1"
        assert "checks" in snap or "checks_performed_and_not_performed" in snap

        # revoke by owner
        d = await ac.delete(f"/api/v1/passports/{pid}", headers=_auth(token))
        assert d.status_code == 204
        g2 = await ac.get(f"/api/v1/passports/{pub_token}")
        assert g2.status_code == 404
        # revoked record retained in storage (no automatic cleanup implemented)
        assert any(
            str(p.id) == pid and p.revoked_at is not None
            for p in store["trust_passports"].values()
        )

        # expired returns 404
        analysis2 = JobAnalysis(
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
        store["job_analyses"][analysis2.id] = analysis2
        r3 = await ac.post(
            "/api/v1/passports",
            headers=_auth(token),
            json={"analysis_id": str(analysis2.id)},
        )
        assert r3.status_code == 201
        tok2 = r3.json()["token"]
        pid2 = r3.json()["id"]
        # force expire in store
        for p in store["trust_passports"].values():
            if hashlib.sha256(tok2.encode("utf-8")).hexdigest() == p.public_token_hash:
                p.expires_at = datetime.now(UTC) - timedelta(days=1)
        g3 = await ac.get(f"/api/v1/passports/{tok2}")
        assert g3.status_code == 404
        # expired record retained (no automatic purge implemented)
        assert any(str(p.id) == pid2 for p in store["trust_passports"].values())

        # other user cannot revoke someone else's passport (not found/forbidden via 404)
        # create another
        r4 = await ac.post(
            "/api/v1/passports",
            headers=_auth(token),
            json={"analysis_id": str(analysis2.id)},
        )
        pid4 = r4.json()["id"]
        d4 = await ac.delete(f"/api/v1/passports/{pid4}", headers=_auth(other_token))
        assert d4.status_code == 404
    finally:
        limiter.enabled = True
