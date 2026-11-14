from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.rate_limit import limiter, rate_limit_key_user_or_ip
from app.db.models.company import Company
from app.db.models.user import User
from app.db.models.verification_check import VerificationCheck
from app.db.session import get_db
from app.schemas.verification import ScanUrlRequest, VerifyCompanyRequest, VerifyRecruiterRequest
from app.services.verification.company import _normalize_domain, run_company_verification
from app.services.verification.recruiter import verify_recruiter
from app.services.verification.url_scan import scan_public_url

router = APIRouter(prefix="/api/v1", tags=["verification"])


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


@router.post("/verify/company")
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def verify_company(
    request: Request,
    payload: VerifyCompanyRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = request
    # find or create company record (simple)
    norm_name = _normalize_name(payload.company_name)
    norm_domain = _normalize_domain(payload.website)
    result = await db.execute(select(Company).where(Company.normalized_name == norm_name))
    company = result.scalar_one_or_none()
    if not company:
        company = Company(
            name=payload.company_name,
            normalized_name=norm_name,
            website=payload.website,
            normalized_domain=norm_domain,
            registration_reference=payload.registration_id,
            verification_status="pending",
        )
        db.add(company)
        await db.flush()

    verification = await run_company_verification(
        company_name=payload.company_name,
        website=payload.website,
        email_domain=payload.email_domain,
        registration_id=payload.registration_id,
        company_id=str(company.id),
    )

    # persist checks
    for c in verification.get("checks", []):
        checked_at = c.get("checked_at")
        try:
            ca = (
                datetime.fromisoformat(checked_at.replace("Z", "+00:00"))
                if checked_at
                else datetime.now(UTC)
            )
        except Exception:
            ca = datetime.now(UTC)
        db.add(
            VerificationCheck(
                entity_type="company",
                entity_id=str(company.id),
                check_type=c.get("check_type") or "unknown",
                status=c.get("status") or "inconclusive",
                matched_fields=c.get("matched_fields") or [],
                mismatched_fields=c.get("mismatched_fields") or [],
                unknown_fields=c.get("unknown_fields") or [],
                source_url=c.get("source_url"),
                checked_at=ca,
                details=c.get("details") or {},
            )
        )
    company.verification_status = verification.get("overall_status")
    await db.commit()
    await db.refresh(company)

    return {
        "company_id": str(company.id),
        "checks": verification.get("checks", []),
        "community": {
            "approved_report_count": 0,
            "labels": [],
            "note": "User-submitted; not verified facts.",
        },
        "overall_status": verification.get("overall_status"),
        "checked_at": verification.get("checked_at"),
    }


@router.get("/companies/{company_id}")
@limiter.limit("60/minute", key_func=rate_limit_key_user_or_ip)
async def get_company(
    request: Request,
    company_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    _ = request
    try:
        cid = uuid.UUID(company_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Not found") from None
    company = await db.get(Company, cid)
    if not company:
        raise HTTPException(status_code=404, detail="Not found")
    # return latest checks for company (simple: all, or could limit; fine for now)
    result = await db.execute(
        select(VerificationCheck).where(
            VerificationCheck.entity_type == "company",
            VerificationCheck.entity_id == str(company.id),
        )
    )
    checks = result.scalars().all() if hasattr(result, "scalars") else []

    def _c(v: VerificationCheck) -> dict[str, Any]:
        return {
            "check_type": v.check_type,
            "status": v.status,
            "matched_fields": v.matched_fields or [],
            "mismatched_fields": v.mismatched_fields or [],
            "unknown_fields": v.unknown_fields or [],
            "source_url": v.source_url,
            "checked_at": v.checked_at.isoformat() if v.checked_at else None,
            "details": v.details or {},
        }

    return {
        "id": str(company.id),
        "name": company.name,
        "website": company.website,
        "normalized_domain": company.normalized_domain,
        "verification_status": company.verification_status,
        "checks": [_c(c) for c in checks],
        "community": {
            "approved_report_count": 0,
            "labels": [],
            "note": "User-submitted; not verified facts.",
        },
    }


@router.post("/verify/recruiter")
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def verify_recruiter_endpoint(
    request: Request,
    payload: VerifyRecruiterRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = request, user
    return await verify_recruiter(
        recruiter_name=payload.recruiter_name,
        claimed_company=payload.claimed_company,
        claimed_role=payload.claimed_role,
        email=payload.email,
        profile_url=payload.profile_url,
        company_website=payload.company_website,
    )


@router.post("/scan/url")
@limiter.limit("10/minute", key_func=rate_limit_key_user_or_ip)
async def scan_url_endpoint(
    request: Request,
    payload: ScanUrlRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, Any]:
    _ = request, user
    return await scan_public_url(payload.url)
