"""add multi source fields to financial goals

Revision ID: 0012_goal_sources
Revises: 0011_financial_goals
Create Date: 2026-06-25 12:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0012_goal_sources"
down_revision = "0011_financial_goals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_goals", sa.Column("linked_source_types", sa.JSON(), nullable=True))
    op.add_column("financial_goals", sa.Column("linked_source_map", sa.JSON(), nullable=True))
    op.execute(
        """
        UPDATE financial_goals
        SET linked_source_types = CASE
                WHEN linked_source_type IS NULL THEN NULL
                ELSE json_build_array(linked_source_type)
            END,
            linked_source_map = CASE
                WHEN linked_source_type IS NULL OR linked_source_ids IS NULL THEN NULL
                ELSE json_build_object(linked_source_type, linked_source_ids)
            END
        """
    )


def downgrade() -> None:
    op.drop_column("financial_goals", "linked_source_map")
    op.drop_column("financial_goals", "linked_source_types")
