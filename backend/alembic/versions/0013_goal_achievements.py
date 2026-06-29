"""add goal achievement fields

Revision ID: 0013_goal_achievements
Revises: 0012_goal_sources
Create Date: 2026-06-29 19:15:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_goal_achievements"
down_revision = "0012_goal_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_goals", sa.Column("status", sa.String(length=16), nullable=False, server_default="active"))
    op.add_column("financial_goals", sa.Column("achieved_date", sa.Date(), nullable=True))
    op.add_column("financial_goals", sa.Column("achieved_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("financial_goals", sa.Column("achievement_type", sa.String(length=32), nullable=True))
    op.add_column("financial_goals", sa.Column("payment_source", sa.String(length=32), nullable=True))
    op.add_column("financial_goals", sa.Column("is_big_purchase", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("financial_goals", sa.Column("purchase_notes", sa.Text(), nullable=True))
    op.execute(
        """
        UPDATE financial_goals
        SET status = CASE
            WHEN is_active = false THEN 'cancelled'
            ELSE 'active'
        END
        """
    )


def downgrade() -> None:
    op.drop_column("financial_goals", "purchase_notes")
    op.drop_column("financial_goals", "is_big_purchase")
    op.drop_column("financial_goals", "payment_source")
    op.drop_column("financial_goals", "achievement_type")
    op.drop_column("financial_goals", "achieved_amount")
    op.drop_column("financial_goals", "achieved_date")
    op.drop_column("financial_goals", "status")
