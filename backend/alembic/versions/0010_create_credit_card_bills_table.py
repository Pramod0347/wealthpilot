"""create credit card bills table

Revision ID: 0010_credit_card_bills
Revises: 0009_cashflow_entries
Create Date: 2026-06-23 10:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_credit_card_bills"
down_revision = "0009_cashflow_entries"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "credit_card_bills",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("credit_card_id", sa.Integer(), nullable=False),
        sa.Column("billing_cycle_start", sa.Date(), nullable=True),
        sa.Column("billing_cycle_end", sa.Date(), nullable=True),
        sa.Column("bill_generated_date", sa.Date(), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("bill_amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("paid_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("paid_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["credit_card_id"], ["credit_cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_credit_card_bills_id"), "credit_card_bills", ["id"], unique=False)
    op.create_index("ix_credit_card_bills_credit_card_id", "credit_card_bills", ["credit_card_id"], unique=False)
    op.create_index("ix_credit_card_bills_due_date", "credit_card_bills", ["due_date"], unique=False)
    op.create_index("ix_credit_card_bills_paid_date", "credit_card_bills", ["paid_date"], unique=False)
    op.create_index("ix_credit_card_bills_status", "credit_card_bills", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_credit_card_bills_status", table_name="credit_card_bills")
    op.drop_index("ix_credit_card_bills_paid_date", table_name="credit_card_bills")
    op.drop_index("ix_credit_card_bills_due_date", table_name="credit_card_bills")
    op.drop_index("ix_credit_card_bills_credit_card_id", table_name="credit_card_bills")
    op.drop_index(op.f("ix_credit_card_bills_id"), table_name="credit_card_bills")
    op.drop_table("credit_card_bills")
