from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from app.services.analyzer.detectors import RawFactor
from app.services.analyzer.service import analyze as run_analyze
from app.services.verification.company import run_company_verification
from app.services.verification.recruiter import verify_recruiter

from .extraction import ExtractionResult


def _domain_of(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if "@" in v:
        return v.split("@", 1)[1]
    try:
        p = urlparse(v if "://" in v else f"https://{v}")
        host = (p.hostname or "").lower().strip(".")
        return host or None
    except Exception:
        m = re.search(r"\b([a-z0-9.-]+\.[a-z]{2,})\b", v)
        return m.group(1).lower() if m else None


async def analyze_offer_letter(
    *,
    extraction: ExtractionResult,
    consent: bool,
    keep_file: bool,
) -> dict[str, Any]:
    _ = consent, keep_file  # recorded by caller; LLM disabled by default
    fields = extraction.fields or {}
    text = extraction.text or ""
    notes = list(extraction.notes or [])

    if extraction.status == "inconclusive" or not text.strip():
        return {
            "assessment_type": "decision_support",
            "risk_score": None,
            "risk_band": "insufficient_information",
            "summary": "Offer letter text could not be extracted reliably.",
            "risk_factors": [],
            "verification": [],
            "unknowns": [
                "Offer letter extraction was inconclusive; no reliable text could be analyzed."
            ],
            "missing_information": [
                "Readable offer letter text (clear PDF text layer or legible image)."
            ],
            "recommendations": [
                {
                    "code": "VERIFY_COMPANY_IDENTITY",
                    "priority": 2,
                    "text_key": "rec.verify_company_identity",
                },
                {
                    "code": "NEVER_SHARE_CREDENTIALS",
                    "priority": 3,
                    "text_key": "rec.never_share_credentials",
                },
            ],
            "extraction": {
                "status": extraction.status,
                "confidence": extraction.confidence,
                "method": extraction.method,
                "fields": fields,
                "notes": notes,
            },
            "disclaimer_key": "disclaimer.decision_support",
        }

    # feed extracted text through analyzer
    company_name = fields.get("company_name")
    contacts = fields.get("contacts") or []
    recruiter_contact = contacts[0] if contacts else None
    domains = fields.get("domains") or []
    company_website = None
    for u in (fields.get("urls") or []):
        if u:
            company_website = u
            break
    if not company_website and domains:
        company_website = f"https://{domains[0]}"

    evidence: list[RawFactor] = []
    verification: list[dict[str, Any]] = []

    # run company check if enough info
    company_check: dict[str, Any] | None = None
    email_contact = next((c for c in contacts if "@" in str(c)), None)
    email_domain = (
        email_contact.split("@", 1)[1] if email_contact and "@" in email_contact else None
    )
    if company_name or company_website:
        try:
            company_check = await run_company_verification(
                company_name=str(company_name) if company_name else "Unknown company",
                website=str(company_website) if company_website else None,
                email_domain=email_domain,
            )
            verification.append(
                {
                    "check_type": "company_identity",
                    "status": company_check.get("overall_status"),
                    "matched_fields": [],
                    "mismatched_fields": [],
                    "unknown_fields": [],
                    "source_url": (
                        (company_check.get("checks") or [{}])[0].get("source_url")
                        if company_check.get("checks")
                        else None
                    ),
                    "checked_at": company_check.get("checked_at"),
                }
            )
        except Exception:
            notes.append("Company verification could not be completed.")
            company_check = None

    recruiter_check: dict[str, Any] | None = None
    # try recruiter check on first email/contact (best-effort, no fabricated identity claims)
    if email_contact and (company_name or company_website):
        try:
            recruiter_check = await verify_recruiter(
                recruiter_name="Recruiter (from offer letter)",
                claimed_company=str(company_name) if company_name else "Unknown company",
                claimed_role=None,
                email=str(email_contact),
                profile_url=None,
                company_website=str(company_website) if company_website else None,
            )
            verification.append(
                {
                    "check_type": "recruiter_affiliation",
                    "status": recruiter_check.get("overall_status"),
                    "matched_fields": [],
                    "mismatched_fields": [],
                    "unknown_fields": [],
                    "source_url": None,
                    "checked_at": recruiter_check.get("checked_at"),
                }
            )
        except Exception:
            notes.append("Recruiter verification could not be completed.")
            recruiter_check = None

    # OFFER_CONTACT_MISMATCH only on actual mismatch with independently verified info
    mismatch_reasons: list[str] = []
    if recruiter_check:
        rc_checks = recruiter_check.get("checks") or []
        for c in rc_checks:
            if c.get("status") == "mismatch":
                detail = (
                    c.get("detail")
                    or c.get("check_type")
                    or c.get("type")
                    or "recruiter_mismatch"
                )
                mismatch_reasons.append(str(detail))
        if recruiter_check.get("overall_status") == "mismatch":
            mismatch_reasons.append("recruiter_verification_mismatch")
        # explicit mismatches list if present
        for m in recruiter_check.get("mismatches") or []:
            mismatch_reasons.append(str(m))
    if company_check and company_check.get("overall_status") == "mismatch":
        mismatch_reasons.append("company_verification_mismatch")

    # compare extracted email domain vs company website domain only when evidence indicates mismatch
    web_domain = _domain_of(company_website)
    extracted_email_domain = _domain_of(email_contact) if email_contact else None
    if web_domain and extracted_email_domain and web_domain != extracted_email_domain:
        if company_check and company_check.get("overall_status") == "mismatch":
            mismatch_reasons.append("offer_contact_domain_differs_from_company_domain")

    if mismatch_reasons:
        excerpt_src = email_contact or (domains[0] if domains else "offer contact")
        evidence.append(
            RawFactor(
                code="OFFER_CONTACT_MISMATCH",
                severity="high",
                confidence="high",
                explanation=(
                    "Contact details in the offer letter do not align with independently verified "
                    "company or recruiter information."
                ),
                excerpt=str(excerpt_src)[:200],
                span_start=None,
                span_end=None,
                source_type="offer_letter",
                evidence_key=f"offer:contact_mismatch:{'|'.join(sorted(set(mismatch_reasons)))[:120]}",
            )
        )

    base = run_analyze(
        title="Offer letter review",
        description=text[:20000],
        company_name=str(company_name) if company_name else None,
        recruiter_contact=str(recruiter_contact) if recruiter_contact else None,
        company_website=str(company_website) if company_website else None,
        evidence=evidence,
    )
    base["verification"] = verification or base.get("verification", [])
    base["extraction"] = {
        "status": extraction.status,
        "confidence": extraction.confidence,
        "method": extraction.method,
        "fields": fields,
        "notes": notes,
    }
    # ensure privacy: never include raw file contents
    return base
