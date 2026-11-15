from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.db.models.audit_log import AuditLog
from app.db.models.community_report import CommunityReport
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User
from app.db.models.watchlist import WatchlistEntry
from app.db.session import get_db
from app.services.analytics import report_trends
from app.services.audit import AuditLogger

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
    request: Request,
    admin: Annotated[User, Depends(require_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    metrics: dict[str, Any] = {
        "analyses": 0,
        "reports": 0,
        "reports_by_status": {},
        "users_by_role": {},
        "watchlist_entries": 0,
        "audit_events": 0,
        "generated_at": None,
    }
    try:
        from datetime import UTC, datetime

        metrics["generated_at"] = datetime.now(UTC).isoformat()

        ares = await db.execute(select(JobAnalysis))
        analyses = ares.scalars().all() if hasattr(ares, "scalars") else []
        metrics["analyses"] = len(analyses)

        rres = await db.execute(select(CommunityReport))
        reports = rres.scalars().all() if hasattr(rres, "scalars") else []
        metrics["reports"] = len(reports)
        by: dict[str, int] = {}
        for r in reports:
            s = getattr(r, "moderation_status", "unknown") or "unknown"
            by[s] = by.get(s, 0) + 1
        metrics["reports_by_status"] = by

        ures = await db.execute(select(User.role))
        roles = ures.scalars().all() if hasattr(ures, "scalars") else []
        role_counts: dict[str, int] = {}
        for role in roles:
            key = str(role or "unknown")
            role_counts[key] = role_counts.get(key, 0) + 1
        metrics["users_by_role"] = role_counts

        wres = await db.execute(select(WatchlistEntry))
        watchlist = wres.scalars().all() if hasattr(wres, "scalars") else []
        metrics["watchlist_entries"] = len(watchlist)

        try:
            audit_count_res = await db.execute(select(func.count()).select_from(AuditLog))
            metrics["audit_events"] = int(audit_count_res.scalar() or 0)
        except Exception:
            ares2 = await db.execute(select(AuditLog.id))
            ids = ares2.scalars().all() if hasattr(ares2, "scalars") else []
            metrics["audit_events"] = len(ids)

        await AuditLogger.log(
            db,
            actor_id=admin.id,
            action="admin.metrics.view",
            resource_type="admin_metrics",
            resource_id=None,
            ip=request.client.host if request.client else None,
            request_id=getattr(request.state, "request_id", None),
        )
        await db.commit()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass
    return metrics


@router.get("/admin/audit-logs")
async def admin_audit_logs(
    admin: Annotated[User, Depends(require_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(50, ge=1, le=200),
    cursor: str | None = None,
    action: str | None = None,
    resource_type: str | None = None,
) -> dict[str, Any]:
    """Admin-only audit log review. Returns redacted, non-PII event metadata only."""
    _ = admin
    try:
        stmt = select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
        if action:
            stmt = stmt.where(AuditLog.action == action)
        if resource_type:
            stmt = stmt.where(AuditLog.resource_type == resource_type)
        res = await db.execute(stmt)
        rows = list(res.scalars().all()) if hasattr(res, "scalars") else []
    except Exception:
        rows = []

    start = 0
    if cursor:
        try:
            start = max(int(cursor), 0)
        except Exception:
            start = 0
    page = rows[start : start + limit]
    next_cursor = str(start + limit) if (start + limit) < len(rows) else None

    items = []
    for row in page:
        items.append(
            {
                "id": str(getattr(row, "id", "")),
                "actor_id": (
                    str(getattr(row, "actor_id", "")) if getattr(row, "actor_id", None) else None
                ),
                "action": getattr(row, "action", None),
                "resource_type": getattr(row, "resource_type", None),
                "resource_id": getattr(row, "resource_id", None),
                "timestamp": (
                    row.timestamp.isoformat() if getattr(row, "timestamp", None) else None
                ),
                "request_id": getattr(row, "request_id", None),
            }
        )
    return {"items": items, "next_cursor": next_cursor}
