from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.rate_limit import limiter, rate_limit_key_user_or_ip
from app.db.models.community_report import CommunityReport
from app.db.models.company import Company
from app.db.models.experience_rating import ExperienceRating
from app.db.models.moderation_action import ModerationAction
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.reports import (
    AppealRequest,
    ModerationUpdate,
    RatingCreate,
    ReportCreate,
    ReportUpdate,
)
from app.services.audit import AuditLogger
from app.services.network import process_report_for_network
from app.services.pii import scan_pii

router = APIRouter(prefix="/api/v1", tags=["reports"])

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "pending_review": {
        "under_review",
        "evidence_requested",
        "substantiated",
        "inconclusive",
        "rejected",
        "removed",
        "redact",
    },
    "under_review": {
        "evidence_requested",
        "substantiated",
        "inconclusive",
        "rejected",
        "removed",
        "redact",
    },
    "evidence_requested": {
        "under_review",
        "substantiated",
        "inconclusive",
        "rejected",
        "removed",
        "redact",
    },
    "substantiated": {"removed", "redact", "inconclusive"},
    "inconclusive": {"removed", "redact", "substantiated"},
    "rejected": {"removed", "redact"},
    "removed": set(),
}
ACTION_TO_STATUS = {
    "approve": "substantiated",
    "reject": "rejected",
    "mark_inconclusive": "inconclusive",
    "request_evidence": "evidence_requested",
    "remove": "removed",
    "redact": "under_review",  # keep in moderation flow, content redacted via public_summary
}
PUBLIC_VISIBLE_STATUSES = {"substantiated", "inconclusive"}


def _norm_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


async def _get_or_create_company(db: AsyncSession, name: str) -> Company:
    norm = _norm_name(name)
    res = await db.execute(select(Company).where(Company.normalized_name == norm))
    c = res.scalar_one_or_none()
    if c:
        return c
    c = Company(name=name, normalized_name=norm)
    db.add(c)
    await db.flush()
    return c


def _report_public(r: CommunityReport) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "company": r.company_name,
        "category": r.category,
        "public_summary": r.public_summary,
        "moderation_status": r.moderation_status,
        "occurred_on_approx": r.occurred_on.isoformat() if r.occurred_on else None,
        "label": "user_submitted_report",
    }


