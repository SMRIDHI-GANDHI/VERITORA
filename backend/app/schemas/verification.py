from __future__ import annotations

from pydantic import BaseModel, Field


class VerifyCompanyRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=300)
    website: str | None = None
    email_domain: str | None = None
    registration_id: str | None = None


class VerifyRecruiterRequest(BaseModel):
    recruiter_name: str = Field(min_length=1, max_length=200)
    claimed_role: str | None = None
    claimed_company: str = Field(min_length=1, max_length=300)
    email: str | None = None
    profile_url: str | None = None
    company_website: str | None = None


class ScanUrlRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)


class MessageItem(BaseModel):
    sender: str = Field(default="unknown", max_length=50)
    text: str = Field(min_length=1, max_length=10000)


class AnalyzeMessageRequest(BaseModel):
    messages: list[MessageItem] = Field(min_length=1, max_length=100)
