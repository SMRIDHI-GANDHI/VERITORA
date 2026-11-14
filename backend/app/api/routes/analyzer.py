from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.config import get_settings
from app.core.rate_limit import limiter, rate_limit_key_user_or_ip
from app.db.models.job_analysis import JobAnalysis
from app.db.models.job_posting import JobPosting
from app.db.models.risk_factor import RiskFactor
from app.db.models.safety_recommendation import SafetyRecommendation
from app.db.models.user import User
from app.db.session import get_db
from app.schemas.analyzer import JobAnalyzeRequest
from app.schemas.verification import AnalyzeMessageRequest
from app.services.analyzer.message import analyze_messages
from app.services.analyzer.service import analyze as run_analyze
from app.services.network import process_job_posting_for_network
from app.services.offer_letter import (
    analyze_offer_letter as run_offer_analysis,
)
from app.services.offer_letter import (
    av_scan_hook,
    cleanup_expired,
    delete_file,
    detect_file_type,
    extract_offer_letter,
    save_upload,
    strip_metadata_best_effort,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["analysis"])


def _to_response(analysis: JobAnalysis) -> dict[str, Any]:
    data = analysis.result_json or {}
    # ensure id/created_at present
    data = dict(data)
    data["id"] = str(analysis.id)
    if analysis.created_at and not data.get("created_at"):
        data["created_at"] = analysis.created_at.isoformat()
    # ensure required top-level fields
    data.setdefault("assessment_type", analysis.assessment_type)
    data.setdefault("rules_version", analysis.rules_version)
    data.setdefault("risk_score", analysis.risk_score)
    data.setdefault("risk_band", analysis.risk_band)
    data.setdefault("verification", [])
    data.setdefault("unknowns", [])
    data.setdefault("missing_information", [])
    data.setdefault("recommendations", [])
    data.setdefault("risk_factors", [])
    return data


@router.post("/analyze/job")
@limiter.limit("30/minute", key_func=rate_limit_key_user_or_ip)
async def analyze_job(
    request: Request,
    payload: JobAnalyzeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    result = run_analyze(
        title=payload.title,
        description=payload.description,
        company_name=payload.company_name,
        salary_text=payload.salary_text,
        experience_level=payload.experience_level,
        location=payload.location,
        application_instructions=payload.application_instructions,
        recruiter_contact=payload.recruiter_contact,
        company_website=payload.company_website,
        evidence=[],
    )

    posting = JobPosting(
        title=payload.title,
        description=payload.description,
        salary_text=payload.salary_text,
        location=payload.location,
        source_url=payload.company_website,
        submitted_by=user.id,
    )
    db.add(posting)
    await db.flush()
    try:
        await process_job_posting_for_network(
            db,
            posting,
            company_name=payload.company_name,
            recruiter_contact=payload.recruiter_contact,
            company_website=payload.company_website,
        )
        await db.flush()
    except Exception:
        # network processing must not break analysis
        try:
            await db.rollback()
        except Exception:
            pass

    analysis = JobAnalysis(
        user_id=user.id,
        job_id=posting.id,
        risk_score=result.get("risk_score"),
        risk_band=result.get("risk_band") or "insufficient_information",
        assessment_type=result.get("assessment_type") or "decision_support",
        summary=result.get("summary"),
        explanation=None,
        rules_version=result.get("rules_version") or "rules-2026.11.1",
        input_summary={
            "title": payload.title,
            "company_name": payload.company_name,
            "has_description": bool(payload.description),
        },
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
    # ensure result has id/created_at
    out = _to_response(analysis)
    if "created_at" not in out or out["created_at"] is None:
        out["created_at"] = datetime.now(UTC).isoformat()
    # attach explanation language translations (original preserved)
    try:
        lang = (payload.explanation_language or "en").lower()
        if lang != "en":
            from app.services.translation import (
                get_disclaimer,
                translate_factors,
                translate_recommendations,
            )

            out["explanation_language"] = lang
            out["recommendations"] = translate_recommendations(
                out.get("recommendations") or [], lang
            )
            out["risk_factors"] = translate_factors(out.get("risk_factors") or [], lang)
            out["disclaimer"] = get_disclaimer(lang)
    except Exception:
        pass
    return out


# GET /analyses/{id} moved to analyses router for consolidation.

@router.post("/analyze/message")
@limiter.limit("30/minute", key_func=rate_limit_key_user_or_ip)
async def analyze_message_endpoint(
    request: Request,
    payload: AnalyzeMessageRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = request, user
    messages = [m.model_dump() for m in payload.messages]
    return analyze_messages(messages)

@router.post("/analyze/offer-letter")
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def analyze_offer_letter_endpoint(
    request: Request,
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),  # noqa: B008
    consent: bool = Form(...),  # noqa: B008
    keep_file: bool = Form(False),  # noqa: B008
) -> dict[str, Any]:
    _ = request, user
    if not consent:
        raise HTTPException(
            status_code=400,
            detail="Explicit consent is required before uploading an offer letter for analysis.",
        )
    settings = get_settings()
    max_bytes = int(getattr(settings, "offer_max_upload_mb", 5) or 5) * 1024 * 1024
    ttl_seconds = int(getattr(settings, "offer_file_ttl_hours", 24) or 24) * 3600

    # basic input checks
    filename = (file.filename or "").lower()
    if not filename.endswith((".pdf", ".png", ".jpg", ".jpeg")):
        raise HTTPException(
            status_code=400, detail="Unsupported file type. Allowed: pdf, png, jpg."
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail="File too large (max 5 MB).")

    file_type = detect_file_type(data)
    if file_type not in {"pdf", "png", "jpg"}:
        raise HTTPException(status_code=400, detail="Invalid or unsupported file content.")

    ok, reason = av_scan_hook(data)
    if not ok:
        logger.warning("offer_letter.av_rejected reason=%s", reason or "unknown")
        raise HTTPException(status_code=400, detail="File rejected by security scan.")

    # strip metadata best-effort, store privately with TTL
    cleaned = strip_metadata_best_effort(data, file_type)
    suffix = ".pdf" if file_type == "pdf" else (".png" if file_type == "png" else ".jpg")
    stored = None
    try:
        # opportunistic cleanup (best-effort)
        try:
            cleanup_expired(ttl_seconds)
        except Exception:
            pass
        stored = save_upload(cleaned, suffix=suffix, ttl_seconds=ttl_seconds)
        extraction = extract_offer_letter(cleaned, file_type)
        result = await run_offer_analysis(
            extraction=extraction,
            consent=bool(consent),
            keep_file=bool(keep_file),
        )
        # explicit consent gate for third-party AI: LLM disabled by default; no external send here
        result.setdefault("assessment_type", "decision_support")
        result.setdefault("disclaimer_key", "disclaimer.decision_support")
        result["consent_recorded"] = bool(consent)
        result["file_retained"] = bool(keep_file)
        return result
    finally:
        # retention: delete after analysis unless user opts to keep
        if stored and not keep_file:
            try:
                delete_file(Path(stored.path))
            except Exception:
                pass