def _report_owner_view(r: CommunityReport) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "company_name": r.company_name,
        "job_title": r.job_title,
        "job_url": r.job_url,
        "recruiter_identifier": r.recruiter_identifier,
        "category": r.category,
        "description": r.description,
        "occurred_on": r.occurred_on.isoformat() if r.occurred_on else None,
        "interacted": r.interacted,
        "paid": r.paid,
        "shared_info": r.shared_info,
        "moderation_status": r.moderation_status,
        "public_summary": r.public_summary,
        "pii_flagged": r.pii_flagged,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.post("/reports", status_code=201)
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def create_report(
    request: Request,
    payload: ReportCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    company = await _get_or_create_company(db, payload.company_name)
    pii_flagged, pii_warnings = scan_pii(payload.description)
    report = CommunityReport(
        user_id=user.id,
        company_id=company.id,
        company_name=payload.company_name,
        job_title=payload.job_title,
        job_url=payload.job_url,
        recruiter_identifier=payload.recruiter_identifier,
        category=payload.category,
        description=payload.description,
        occurred_on=payload.occurred_on,
        interacted=bool(payload.interacted),
        paid=bool(payload.paid),
        shared_info=bool(payload.shared_info),
        moderation_status="pending_review",
        pii_flagged=pii_flagged,
    )
    db.add(report)
    await db.flush()
    try:
        await process_report_for_network(db, report)
        await db.flush()
    except Exception:
        try:
            await db.rollback()
        except Exception:
            pass
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="report.submit",
        resource_type="community_report",
        resource_id=str(report.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(report)
    return {
        "id": str(report.id),
        "moderation_status": report.moderation_status,
        "pii_warnings": pii_warnings,
    }


@router.get("/reports")
async def list_reports(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    company: str | None = None,
) -> dict[str, Any]:
    stmt = select(CommunityReport)
    if company:
        stmt = stmt.where(CommunityReport.company_name == company)
    res = await db.execute(stmt)
    items = res.scalars().all() if hasattr(res, "scalars") else []
    visible = []
    for r in items:
        if r.moderation_status in PUBLIC_VISIBLE_STATUSES and r.public_summary:
            visible.append(_report_public(r))
    return {"items": visible, "next_cursor": None}


@router.patch("/reports/{report_id}")
async def update_report(
    request: Request,
    report_id: str,
    payload: ReportUpdate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        rid = uuid.UUID(report_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    report = await db.get(CommunityReport, rid)
    if not report or report.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    if "description" in data and data["description"] is not None:
        pii_flagged, _ = scan_pii(data["description"])
        report.pii_flagged = pii_flagged
        report.moderation_status = "pending_review"  # re-review after edit
        report.public_summary = None
    for k, v in data.items():
        setattr(report, k, v)
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="report.update",
        resource_type="community_report",
        resource_id=str(report.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(report)
    return _report_owner_view(report)


@router.delete("/reports/{report_id}", status_code=204)
async def delete_report(
    request: Request,
    report_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    try:
        rid = uuid.UUID(report_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    report = await db.get(CommunityReport, rid)
    if not report or report.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    # deletion request: mark removed from public view; keep for audit/moderation trail
    report.moderation_status = "removed"
    report.public_summary = None
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="report.delete_requested",
        resource_type="community_report",
        resource_id=str(report.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    from fastapi import Response

    return Response(status_code=204)


@router.post("/reports/{report_id}/appeal", status_code=202)
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def appeal_report(
    request: Request,
    report_id: str,
    payload: AppealRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        rid = uuid.UUID(report_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    report = await db.get(CommunityReport, rid)
    if not report or report.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    # record appeal as moderation action/audit; move to under_review if applicable
    db.add(
        ModerationAction(
            moderator_id=None,
            target_type="community_report",
            target_id=str(report.id),
            action="appeal_submitted",
            reason=payload.message,
            private_note=None,
        )
    )
    if report.moderation_status in {"rejected", "inconclusive", "removed"}:
        report.moderation_status = "under_review"
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="report.appeal",
        resource_type="community_report",
        resource_id=str(report.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    return {
        "id": str(report.id),
        "status": "appeal_submitted",
        "moderation_status": report.moderation_status,
    }


@router.post("/companies/{company_id}/ratings", status_code=201)
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def create_rating(
    request: Request,
    company_id: str,
    payload: RatingCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        cid = uuid.UUID(company_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    company = await db.get(Company, cid)
    if not company:
        raise HTTPException(status_code=404, detail="Not found")

    # unique per user/company/job(null)
    existing = await db.execute(
        select(ExperienceRating).where(
            ExperienceRating.user_id == user.id,
            ExperienceRating.company_id == cid,
            ExperienceRating.job_id.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Rating already exists")

    review_text = payload.review_text or ""
    pii_flagged, _ = scan_pii(review_text)
    spam_score = 0.0
    # simple duplicate/velocity heuristics
    recent = await db.execute(select(ExperienceRating).where(ExperienceRating.user_id == user.id))
    recent_items = recent.scalars().all() if hasattr(recent, "scalars") else []
    if len(recent_items) >= 10:
        spam_score += 0.5
    if review_text:
        for r in recent_items[-20:]:
            if r.review_text and r.review_text.strip().lower() == review_text.strip().lower():
                spam_score += 0.7
                break
    moderation_status = "pending_review" if (pii_flagged or spam_score >= 0.5) else "pending_review"
    rating = ExperienceRating(
        user_id=user.id,
        company_id=cid,
        job_id=None,
        rating=payload.rating,
        dimensions_json=payload.dimensions.model_dump(),
        review_text=payload.review_text,
        moderation_status=moderation_status,
        spam_score=min(spam_score, 1.0),
    )
    db.add(rating)
    await db.flush()
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="rating.submit",
        resource_type="experience_rating",
        resource_id=str(rating.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(rating)
    return {
        "id": str(rating.id),
        "rating": rating.rating,
        "moderation_status": rating.moderation_status,
        "label": "user_submitted_experience",
        "spam_score": rating.spam_score,
    }


# ---- Admin moderation ----
@router.get("/admin/reports")
async def admin_list_reports(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str | None = None,
) -> dict[str, Any]:
    stmt = select(CommunityReport)
    if status:
        stmt = stmt.where(CommunityReport.moderation_status == status)
    res = await db.execute(stmt)
    items = res.scalars().all() if hasattr(res, "scalars") else []
    out = []
    for r in items:
        # moderators can see full details incl description; never expose to ordinary users
        d = _report_owner_view(r)
        d["user_id"] = str(r.user_id)
        out.append(d)
    return {"items": out, "next_cursor": None}


@router.patch("/admin/reports/{report_id}")
async def admin_moderate_report(
    request: Request,
    report_id: str,
    payload: ModerationUpdate,
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        rid = uuid.UUID(report_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    report = await db.get(CommunityReport, rid)
    if not report:
        raise HTTPException(status_code=404, detail="Not found")

    current = report.moderation_status
    target = ACTION_TO_STATUS[payload.action]
    if payload.action != "redact" and target not in ALLOWED_TRANSITIONS.get(current, set()):
        # allow staying in under_review for redact-like edits or explicit transitions only
        if not (payload.action == "mark_inconclusive" and current == "inconclusive"):
            raise HTTPException(status_code=409, detail="Illegal moderation transition")

    # apply
    if payload.action == "redact":
        report.public_summary = payload.public_summary
        if current == "pending_review":
            report.moderation_status = "under_review"
    else:
        report.moderation_status = target
        if payload.public_summary is not None:
            report.public_summary = payload.public_summary

    # if making public, ensure no raw PII in public summary (best effort: use provided summary)
    if report.moderation_status in PUBLIC_VISIBLE_STATUSES and not report.public_summary:
        # require moderator-approved summary; fall back to generic neutral
        report.public_summary = (
            "User-submitted report reviewed by moderators. Details withheld for privacy."
        )

    db.add(
        ModerationAction(
            moderator_id=moderator.id,
            target_type="community_report",
            target_id=str(report.id),
            action=payload.action,
            reason=payload.reason,
            private_note=payload.private_note,
        )
    )
    await AuditLogger.log(
        db,
        actor_id=moderator.id,
        action=f"moderation.{payload.action}",
        resource_type="community_report",
        resource_id=str(report.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(report)
    out = _report_owner_view(report)
    # never expose private_note in response (stored in moderation_actions only)
    return out


@router.get("/admin/appeals")
async def admin_list_appeals(
    moderator: Annotated[User, Depends(require_role("moderator", "admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = moderator
    stmt = select(ModerationAction).where(
        ModerationAction.target_type == "community_report",
        ModerationAction.action == "appeal_submitted",
    )
    res = await db.execute(stmt)
    actions = res.scalars().all() if hasattr(res, "scalars") else []
    out: list[dict[str, Any]] = []
    for a in actions:
        report = None
        try:
            report = await db.get(CommunityReport, uuid.UUID(str(a.target_id)))
        except Exception:
            report = None
        out.append(
            {
                "id": str(a.id),
                "report_id": str(a.target_id),
                "message": a.reason,
                "submitted_at": a.created_at.isoformat() if a.created_at else None,
                "report": _report_owner_view(report) if report else None,
            }
        )
    try:
        out.sort(key=lambda x: x.get("submitted_at") or "", reverse=True)
    except Exception:
        pass
    return {"items": out, "next_cursor": None}
