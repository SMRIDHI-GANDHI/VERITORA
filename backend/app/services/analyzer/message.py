from __future__ import annotations

from typing import Any

from app.services.analyzer.detectors import RawFactor, detect_text_factors
from app.services.risk.engine import compute_risk


def analyze_messages(messages: list[dict[str, str]]) -> dict[str, Any]:
    factors: list[RawFactor] = []
    notes: list[str] = []
    combined_parts: list[str] = []
    per_msg_factors: list[tuple[int, list[RawFactor]]] = []

    for idx, msg in enumerate(messages):
        text = msg.get("text") or ""
        sender = msg.get("sender") or "unknown"
        combined_parts.append(f"[{idx}:{sender}] {text}")
        m_factors, m_notes = detect_text_factors(text)
        per_msg_factors.append((idx, m_factors))
        for f in m_factors:
            # annotate span with message context
            f.source_type = f"message:{idx}:{sender}"
            excerpt = (f.excerpt or "").lower()
            f.evidence_key = (
                f"{f.code}:msg{idx}:{f.span_start}:{f.span_end}:{excerpt}"
            )
            factors.append(f)
        notes.extend(m_notes)

    # simple escalation heuristic across turns: pressure/urgency appears later after benign start
    # or payment ask appears in later message
    pay_indices = [
        idx
        for idx, mfs in per_msg_factors
        for f in mfs
        if f.code == "UPFRONT_PAYMENT"
    ]
    urgency_indices = [
        idx
        for idx, mfs in per_msg_factors
        for f in mfs
        if f.code == "ARTIFICIAL_URGENCY"
    ]
    escalates = (pay_indices and any(i >= 1 for i in pay_indices)) or (
        urgency_indices and pay_indices and max(pay_indices) >= min(urgency_indices)
    )
    if escalates:
        key_ids = sorted(set(pay_indices + urgency_indices))
        conv_key = "-".join(map(str, key_ids)) or "na"
        factors.append(
            RawFactor(
                code="ESCALATING_PRESSURE",
                severity="medium",
                confidence="medium",
                explanation=(
                    "Conversation shows escalating pressure or a delayed payment request "
                    "across messages."
                ),
                excerpt=None,
                span_start=None,
                span_end=None,
                evidence_key=f"ESCALATING_PRESSURE:conv:{conv_key}",
                source_type="conversation",
            )
        )

    risk = compute_risk(
        factors,
        coverage={},
        input_length=len("\n".join(combined_parts)),
        extra_unknowns=[],
    )
    missing: list[str] = []
    if len(messages) < 2:
        missing.append("More conversation context (multiple messages) for escalation analysis")

    if risk.get("risk_band") == "insufficient_information":
        summary = "Not enough information to assess this conversation."
    else:
        summary = "Conversation analyzed for warning signs and escalation patterns."

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
                "source": {"type": f.get("source_type") or "message"},
                "explanation": f.get("explanation"),
                "evidence_key": f.get("evidence_key"),
            }
            for f in risk["factors"]
        ],
        "verification": [],
        "unknowns": list(risk.get("unknowns") or []),
        "missing_information": missing,
        "recommendations": risk["recommendations"],
        "community": {
            "approved_report_count": 0,
            "labels": [],
            "note": "User-submitted; not verified facts.",
        },
        "disclaimer_key": "disclaimer.decision_support",
        "notes": notes,
    }
    return result
