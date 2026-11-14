"""Evidence pack construction for the verification chatbot.

The assistant may only make claims that are backed by an entry in the evidence
pack, and every claim must cite the id of the entry that backs it. This module
is the single place where stored analysis data, approved community reports and
official resource links are turned into that pack.

Design rules enforced here:

* Only **moderator-approved** community reports contribute a ``user_report``
  statement. Raw reporter descriptions are never included.
* Verification checks that were not performed are represented explicitly with
  status ``not_checked`` so the assistant can say "I can't tell".
* Evidence ids are stable and prefixed so a citation can always be traced back
  to its source kind.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.community_report import CommunityReport
from app.db.models.job_analysis import JobAnalysis
from app.db.models.verification_check import VerificationCheck

# Evidence id namespaces
EV_ANALYSIS = "ev:analysis"
EV_FACTOR = "ev:factor"
EV_CHECK = "ev:check"
EV_COMMUNITY = "ev:community"
EV_RESOURCE = "ev:resource"
EV_RECOMMENDATION = "ev:recommendation"
EV_UNKNOWN = "ev:unknown"

# Checks that are expected to have run for a company/recruiter verification.
EXPECTED_CHECKS = [
    "domain_consistency",
    "lookalike_domain",
    "safe_fetch",
    "registry_lookup",
    "community_report_lookup",
    "recruiter_affiliation",
    "company_identity",
]

STATEMENT_FACT = "fact"
STATEMENT_USER_REPORT = "user_report"
STATEMENT_AI_INTERPRETATION = "ai_interpretation"
ALLOWED_STATEMENT_TYPES = {STATEMENT_FACT, STATEMENT_USER_REPORT, STATEMENT_AI_INTERPRETATION}


def _evidence(
    *,
    id: str,
    kind: str,
    label: str,
    summary: str,
    statement_type: str,
    status: str | None = None,
    source_url: str | None = None,
    checked_at: str | None = None,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": id,
        "kind": kind,
        "label": label,
        "summary": summary,
        "statement_type": statement_type,
        "status": status,
        "source_url": source_url,
        "checked_at": checked_at,
        "data": data or {},
    }


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    try:
        return str(value.isoformat())
    except Exception:
        return str(value)


def build_analysis_evidence(analysis: JobAnalysis | None) -> list[dict[str, Any]]:
    """Evidence derived from a stored analysis (facts from our own engine)."""
    if analysis is None:
        return []
    data = dict(analysis.result_json or {})
    out: list[dict[str, Any]] = []

    band = analysis.risk_band or data.get("risk_band") or "insufficient_information"
    score = analysis.risk_score if analysis.risk_score is not None else data.get("risk_score")
    summary = analysis.summary or data.get("summary") or ""
    if band == "insufficient_information":
        score_text = "no numeric risk indicator (not enough information)"
    elif score is None:
        score_text = "no numeric risk indicator"
    else:
        score_text = f"risk indicator {score}/100, band '{band}'"
    out.append(
        _evidence(
            id=EV_ANALYSIS,
            kind="analysis",
            label="Stored analysis",
            summary=f"{summary} ({score_text}).".strip(),
            statement_type=STATEMENT_FACT,
            status=band,
            data={
                "assessment_type": data.get("assessment_type") or analysis.assessment_type,
                "rules_version": analysis.rules_version,
                "risk_band": band,
                "risk_score": score,
                "summary": summary,
                "created_at": _iso(analysis.created_at),
            },
        )
    )

    for factor in data.get("risk_factors") or []:
        code = str(factor.get("code") or "UNKNOWN")
        ev = factor.get("evidence") or {}
        out.append(
            _evidence(
                id=f"{EV_FACTOR}:{code}",
                kind="risk_factor",
                label=code,
                summary=str(factor.get("explanation") or ""),
                statement_type=STATEMENT_FACT,
                status=str(factor.get("severity") or "unknown"),
                data={
                    "severity": factor.get("severity"),
                    "confidence": factor.get("confidence"),
                    "excerpt": ev.get("excerpt"),
                    "source_type": (factor.get("source") or {}).get("type"),
                },
            )
        )

    for rec in data.get("recommendations") or []:
        code = str(rec.get("code") or "RECOMMENDATION")
        out.append(
            _evidence(
                id=f"{EV_RECOMMENDATION}:{code}",
                kind="recommendation",
                label=code,
                summary=str(rec.get("text") or rec.get("text_key") or ""),
                statement_type=STATEMENT_AI_INTERPRETATION,
                status=None,
                data={"priority": rec.get("priority"), "text_key": rec.get("text_key")},
            )
        )

    unknowns = list(data.get("unknowns") or [])
    missing = list(data.get("missing_information") or [])
    if unknowns or missing:
        out.append(
            _evidence(
                id=EV_UNKNOWN,
                kind="unknowns",
                label="What is not known",
                summary="; ".join([str(u) for u in unknowns + missing]),
                statement_type=STATEMENT_FACT,
                status="unknown",
                data={"unknowns": unknowns, "missing_information": missing},
            )
        )
    return out


def build_check_evidence(
    analysis: JobAnalysis | None,
    checks: list[VerificationCheck],
) -> list[dict[str, Any]]:
    """Verification-check evidence, including checks that were not performed."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for check in checks:
        ctype = str(check.check_type or "unknown")
        seen.add(ctype)
        status = str(check.status or "not_checked")
        matched = list(check.matched_fields or [])
        mismatched = list(check.mismatched_fields or [])
        unknown = list(check.unknown_fields or [])
        bits: list[str] = []
        if matched:
            bits.append("matched: " + ", ".join(matched))
        if mismatched:
            bits.append("mismatched: " + ", ".join(mismatched))
        if unknown:
            bits.append("unknown: " + ", ".join(unknown))
        summary = f"{ctype}: {status}" + (f" ({'; '.join(bits)})" if bits else "")
        out.append(
            _evidence(
                id=f"{EV_CHECK}:{ctype}",
                kind="verification_check",
                label=ctype,
                summary=summary,
                statement_type=STATEMENT_FACT,
                status=status,
                source_url=check.source_url,
                checked_at=_iso(check.checked_at),
                data={
                    "matched_fields": matched,
                    "mismatched_fields": mismatched,
                    "unknown_fields": unknown,
                },
            )
        )

    # Checks that were expected but never performed must be visible, otherwise
    # the assistant could imply a check happened.
    analysis_data = dict(analysis.result_json or {}) if analysis is not None else {}
    performed_in_result = {
        str(c.get("check_type"))
        for c in (analysis_data.get("verification") or [])
        if c.get("check_type")
    }
    known = seen | performed_in_result
    for ctype in EXPECTED_CHECKS:
        if ctype in known:
            continue
        out.append(
            _evidence(
                id=f"{EV_CHECK}:{ctype}",
                kind="verification_check",
                label=ctype,
                summary=f"{ctype}: not_checked (not performed for this analysis)",
                statement_type=STATEMENT_FACT,
                status="not_checked",
                data={"matched_fields": [], "mismatched_fields": [], "unknown_fields": []},
            )
        )
    return out


