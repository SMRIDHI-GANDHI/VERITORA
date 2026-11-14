import pytest
from httpx import ASGITransport, AsyncClient

from app.main import create_app


@pytest.mark.asyncio
async def test_validation_error_returns_problem_json():
    app = create_app()

    @app.get("/_validate")
    async def _validate(q: int):
        return {"q": q}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/_validate", params={"q": "not-an-int"})
    assert r.status_code == 422
    body = r.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["status"] == 422
    assert "request_id" in body
