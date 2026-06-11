"""create bank accounts table

Revision ID: 0007_create_bank_accounts_table
Revises: 0006_us_stock_fields
Create Date: 2026-06-11 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007_create_bank_accounts_table"
down_revision: str | None = "0006_us_stock_fields"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bank_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("bank_name", sa.String(length=128), nullable=False),
        sa.Column("account_name", sa.String(length=128), nullable=True),
        sa.Column("account_type", sa.String(length=32), nullable=False, server_default="savings"),
        sa.Column("account_number_last4", sa.String(length=4), nullable=True),
        sa.Column("balance", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default="INR"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("as_of_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bank_accounts_id"), "bank_accounts", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_bank_accounts_id"), table_name="bank_accounts")
    op.drop_table("bank_accounts")
