from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_analysis import JobAnalysis
from app.db.models.passport import TrustPassport

DEFAULT_EXPIRY_DAYS = 30
EXPECTED_CHECKS = [
    "domain_consistency",
    "lookalike_domain",
    "safe_fetch",
    "registry_lookup",
    "community_report_lookup",
    "recruiter_affiliation",
    "company_identity",
]


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_token() -> str:
    # 256-bit random token (returned once)
    return secrets.token_urlsafe(32)


def _checks_with_not_performed(verification: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_type: dict[str, dict[str, Any]] = {}
    for c in verification or []:
        ctype = str(c.get("check_type") or "unknown")
        # keep as-is but ensure no internal-only fields leak
        safe = {
            "check_type": ctype,
            "status": c.get("status"),
            "matched_fields": c.get("matched_fields") or [],
            "mismatched_fields": c.get("mismatched_fields") or [],
            "unknown_fields": c.get("unknown_fields") or [],
            "source_url": c.get("source_url"),
            "checked_at": c.get("checked_at"),
        }
        by_type[ctype] = safe
    out = list(by_type.values())
    present = set(by_type.keys())
    # include expected checks as not performed/not checked when missing
    for ctype in EXPECTED_CHECKS:
        if ctype not in present:
            out.append(
                {
                    "check_type": ctype,
                    "status": "not_checked",
                    "matched_fields": [],
                    "mismatched_fields": [],
                    "unknown_fields": [],
                    "source_url": None,
                    "checked_at": None,
                    "note": "Not performed for this analysis.",
                }
            )
    return out


def build_snapshot(analysis: JobAnalysis) -> dict[str, Any]:
    data = dict(analysis.result_json or {})
    verification = _checks_with_not_performed(list(data.get("verification") or []))
    community = data.get("community") or {
        "approved_report_count": 0,
        "labels": [],
        "note": "User-submitted; not verified facts.",
    }
    snapshot = {
        "assessment_type": data.get("assessment_type") or analysis.assessment_type,
        "rules_version": data.get("rules_version") or analysis.rules_version,
        "risk_score": data.get("risk_score", analysis.risk_score),
        "risk_band": data.get("risk_band") or analysis.risk_band,
        "summary": data.get("summary") or analysis.summary,
        "risk_factors": data.get("risk_factors") or [],
        "checks": verification,
        "checks_performed_and_not_performed": verification,
        "unknowns": data.get("unknowns") or [],
        "missing_information": data.get("missing_information") or [],
        "recommendations": data.get("recommendations") or [],
        "community": community,
        "disclaimer_key": data.get("disclaimer_key") or "disclaimer.decision_support",
        "analysis_created_at": analysis.created_at.isoformat() if analysis.created_at else None,
        "refresh_guidance": (
            "This snapshot reflects checks at the time of creation. Refresh analysis for the "
            "latest information; results may change."
        ),
        "no_personal_data": True,
    }
    return snapshot


async def create_passport(
    db: AsyncSession,
    *,
    analysis: JobAnalysis,
    user_id: uuid.UUID,
    expires_in_days: int | None = None,
) -> tuple[TrustPassport, str]:
    days = expires_in_days or DEFAULT_EXPIRY_DAYS
    if days < 1:
        days = 1
    if days > 365:
        days = 365
    token = generate_token()
    token_hash = _hash_token(token)
    now = datetime.now(UTC)
    passport = TrustPassport(
        analysis_id=analysis.id,
        public_token_hash=token_hash,
        snapshot_json=build_snapshot(analysis),
        expires_at=now + timedelta(days=days),
        revoked_at=None,
        created_by=user_id,
    )
    db.add(passport)
    await db.flush()
    return passport, token


async def get_public_passport(db: AsyncSession, token: str) -> dict[str, Any] | None:
    token_hash = _hash_token(token)
    # try direct query
    try:
        from sqlalchemy import select

        stmt = select(TrustPassport).where(TrustPassport.public_token_hash == token_hash)
        res = await db.execute(stmt)
        obj = res.scalar_one_or_none() if hasattr(res, "scalar_one_or_none") else None
    except Exception:
        obj = None
    if not obj:
        # fallback scan for in-memory session limitations
        try:
            # access store-like behavior via all objects not available; best effort
            from sqlalchemy import select

            res = await db.execute(select(TrustPassport))
            all_items = res.scalars().all() if hasattr(res, "scalars") else []
            obj = next((p for p in all_items if p.public_token_hash == token_hash), None)
        except Exception:
            obj = None
    if not obj:
        return None
    now = datetime.now(UTC)
    if obj.revoked_at is not None:
        return None
    exp = obj.expires_at
    try:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
    except Exception:
        pass
    if exp <= now:
        return None
    snap = dict(obj.snapshot_json or {})
    snap["passport_id"] = str(obj.id)
    snap["expires_at"] = obj.expires_at.isoformat() if obj.expires_at else None
    snap["created_at"] = obj.created_at.isoformat() if obj.created_at else None
    snap["revoked"] = False
    return snap


async def revoke_passport(db: AsyncSession, *, passport_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    obj = await db.get(TrustPassport, passport_id)
    if not obj or obj.created_by != user_id:
        return False
    if obj.revoked_at is None:
        obj.revoked_at = datetime.now(UTC)
        await db.flush()
    return True


def _list_item(passport: TrustPassport) -> dict[str, Any]:
    snap = dict(passport.snapshot_json or {})
    now = datetime.now(UTC)
    exp = passport.expires_at
    try:
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=UTC)
    except Exception:
        pass
    expired = exp <= now
    revoked = passport.revoked_at is not None
    status = "revoked" if revoked else "expired" if expired else "active"
    return {
        "id": str(passport.id),
        "analysis_id": str(passport.analysis_id),
        "created_at": passport.created_at.isoformat() if passport.created_at else None,
        "expires_at": passport.expires_at.isoformat() if passport.expires_at else None,
        "revoked_at": passport.revoked_at.isoformat() if passport.revoked_at else None,
        "status": status,
        "risk_band": snap.get("risk_band"),
        "risk_score": snap.get("risk_score"),
        "summary": snap.get("summary"),
        "rules_version": snap.get("rules_version"),
    }


async def list_user_passports(db: AsyncSession, *, user_id: uuid.UUID) -> list[dict[str, Any]]:
    try:
        from sqlalchemy import select

        stmt = select(TrustPassport).where(TrustPassport.created_by == user_id)
        res = await db.execute(stmt)
        items = res.scalars().all() if hasattr(res, "scalars") else []
    except Exception:
        store_items = getattr(db, "store", {}).get("trust_passports", {}).values()
        items = [p for p in store_items if getattr(p, "created_by", None) == user_id]
    try:
        items = sorted(
            items,
            key=lambda x: x.created_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
    except Exception:
        pass
    return [_list_item(p) for p in items]
