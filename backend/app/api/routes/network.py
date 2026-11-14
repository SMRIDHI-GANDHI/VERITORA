from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.db.models.user import User
from app.db.session import get_db
from app.services.network import list_network_alerts, search_network_patterns

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/network/search")
async def network_search(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str | None = Query(default=None, max_length=100),
) -> dict[str, Any]:
    _ = moderator
    return await search_network_patterns(db, q)


@router.get("/admin/network/alerts")
async def admin_network_alerts(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = moderator
    items = await list_network_alerts(db)
    return {"items": items, "notice": "lead_for_review_not_proof"}