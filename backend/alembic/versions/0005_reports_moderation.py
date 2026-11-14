"""add community reports, ratings, evidence, moderation actions

Revision ID: 0005_reports_moderation
Revises: 0004_verification_checks
Create Date: 2026-11-10 00:40:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_reports_moderation"
down_revision: str | None = "0004_verification_checks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "community_reports",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("company_name", sa.String(length=300), nullable=False),
        sa.Column("job_title", sa.String(length=300), nullable=True),
        sa.Column("job_url", sa.String(length=1000), nullable=True),
        sa.Column("recruiter_identifier", sa.String(length=300), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=True),
        sa.Column("interacted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("paid", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("shared_info", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "moderation_status",
            sa.String(length=30),
            nullable=False,
            server_default="pending_review",
        ),
        sa.Column("public_summary", sa.Text(), nullable=True),
        sa.Column("pii_flagged", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_community_reports_user_id", "community_reports", ["user_id"])
    op.create_index("ix_community_reports_company_id", "community_reports", ["company_id"])
    op.create_index(
        "ix_community_reports_moderation_status", "community_reports", ["moderation_status"]
    )

    op.create_table(
        "experience_ratings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("dimensions_json", postgresql.JSONB(), nullable=True),
        sa.Column("review_text", sa.Text(), nullable=True),
        sa.Column(
            "moderation_status",
            sa.String(length=30),
            nullable=False,
            server_default="pending_review",
        ),
        sa.Column("spam_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "user_id", "company_id", "job_id", name="uq_experience_ratings_user_company_job"
        ),
    )
    op.create_index("ix_experience_ratings_company_id", "experience_ratings", ["company_id"])

    op.create_table(
        "report_evidence",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("community_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("file_type", sa.String(length=100), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column(
            "redaction_status", sa.String(length=30), nullable=False, server_default="pending"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_report_evidence_report_id", "report_evidence", ["report_id"])

    op.create_table(
        "moderation_actions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "moderator_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_type", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("private_note", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_moderation_actions_target_id", "moderation_actions", ["target_id"])


def downgrade() -> None:
    op.drop_index("ix_moderation_actions_target_id", table_name="moderation_actions")
    op.drop_table("moderation_actions")
    op.drop_index("ix_report_evidence_report_id", table_name="report_evidence")
    op.drop_table("report_evidence")
    op.drop_index("ix_experience_ratings_company_id", table_name="experience_ratings")
    op.drop_table("experience_ratings")
    op.drop_index("ix_community_reports_moderation_status", table_name="community_reports")
    op.drop_index("ix_community_reports_company_id", table_name="community_reports")
    op.drop_index("ix_community_reports_user_id", table_name="community_reports")
    op.drop_table("community_reports")