def build_community_evidence(
    reports: list[CommunityReport],
) -> list[dict[str, Any]]:
    """Approved community reports only (moderation gate)."""
    out: list[dict[str, Any]] = []
    approved = [
        r
        for r in reports
        if str(getattr(r, "moderation_status", "") or "") == "approved"
    ]
    if not approved:
        return out
    categories: dict[str, int] = {}
    for r in approved:
        cat = str(getattr(r, "category", "other") or "other")
        categories[cat] = categories.get(cat, 0) + 1
    out.append(
        _evidence(
            id=EV_COMMUNITY,
            kind="community",
            label="Approved community reports",
            summary=(
                f"{len(approved)} moderator-approved user report(s) mention this entity "
                f"(categories: {', '.join(sorted(categories))}). "
                "User-submitted; not verified facts."
            ),
            statement_type=STATEMENT_USER_REPORT,
            status="approved_reports",
            data={
                "approved_report_count": len(approved),
                "categories": sorted(categories),
                "labels": ["community_reports_exist"],
            },
        )
    )
    return out


def build_resource_evidence(resources: dict[str, Any]) -> list[dict[str, Any]]:
    """Official cyber resources from configuration."""
    out: list[dict[str, Any]] = []
    for r in resources.get("resources") or []:
        rid = str(r.get("id") or "")
        if not rid:
            continue
        target = r.get("href") or r.get("url") or r.get("email") or r.get("tel") or ""
        out.append(
            _evidence(
                id=f"{EV_RESOURCE}:{rid}",
                kind="resource",
                label=str(r.get("label") or rid),
                summary=f"{r.get('label')} — {target}".strip(" —"),
                statement_type=STATEMENT_FACT,
                status=str(r.get("type") or ""),
                source_url=r.get("url"),
                data={
                    "type": r.get("type"),
                    "tel": r.get("tel"),
                    "href": r.get("href"),
                    "email": r.get("email"),
                    "primary": bool(r.get("primary")),
                },
            )
        )
    return out


async def load_evidence_pack(
    db: AsyncSession,
    *,
    analysis: JobAnalysis | None,
    resources: dict[str, Any],
    company_id: Any = None,
) -> list[dict[str, Any]]:
    """Assemble the full evidence pack for one session."""
    pack: list[dict[str, Any]] = []
    pack.extend(build_analysis_evidence(analysis))
    pack.extend(build_check_evidence(analysis, await _load_checks(db, analysis, company_id)))
    pack.extend(build_community_evidence(await _load_reports(db, company_id)))
    pack.extend(build_resource_evidence(resources))
    return pack


async def _load_checks(
    db: AsyncSession,
    analysis: JobAnalysis | None,
    company_id: Any,
) -> list[VerificationCheck]:
    try:
        if analysis is not None:
            stmt = select(VerificationCheck).where(
                VerificationCheck.entity_id == str(analysis.id),
                VerificationCheck.entity_type == "job_analysis",
            )
        elif company_id is not None:
            stmt = select(VerificationCheck).where(
                VerificationCheck.entity_id == str(company_id),
                VerificationCheck.entity_type == "company",
            )
        else:
            return []
        res = await db.execute(stmt)
        rows = res.scalars().all() if hasattr(res, "scalars") else []
        return list(rows)
    except Exception:
        return []


async def _load_reports(db: AsyncSession, company_id: Any) -> list[CommunityReport]:
    try:
        if company_id is None:
            return []
        stmt = select(CommunityReport).where(CommunityReport.company_id == company_id)
        res = await db.execute(stmt)
        rows = res.scalars().all() if hasattr(res, "scalars") else []
        return list(rows)
    except Exception:
        return []


def known_evidence_ids(pack: list[dict[str, Any]]) -> set[str]:
    return {str(e.get("id")) for e in pack if e.get("id")}


__all__ = [
    "ALLOWED_STATEMENT_TYPES",
    "EV_ANALYSIS",
    "EV_CHECK",
    "EV_COMMUNITY",
    "EV_FACTOR",
    "EV_RECOMMENDATION",
    "EV_RESOURCE",
    "EV_UNKNOWN",
    "STATEMENT_AI_INTERPRETATION",
    "STATEMENT_FACT",
    "STATEMENT_USER_REPORT",
    "build_analysis_evidence",
    "build_check_evidence",
    "build_community_evidence",
    "build_resource_evidence",
    "known_evidence_ids",
    "load_evidence_pack",
]
