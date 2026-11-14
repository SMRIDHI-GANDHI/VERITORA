import json
import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _mk_user(store, role: str, email: str) -> tuple[User, str]:
    u = User(
        id=uuid.uuid4(),
        name=role,
        email=email,
        password_hash=hash_password("password123"),
        role=role,
        is_active=True,
    )
    store["users"][u.id] = u
    return u, create_access_token(str(u.id), role)


@pytest.mark.asyncio
async def test_report_create_pending_pii_and_public_visibility(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user, token = _mk_user(store, "user", "r1@example.com")
        mod, mod_token = _mk_user(store, "moderator", "m1@example.com")

        # create with PII in description
        desc = (
            "I paid money and shared my phone 9876543210 and email a@b.com "
            "in this suspicious case."
        )
        r = await ac.post(
            "/api/v1/reports",
            headers=_auth(token),
            json={"company_name": "Acme", "category": "payment_request", "description": desc},
        )
        assert r.status_code == 201
        body = r.json()
        assert body["moderation_status"] == "pending_review"
        assert "pii_warnings" in body and len(body["pii_warnings"]) > 0
        rid = body["id"]

        # ordinary users must not see pending report in public list
        lst = await ac.get("/api/v1/reports", headers=_auth(token))
        assert lst.status_code == 200
        items = lst.json()["items"]
        assert all(i["id"] != rid for i in items)
        # and public fields must not include raw description/reporter identity
        for i in items:
            assert "description" not in i
            assert "user_id" not in i

        # moderator approves with public summary
        adm = await ac.patch(
            f"/api/v1/admin/reports/{rid}",
            headers=_auth(mod_token),
            json={
                "action": "approve",
                "reason": "Reviewed",
                "public_summary": "User reported a payment request concern.",
                "private_note": "internal note",
            },
        )
        assert adm.status_code == 200
        # public list now shows approved redacted summary, no raw description/PII/private note
        lst2 = await ac.get("/api/v1/reports", headers=_auth(token))
        items2 = lst2.json()["items"]
        found = [i for i in items2 if i["id"] == rid]
        assert len(found) == 1
        pub = found[0]
        assert pub["public_summary"] == "User reported a payment request concern."
        assert pub["label"] == "user_submitted_report"
        blob = json.dumps(pub).lower()
        assert "9876543210" not in blob
        assert "a@b.com" not in blob
        assert "private_note" not in blob and "internal note" not in blob
        assert "description" not in pub

        # moderation/audit records written
        assert len(store["moderation_actions"]) >= 1
        assert any(a.action == "approve" for a in store["moderation_actions"].values())
        assert any(
            getattr(a, "action", "") == "moderation.approve"
            for a in store["audit_logs"].values()
        )
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_report_idor_illegal_transition_and_xss_inert(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        owner, owner_token = _mk_user(store, "user", "o@example.com")
        other, other_token = _mk_user(store, "user", "x@example.com")
        mod, mod_token = _mk_user(store, "moderator", "m2@example.com")

        xss_desc = (
            "<script>alert('xss')</script> please ignore this text but it is a report "
            "description long enough."
        )
        r = await ac.post(
            "/api/v1/reports",
            headers=_auth(owner_token),
            json={"company_name": "EvilCo", "category": "other", "description": xss_desc},
        )
        rid = r.json()["id"]
        # owner sees own description (stored inert as data)
        own = await ac.patch(
            f"/api/v1/reports/{rid}",
            headers=_auth(owner_token),
            json={"job_title": "Role"},
        )
        assert own.status_code == 200
        assert "<script>" in own.json()["description"]

        # IDOR: other user cannot edit/delete/appeal
        assert (
            await ac.patch(
                f"/api/v1/reports/{rid}",
                headers=_auth(other_token),
                json={"job_title": "x"},
            )
        ).status_code == 404
        assert (
            await ac.post(
                f"/api/v1/reports/{rid}/appeal",
                headers=_auth(other_token),
                json={"message": "please review"},
            )
        ).status_code == 404
        assert (
            await ac.delete(f"/api/v1/reports/{rid}", headers=_auth(other_token))
        ).status_code == 404

        # illegal transition: approve from pending is allowed, but reject after removed is not
        assert (
            await ac.patch(
                f"/api/v1/admin/reports/{rid}",
                headers=_auth(mod_token),
                json={
                    "action": "approve",
                    "reason": "reviewed ok",
                    "public_summary": "Safe summary",
                },
            )
        ).status_code == 200
        assert (
            await ac.patch(
                f"/api/v1/admin/reports/{rid}",
                headers=_auth(mod_token),
                json={"action": "remove", "reason": "removed now"},
            )
        ).status_code == 200
        bad = await ac.patch(
            f"/api/v1/admin/reports/{rid}",
            headers=_auth(mod_token),
            json={"action": "reject", "reason": "not allowed"},
        )
        assert bad.status_code == 409
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_rating_labeled_user_submitted(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user, token = _mk_user(store, "user", "rate@example.com")
        # need a company
        from app.db.models.company import Company

        c = Company(id=uuid.uuid4(), name="RateCo", normalized_name="rateco")
        store["companies"][c.id] = c

        r = await ac.post(
            f"/api/v1/companies/{c.id}/ratings",
            headers=_auth(token),
            json={
                "rating": 4,
                "dimensions": {"clarity": 4, "transparency": 4, "consistency": 3},
                "review_text": "Good communication.",
            },
        )
        assert r.status_code == 201
        body = r.json()
        assert body["label"] == "user_submitted_experience"
        assert body["moderation_status"] == "pending_review"
        assert body["rating"] == 4
    finally:
        limiter.enabled = True
