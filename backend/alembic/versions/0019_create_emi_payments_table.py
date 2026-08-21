"""create emi payments table

Revision ID: 0019_create_emi_payments
Revises: 0018_goal_emi_flag
Create Date: 2026-08-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_create_emi_payments"
down_revision = "0018_goal_emi_flag"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "emi_payments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("goal_id", sa.Integer(), sa.ForeignKey("financial_goals.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_month", sa.String(length=7), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index(op.f("ix_emi_payments_goal_id"), "emi_payments", ["goal_id"], unique=False)
    op.create_index(op.f("ix_emi_payments_payment_month"), "emi_payments", ["payment_month"], unique=False)
    op.create_index(op.f("ix_emi_payments_payment_date"), "emi_payments", ["payment_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_emi_payments_payment_date"), table_name="emi_payments")
    op.drop_index(op.f("ix_emi_payments_payment_month"), table_name="emi_payments")
    op.drop_index(op.f("ix_emi_payments_goal_id"), table_name="emi_payments")
    op.drop_table("emi_payments")
