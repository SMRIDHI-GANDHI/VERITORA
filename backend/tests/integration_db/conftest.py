from __future__ import annotations

import os
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.session import get_db
from app.main import create_app


def _is_postgres_url(url: str) -> bool:
    return url.startswith("postgresql")


@pytest.fixture(scope="session")
def database_url() -> str:
    """Real database URL for integration tests.

    Uses DATABASE_URL from the environment. In CI this points to an ephemeral
    PostgreSQL service container. Tests are skipped when a PostgreSQL URL is not
    configured to avoid touching any real/dev/prod database.
    """
    url = os.getenv("DATABASE_URL", "")
    if not _is_postgres_url(url):
        pytest.skip(
            "PostgreSQL-backed integration tests require DATABASE_URL="
            "postgresql+asyncpg://... (CI provides an isolated service DB)."
        )
    return url


@pytest.fixture(scope="session", autouse=True)
def _migrated_database(database_url: str) -> None:
    """Ensure schema is migrated on the isolated test database.

    Runs alembic upgrade head against DATABASE_URL. This is intended only for
    ephemeral CI/service databases; the URL guard above prevents accidental use
    against non-PostgreSQL or unconfigured environments.
    """
    from alembic.config import Config

    from alembic import command

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(cfg, "head")


@pytest_asyncio.fixture
async def db_engine(database_url: str):
    engine = create_async_engine(database_url, pool_pre_ping=True)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Per-test session isolated by transaction rollback.

    Uses a connection-level transaction so data written during a test never
    persists to the database.
    """
    async with db_engine.connect() as conn:
        trans = await conn.begin()
        session_factory = async_sessionmaker(
            bind=conn, expire_on_commit=False, class_=AsyncSession
        )
        session = session_factory()
        try:
            await session.execute(text("SELECT 1"))
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest_asyncio.fixture
async def real_app_and_client(db_session: AsyncSession):
    app = create_app()

    async def override_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield app, ac
    app.dependency_overrides.clear()
