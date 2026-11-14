from __future__ import annotations

import re
from typing import Any

# classification categories: ordinary, contact, identity, financial, credentials, other_sensitive

_PATTERNS: list[tuple[str, re.Pattern[str], str, str, str]] = [
    (
        "credentials",
        re.compile(r"\b(password|passcode|otp|one[- ]?time password|pin)\b", re.I),
        "Credentials/OTP",
        "Never share passwords, OTPs, or PINs with recruiters or for job applications.",
        "Refuse and verify the request through official company channels.",
    ),
    (
        "financial",
        re.compile(
            r"\b(bank account|account number|ifsc|iban|swift|credit card|debit card|"
            r"cvv|upi|wallet)\b",
            re.I,
        ),
        "Financial/banking details",
        "Financial details are rarely needed before formal onboarding and verified processes.",
        "Share only through verified HR/payroll systems after confirming legitimacy; "
        "never share OTP/CVV.",
    ),
    (
        "identity",
        re.compile(
            r"\b(aadhaar|aadhar|pan|passport|voter id|driving licence|driver'?s license|"
            r"ssn|national id)\b",
            re.I,
        ),
        "Government/identity ID",
        "Identity documents may be needed later in verified hiring, but not at early "
        "screening or via untrusted channels.",
        "Share redacted copies only after verifying employer/recruiter legitimacy and necessity.",
    ),
    (
        "contact",
        re.compile(r"\b(phone|mobile|email|address|home address|whatsapp|telegram)\b", re.I),
        "Contact information",
        "Basic contact details are commonly needed for communication, but should be shared "
        "cautiously.",
        "Use professional contact channels and avoid sharing unnecessary personal details.",
    ),
    (
        "other_sensitive",
        re.compile(r"\b(photo|selfie|medical|health|biometric|fingerprint|face scan)\b", re.I),
        "Sensitive personal data",
        "Sensitive personal data is usually not required for initial job screening.",
        "Ask why it is needed, how it will be stored, and avoid sharing unless necessary "
        "and verified.",
    ),
]


def _stage_necessity(category: str) -> str:
    if category == "credentials":
        return "Not appropriate at any hiring stage."
    if category == "financial":
        return (
            "Sometimes required only after verified offer/onboarding; not for application "
            "fees or screening."
        )
    if category == "identity":
        return (
            "May be required during verified onboarding/background checks; usually not at "
            "first contact."
        )
    if category == "contact":
        return "Commonly needed for legitimate communication during hiring."
    if category == "other_sensitive":
        return "Rarely needed; require strong justification and verified handling."
    return "May be relevant depending on role/stage; verify necessity."


def classify_items(items: list[str]) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    hard_warning = False
    for raw in items:
        item = (raw or "").strip()
        if not item:
            continue
        category = "ordinary"
        explanation = (
            "This information may be ordinary for a job application, but share only what "
            "is necessary."
        )
        safer = "Provide only relevant details and confirm who will receive them."
        matched = None
        for cat, pat, label, expl, safe in _PATTERNS:
            if pat.search(item):
                category = cat
                explanation = expl
                safer = safe
                matched = label
                break
        if category == "credentials":
            hard_warning = True
        # extra hard-warning triggers
        if re.search(r"\b(cvv|banking credentials|otp)\b", item, re.I):
            hard_warning = True
            if "otp" in item.lower() or "credential" in item.lower():
                category = "credentials"
        results.append(
            {
                "item": item,
                "category": category,
                "matched_as": matched,
                "necessity_by_stage": _stage_necessity(category),
                "why_may_be_unnecessary": explanation,
                "safer_alternative": safer,
            }
        )

    grouped: dict[str, list[dict[str, Any]]] = {}
    for r in results:
        grouped.setdefault(r["category"], []).append(r)

    warning_msg = (
        "Never share passwords, OTPs, banking credentials, or CVV with anyone. "
        "Legitimate employers do not need these for hiring."
    )
    return {
        "results": results,
        "grouped": grouped,
        "hard_warning": hard_warning,
        "hard_warning_message": warning_msg if hard_warning else None,
        "note": (
            "Do not upload unredacted ID or financial documents here. Share sensitive "
            "information only after independent verification."
        ),
    }


def exposure_response(items: list[str]) -> dict[str, Any]:
    """Public API shape for POST /data-exposure/check.

    Wraps :func:`classify_items` and exposes both the canonical service keys
    (``results``/``hard_warning``) and the client-facing aliases
    (``items``/``has_high_risk``/``guidance``) so the frontend contract in
    ``docs/06-API-CONTRACT.md`` matches what the service actually returns.
    """
    data = classify_items(items)
    results = data["results"]
    guidance: list[str] = [data["note"]]
    if data["hard_warning_message"]:
        guidance.insert(0, data["hard_warning_message"])

    # Normalise each item to the client contract while keeping the canonical
    # service keys so both consumers stay in sync.
    items_out: list[dict[str, Any]] = []
    for r in results:
        category = str(r.get("category") or "ordinary")
        items_out.append(
            {
                **r,
                "categories": [category],
                "necessity": {
                    "by_stage": r.get("necessity_by_stage"),
                    "why_may_be_unnecessary": r.get("why_may_be_unnecessary"),
                },
                "warning": data["hard_warning_message"] if data["hard_warning"] else None,
                "safer_alternatives": [r.get("safer_alternative")],
            }
        )

    return {
        "items": items_out,
        "results": items_out,
        "grouped": data["grouped"],
        "has_high_risk": data["hard_warning"],
        "hard_warning": data["hard_warning"],
        "hard_warning_message": data["hard_warning_message"],
        "guidance": guidance,
        "note": data["note"],
    }
