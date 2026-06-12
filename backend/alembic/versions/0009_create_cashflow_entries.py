"""create cashflow entries table

Revision ID: 0009_cashflow_entries
Revises: 0008_fixed_savings_accounts
Create Date: 2026-06-12 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009_cashflow_entries"
down_revision: str | None = "0008_fixed_savings_accounts"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cashflow_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("month", sa.String(length=7), nullable=False),
        sa.Column("entry_type", sa.String(length=16), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("source", sa.String(length=128), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cashflow_entries_id"), "cashflow_entries", ["id"], unique=False)
    op.create_index(op.f("ix_cashflow_entries_month"), "cashflow_entries", ["month"], unique=False)
    op.create_index(op.f("ix_cashflow_entries_entry_type"), "cashflow_entries", ["entry_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cashflow_entries_entry_type"), table_name="cashflow_entries")
    op.drop_index(op.f("ix_cashflow_entries_month"), table_name="cashflow_entries")
    op.drop_index(op.f("ix_cashflow_entries_id"), table_name="cashflow_entries")
    op.drop_table("cashflow_entries")
