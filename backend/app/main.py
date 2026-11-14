from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.admin import router as admin_router
from app.api.routes.analyses import router as analyses_router
from app.api.routes.analyzer import router as analyzer_router
from app.api.routes.auth import router as auth_router
from app.api.routes.chat import router as chat_router
from app.api.routes.network import router as network_router
from app.api.routes.passports import router as passports_router
from app.api.routes.reports import router as reports_router
from app.api.routes.resources import router as resources_router
from app.api.routes.verification import router as verification_router
from app.api.routes.watchlist import router as watchlist_router
from app.config import get_settings
from app.core.errors import register_exception_handlers, register_rate_limit_handler
from app.core.logging import RequestIdMiddleware, SecurityHeadersMiddleware, setup_logging
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.services.cyber_resources import validate_cyber_resources_config


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    setup_logging()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    # fail fast if cyber resources config is invalid/missing
    validate_cyber_resources_config(settings.cybercrime_resources_file)
    app = FastAPI(title="VERITORA API", version="0.1.0", lifespan=lifespan)
    app.state.limiter = limiter
    register_rate_limit_handler(app)

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        # In development also allow any localhost/127.0.0.1 port: Vite shifts
        # ports when 5173 is busy, and a browser treats localhost and 127.0.0.1
        # as different origins. Production ignores this (returns None).
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(auth_router)
    app.include_router(resources_router)
    app.include_router(analyzer_router)
    app.include_router(analyses_router)
    app.include_router(verification_router)
    app.include_router(reports_router)
    app.include_router(chat_router)
    app.include_router(network_router)
    app.include_router(admin_router)
    app.include_router(watchlist_router)
    app.include_router(passports_router)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health")
    async def health() -> dict[str, str]:
        # Alias for /healthz so external monitors using either convention work.
        return {"status": "ok"}

    @app.get("/readyz")
    async def readyz(db: Annotated[AsyncSession, Depends(get_db)]) -> dict[str, str]:
        try:
            await db.execute(text("SELECT 1"))
        except Exception as exc:
            raise HTTPException(status_code=503, detail="Database not ready") from exc
        return {"status": "ready"}

    return app


app = create_app()
