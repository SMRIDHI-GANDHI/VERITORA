import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CommunityReport(Base):
    __tablename__ = "community_reports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("companies.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("job_postings.id", ondelete="SET NULL"), nullable=True
    )
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    job_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    job_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    recruiter_identifier: Mapped[str | None] = mapped_column(String(300), nullable=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    interacted: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    shared_info: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    moderation_status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="pending_review", index=True
    )
    public_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    pii_flagged: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
