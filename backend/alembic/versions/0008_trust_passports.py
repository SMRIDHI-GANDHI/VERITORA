"""add trust passports

Revision ID: 0008_trust_passports
Revises: 0007_watchlist_and_dashboard
Create Date: 2026-11-11 02:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0008_trust_passports"
down_revision: str | None = "0007_watchlist_and_dashboard"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trust_passports",
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
        sa.Column("public_token_hash", sa.String(length=128), nullable=False),
        sa.Column("snapshot_json", postgresql.JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "ix_trust_passports_token_hash",
        "trust_passports",
        ["public_token_hash"],
        unique=True,
    )
    op.create_index("ix_trust_passports_analysis_id", "trust_passports", ["analysis_id"])


def downgrade() -> None:
    op.drop_index("ix_trust_passports_analysis_id", table_name="trust_passports")
    op.drop_index("ix_trust_passports_token_hash", table_name="trust_passports")
    op.drop_table("trust_passports")
