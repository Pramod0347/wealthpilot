"""add country currency exchange and fx rate to holdings

Revision ID: 0006_us_stock_fields
Revises: 0005_portfolio_snapshots
Create Date: 2026-06-11 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_us_stock_fields"
down_revision = "0005_portfolio_snapshots"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "holdings",
        sa.Column("country", sa.String(length=4), nullable=False, server_default=sa.text("'IN'")),
    )
    op.add_column(
        "holdings",
        sa.Column("currency", sa.String(length=8), nullable=False, server_default=sa.text("'INR'")),
    )
    op.add_column("holdings", sa.Column("exchange", sa.String(length=32), nullable=True))
    op.add_column(
        "holdings",
        sa.Column("fx_rate_to_inr", sa.Numeric(18, 4), nullable=False, server_default=sa.text("1")),
    )

    op.execute("UPDATE holdings SET country = 'IN', currency = 'INR', exchange = 'NSE', fx_rate_to_inr = 1")


def downgrade() -> None:
    op.drop_column("holdings", "fx_rate_to_inr")
    op.drop_column("holdings", "exchange")
    op.drop_column("holdings", "currency")
    op.drop_column("holdings", "country")
