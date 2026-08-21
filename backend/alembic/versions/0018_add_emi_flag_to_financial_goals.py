"""add emi flag to financial goals

Revision ID: 0018_goal_emi_flag
Revises: 0017_merge_tax_config
Create Date: 2026-08-17 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0018_goal_emi_flag"
down_revision = "0017_merge_tax_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_goals", sa.Column("is_emi", sa.Boolean(), nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("financial_goals", "is_emi")
