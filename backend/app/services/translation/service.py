from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

SUPPORTED_LANGUAGES = {"en", "hi"}


@lru_cache(maxsize=8)
def _load_catalog(lang: str) -> dict[str, Any]:
    lang = lang if lang in SUPPORTED_LANGUAGES else "en"
    path = Path(__file__).resolve().parents[2] / "config" / "i18n" / f"explanations_{lang}.json"
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def get_text(lang: str, section: str, key: str) -> str | None:
    cat = _load_catalog(lang)
    sec = cat.get(section)
    if isinstance(sec, dict):
        val = sec.get(key)
        if isinstance(val, str):
            return val
    return None


def translate_recommendations(
    recommendations: list[dict[str, Any]], language: str | None
) -> list[dict[str, Any]]:
    lang = (language or "en").lower()
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    out: list[dict[str, Any]] = []
    for r in recommendations:
        code = str(r.get("code") or "")
        text_key = str(r.get("text_key") or "")
        original = get_text("en", "recommendations", code) or text_key or code
        translated = get_text(lang, "recommendations", code)
        item = dict(r)
        item["text_original"] = original
        item["text"] = translated or original
        item["language"] = lang
        if lang != "en":
            item["translation"] = {
                "source_language": "en",
                "target_language": lang,
                "provider": "catalog",
                "confidence": "high" if translated else "low",
                "uncertain": translated is None,
                "note": "Machine-translated, may be inaccurate." if translated is None else None,
            }
        else:
            item["translation"] = {
                "source_language": "en",
                "target_language": "en",
                "provider": "original",
                "confidence": "high",
                "uncertain": False,
                "note": None,
            }
        out.append(item)
    return out


def translate_factors(
    factors: list[dict[str, Any]], language: str | None
) -> list[dict[str, Any]]:
    lang = (language or "en").lower()
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    out: list[dict[str, Any]] = []
    for f in factors:
        code = str(f.get("code") or "")
        original = str(f.get("explanation") or get_text("en", "factors", code) or "")
        translated = get_text(lang, "factors", code)
        item = dict(f)
        item["explanation_original"] = original
        if lang != "en" and translated:
            item["explanation"] = translated
            item["translation"] = {
                "source_language": "en",
                "target_language": lang,
                "provider": "catalog",
                "confidence": "high",
                "uncertain": False,
                "note": None,
            }
        elif lang != "en":
            item["explanation"] = original
            item["translation"] = {
                "source_language": "en",
                "target_language": lang,
                "provider": "catalog",
                "confidence": "low",
                "uncertain": True,
                "note": "Machine-translated, may be inaccurate.",
            }
        else:
            item["translation"] = {
                "source_language": "en",
                "target_language": "en",
                "provider": "original",
                "confidence": "high",
                "uncertain": False,
                "note": None,
            }
        out.append(item)
    return out


def get_disclaimer(language: str | None) -> dict[str, Any]:
    lang = (language or "en").lower()
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
    original = get_text("en", "disclaimer", "decision_support") or ""
    translated = get_text(lang, "disclaimer", "decision_support")
    return {
        "text_original": original,
        "text": translated or original,
        "language": lang,
        "translation_confidence": "high" if translated else "low",
        "uncertain": lang != "en" and translated is None,
    }


CLAUSE_RULES = [
    (
        r"\b(non[- ]?refundable|no refund)\b",
        (
            "This wording suggests you may not get money back. "
            "Verify terms carefully before paying anything."
        ),
    ),
    (
        r"\b(confidential|do not disclose|do not share)\b",
        (
            "This asks you to keep information secret. "
            "Be cautious if secrecy prevents independent verification."
        ),
    ),
    (
        r"\b(immediate|within \d+ hours?|today only|urgent)\b",
        (
            "Urgency pressure can be a manipulation tactic. "
            "Take time to verify through official channels."
        ),
    ),
    (
        r"\b(processing fee|registration fee|security deposit|training fee)\b",
        (
            "Requests for upfront payment require strong independent verification "
            "of the employer and process."
        ),
    ),
    (
        r"\b(guarantee|guaranteed|100%)\b",
        (
            "Absolute guarantees are uncommon in legitimate hiring and should be "
            "verified independently."
        ),
    ),
    (
        r"\b(whatsapp|telegram|personal email)\b",
        (
            "Requests to move off official channels can reduce accountability; "
            "verify contacts independently."
        ),
    ),
]


def explain_wording(text: str) -> dict[str, Any]:
    original = (text or "").strip()
    findings: list[dict[str, Any]] = []
    lowered = original.lower()
    for pattern, explanation in CLAUSE_RULES:
        m = re.search(pattern, lowered, re.I)
        if m:
            start, end = m.span()
            findings.append(
                {
                    "clause": original[start:end],
                    "explanation": explanation,
                    "confidence": "medium",
                    "method": "rule_based",
                }
            )
    if not findings:
        findings.append(
            {
                "clause": None,
                "explanation": (
                    "No specific manipulative or formal clause pattern was detected by rule-based "
                    "checks. Read carefully and verify key terms independently."
                ),
                "confidence": "low",
                "method": "rule_based",
            }
        )
    return {
        "original_text": original,
        "explanations": findings,
        "translation": {
            "provider": "none",
            "source_language": "unknown",
            "target_language": "en",
            "confidence": "high",
            "uncertain": False,
            "note": None,
        },
    }
