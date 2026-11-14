from __future__ import annotations

import asyncio
import re
import unicodedata
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse

from app.core.ssrf import SSRFBlockedError, safe_fetch, validate_url
from app.services.verification.types import VerificationResult


def _normalize_domain(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip().lower()
    if "://" in v:
        try:
            v = urlparse(v).hostname or v
        except Exception:
            pass
    v = v.split("/")[0].split(":")[0].strip(".")
    return v or None


def _name_tokens(name: str | None) -> set[str]:
    if not name:
        return set()
    n = re.sub(r"[^a-z0-9\s]", " ", name.lower())
    stop = {"pvt", "ltd", "limited", "inc", "corp", "company", "co", "india", "private"}
    return {t for t in n.split() if len(t) > 2 and t not in stop}


def _confusable_normalize(s: str) -> str:
    # basic homoglyph folding for lookalike detection
    s = unicodedata.normalize("NFKC", s).lower()
    table = str.maketrans(
        {
            "0": "o",
            "1": "l",
            "3": "e",
            "5": "s",
            "@": "a",
            "|": "l",
            "¡": "i",
            "í": "i",
            "ì": "i",
            "ï": "i",
            "а": "a",  # cyrillic
            "е": "e",
            "о": "o",
            "р": "p",
            "с": "c",
            "у": "y",
            "х": "x",
            "м": "m",
            "н": "h",
        }
    )
    s = s.translate(table)
    # map rn -> m style confusion token
    s = s.replace("rn", "m")
    return s


def _levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            ins = cur[j - 1] + 1
            dele = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            cur.append(min(ins, dele, sub))
        prev = cur
    return prev[-1]


async def domain_consistency_check(
    company_name: str, website: str | None, email_domain: str | None
) -> VerificationResult:
    now = datetime.now(UTC)
    web_dom = _normalize_domain(website)
    email_dom = _normalize_domain(email_domain)
    matched: list[str] = []
    mismatched: list[str] = []
    unknown: list[str] = []
    details: dict[str, Any] = {"website_domain": web_dom, "email_domain": email_dom}

    if not web_dom and not email_dom:
        return VerificationResult(
            check_type="domain_consistency",
            status="not_checked",
            unknown_fields=["website", "email_domain"],
            checked_at=now,
            details={**details, "reason": "No website or email domain provided"},
        )

    if web_dom and email_dom:
        if (
            web_dom == email_dom
            or web_dom.endswith("." + email_dom)
            or email_dom.endswith("." + web_dom)
        ):
            matched.append("email_domain")
            status = "consistent"
        else:
            mismatched.append("email_domain")
            status = "mismatch"
    else:
        status = "information_found"
        if not web_dom:
            unknown.append("website")
        if not email_dom:
            unknown.append("email_domain")

    # name token hint vs domain
    tokens = _name_tokens(company_name)
    dom_for_name = web_dom or email_dom or ""
    if tokens and dom_for_name:
        if any(t in dom_for_name.replace("-", "") for t in tokens):
            matched.append("company_name")
        else:
            # not a hard mismatch alone, but note
            unknown.append("company_name_alignment")

    source = f"https://{web_dom}" if web_dom else None
    return VerificationResult(
        check_type="domain_consistency",
        status=status,  # type: ignore[arg-type]
        matched_fields=sorted(set(matched)),
        mismatched_fields=sorted(set(mismatched)),
        unknown_fields=sorted(set(unknown)),
        source_url=source,
        checked_at=now,
        details=details,
    )


async def lookalike_domain_check(
    website: str | None, company_name: str | None
) -> VerificationResult:
    now = datetime.now(UTC)
    dom = _normalize_domain(website)
    if not dom:
        return VerificationResult(
            check_type="lookalike_domain",
            status="not_checked",
            unknown_fields=["website"],
            checked_at=now,
            details={"reason": "No website domain provided"},
        )
    labels = dom.split(".")
    sld = labels[-2] if len(labels) >= 2 else labels[0]
    tld = labels[-1] if labels else ""
    suspicious_tlds = {"xyz", "top", "click", "info", "support", "gq", "tk", "ml"}
    folded = _confusable_normalize(sld)

    # compare against company name tokens folded
    tokens = {_confusable_normalize(t) for t in _name_tokens(company_name)}
    mismatched: list[str] = []
    matched: list[str] = []
    unknown: list[str] = []
    status = "information_found"
    details: dict[str, Any] = {"domain": dom, "folded_sld": folded, "tld": tld}

    # detect confusable/homoglyph: folded label differs from raw normalized label
    raw = re.sub(r"[^a-z0-9]", "", sld.lower())
    if folded != raw:
        mismatched.append("domain_characters")
        status = "mismatch"
        details["reason"] = "Potential homoglyph or confusable characters detected"

    # suspicious tld
    if tld in suspicious_tlds:
        unknown.append("tld_reputation")
        details["tld_flag"] = "suspicious_tld"

    # distance vs name token
    if tokens:
        dists = [(_levenshtein(folded, t), t) for t in tokens if t]
        if dists:
            best, best_t = min(dists, key=lambda x: x[0])
            details["best_name_distance"] = best
            details["best_name_token"] = best_t
            if 0 < best <= 2:
                mismatched.append("domain_similarity")
                status = "mismatch"
                details["reason"] = (
                    details.get("reason") or "Domain is very similar to company name"
                )
            elif best == 0:
                matched.append("company_name")

    return VerificationResult(
        check_type="lookalike_domain",
        status=status,  # type: ignore[arg-type]
        matched_fields=sorted(set(matched)),
        mismatched_fields=sorted(set(mismatched)),
        unknown_fields=sorted(set(unknown)),
        source_url=f"https://{dom}",
        checked_at=now,
        details=details,
    )


async def safe_fetch_check(website: str | None) -> VerificationResult:
    now = datetime.now(UTC)
    dom = _normalize_domain(website)
    if not dom:
        return VerificationResult(
            check_type="safe_fetch",
            status="not_checked",
            unknown_fields=["website"],
            checked_at=now,
            details={"reason": "No website provided"},
        )
    url = website if website and website.startswith(("http://", "https://")) else f"https://{dom}"
    try:
        validate_url(url)
    except SSRFBlockedError as e:
        return VerificationResult(
            check_type="safe_fetch",
            status="inconclusive",
            unknown_fields=["website_content"],
            source_url=url,
            checked_at=now,
            details={"error_class": "blocked", "reason": str(e)},
        )
    try:
        res = await safe_fetch(url)
        status = "information_found" if res.status_code < 400 else "inconclusive"
        matched = ["website_reachable"] if res.status_code < 400 else []
        unknown = [] if res.status_code < 400 else ["website_content"]
        return VerificationResult(
            check_type="safe_fetch",
            status=status,  # type: ignore[arg-type]
            matched_fields=matched,
            mismatched_fields=[],
            unknown_fields=unknown,
            source_url=res.final_url or url,
            checked_at=now,
            details={
                "status_code": res.status_code,
                "title": res.title,
                "redirect_chain": res.redirect_chain,
                "content_type": res.content_type,
            },
        )
    except SSRFBlockedError as e:
        return VerificationResult(
            check_type="safe_fetch",
            status="inconclusive",
            unknown_fields=["website_content"],
            source_url=url,
            checked_at=now,
            details={"error_class": "blocked", "reason": str(e)},
        )
    except Exception as e:
        return VerificationResult(
            check_type="safe_fetch",
            status="inconclusive",
            unknown_fields=["website_content"],
            source_url=url,
            checked_at=now,
            details={"error_class": e.__class__.__name__},
        )


async def community_report_lookup(company_id: str | None) -> VerificationResult:
    now = datetime.now(UTC)
    # B06 not implemented: no approved reports table/query available; return not_checked
    return VerificationResult(
        check_type="community_report_lookup",
        status="not_checked",
        unknown_fields=["community_reports"],
        checked_at=now,
        details={"reason": "Community reports not available"},
    )


async def registry_lookup_check(registration_id: str | None) -> VerificationResult:
    now = datetime.now(UTC)
    if not registration_id:
        return VerificationResult(
            check_type="registry_lookup",
            status="not_checked",
            unknown_fields=["registration_id"],
            checked_at=now,
            details={"reason": "No registration id provided"},
        )
    # config-gated stub without credentials
    return VerificationResult(
        check_type="registry_lookup",
        status="not_checked",
        unknown_fields=["registry"],
        checked_at=now,
        details={"reason": "Registry lookup not configured"},
    )


def _compute_overall(checks: list[VerificationResult]) -> str:
    statuses = {c.status for c in checks}
    if "mismatch" in statuses:
        return "mismatch"
    if statuses and statuses.issubset({"not_checked", "inconclusive"}):
        # prefer not_checked if nothing conclusive
        return "not_checked" if "not_checked" in statuses else "inconclusive"
    if "consistent" in statuses:
        return "consistent"
    if "information_found" in statuses:
        return "information_found"
    return "inconclusive"


async def run_company_verification(
    company_name: str,
    website: str | None = None,
    email_domain: str | None = None,
    registration_id: str | None = None,
    company_id: str | None = None,
) -> dict[str, Any]:
    async def _run(coro: Any, check_type: str) -> VerificationResult:
        try:
            return await asyncio.wait_for(coro, timeout=8.0)
        except Exception as e:
            return VerificationResult(
                check_type=check_type,
                status="inconclusive",
                unknown_fields=[],
                checked_at=datetime.now(UTC),
                details={"error_class": e.__class__.__name__},
            )

    results = await asyncio.gather(
        _run(domain_consistency_check(company_name, website, email_domain), "domain_consistency"),
        _run(lookalike_domain_check(website, company_name), "lookalike_domain"),
        _run(safe_fetch_check(website), "safe_fetch"),
        _run(community_report_lookup(company_id), "community_report_lookup"),
        _run(registry_lookup_check(registration_id), "registry_lookup"),
    )
    checks = list(results)
    overall = _compute_overall(checks)
    return {
        "checks": [c.to_dict() for c in checks],
        "overall_status": overall,
        "checked_at": max(c.checked_at for c in checks).isoformat()
        if checks
        else datetime.now(UTC).isoformat(),
    }
