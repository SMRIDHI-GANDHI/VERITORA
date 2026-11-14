from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.db.session import get_db
from app.main import create_app


@pytest.mark.asyncio
async def test_health_alias():
    """External monitors commonly poll /health; the app exposes both aliases."""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for path in ("/health", "/healthz"):
            r = await ac.get(path)
            assert r.status_code == 200, path
            assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_readyz_db_down():
    app = create_app()

    async def broken_db():
        class _S:
            async def execute(self, *_args, **_kwargs):
                raise RuntimeError("db down")

        yield _S()

    app.dependency_overrides[get_db] = broken_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        r = await ac.get("/readyz")
    assert r.status_code == 503
    body = r.json()
    assert body["title"] == "HTTP error" or body["status"] == 503
    assert "request_id" in body
