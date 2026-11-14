"""Input sanitisation for the verification chatbot.

Two independent concerns live here:

1. **Credential handling.** A user must never be able to store a password,
   OTP, PIN, banking credential or unredacted ID number through chat. Such a
   message is detected, refused and *not persisted*.

2. **Prompt-injection defence.** User text and any retrieved text are DATA.
   They are never concatenated into system instructions. Instruction-like
   content is stripped from the user's text, and whatever survives is wrapped
   in delimiters before it is handed to an LLM. The rule engine is never
   affected by injected text.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

MAX_MESSAGE_CHARS = 4000
MAX_MESSAGE_LINES = 60

# --- credential detection -------------------------------------------------
# Deliberately conservative about *values*: we detect requests for secrets and
# obvious secret material, not every mention of the word "password".
_CREDENTIAL_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "password",
        re.compile(
            r"\b(?:my\s+)?(?:password|passwd|passcode|pass phrase)\b\s*(?:is|:|=|-)?\s*\S+",
            re.I,
        ),
    ),
    (
        "password",
        re.compile(r"\b(?:here\s+is|here'?s|sharing)\s+(?:my\s+)?(?:password|passwd|pin)\b", re.I),
    ),
    (
        "otp",
        re.compile(
            r"\b(?:otp|one[\s-]?time\s+password|verification\s+code|2fa\s+code|"
            r"authentication\s+code)\b\s*(?:is|:|=|-)?\s*\d{3,8}\b",
            re.I,
        ),
    ),
    ("otp", re.compile(r"\b(?:my\s+)?otp\s+(?:is|was)\b", re.I)),
    (
        "pin",
        re.compile(
            r"\b(?:my\s+)?(?:pin|cvv|cvc|security\s+code)\b\s*(?:is|:|=|-)?\s*\d{3,6}\b",
            re.I,
        ),
    ),
    (
        "banking",
        re.compile(
            r"\b(?:account\s+number|acct\s*no|ifsc|upi\s*id|upi\s+handle|sort\s*code|"
            r"swift|bic)\b\s*(?:is|:|=|-)?\s*[a-z0-9\-]{4,}",
            re.I,
        ),
    ),
    (
        "banking",
        re.compile(
            r"\b(?:card\s+number|debit\s+card|credit\s+card)\b\s*(?:is|:|=|-)?\s*[\d\s]{12,19}",
            re.I,
        ),
    ),
    (
        "identity",
        re.compile(
            r"\b(?:aadhaar|aadhar|pan\s+number|passport\s+number)\b\s*(?:is|:|=|-)?\s*[a-z0-9]{6,}",
            re.I,
        ),
    ),
    (
        "remote_access",
        re.compile(
            r"\b(?:teamviewer|anydesk|remote\s+access|screen\s+sharing\s+code|"
            r"remote\s+desktop\s+code)\b",
            re.I,
        ),
    ),
]

# --- prompt-injection detection -------------------------------------------
# Instruction-like content is stripped from user text so it cannot influence
# an LLM. This is defence in depth: the LLM prompt itself also states that
# the user text is data.
_INJECTION_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|preceding)\b", re.I),
    re.compile(r"\bdisregard\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\b", re.I),
    re.compile(r"\bforget\s+(?:everything|all)\b", re.I),
    re.compile(r"\byou\s+are\s+now\b", re.I),
    re.compile(r"\bnew\s+instructions?\b", re.I),
    re.compile(r"\bsystem\s*(?:prompt|message|instructions?)\b", re.I),
    re.compile(r"</?(?:system|assistant|user|instructions?)>", re.I),
    re.compile(r"```.*?```", re.S),
    re.compile(r"\bdeveloper\s+mode\b", re.I),
    re.compile(r"\bact\s+as\s+(?:if\s+you\s+are\s+)?(?:a\s+)?(?:different|unrestricted)\b", re.I),
    re.compile(r"\bfrom\s+now\s+on,?\s+(?:you|respond|answer|ignore)\b", re.I),
    re.compile(r"\bdo\s+not\s+(?:mention|say|reveal|tell)\s+(?:that\s+)?(?:you|this)\b", re.I),
    re.compile(r"\b(?:always|only)\s+answer\s+(?:with\s+)?['\"]?[a-z ]{0,20}['\"]?$", re.I),
]

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


@dataclass
class SanitizedInput:
    """Result of sanitising one inbound chat message."""

    text: str
    safe_text: str
    credential_kinds: list[str] = field(default_factory=list)
    injection_detected: bool = False
    truncated: bool = False

    @property
    def has_credentials(self) -> bool:
        return bool(self.credential_kinds)

    @property
    def redacted_text(self) -> str:
        """A safe placeholder used when the original must not be stored."""
        if not self.has_credentials:
            return self.text
        kinds = ", ".join(sorted(set(self.credential_kinds)))
        return f"[redacted: message contained {kinds}]"


def detect_credentials(text: str) -> list[str]:
    """Return the kinds of credential material found in ``text``."""
    kinds: list[str] = []
    for kind, pattern in _CREDENTIAL_PATTERNS:
        if pattern.search(text):
            kinds.append(kind)
    return kinds


def detect_injection(text: str) -> bool:
    """True when the text looks like it is trying to issue instructions."""
    return any(p.search(text) for p in _INJECTION_PATTERNS)


def strip_instructions(text: str) -> str:
    """Remove instruction-like sentences, keeping the rest of the message."""
    cleaned_lines: list[str] = []
    for line in text.splitlines():
        if any(p.search(line) for p in _INJECTION_PATTERNS):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines).strip()


def sanitize_message(raw: str) -> SanitizedInput:
    """Normalise, truncate and de-instruct one inbound message."""
    text = _CONTROL_CHARS.sub("", raw or "")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.strip()

    truncated = False
    if len(text) > MAX_MESSAGE_CHARS:
        text = text[:MAX_MESSAGE_CHARS]
        truncated = True
    lines = text.split("\n")
    if len(lines) > MAX_MESSAGE_LINES:
        text = "\n".join(lines[:MAX_MESSAGE_LINES])
        truncated = True

    credential_kinds = detect_credentials(text)
    injection_detected = detect_injection(text)
    safe_text = strip_instructions(text) if injection_detected else text
    if injection_detected and not safe_text.strip():
        # The whole message was instruction-like; keep a non-empty placeholder
        # so the conversation turn stays readable in the history.
        safe_text = "[instruction-like content removed]"

    return SanitizedInput(
        text=text,
        safe_text=safe_text,
        credential_kinds=credential_kinds,
        injection_detected=injection_detected,
        truncated=truncated,
    )


CREDENTIAL_WARNING = (
    "I can't store that message because it appears to contain sensitive credentials "
    "(password, OTP, PIN, banking details or an ID number). Nothing was saved. "
    "Never share passwords, OTPs, PINs or banking credentials with recruiters, and "
    "change them if you have already shared them. If you have already sent money, "
    "contact the cybercrime helpline on 1930."
)

INJECTION_NOTICE = (
    "Part of your message looked like an instruction to the assistant and was ignored. "
    "I only answer from your stored analysis and approved sources."
)


__all__ = [
    "MAX_MESSAGE_CHARS",
    "CREDENTIAL_WARNING",
    "INJECTION_NOTICE",
    "SanitizedInput",
    "detect_credentials",
    "detect_injection",
    "sanitize_message",
    "strip_instructions",
]
