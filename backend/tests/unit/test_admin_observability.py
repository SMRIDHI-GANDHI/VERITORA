from __future__ import annotations

import uuid

import pytest

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.db.models.audit_log import AuditLog
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_user(store, *, email: str, role: str) -> str:
    user = User(
        id=uuid.uuid4(),
        name=email.split("@")[0],
        email=email,
        password_hash=hash_password("password123"),
        role=role,
        is_active=True,
    )
    store["users"][user.id] = user
    return create_access_token(str(user.id), role)


@pytest.mark.asyncio
async def test_admin_metrics_requires_admin_and_records_audit_event(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user_token = await _create_user(store, email="user-metrics@example.com", role="user")
        admin_token = await _create_user(store, email="admin-metrics@example.com", role="admin")

        forbidden = await ac.get("/api/v1/admin/metrics", headers=_auth(user_token))
        assert forbidden.status_code == 403

        ok = await ac.get("/api/v1/admin/metrics", headers=_auth(admin_token))
        assert ok.status_code == 200
        body = ok.json()
        assert "analyses" in body
        assert "reports" in body
        assert "reports_by_status" in body
        assert "users_by_role" in body
        assert "watchlist_entries" in body
        assert "audit_events" in body
        assert "generated_at" in body

        audits = [
            a
            for a in store["audit_logs"].values()
            if getattr(a, "action", None) == "admin.metrics.view"
        ]
        assert audits, "admin metrics access should be audited"
        assert audits[0].resource_type == "admin_metrics"
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_admin_audit_logs_admin_only_and_redacted(app_and_client, store):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        user_token = await _create_user(store, email="user-audit@example.com", role="user")
        admin_token = await _create_user(store, email="admin-audit@example.com", role="admin")
        actor_id = uuid.uuid4()

        entry = AuditLog(
            id=uuid.uuid4(),
            actor_id=actor_id,
            action="moderation.approve",
            resource_type="community_report",
            resource_id="report-123",
            ip_hash="sensitive-hash-should-not-be-exposed",
            request_id="req-123",
        )
        store["audit_logs"][entry.id] = entry

        unauth = await ac.get("/api/v1/admin/audit-logs")
        assert unauth.status_code in (401, 403)

        forbidden = await ac.get("/api/v1/admin/audit-logs", headers=_auth(user_token))
        assert forbidden.status_code == 403

        ok = await ac.get("/api/v1/admin/audit-logs", headers=_auth(admin_token))
        assert ok.status_code == 200
        body = ok.json()
        assert "items" in body
        assert "next_cursor" in body
        assert len(body["items"]) >= 1
        item = next(i for i in body["items"] if i["id"] == str(entry.id))
        assert item["action"] == "moderation.approve"
        assert item["resource_type"] == "community_report"
        assert item["resource_id"] == "report-123"
        assert item["actor_id"] == str(actor_id)
        assert item["request_id"] == "req-123"
        assert "ip_hash" not in item
        assert "ip" not in item

        filtered = await ac.get(
            "/api/v1/admin/audit-logs?action=moderation.approve&resource_type=community_report",
            headers=_auth(admin_token),
        )
        assert filtered.status_code == 200
        assert any(i["id"] == str(entry.id) for i in filtered.json()["items"])

        paged = await ac.get("/api/v1/admin/audit-logs?limit=1", headers=_auth(admin_token))
        assert paged.status_code == 200
        assert len(paged.json()["items"]) == 1
        assert paged.json()["next_cursor"] in (None, "1")
    finally:
        limiter.enabled = True
