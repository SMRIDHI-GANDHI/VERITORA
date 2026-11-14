from __future__ import annotations

from collections.abc import Sequence
from dataclasses import asdict, dataclass
from typing import Any

from app.services.analyzer.detectors import RawFactor

from .config import load_recommendations_config, load_weights, rules_version


@dataclass
class ScoredFactor:
    code: str
    severity: str
    confidence: str
    explanation: str
    excerpt: str | None
    span_start: int | None
    span_end: int | None
    evidence_key: str
    source_type: str = "job_text"
    source_id: str | None = None
    points: float = 0.0


def _band_for(score: int | None) -> str:
    if score is None:
        return "insufficient_information"
    if score <= 24:
        return "lower"
    if score <= 49:
        return "moderate"
    if score <= 74:
        return "high_concern"
    return "very_high_concern"


def _dedupe(factors: Sequence[RawFactor | ScoredFactor]) -> list[RawFactor | ScoredFactor]:
    sev_rank = {"info": 0, "low": 1, "medium": 2, "high": 3}
    best: dict[str, RawFactor | ScoredFactor] = {}
    for f in factors:
        k = f.evidence_key
        if k not in best or sev_rank.get(f.severity, 0) > sev_rank.get(best[k].severity, 0):
            best[k] = f
    return list(best.values())


def compute_risk(
    factors: list[RawFactor],
    *,
    coverage: dict[str, str] | None = None,
    input_length: int = 0,
    extra_unknowns: list[str] | None = None,
) -> dict[str, Any]:
    weights_cfg = load_weights()
    sev_mult = weights_cfg.get("severity_mult", {"info": 0, "low": 0.4, "medium": 0.7, "high": 1.0})
    conf_mult = weights_cfg.get("confidence_mult", {"low": 0.4, "medium": 0.7, "high": 1.0})
    code_weights = weights_cfg.get("weights", {})

    deduped = _dedupe(factors)
    scored: list[ScoredFactor] = []
    for f in deduped:
        w = float(code_weights.get(f.code, 10))
        sm = float(sev_mult.get(f.severity, 0.4))
        cm = float(conf_mult.get(f.confidence, 0.7))
        pts = w * sm * cm
        scored.append(
            ScoredFactor(
                code=f.code,
                severity=f.severity,
                confidence=f.confidence,
                explanation=f.explanation,
                excerpt=f.excerpt,
                span_start=f.span_start,
                span_end=f.span_end,
                evidence_key=f.evidence_key,
                source_type=getattr(f, "source_type", "job_text"),
                source_id=getattr(f, "source_id", None),
                points=pts,
            )
        )

    unknowns: list[str] = list(extra_unknowns or [])
    coverage = coverage or {}
    for k, v in coverage.items():
        if v in {"inconclusive", "not_checked"}:
            unknowns.append(f"{k}: {v}")

    # insufficient information
    checks_ran = any(
        v in {"checked", "consistent", "mismatch", "information_found"} for v in coverage.values()
    )
    if input_length < 60 and not checks_ran and not scored:
        if "Not enough information provided to assess this posting." not in unknowns:
            unknowns.append("Not enough information provided to assess this posting.")
        return {
            "risk_score": None,
            "risk_band": "insufficient_information",
            "factors": [],
            "unknowns": unknowns,
            "recommendations": _recommendations(scored, None),
            "rules_version": rules_version(),
            "coverage": coverage,
        }

    # diminishing returns
    prod = 1.0
    for s in scored:
        prod *= 1.0 - (min(max(s.points, 0.0), 100.0) / 100.0)
    score = int(round(100.0 * (1.0 - prod)))
    score = max(0, min(100, score))

    # guardrails
    codes = {s.code for s in scored}
    only_weak = codes and codes.issubset({"OFFPLATFORM_CONTACT", "VAGUE_EMPLOYER_OR_ROLE"})
    single_low_conf = len(scored) == 1 and scored[0].confidence == "low"
    if score > 49 and (only_weak or single_low_conf):
        score = 49

    band = _band_for(score)

    # if no factors at all but input is sufficient-ish, lower
    if not scored and score == 0:
        band = "lower"
        if "No strong warning signals detected from the provided information." not in " ".join(
            unknowns
        ):
            # not required, but keep clean
            pass

    return {
        "risk_score": score,
        "risk_band": band,
        "factors": [asdict(s) for s in scored],
        "unknowns": unknowns,
        "recommendations": _recommendations(scored, band),
        "rules_version": rules_version(),
        "coverage": coverage,
    }


def _recommendations(scored: list[ScoredFactor], band: str | None) -> list[dict[str, Any]]:
    cfg = load_recommendations_config().get("recommendations", [])
    present = {s.code for s in scored}
    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(code: str, priority: int, text_key: str) -> None:
        if code in seen:
            return
        seen.add(code)
        out.append({"code": code, "priority": priority, "text_key": text_key})

    for rec in cfg:
        trig = rec.get("trigger")
        code = rec.get("code")
        if not code:
            continue
        if trig == "ALWAYS":
            add(code, int(rec.get("priority", 3)), rec.get("text_key", ""))
        elif trig == "UPFRONT_PAYMENT" and "UPFRONT_PAYMENT" in present:
            add(code, int(rec.get("priority", 1)), rec.get("text_key", ""))
        elif trig == "SUSPICIOUS_URL" and "SUSPICIOUS_URL" in present:
            add(code, int(rec.get("priority", 2)), rec.get("text_key", ""))
        elif trig == "RECRUITER_MISMATCH" and ("RECRUITER_AFFILIATION_MISMATCH" in present):
            add(code, int(rec.get("priority", 2)), rec.get("text_key", ""))
        elif trig == "SENSITIVE_DATA_REQUEST" and "SENSITIVE_DATA_REQUEST" in present:
            add(code, int(rec.get("priority", 2)), rec.get("text_key", ""))
        elif trig == "OFFER_MISMATCH" and "CONTRADICTION" in present:
            add(code, int(rec.get("priority", 2)), rec.get("text_key", ""))
        elif trig == "OFFER_CONTACT_MISMATCH" and "OFFER_CONTACT_MISMATCH" in present:
            add(code, int(rec.get("priority", 2)), rec.get("text_key", ""))
        elif (
            trig == "HIGH_CONCERN_FINANCIAL"
            and band in {"high_concern", "very_high_concern"}
            and ("UPFRONT_PAYMENT" in present)
        ):
            add(code, int(rec.get("priority", 1)), rec.get("text_key", ""))

    out.sort(key=lambda x: (x["priority"], x["code"]))
    return out
