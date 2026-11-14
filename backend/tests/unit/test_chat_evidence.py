from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from app.db.models.community_report import CommunityReport
from app.db.models.job_analysis import JobAnalysis
from app.db.models.verification_check import VerificationCheck
from app.services.chat.evidence import (
    EV_ANALYSIS,
    EV_CHECK,
    EV_COMMUNITY,
    EV_FACTOR,
    build_analysis_evidence,
    build_check_evidence,
    build_community_evidence,
    known_evidence_ids,
)


def _analysis(**overrides: Any) -> JobAnalysis:
    data = {
        "assessment_type": "decision_support",
        "rules_version": "rules-2026.11.1",
        "risk_score": 76,
        "risk_band": "very_high_concern",
        "summary": "Several warning signs need independent verification.",
        "risk_factors": [
            {
                "code": "UPFRONT_PAYMENT",
                "severity": "high",
                "confidence": "high",
                "explanation": "The text asks the candidate to pay money.",
                "evidence": {"excerpt": "pay Rs 2000 registration fee"},
                "source": {"type": "job_text"},
            }
        ],
        "verification": [],
        "unknowns": ["Recruiter affiliation has not been independently confirmed."],
        "missing_information": ["Official company careers page link"],
        "recommendations": [{"code": "DO_NOT_PAY", "priority": 1, "text_key": "rec.do_not_pay"}],
        "community": {"approved_report_count": 0, "labels": [], "note": "User-submitted."},
    }
    data.update(overrides)
    return JobAnalysis(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        risk_score=data.get("risk_score"),
        risk_band=data.get("risk_band") or "insufficient_information",
        assessment_type="decision_support",
        summary=data.get("summary"),
        rules_version="rules-2026.11.1",
        result_json=data,
        created_at=datetime.now(UTC),
    )


def _check(check_type: str, status: str) -> VerificationCheck:
    return VerificationCheck(
        id=uuid.uuid4(),
        entity_type="job_analysis",
        entity_id="e1",
        check_type=check_type,
        status=status,
        matched_fields=[],
        mismatched_fields=[],
        unknown_fields=[],
        source_url=None,
        checked_at=datetime.now(UTC),
    )


def _report(category: str, status: str) -> CommunityReport:
    return CommunityReport(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        company_name="Acme",
        category=category,
        description="secret raw description",
        moderation_status=status,
        public_summary="public summary",
        created_at=datetime.now(UTC),
    )


def test_analysis_evidence_has_stable_ids():
    pack = build_analysis_evidence(_analysis())
    ids = known_evidence_ids(pack)
    assert EV_ANALYSIS in ids
    assert f"{EV_FACTOR}:UPFRONT_PAYMENT" in ids
    assert "ev:unknown" in ids
    assert "ev:recommendation:DO_NOT_PAY" in ids


def test_insufficient_information_analysis_has_no_score_claim():
    analysis = _analysis(risk_score=None, risk_band="insufficient_information")
    pack = build_analysis_evidence(analysis)
    entry = next(e for e in pack if e["id"] == EV_ANALYSIS)
    assert "not enough information" in entry["summary"].lower()
    assert entry["data"]["risk_score"] is None


def test_not_performed_checks_are_present_as_unknown():
    """A check that never ran must be visible so the assistant can say so."""
    pack = build_check_evidence(_analysis(), [])
    ids = known_evidence_ids(pack)
    assert f"{EV_CHECK}:domain_consistency" in ids
    entry = next(e for e in pack if e["id"] == f"{EV_CHECK}:domain_consistency")
    assert entry["status"] == "not_checked"


def test_performed_check_is_present():
    pack = build_check_evidence(_analysis(), [_check("safe_fetch", "inconclusive")])
    entry = next(e for e in pack if e["id"] == f"{EV_CHECK}:safe_fetch")
    assert entry["status"] == "inconclusive"


def test_community_evidence_only_uses_approved_reports():
    reports = [
        _report("payment_request", "approved"),
        _report("impersonation_concern", "pending_review"),
        _report("suspicious_link", "rejected"),
    ]
    pack = build_community_evidence(reports)
    assert len(pack) == 1
    entry = pack[0]
    assert entry["id"] == EV_COMMUNITY
    assert entry["statement_type"] == "user_report"
    assert entry["data"]["approved_report_count"] == 1
    # The raw reporter description must never appear.
    assert "secret raw description" not in entry["summary"]


def test_no_community_evidence_without_approved_reports():
    assert build_community_evidence([_report("payment_request", "pending_review")]) == []
