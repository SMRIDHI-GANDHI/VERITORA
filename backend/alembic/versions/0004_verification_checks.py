"""add verification_checks table

Revision ID: 0004_verification_checks
Revises: 0003_job_analysis_tables
Create Date: 2026-11-10 00:30:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_verification_checks"
down_revision: str | None = "0003_job_analysis_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "verification_checks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("check_type", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("matched_fields", postgresql.JSONB(), nullable=True),
        sa.Column("mismatched_fields", postgresql.JSONB(), nullable=True),
        sa.Column("unknown_fields", postgresql.JSONB(), nullable=True),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column(
            "checked_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("details", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_verification_checks_entity_type", "verification_checks", ["entity_type"])
    op.create_index("ix_verification_checks_entity_id", "verification_checks", ["entity_id"])


def downgrade() -> None:
    op.drop_index("ix_verification_checks_entity_id", table_name="verification_checks")
    op.drop_index("ix_verification_checks_entity_type", table_name="verification_checks")
    op.drop_table("verification_checks")
