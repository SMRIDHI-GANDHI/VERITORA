from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.db.models.user import User
from app.db.models.watchlist import WatchlistAppeal, WatchlistEntry
from app.db.session import get_db
from app.services.audit import AuditLogger

router = APIRouter(prefix="/api/v1", tags=["watchlist"])


def _entry_view(e: WatchlistEntry) -> dict[str, Any]:
    return {
        "id": str(e.id),
        "entity_reference": e.entity_reference,
        "status": e.status,
        "reason": e.reason,
        "evidence_reference": e.evidence_reference,
        "source": e.source,
        "confidence": e.confidence,
        "reviewer_id": str(e.reviewer_id) if e.reviewer_id else None,
        "reviewed_at": e.reviewed_at.isoformat() if e.reviewed_at else None,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if getattr(e, "updated_at", None) else None,
    }


def _public_neutral_status(status: str) -> str | None:
    # Public API must expose only neutral flags, never internal labels like confirmed_pattern
    if status in {"under_review", "confirmed_pattern", "unverified_signal"}:
        return "additional_verification_recommended"
    return None


@router.get("/admin/watchlist")
async def list_watchlist(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = moderator
    res = await db.execute(select(WatchlistEntry))
    items = res.scalars().all() if hasattr(res, "scalars") else []
    return {"items": [_entry_view(e) for e in items], "next_cursor": None}


@router.post("/admin/watchlist", status_code=201)
async def create_watchlist_entry(
    request: Request,
    payload: dict[str, Any],
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    entity_reference = str(payload.get("entity_reference") or "").strip()
    if not entity_reference:
        raise HTTPException(status_code=422, detail="entity_reference is required")
    status = str(payload.get("status") or "unverified_signal")
    if status not in {"unverified_signal", "under_review", "confirmed_pattern", "cleared"}:
        raise HTTPException(status_code=422, detail="Invalid status")
    # elevated status requires moderator approval; require moderator/admin role and audit
    if status == "confirmed_pattern" and moderator.role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Moderator approval required")
    entry = WatchlistEntry(
        entity_reference=entity_reference,
        status=status,
        reason=payload.get("reason"),
        evidence_reference=payload.get("evidence_reference"),
        source=payload.get("source"),
        confidence=payload.get("confidence"),
        reviewer_id=moderator.id if status != "unverified_signal" else None,
        reviewed_at=datetime.now(UTC) if status != "unverified_signal" else None,
    )
    db.add(entry)
    await db.flush()
    await AuditLogger.log(
        db,
        actor_id=moderator.id,
        action="watchlist.create",
        resource_type="watchlist_entry",
        resource_id=str(entry.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(entry)
    return _entry_view(entry)


@router.patch("/admin/watchlist/{entry_id}")
async def update_watchlist_entry(
    request: Request,
    entry_id: str,
    payload: dict[str, Any],
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        eid = uuid.UUID(entry_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    entry = await db.get(WatchlistEntry, eid)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")

    current = entry.status
    target = str(payload.get("status") or current)
    allowed = {
        "unverified_signal": {"under_review", "cleared"},
        "under_review": {"confirmed_pattern", "cleared"},
        "confirmed_pattern": {"cleared", "under_review"},
        "cleared": {"under_review"},
    }
    if target != current and target not in allowed.get(current, set()):
        raise HTTPException(status_code=409, detail="Illegal watchlist transition")
    if target == "confirmed_pattern" and moderator.role not in {"moderator", "admin"}:
        raise HTTPException(status_code=403, detail="Moderator approval required")

    entry.status = target
    if "reason" in payload:
        entry.reason = payload.get("reason")
    if "evidence_reference" in payload:
        entry.evidence_reference = payload.get("evidence_reference")
    if "source" in payload:
        entry.source = payload.get("source")
    if "confidence" in payload:
        entry.confidence = payload.get("confidence")
    entry.reviewer_id = moderator.id
    entry.reviewed_at = datetime.now(UTC)

    await AuditLogger.log(
        db,
        actor_id=moderator.id,
        action=f"watchlist.update.{current}_to_{target}",
        resource_type="watchlist_entry",
        resource_id=str(entry.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(entry)
    return _entry_view(entry)


@router.post("/watchlist/{entry_id}/appeals", status_code=201)
async def submit_watchlist_appeal(
    request: Request,
    entry_id: str,
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        eid = uuid.UUID(entry_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    entry = await db.get(WatchlistEntry, eid)
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    message = str(payload.get("message") or "").strip()
    if len(message) < 5:
        raise HTTPException(status_code=422, detail="Appeal message is required")
    appeal = WatchlistAppeal(
        entry_id=entry.id, submitted_by=user.id, message=message, status="open"
    )
    db.add(appeal)
    # appeals reopen to under_review
    if entry.status in {"confirmed_pattern", "cleared", "unverified_signal"}:
        entry.status = "under_review"
        entry.reviewed_at = None
        entry.reviewer_id = None
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="watchlist.appeal.submit",
        resource_type="watchlist_entry",
        resource_id=str(entry.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    return {"id": str(appeal.id), "status": appeal.status, "entry_status": entry.status}


@router.get("/watchlist/status")
async def public_watchlist_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    entity_reference: str | None = None,
) -> dict[str, Any]:
    """Public-safe view: only neutral flags, no internal labels/reasons/evidence."""
    if not entity_reference:
        return {"items": []}
    stmt = select(WatchlistEntry).where(WatchlistEntry.entity_reference == entity_reference)
    res = await db.execute(stmt)
    items = res.scalars().all() if hasattr(res, "scalars") else []
    out = []
    for e in items:
        neutral = _public_neutral_status(e.status)
        if neutral:
            out.append({"entity_reference": e.entity_reference, "flag": neutral})
    return {"items": out}