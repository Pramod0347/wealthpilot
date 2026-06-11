"""create credit cards table

Revision ID: 0004_credit_cards
Revises: 0003_asset_type
Create Date: 2026-06-10 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0004_credit_cards"
down_revision = "0003_asset_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_cards",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("card_name", sa.String(length=128), nullable=False),
        sa.Column("bank_name", sa.String(length=128), nullable=False),
        sa.Column("last4", sa.String(length=4), nullable=False),
        sa.Column("total_limit", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("used_amount", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("current_bill_amount", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("billing_cycle_start", sa.Date(), nullable=False),
        sa.Column("billing_cycle_end", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'due_soon'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(op.f("ix_credit_cards_id"), "credit_cards", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_credit_cards_id"), table_name="credit_cards")
    op.drop_table("credit_cards")
