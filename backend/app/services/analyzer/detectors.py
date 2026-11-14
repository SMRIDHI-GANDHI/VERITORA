from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]

from .normalize import NormalizedText, normalize_with_offsets, span_to_original


@dataclass
class RawFactor:
    code: str
    severity: str
    confidence: str
    explanation: str
    excerpt: str | None
    span_start: int | None
    span_end: int | None
    evidence_key: str
    source_type: str = "job_text"
    negation_noted: bool = False


_CONFIG_CACHE: dict[str, Any] | None = None


def load_signals_config() -> dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE
    path = Path(__file__).resolve().parents[2] / "config" / "signals.yaml"
    _CONFIG_CACHE = yaml.safe_load(path.read_text(encoding="utf-8"))
    return _CONFIG_CACHE


def _find_matches(norm: NormalizedText, pattern: str) -> list[tuple[int, int, str]]:
    out: list[tuple[int, int, str]] = []
    try:
        regex = re.compile(pattern, re.IGNORECASE | re.UNICODE)
    except re.error:
        return out
    for m in regex.finditer(norm.normalized):
        s, e = m.span()
        mapped = span_to_original(norm, s, e)
        if not mapped:
            continue
        excerpt = norm.original[mapped[0] : mapped[1]]
        out.append((mapped[0], mapped[1], excerpt))
    return out


def detect_text_factors(text: str) -> tuple[list[RawFactor], list[str]]:
    cfg = load_signals_config()
    signals = cfg.get("signals", {})
    norm = normalize_with_offsets(text)
    factors: list[RawFactor] = []
    notes: list[str] = []

    for code, spec in signals.items():
        patterns = spec.get("patterns") or []
        negations = spec.get("negations") or []
        if not patterns:
            continue
        matches: list[tuple[int, int, str]] = []
        for pat in patterns:
            matches.extend(_find_matches(norm, pat))
        if not matches:
            continue

        negated = False
        for neg in negations:
            if re.search(neg, norm.normalized, re.IGNORECASE | re.UNICODE):
                negated = True
                break

        # choose first/best match for span evidence
        ms, me, excerpt = sorted(matches, key=lambda x: (x[0], x[1] - x[0]))[0]
        if negated and code == "UPFRONT_PAYMENT":
            notes.append("Negation detected for upfront payment language; signal suppressed.")
            continue

        severity = str(spec.get("severity", "low"))
        confidence = str(spec.get("confidence", "medium"))
        explanation = str(spec.get("explanation", "Potential risk signal detected."))
        evidence_key = f"{code}:{ms}:{me}:{excerpt.lower()}"
        factors.append(
            RawFactor(
                code=code,
                severity=severity,
                confidence=confidence,
                explanation=explanation,
                excerpt=excerpt,
                span_start=ms,
                span_end=me,
                evidence_key=evidence_key,
                source_type="job_text",
                negation_noted=negated,
            )
        )
    return factors, notes
