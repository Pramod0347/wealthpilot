"""add persisted EMI settings to financial goals

Revision ID: 0021_emi_goal_settings
Revises: 0020_add_emi_breakdown_columns
Create Date: 2026-08-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_emi_goal_settings"
down_revision = "0020_add_emi_breakdown_columns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_goals", sa.Column("emi_monthly_amount", sa.Numeric(14, 2), nullable=True))
    op.add_column("financial_goals", sa.Column("emi_total_months", sa.Integer(), nullable=True))
    op.add_column("financial_goals", sa.Column("emi_processing_fee", sa.Numeric(14, 2), nullable=True))
    op.add_column("financial_goals", sa.Column("emi_processing_fee_gst", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("financial_goals", "emi_processing_fee_gst")
    op.drop_column("financial_goals", "emi_processing_fee")
    op.drop_column("financial_goals", "emi_total_months")
    op.drop_column("financial_goals", "emi_monthly_amount")