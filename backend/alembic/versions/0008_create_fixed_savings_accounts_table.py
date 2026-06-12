"""create fixed savings accounts table

Revision ID: 0008_fixed_savings_accounts
Revises: 0007_create_bank_accounts_table
Create Date: 2026-06-12 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0008_fixed_savings_accounts"
down_revision: str | None = "0007_create_bank_accounts_table"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "fixed_savings_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_type", sa.String(length=32), nullable=False),
        sa.Column("account_name", sa.String(length=128), nullable=False),
        sa.Column("provider_name", sa.String(length=128), nullable=True),
        sa.Column("account_number_last4", sa.String(length=4), nullable=True),
        sa.Column("employee_contribution", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("employer_contribution", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("self_contribution", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("interest_earned", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("current_value", sa.Numeric(18, 2), nullable=False),
        sa.Column("interest_rate", sa.Numeric(8, 4), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("maturity_date", sa.Date(), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_fixed_savings_accounts_id"), "fixed_savings_accounts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_fixed_savings_accounts_id"), table_name="fixed_savings_accounts")
    op.drop_table("fixed_savings_accounts")
