"""allow ipo investment transaction mode

Revision ID: 0023_ipo_transaction_mode
Revises: 0022_deposit_returns
Create Date: 2026-09-03 00:00:00.000000
"""

from alembic import op


revision = "0023_ipo_transaction_mode"
down_revision = "0022_deposit_returns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("ck_investment_transaction_mode", "investment_transactions", type_="check")
    op.create_check_constraint(
        "ck_investment_transaction_mode",
        "investment_transactions",
        "transaction_mode IN ('One Time', 'SIP', 'IPO')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_investment_transaction_mode", "investment_transactions", type_="check")
    op.create_check_constraint(
        "ck_investment_transaction_mode",
        "investment_transactions",
        "transaction_mode IN ('One Time', 'SIP')",
    )
