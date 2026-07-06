"""add investment transaction ledger

Revision ID: 0016_investment_transactions
Revises: 0015_create_deposits_table
"""
from alembic import op
import sqlalchemy as sa

revision = "0016_investment_transactions"
down_revision = "0015_create_deposits_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holdings", sa.Column("tags", sa.Text(), nullable=True))
    op.add_column("holdings", sa.Column("status", sa.String(16), nullable=False, server_default="Active"))
    op.create_table(
        "investment_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("investment_id", sa.Integer(), sa.ForeignKey("holdings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("transaction_type", sa.String(4), nullable=False),
        sa.Column("transaction_mode", sa.String(16), nullable=False, server_default="One Time"),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("price_per_unit", sa.Numeric(18, 4), nullable=False),
        sa.Column("fees", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("taxes", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("exchange_rate", sa.Numeric(18, 4), nullable=False, server_default="1"),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("transaction_type IN ('BUY', 'SELL')", name="ck_investment_transaction_type"),
        sa.CheckConstraint("transaction_mode IN ('One Time', 'SIP')", name="ck_investment_transaction_mode"),
        sa.CheckConstraint("quantity > 0", name="ck_investment_transaction_quantity"),
    )
    op.create_index("ix_investment_transactions_id", "investment_transactions", ["id"])
    op.create_index("ix_investment_transactions_investment_id", "investment_transactions", ["investment_id"])
    op.execute(sa.text("""
        INSERT INTO investment_transactions
            (investment_id, transaction_type, transaction_mode, quantity, price_per_unit,
             fees, taxes, exchange_rate, transaction_date, notes)
        SELECT id, 'BUY', 'One Time', quantity, avg_buy_price, 0, 0,
               COALESCE(fx_rate_to_inr, 1), as_of_date, 'Opening balance'
        FROM holdings WHERE quantity > 0
    """))
    op.execute("UPDATE holdings SET status = CASE WHEN quantity = 0 THEN 'Closed' ELSE 'Active' END")


def downgrade() -> None:
    op.drop_index("ix_investment_transactions_investment_id", table_name="investment_transactions")
    op.drop_index("ix_investment_transactions_id", table_name="investment_transactions")
    op.drop_table("investment_transactions")
    op.drop_column("holdings", "status")
    op.drop_column("holdings", "tags")
