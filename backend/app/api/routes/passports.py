from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.models.job_analysis import JobAnalysis
from app.db.models.user import User
from app.db.session import get_db
from app.services.audit import AuditLogger
from app.services.passport import (
    create_passport,
    get_public_passport,
    list_user_passports,
    revoke_passport,
)
from app.services.translation import (
    explain_wording,
    get_disclaimer,
    translate_factors,
    translate_recommendations,
)

router = APIRouter(prefix="/api/v1", tags=["passports"])


@router.get("/passports")
async def list_passports_endpoint(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    items = await list_user_passports(db, user_id=user.id)
    return {"items": items, "next_cursor": None}


@router.post("/passports", status_code=201)
async def create_passport_endpoint(
    request: Request,
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    analysis_id = payload.get("analysis_id")
    if not analysis_id:
        raise HTTPException(status_code=422, detail="analysis_id is required")
    try:
        aid = uuid.UUID(str(analysis_id))
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid analysis_id") from None
    analysis = await db.get(JobAnalysis, aid)
    if not analysis or analysis.user_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")

    expires_in_days = payload.get("expires_in_days")
    try:
        expires_in_days_int = int(expires_in_days) if expires_in_days is not None else None
    except Exception:
        expires_in_days_int = None

    passport, token = await create_passport(
        db, analysis=analysis, user_id=user.id, expires_in_days=expires_in_days_int
    )
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="passport.create",
        resource_type="trust_passport",
        resource_id=str(passport.id),
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()
    await db.refresh(passport)
    return {
        "id": str(passport.id),
        "analysis_id": str(passport.analysis_id),
        "token": token,  # returned once
        "expires_at": passport.expires_at.isoformat() if passport.expires_at else None,
        "created_at": passport.created_at.isoformat() if passport.created_at else None,
        "note": "Store this token securely. It will not be shown again.",
    }


@router.get("/passports/{token}")
async def get_passport_public(
    token: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    snap = await get_public_passport(db, token)
    if not snap:
        raise HTTPException(status_code=404, detail="Passport not found, expired, or revoked")
    return snap


@router.delete("/passports/{passport_id}", status_code=204)
async def delete_passport(
    request: Request,
    passport_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    try:
        pid = uuid.UUID(passport_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    ok = await revoke_passport(db, passport_id=pid, user_id=user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Not found")
    await AuditLogger.log(
        db,
        actor_id=user.id,
        action="passport.revoke",
        resource_type="trust_passport",
        resource_id=passport_id,
        ip=request.client.host if request.client else None,
        request_id=getattr(request.state, "request_id", None),
    )
    await db.commit()


@router.post("/explanations/translate")
async def translate_explanation(
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = user
    language = str(payload.get("language") or "en")
    recommendations = payload.get("recommendations") or []
    factors = payload.get("risk_factors") or payload.get("factors") or []
    if not isinstance(recommendations, list):
        recommendations = []
    if not isinstance(factors, list):
        factors = []
    return {
        "language": language,
        "recommendations": translate_recommendations(recommendations, language),
        "risk_factors": translate_factors(factors, language),
        "disclaimer": get_disclaimer(language),
        "translation_note": "Machine-translated, may be inaccurate." if language != "en" else None,
    }


@router.post("/explanations/wording")
async def explain_wording_endpoint(
    payload: dict[str, Any],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = user
    text = str(payload.get("text") or "")
    if not text.strip():
        raise HTTPException(status_code=422, detail="text is required")
    return explain_wording(text)
