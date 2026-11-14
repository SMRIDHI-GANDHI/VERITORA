from __future__ import annotations

import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.community_report import CommunityReport
from app.db.models.dashboard import ChecklistProgress, SavedOpportunity
from app.db.models.job_analysis import JobAnalysis
from app.db.models.job_posting import JobPosting
from app.db.models.risk_factor import RiskFactor
from app.db.models.safety_recommendation import SafetyRecommendation
from app.db.models.user import User
from app.db.session import get_db
from app.services.analyzer.service import analyze as run_analyze
from app.services.data_exposure import exposure_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analyses"])


def _to_response(analysis: JobAnalysis) -> dict[str, Any]:
    data = analysis.result_json or {}
    data = dict(data)
    data["id"] = str(analysis.id)
    if analysis.created_at and not data.get("created_at"):
        data["created_at"] = analysis.created_at.isoformat()
    data.setdefault("assessment_type", analysis.assessment_type)
    data.setdefault("rules_version", analysis.rules_version)
    data.setdefault("risk_score", analysis.risk_score)
    data.setdefault("risk_band", analysis.risk_band)
    sid = str(analysis.supersedes_id) if analysis.supersedes_id else None
    data.setdefault("supersedes_id", sid)
    return data


@router.get("/analyses")
async def list_analyses(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    stmt = select(JobAnalysis).where(JobAnalysis.user_id == user.id)
    res = await db.execute(stmt)
    items = res.scalars().all() if hasattr(res, "scalars") else []
    # newest first if created_at available
    try:
        items = sorted(items, key=lambda x: x.created_at or 0, reverse=True)
    except Exception:
        pass
    return {"items": [_to_response(a) for a in items], "next_cursor": None}


@router.get("/analyses/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        aid = uuid.UUID(analysis_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    analysis = await db.get(JobAnalysis, aid)
    if not analysis or analysis.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    return _to_response(analysis)


@router.post("/analyses/{analysis_id}/refresh")
async def refresh_analysis(
    analysis_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    try:
        aid = uuid.UUID(analysis_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    prev = await db.get(JobAnalysis, aid)
    if not prev or prev.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    posting = await db.get(JobPosting, prev.job_id) if prev.job_id else None
    if not posting:
        raise HTTPException(status_code=400, detail="Original posting unavailable for refresh")

    result = run_analyze(
        title=posting.title,
        description=posting.description,
        company_name=(prev.input_summary or {}).get("company_name"),
        salary_text=posting.salary_text,
        location=posting.location,
        company_website=posting.source_url,
    )

    # new posting snapshot not required; link to same posting is fine for MVP refresh
    analysis = JobAnalysis(
        user_id=user.id,
        job_id=posting.id,
        risk_score=result.get("risk_score"),
        risk_band=result.get("risk_band") or "insufficient_information",
        assessment_type=result.get("assessment_type") or "decision_support",
        summary=result.get("summary"),
        explanation=None,
        rules_version=result.get("rules_version") or "rules-2026.11.1",
        input_summary=prev.input_summary,
        supersedes_id=prev.id,
        result_json=result,
    )
    db.add(analysis)
    await db.flush()
    for f in result.get("risk_factors", []) or []:
        ev = f.get("evidence") or {}
        span = ev.get("span") or {}
        db.add(
            RiskFactor(
                analysis_id=analysis.id,
                factor_code=f.get("code") or "UNKNOWN",
                severity=f.get("severity") or "low",
                confidence=f.get("confidence") or "low",
                evidence_excerpt=ev.get("excerpt"),
                span_start=span.get("start"),
                span_end=span.get("end"),
                explanation=f.get("explanation"),
                source_type=(f.get("source") or {}).get("type"),
                evidence_key=f.get("evidence_key"),
            )
        )
    for rec in result.get("recommendations", []) or []:
        db.add(
            SafetyRecommendation(
                analysis_id=analysis.id,
                recommendation_code=rec.get("code") or "REC",
                text_key=rec.get("text_key"),
                priority=int(rec.get("priority") or 3),
            )
        )
    await db.commit()
    await db.refresh(analysis)
    return _to_response(analysis)


@router.get("/dashboard")
async def get_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    analyses: list[Any] = []
    reports: list[Any] = []
    saved_count = 0
    checklist_total = 0
    checklist_completed = 0
    try:
        ares = await db.execute(select(JobAnalysis).where(JobAnalysis.user_id == user.id))
        a_rows = ares.scalars().all() if hasattr(ares, "scalars") else []
        analyses = list(a_rows)
    except Exception:
        logger.exception("dashboard: failed to load analyses for user %s", user.id)
    try:
        rres = await db.execute(select(CommunityReport).where(CommunityReport.user_id == user.id))
        r_rows = rres.scalars().all() if hasattr(rres, "scalars") else []
        reports = list(r_rows)
    except Exception:
        logger.exception("dashboard: failed to load community reports for user %s", user.id)
    try:
        sres = await db.execute(select(SavedOpportunity).where(SavedOpportunity.user_id == user.id))
        s_rows = sres.scalars().all() if hasattr(sres, "scalars") else []
        saved_count = len(s_rows)
    except Exception:
        logger.exception("dashboard: failed to load saved opportunities for user %s", user.id)
    try:
        cres = await db.execute(
            select(ChecklistProgress).where(ChecklistProgress.user_id == user.id)
        )
        c_rows = cres.scalars().all() if hasattr(cres, "scalars") else []
        checklist_total = len(c_rows)
        checklist_completed = sum(1 for i in c_rows if bool(getattr(i, "completed", False)))
    except Exception:
        logger.exception("dashboard: failed to load checklist progress for user %s", user.id)
    bands: dict[str, int] = {}
    for a in analyses:
        b = getattr(a, "risk_band", "unknown") or "unknown"
        bands[b] = bands.get(b, 0) + 1
    recent = sorted(analyses, key=lambda x: getattr(x, "created_at", None) or 0, reverse=True)[:5]
    recent_out = []
    for a in recent:
        created = getattr(a, "created_at", None)
        recent_out.append(
            {
                "id": str(a.id),
                "risk_band": a.risk_band,
                "created_at": created.isoformat() if created else None,
            }
        )
    return {
        "totals": {
            "analyses": len(analyses),
            "reports": len(reports),
            "saved_opportunities": saved_count,
        },
        "risk_band_distribution": bands,
        "recent_analyses": recent_out,
        "report_statuses": [
            {"id": str(r.id), "moderation_status": getattr(r, "moderation_status", None)}
            for r in reports[:10]
        ],
        "checklist_progress": {"completed": checklist_completed, "total": checklist_total},
    }


@router.post("/data-exposure/check")
async def data_exposure_check(
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = user
    items = payload.get("items")
    if items is None and isinstance(payload.get("text"), str):
        # split free text by commas/newlines
        items = [s.strip() for s in re_split(payload["text"]) if s.strip()]
    if not isinstance(items, list):
        raise HTTPException(status_code=422, detail="Provide 'items' (list) or 'text'.")
    cleaned = [str(x) for x in items if str(x).strip()][:200]
    return exposure_response(cleaned)


def re_split(text: str) -> list[str]:
    # simple splitter
    parts = []
    for chunk in text.replace("\r", "\n").split("\n"):
        parts.extend(chunk.split(","))
    return parts
@router.post("/feedback/analysis/{analysis_id}")
async def feedback_analysis(
    analysis_id: str,
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    # Feedback is best-effort: it is recorded in the audit log, but a logging
    # failure must not lose the user's submission.
    try:
        from app.services.audit import AuditLogger

        await AuditLogger.log(
            db,
            actor_id=user.id,
            action="feedback.analysis",
            resource_type="job_analysis",
            resource_id=analysis_id,
            ip=None,
            request_id=None,
        )
        await db.commit()
    except Exception:
        logger.exception("feedback: failed to record audit entry for analysis %s", analysis_id)
        await db.rollback()
    return {"status": "received", "analysis_id": analysis_id, "feedback": payload}

@router.get("/saved")
async def list_saved(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    res = await db.execute(select(SavedOpportunity).where(SavedOpportunity.user_id == user.id))
    items = res.scalars().all() if hasattr(res, "scalars") else []
    out = []
    for i in items:
        out.append(
            {
                "id": str(i.id),
                "analysis_id": str(i.analysis_id) if i.analysis_id else None,
                "title": i.title,
                "notes": i.notes,
            }
        )
    return {"items": out, "next_cursor": None}


@router.post("/saved", status_code=201)
async def create_saved(
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    aid = payload.get("analysis_id")
    analysis_uuid = None
    if aid:
        try:
            analysis_uuid = uuid.UUID(str(aid))
        except Exception:
            analysis_uuid = None
    item = SavedOpportunity(
        user_id=user.id,
        analysis_id=analysis_uuid,
        title=payload.get("title"),
        notes=payload.get("notes"),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "id": str(item.id),
        "analysis_id": str(item.analysis_id) if item.analysis_id else None,
        "title": item.title,
        "notes": item.notes,
    }


@router.get("/checklist")
async def get_checklist(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    stmt = select(ChecklistProgress).where(ChecklistProgress.user_id == user.id)
    res = await db.execute(stmt)
    items = res.scalars().all() if hasattr(res, "scalars") else []
    return {
        "items": [
            {"item_key": i.item_key, "completed": bool(i.completed), "meta": i.meta}
            for i in items
        ]
    }


@router.post("/checklist")
async def update_checklist(
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    item_key = str(payload.get("item_key") or "").strip()
    if not item_key:
        raise HTTPException(status_code=422, detail="item_key is required")
    completed = bool(payload.get("completed", False))
    # find existing
    stmt = select(ChecklistProgress).where(
        ChecklistProgress.user_id == user.id,
        ChecklistProgress.item_key == item_key,
    )
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none() if hasattr(res, "scalar_one_or_none") else None
    if not existing:
        # Fallback scan: some drivers cannot express the multi-column filter.
        try:
            all_res = await db.execute(select(ChecklistProgress))
            for i in (all_res.scalars().all() if hasattr(all_res, "scalars") else []):
                if i.user_id == user.id and i.item_key == item_key:
                    existing = i
                    break
        except Exception:
            logger.exception("checklist: fallback lookup failed for item %s", item_key)
    if existing:
        existing.completed = completed
        existing.meta = payload.get("meta")
    else:
        existing = ChecklistProgress(
            user_id=user.id,
            item_key=item_key,
            completed=completed,
            meta=payload.get("meta"),
        )
        db.add(existing)
    await db.commit()
    await db.refresh(existing)
    return {
        "item_key": existing.item_key,
        "completed": bool(existing.completed),
        "meta": existing.meta,
    }
