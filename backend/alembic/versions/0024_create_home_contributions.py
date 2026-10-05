"""create global home contribution tracker

Revision ID: 0024_home_contributions
Revises: 0023_ipo_transaction_mode
"""

from alembic import op
import sqlalchemy as sa


revision = "0024_home_contributions"
down_revision = "0023_ipo_transaction_mode"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "home_contributions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("contribution_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=160), nullable=False),
        sa.Column("purpose", sa.String(length=160), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_home_contributions_id", "home_contributions", ["id"])
    op.create_index("ix_home_contributions_contribution_date", "home_contributions", ["contribution_date"])


def downgrade() -> None:
    op.drop_index("ix_home_contributions_contribution_date", table_name="home_contributions")
    op.drop_index("ix_home_contributions_id", table_name="home_contributions")
    op.drop_table("home_contributions")
