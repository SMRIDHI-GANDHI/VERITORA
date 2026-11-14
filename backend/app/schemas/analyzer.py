from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class JobAnalyzeRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=20, max_length=20000)
    company_name: str | None = None
    salary_text: str | None = None
    experience_level: str | None = None
    location: str | None = None
    application_instructions: str | None = None
    recruiter_contact: str | None = None
    company_website: str | None = None
    explanation_language: Literal["en", "hi"] | None = None


class AnalysisResponse(BaseModel):
    id: str
    assessment_type: str
    rules_version: str
    risk_score: int | None
    risk_band: str
    summary: str | None = None
    risk_factors: list[dict[str, Any]] = []
    verification: list[dict[str, Any]] = []
    unknowns: list[str] = []
    missing_information: list[str] = []
    recommendations: list[dict[str, Any]] = []
    community: dict[str, Any] | None = None
    disclaimer_key: str | None = None
    created_at: str | None = None
