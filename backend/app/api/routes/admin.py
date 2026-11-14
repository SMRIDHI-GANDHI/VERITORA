from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.db.models.community_report import CommunityReport
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User
from app.db.session import get_db
from app.services.analytics import report_trends

router = APIRouter(prefix="/api/v1", tags=["admin"])


@router.get("/admin/analytics/trends")
async def admin_analytics_trends(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    weeks: int = 8,
) -> dict[str, Any]:
    """Weekly approved-report counts and rising categories for moderators."""
    _ = moderator
    return await report_trends(db, weeks=weeks)


@router.get("/admin/metrics")
async def admin_metrics(
    admin: Annotated[User, Depends(require_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = admin
    metrics: dict[str, Any] = {"analyses": 0, "reports": 0, "reports_by_status": {}}
    try:
        ares = await db.execute(select(JobAnalysis))
        analyses = ares.scalars().all() if hasattr(ares, "scalars") else []
        metrics["analyses"] = len(analyses)
    except Exception:
        pass
    try:
        rres = await db.execute(select(CommunityReport))
        reports = rres.scalars().all() if hasattr(rres, "scalars") else []
        metrics["reports"] = len(reports)
        by: dict[str, int] = {}
        for r in reports:
            s = getattr(r, "moderation_status", "unknown") or "unknown"
            by[s] = by.get(s, 0) + 1
        metrics["reports_by_status"] = by
    except Exception:
        pass
    return metrics