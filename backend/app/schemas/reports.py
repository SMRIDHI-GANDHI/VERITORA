from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

ReportCategory = Literal[
    "payment_request",
    "impersonation_concern",
    "suspicious_link",
    "fake_offer_concern",
    "data_request",
    "misleading_job_details",
    "other",
]

ModerationActionType = Literal[
    "approve",
    "reject",
    "mark_inconclusive",
    "request_evidence",
    "remove",
    "redact",
]


class ReportCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=300)
    job_title: str | None = None
    job_url: str | None = None
    recruiter_identifier: str | None = None
    category: ReportCategory
    description: str = Field(min_length=30, max_length=5000)
    occurred_on: date | None = None
    interacted: bool | None = None
    paid: bool | None = None
    shared_info: bool | None = None
    evidence_ids: list[str] | None = None


class ReportUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=30, max_length=5000)
    job_title: str | None = None
    job_url: str | None = None
    recruiter_identifier: str | None = None


class AppealRequest(BaseModel):
    message: str = Field(min_length=5, max_length=2000)


class RatingDimensions(BaseModel):
    clarity: int = Field(ge=1, le=5)
    transparency: int = Field(ge=1, le=5)
    consistency: int = Field(ge=1, le=5)


class RatingCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    dimensions: RatingDimensions
    review_text: str | None = Field(default=None, max_length=2000)


class ModerationUpdate(BaseModel):
    action: ModerationActionType
    reason: str = Field(min_length=3, max_length=1000)
    public_summary: str | None = Field(default=None, max_length=1000)
    private_note: str | None = Field(default=None, max_length=2000)
