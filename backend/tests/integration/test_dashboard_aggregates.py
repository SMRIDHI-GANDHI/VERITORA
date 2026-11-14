from __future__ import annotations

import pytest

from app.core.rate_limit import limiter


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_dashboard_counts_saved_and_checklist(app_and_client):
    """Regression test: dashboard totals must reflect real saved/checklist rows.

    Previously ``totals.saved_opportunities`` and ``checklist_progress`` were
    hardcoded to 0 regardless of stored data.
    """
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "Dash User", "email": "dash@example.com", "password": "password123"},
        )
        assert r.status_code == 201
        token = r.json()["access_token"]

        # save two opportunities
        for title in ("Opportunity A", "Opportunity B"):
            s = await ac.post(
                "/api/v1/saved",
                headers=_auth(token),
                json={"title": title},
            )
            assert s.status_code == 201

        # complete one checklist item, leave another incomplete
        assert (
            await ac.post(
                "/api/v1/checklist",
                headers=_auth(token),
                json={"item_key": "verified_company_site", "completed": True},
            )
        ).status_code == 200
        assert (
            await ac.post(
                "/api/v1/checklist",
                headers=_auth(token),
                json={"item_key": "confirmed_recruiter", "completed": False},
            )
        ).status_code == 200

        d = await ac.get("/api/v1/dashboard", headers=_auth(token))
        assert d.status_code == 200
        body = d.json()

        assert body["totals"]["saved_opportunities"] == 2
        assert body["checklist_progress"]["total"] == 2
        assert body["checklist_progress"]["completed"] == 1
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_dashboard_empty_state_is_zero_not_missing(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={"name": "Empty User", "email": "empty@example.com", "password": "password123"},
        )
        token = r.json()["access_token"]

        d = await ac.get("/api/v1/dashboard", headers=_auth(token))
        assert d.status_code == 200
        body = d.json()
        assert body["totals"]["saved_opportunities"] == 0
        assert body["checklist_progress"] == {"completed": 0, "total": 0}
        assert body["risk_band_distribution"] == {}
    finally:
        limiter.enabled = True
