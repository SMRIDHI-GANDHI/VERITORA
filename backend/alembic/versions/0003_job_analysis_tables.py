"""create job analysis tables

Revision ID: 0003_job_analysis_tables
Revises: 0002_refresh_tokens
Create Date: 2026-11-10 00:20:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_job_analysis_tables"
down_revision: str | None = "0002_refresh_tokens"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "companies",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(length=300), nullable=False),
        sa.Column("normalized_name", sa.String(length=300), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("normalized_domain", sa.String(length=255), nullable=True),
        sa.Column("registration_reference", sa.String(length=200), nullable=True),
        sa.Column("verification_status", sa.String(length=50), nullable=True),
        sa.Column("is_synthetic", sa.Boolean(), nullable=False, server_default=sa.text("false")),
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
    op.create_index("ix_companies_normalized_name", "companies", ["normalized_name"])
    op.create_index("ix_companies_normalized_domain", "companies", ["normalized_domain"])

    op.create_table(
        "job_postings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "company_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("salary_text", sa.String(length=200), nullable=True),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("description_fingerprint", sa.String(length=128), nullable=True),
        sa.Column(
            "submitted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_job_postings_description_fingerprint", "job_postings", ["description_fingerprint"]
    )

    op.create_table(
        "job_analyses",
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
            "job_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_postings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("risk_score", sa.Integer(), nullable=True),
        sa.Column("risk_band", sa.String(length=50), nullable=False),
        sa.Column(
            "assessment_type",
            sa.String(length=50),
            nullable=False,
            server_default="decision_support",
        ),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("rules_version", sa.String(length=50), nullable=False),
        sa.Column("input_summary", postgresql.JSONB(), nullable=True),
        sa.Column(
            "supersedes_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_analyses.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("result_json", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_job_analyses_user_id", "job_analyses", ["user_id"])
    op.create_index("ix_job_analyses_job_id", "job_analyses", ["job_id"])

    op.create_table(
        "risk_factors",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_analyses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("factor_code", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.String(length=20), nullable=False),
        sa.Column("evidence_excerpt", sa.Text(), nullable=True),
        sa.Column("span_start", sa.Integer(), nullable=True),
        sa.Column("span_end", sa.Integer(), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(length=100), nullable=True),
        sa.Column("source_id", sa.String(length=100), nullable=True),
        sa.Column("evidence_key", sa.String(length=300), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_risk_factors_analysis_id", "risk_factors", ["analysis_id"])

    op.create_table(
        "safety_recommendations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "analysis_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_analyses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("recommendation_code", sa.String(length=100), nullable=False),
        sa.Column("text_key", sa.String(length=200), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="3"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_safety_recommendations_analysis_id", "safety_recommendations", ["analysis_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_safety_recommendations_analysis_id", table_name="safety_recommendations")
    op.drop_table("safety_recommendations")
    op.drop_index("ix_risk_factors_analysis_id", table_name="risk_factors")
    op.drop_table("risk_factors")
    op.drop_index("ix_job_analyses_job_id", table_name="job_analyses")
    op.drop_index("ix_job_analyses_user_id", table_name="job_analyses")
    op.drop_table("job_analyses")
    op.drop_index("ix_job_postings_description_fingerprint", table_name="job_postings")
    op.drop_table("job_postings")
    op.drop_index("ix_companies_normalized_domain", table_name="companies")
    op.drop_index("ix_companies_normalized_name", table_name="companies")
    op.drop_table("companies")
