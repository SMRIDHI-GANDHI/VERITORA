"""add network detection tables

Revision ID: 0006_network_detection
Revises: 0005_reports_moderation
Create Date: 2026-11-11 00:10:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_network_detection"
down_revision: str | None = "0005_reports_moderation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "network_entities",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("protected_value_hash", sa.String(length=128), nullable=False),
        sa.Column(
            "visibility_level",
            sa.String(length=20),
            nullable=False,
            server_default="restricted",
        ),
        sa.Column(
            "first_seen",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "last_seen",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "entity_type", "protected_value_hash", name="uq_network_entity_type_hash"
        ),
    )
    op.create_index("ix_network_entities_entity_type", "network_entities", ["entity_type"])

    op.create_table(
        "network_evidence",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("similarity", sa.Float(), nullable=True),
        sa.Column("detail", postgresql.JSONB(), nullable=True),
        sa.Column("record_refs", postgresql.JSONB(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "network_relationships",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "source_entity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("network_entities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "target_entity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("network_entities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("relationship_type", sa.String(length=50), nullable=False),
        sa.Column(
            "evidence_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("network_evidence.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column(
            "review_status",
            sa.String(length=30),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "source_entity_id",
            "target_entity_id",
            "relationship_type",
            name="uq_network_relationship_src_tgt_type",
        ),
    )
    op.create_index(
        "ix_network_relationships_source_entity_id",
        "network_relationships",
        ["source_entity_id"],
    )
    op.create_index(
        "ix_network_relationships_target_entity_id",
        "network_relationships",
        ["target_entity_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_network_relationships_target_entity_id", table_name="network_relationships")
    op.drop_index("ix_network_relationships_source_entity_id", table_name="network_relationships")
    op.drop_table("network_relationships")
    op.drop_table("network_evidence")
    op.drop_index("ix_network_entities_entity_type", table_name="network_entities")
    op.drop_table("network_entities")