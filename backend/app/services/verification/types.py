from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

VerificationStatus = Literal[
    "information_found", "consistent", "mismatch", "inconclusive", "not_checked"
]


@dataclass
class VerificationResult:
    check_type: str
    status: VerificationStatus
    matched_fields: list[str] = field(default_factory=list)
    mismatched_fields: list[str] = field(default_factory=list)
    unknown_fields: list[str] = field(default_factory=list)
    source_url: str | None = None
    checked_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "check_type": self.check_type,
            "status": self.status,
            "matched_fields": self.matched_fields,
            "mismatched_fields": self.mismatched_fields,
            "unknown_fields": self.unknown_fields,
            "source_url": self.source_url,
            "checked_at": self.checked_at.isoformat(),
            "details": self.details,
        }
