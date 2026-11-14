from __future__ import annotations

import pytest

from app.core.rate_limit import limiter
from app.services.data_exposure import classify_items, exposure_response


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_exposure_response_exposes_client_contract_keys():
    res = exposure_response(["Aadhaar number", "OTP", "resume"])

    # Client-facing contract (frontend/src/lib/api.ts)
    assert isinstance(res["items"], list)
    assert res["has_high_risk"] is True
    assert isinstance(res["guidance"], list)
    assert res["guidance"], "guidance must not be empty"

    # Canonical service keys remain available
    assert res["hard_warning"] is True
    assert res["results"] == res["items"]
    assert "grouped" in res

    item = next(i for i in res["items"] if i["item"] == "Aadhaar number")
    assert item["category"] == "identity"
    assert item["categories"] == ["identity"]
    assert item["necessity"]["by_stage"]
    assert item["necessity"]["why_may_be_unnecessary"]
    assert item["safer_alternatives"]


def test_exposure_response_no_hard_warning_for_ordinary_items():
    res = exposure_response(["resume", "phone number"])
    assert res["has_high_risk"] is False
    assert res["hard_warning_message"] is None
    # guidance still carries the "do not upload documents" note
    assert any("upload" in g.lower() for g in res["guidance"])


def test_classify_items_contract_unchanged():
    """The service-level helper keeps its original keys for existing callers."""
    res = classify_items(["OTP", "PAN card"])
    assert res["hard_warning"] is True
    assert res["results"][0]["category"] == "credentials"
    assert "necessity_by_stage" in res["results"][0]
    assert "safer_alternative" in res["results"][0]


@pytest.mark.asyncio
async def test_data_exposure_endpoint_contract(app_and_client):
    app, ac = app_and_client
    limiter.enabled = False
    try:
        r = await ac.post(
            "/api/v1/auth/register",
            json={
                "name": "Exposure User",
                "email": "exposure@example.com",
                "password": "password123",
            },
        )
        assert r.status_code == 201
        token = r.json()["access_token"]

        resp = await ac.post(
            "/api/v1/data-exposure/check",
            headers=_auth(token),
            json={"items": ["Aadhaar number", "OTP"]},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["has_high_risk"] is True
        assert len(body["items"]) == 2
        assert body["guidance"]
    finally:
        limiter.enabled = True


@pytest.mark.asyncio
async def test_data_exposure_endpoint_requires_auth(app_and_client):
    app, ac = app_and_client
    resp = await ac.post("/api/v1/data-exposure/check", json={"items": ["OTP"]})
    assert resp.status_code == 401
