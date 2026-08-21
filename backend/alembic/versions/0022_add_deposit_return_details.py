"""add deposit return details

Revision ID: 0022_deposit_returns
Revises: 0021_emi_goal_settings
Create Date: 2026-08-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0022_deposit_returns"
down_revision = "0021_emi_goal_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("deposits", sa.Column("returned_amount", sa.Numeric(18, 2), nullable=True))
    op.add_column("deposits", sa.Column("return_deduction", sa.Numeric(18, 2), nullable=True))
    op.add_column("deposits", sa.Column("return_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("deposits", "return_notes")
    op.drop_column("deposits", "return_deduction")
    op.drop_column("deposits", "returned_amount")