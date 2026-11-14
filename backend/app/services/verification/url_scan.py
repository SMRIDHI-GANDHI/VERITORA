from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from typing import Any

from app.core.ssrf import SSRFBlockedError, safe_fetch, validate_url

NOTICE = (
    "Only public pages are accessed; scripts are not executed and site access rules are respected."
)
MANUAL_PASTE_BLOCKED = (
    "URL could not be fetched safely. Please copy and paste the job details manually for analysis."
)
MANUAL_PASTE_LIMITED = (
    "The page could not be processed. Please paste the job details manually."
)


def _extract_jsonld_jobposting(html: str) -> dict[str, Any]:
    # very lightweight extraction: find application/ld+json blocks and look for JobPosting
    out: dict[str, Any] = {}
    pattern = r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    for m in re.finditer(pattern, html, re.IGNORECASE | re.DOTALL):
        raw = m.group(1).strip()
        try:
            data = json.loads(raw)
        except Exception:
            continue
        candidates = data if isinstance(data, list) else [data]
        for obj in candidates:
            if not isinstance(obj, dict):
                continue
            t = obj.get("@type")
            types = t if isinstance(t, list) else [t]
            if "JobPosting" not in [str(x) for x in types]:
                # also check @graph
                graph = obj.get("@graph")
                if isinstance(graph, list):
                    for g in graph:
                        if isinstance(g, dict):
                            gt = g.get("@type")
                            gtypes = gt if isinstance(gt, list) else [gt]
                            if "JobPosting" in [str(x) for x in gtypes]:
                                obj = g
                                types = gtypes
                                break
                if "JobPosting" not in [str(x) for x in types]:
                    continue
            out["title"] = out.get("title") or obj.get("title")
            desc = obj.get("description")
            if isinstance(desc, str):
                out["description"] = out.get("description") or re.sub("<[^>]+>", " ", desc)
            org = obj.get("hiringOrganization")
            if isinstance(org, dict):
                out["company_name"] = out.get("company_name") or org.get("name")
                same = org.get("sameAs")
                if isinstance(same, str):
                    out["company_website"] = out.get("company_website") or same
            loc = obj.get("jobLocation")
            if isinstance(loc, dict):
                addr = loc.get("address")
                if isinstance(addr, dict):
                    locality = addr.get("addressLocality") or addr.get("addressRegion")
                    out["location"] = out.get("location") or locality
            if isinstance(loc, list) and loc and isinstance(loc[0], dict):
                addr = loc[0].get("address")
                if isinstance(addr, dict):
                    out["location"] = out.get("location") or addr.get("addressLocality")
            return {k: v for k, v in out.items() if v}
    return out


def _extract_basic_fields(html: str, final_url: str) -> dict[str, Any]:
    fields: dict[str, Any] = {}
    # title tag
    m = re.search(r"<title[^>]*>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    if m:
        title = re.sub(r"\s+", " ", re.sub("<[^>]+>", " ", m.group(1))).strip()
        fields["title"] = title[:200]
    # meta description
    pat1 = r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']'
    pat2 = r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']'
    m = re.search(pat1, html, re.IGNORECASE | re.DOTALL)
    if not m:
        m = re.search(pat2, html, re.IGNORECASE | re.DOTALL)
    if m:
        fields["description"] = re.sub(r"\s+", " ", m.group(1)).strip()[:2000]
    # canonical/company hints minimal
    fields["source_url"] = final_url
    return {k: v for k, v in fields.items() if v}


async def scan_public_url(url: str) -> dict[str, Any]:
    now = datetime.now(UTC).isoformat()
    try:
        validate_url(url)
    except SSRFBlockedError as e:
        return {
            "url": url,
            "status": "blocked",
            "blocked_reason": str(e),
            "extracted_fields": {},
            "extraction_confidence": "none",
            "checked_at": now,
            "manual_paste_fallback": MANUAL_PASTE_BLOCKED,
            "notice": NOTICE,
        }
    try:
        res = await safe_fetch(url)
        if res.status_code >= 400:
            return {
                "url": url,
                "final_url": res.final_url,
                "status": "limited",
                "blocked_reason": f"HTTP {res.status_code}",
                "extracted_fields": {},
                "extraction_confidence": "none",
                "checked_at": now,
                "manual_paste_fallback": MANUAL_PASTE_LIMITED,
                "notice": NOTICE,
            }
        # fetch full-ish html again? safe_fetch returns snippet; for extraction we need more.
        # re-fetch within limits to get body text for parsing
        import httpx

        target = res.final_url or url
        validate_url(target)
        headers = {"User-Agent": "VERITORA-SafeFetch/1.0"}
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=10.0,
            headers=headers,
        ) as client:
            r2 = await client.get(target)
            html = r2.text[: 2 * 1024 * 1024]
        jsonld = _extract_jsonld_jobposting(html)
        basic = _extract_basic_fields(html, target)
        extracted = {**basic, **jsonld}
        # ensure description is plain-ish
        if extracted.get("description"):
            desc = re.sub(r"\s+", " ", str(extracted["description"])).strip()
            extracted["description"] = desc[:20000]
        confidence = "medium" if jsonld else ("low" if extracted else "none")
        return {
            "url": url,
            "final_url": target,
            "status": "ok",
            "extracted_fields": extracted,
            "extraction_confidence": confidence,
            "checked_at": now,
            "manual_paste_fallback": "Review and edit extracted fields before analysis.",
            "notice": NOTICE,
        }
    except SSRFBlockedError as e:
        return {
            "url": url,
            "status": "blocked",
            "blocked_reason": str(e),
            "extracted_fields": {},
            "extraction_confidence": "none",
            "checked_at": now,
            "manual_paste_fallback": MANUAL_PASTE_BLOCKED,
            "notice": NOTICE,
        }
    except Exception:
        return {
            "url": url,
            "status": "limited",
            "blocked_reason": "Fetch failed",
            "extracted_fields": {},
            "extraction_confidence": "none",
            "checked_at": now,
            "manual_paste_fallback": MANUAL_PASTE_LIMITED,
            "notice": NOTICE,
        }
