from __future__ import annotations

from typing import Any

from app.services.analyzer.detectors import RawFactor, detect_text_factors
from app.services.risk.engine import compute_risk


def analyze(
    *,
    title: str,
    description: str,
    company_name: str | None = None,
    salary_text: str | None = None,
    experience_level: str | None = None,
    location: str | None = None,
    application_instructions: str | None = None,
    recruiter_contact: str | None = None,
    company_website: str | None = None,
    evidence: list[RawFactor] | None = None,
) -> dict[str, Any]:
    # detect in description first (spans mapped to original description text)
    factors: list[RawFactor] = []
    notes: list[str] = []

    d_factors, d_notes = detect_text_factors(description or "")
    factors.extend(d_factors)
    notes.extend(d_notes)

    # scan other text fields (field-local spans; included as supporting signals)
    for field_name, val in [
        ("title", title or ""),
        ("application_instructions", application_instructions or ""),
        ("recruiter_contact", recruiter_contact or ""),
        ("company_name", company_name or ""),
    ]:
        if not val:
            continue
        ffs, _ = detect_text_factors(val)
        for f in ffs:
            # avoid duplicating identical code+excerpt from description; keep if new
            if any(x.code == f.code and x.excerpt == f.excerpt for x in factors):
                continue
            # spans refer to that field's text; mark source
            f.source_type = f"job_text:{field_name}"
            f.evidence_key = f"{f.code}:{field_name}:{f.excerpt}"
            factors.append(f)

    if evidence:
        factors.extend(evidence)

    risk = compute_risk(
        factors,
        coverage={},
        input_length=len(description or ""),
        extra_unknowns=[],
    )

    unknowns = list(risk.get("unknowns") or [])
    # if very little info
    missing: list[str] = []
    if not company_name:
        missing.append("Company name")
    if not company_website:
        missing.append("Official company website/careers page link")
    if not recruiter_contact:
        missing.append("Recruiter contact details for independent verification")
    if not description or len(description) < 80:
        missing.append("Detailed job description")

    if (risk.get("risk_score") or 0) >= 50:
        summary = "Several warning signs need independent verification."
    elif risk.get("risk_band") == "insufficient_information":
        summary = "Not enough information to assess this posting."
    else:
        summary = (
            "No strong warning signs detected from the provided information. "
            "Verify independently before proceeding."
        )

    result = {
        "assessment_type": "decision_support",
        "rules_version": risk["rules_version"],
        "risk_score": risk["risk_score"],
        "risk_band": risk["risk_band"],
        "summary": summary,
        "risk_factors": [
            {
                "code": f["code"],
                "severity": f["severity"],
                "confidence": f["confidence"],
                "evidence": {
                    "excerpt": f.get("excerpt"),
                    "span": (
                        {"start": f["span_start"], "end": f["span_end"]}
                        if f.get("span_start") is not None and f.get("span_end") is not None
                        else None
                    ),
                },
                "source": {"type": f.get("source_type") or "job_text"},
                "explanation": f.get("explanation"),
                "evidence_key": f.get("evidence_key"),
            }
            for f in risk["factors"]
        ],
        "verification": [],
        "unknowns": unknowns,
        "missing_information": missing,
        "recommendations": risk["recommendations"],
        "community": {
            "approved_report_count": 0,
            "labels": [],
            "note": "User-submitted; not verified facts.",
        },
        "disclaimer_key": "disclaimer.decision_support",
        "notes": notes,
        "coverage": risk.get("coverage", {}),
    }
    return result
