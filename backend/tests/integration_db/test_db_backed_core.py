from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select

from app.core.security import create_access_token, hash_password
from app.db.models.community_report import CommunityReport
from app.db.models.company import Company
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_auth_register_persists_user_in_database(real_app_and_client, db_session):
    _app, ac = real_app_and_client
    payload = {
        "name": "DB User",
        "email": "db-user@example.com",
        "password": "password123",
    }
    r = await ac.post("/api/v1/auth/register", json=payload)
    assert r.status_code == 201
    body = r.json()
    assert body.get("access_token")
    assert body["user"]["email"] == payload["email"]

    res = await db_session.execute(select(User).where(User.email == payload["email"]))
    user = res.scalar_one_or_none()
    assert user is not None
    assert str(user.id) == body["user"]["id"]
    assert user.role == "user"


@pytest.mark.asyncio
async def test_job_analysis_is_persisted_for_authenticated_user(real_app_and_client, db_session):
    _app, ac = real_app_and_client
    user = User(
        id=uuid.uuid4(),
        name="Analyzer",
        email="analyze-db@example.com",
        password_hash=hash_password("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    token = create_access_token(str(user.id), "user")

    r = await ac.post(
        "/api/v1/analyze/job",
        headers=_auth(token),
        json={
            "title": "Remote Role",
            "description": (
                "Please pay Rs 1500 registration fee to confirm your selection for this role."
            ),
            "company_name": "DB Test Co",
        },
    )
    assert r.status_code == 200
    data = r.json()
    analysis_id = data.get("id")
    assert analysis_id

    stored = await db_session.get(JobAnalysis, uuid.UUID(analysis_id))
    assert stored is not None
    assert stored.user_id == user.id
    assert stored.assessment_type == "decision_support"
    assert stored.risk_band


@pytest.mark.asyncio
async def test_report_creation_persists_with_pending_moderation(real_app_and_client, db_session):
    _app, ac = real_app_and_client
    user = User(
        id=uuid.uuid4(),
        name="Reporter",
        email="report-db@example.com",
        password_hash=hash_password("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    token = create_access_token(str(user.id), "user")

    company_name = f"DB Report Co {uuid.uuid4().hex[:8]}"
    r = await ac.post(
        "/api/v1/reports",
        headers=_auth(token),
        json={
            "company_name": company_name,
            "category": "payment_request",
            "description": (
                "This is a sufficiently long description reporting a request for an upfront fee."
            ),
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["moderation_status"] == "pending_review"
    rid = uuid.UUID(body["id"])

    report = await db_session.get(CommunityReport, rid)
    assert report is not None
    assert report.user_id == user.id
    assert report.moderation_status == "pending_review"

    company_count = await db_session.scalar(
        select(func.count()).select_from(Company).where(Company.name == company_name)
    )
    assert int(company_count or 0) >= 1
