from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.ssrf import SSRFBlockedError, safe_fetch, validate_url
from app.services.verification.company import _normalize_domain, run_company_verification

GENERIC_DOMAINS = {
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "rediffmail.com",
}

SAFE_NEXT_STEP = (
    "Contact the company via independently sourced official channels before sharing information "
    "or taking action."
)


def _email_domain(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    return email.rsplit("@", 1)[-1].strip().lower().strip(".") or None


async def verify_recruiter(
    *,
    recruiter_name: str,
    claimed_company: str,
    claimed_role: str | None = None,
    email: str | None = None,
    profile_url: str | None = None,
    company_website: str | None = None,
) -> dict[str, Any]:
    now = datetime.now(UTC)
    email_dom = _email_domain(email)
    checks: list[dict[str, Any]] = []
    unknowns: list[str] = []
    mismatches: list[str] = []
    evidence: list[dict[str, Any]] = []

    # base company verification for independently identified company context
    company_ver = await run_company_verification(
        company_name=claimed_company,
        website=company_website,
        email_domain=email_dom,
    )
    checks.extend(company_ver.get("checks", []))

    # recruiter affiliation assessment
    aff_status = "inconclusive"
    matched_fields: list[str] = []
    mismatched_fields: list[str] = []
    unknown_fields: list[str] = []
    details: dict[str, Any] = {
        "email_domain": email_dom,
        "company_website": company_website,
        "claimed_company": claimed_company,
    }

    if not email_dom:
        unknown_fields.append("recruiter_email")
        unknowns.append("Recruiter email was not provided; affiliation cannot be compared.")
    else:
        details["generic_provider"] = email_dom in GENERIC_DOMAINS
        if email_dom in GENERIC_DOMAINS:
            unknown_fields.extend(["recruiter_affiliation", "email_domain"])
            unknowns.append(
                "Recruiter uses a generic email provider; this is not proof of affiliation "
                "or fraud."
            )
            aff_status = "inconclusive"
        else:
            web_dom = _normalize_domain(company_website)
            if not web_dom:
                unknown_fields.extend(["company_website", "recruiter_affiliation"])
                unknowns.append(
                    "Company website/domain was not independently provided; recruiter "
                    "affiliation remains unconfirmed."
                )
                aff_status = "inconclusive"
            elif (
                email_dom == web_dom
                or email_dom.endswith("." + web_dom)
                or web_dom.endswith("." + email_dom)
            ):
                matched_fields.append("email_domain")
                aff_status = "consistent"
                evidence.append(
                    {
                        "type": "email_domain_alignment",
                        "detail": "Recruiter email domain aligns with provided company domain.",
                        "source_url": f"https://{web_dom}",
                    }
                )
            else:
                mismatched_fields.append("email_domain")
                mismatches.append(
                    "Recruiter email domain does not match the provided company domain."
                )
                aff_status = "mismatch"

    web_dom = _normalize_domain(company_website)
    source_url = f"https://{web_dom}" if web_dom else None
    checks.append(
        {
            "check_type": "recruiter_affiliation",
            "status": aff_status,
            "matched_fields": matched_fields,
            "mismatched_fields": mismatched_fields,
            "unknown_fields": unknown_fields,
            "source_url": source_url,
            "checked_at": now.isoformat(),
            "details": details,
        }
    )

    # optional public profile safe fetch
    if profile_url:
        try:
            validate_url(profile_url)
            res = await safe_fetch(profile_url)
            reachable = res.status_code < 400
            checks.append(
                {
                    "check_type": "recruiter_profile_fetch",
                    "status": "information_found" if reachable else "inconclusive",
                    "matched_fields": ["profile_reachable"] if reachable else [],
                    "mismatched_fields": [],
                    "unknown_fields": [] if reachable else ["profile_content"],
                    "source_url": res.final_url or profile_url,
                    "checked_at": now.isoformat(),
                    "details": {"status_code": res.status_code, "title": res.title},
                }
            )
            if reachable:
                evidence.append(
                    {
                        "type": "public_profile",
                        "detail": "Public profile URL was reachable.",
                        "source_url": res.final_url or profile_url,
                    }
                )
        except SSRFBlockedError as e:
            checks.append(
                {
                    "check_type": "recruiter_profile_fetch",
                    "status": "inconclusive",
                    "matched_fields": [],
                    "mismatched_fields": [],
                    "unknown_fields": ["profile_content"],
                    "source_url": profile_url,
                    "checked_at": now.isoformat(),
                    "details": {"reason": str(e), "error_class": "blocked"},
                }
            )
        except Exception as e:
            checks.append(
                {
                    "check_type": "recruiter_profile_fetch",
                    "status": "inconclusive",
                    "matched_fields": [],
                    "mismatched_fields": [],
                    "unknown_fields": ["profile_content"],
                    "source_url": profile_url,
                    "checked_at": now.isoformat(),
                    "details": {"error_class": e.__class__.__name__},
                }
            )
    else:
        unknowns.append("No public profile URL provided.")

    overall = "inconclusive"
    statuses = {c.get("status") for c in checks}
    if "mismatch" in statuses:
        overall = "mismatch"
    elif "consistent" in statuses:
        overall = "consistent"
    elif "information_found" in statuses:
        overall = "information_found"
    elif statuses and statuses.issubset({"not_checked", "inconclusive"}):
        overall = "not_checked" if "not_checked" in statuses else "inconclusive"

    return {
        "recruiter_name": recruiter_name,
        "claimed_role": claimed_role,
        "claimed_company": claimed_company,
        "checks": checks,
        "evidence": evidence,
        "mismatches": mismatches,
        "unknowns": unknowns,
        "overall_status": overall,
        "safe_next_step": SAFE_NEXT_STEP,
        "checked_at": now.isoformat(),
    }
