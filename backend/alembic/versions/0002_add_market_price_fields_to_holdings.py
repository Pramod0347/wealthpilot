"""add market price fields to holdings

Revision ID: 0002_market_price_fields
Revises: 0001_create_holdings_table
Create Date: 2026-06-10 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0002_market_price_fields"
down_revision = "0001_create_holdings_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holdings", sa.Column("exchange_symbol", sa.String(length=32), nullable=True))
    op.add_column(
        "holdings",
        sa.Column("price_source", sa.String(length=16), nullable=False, server_default=sa.text("'manual'")),
    )
    op.add_column("holdings", sa.Column("last_price_refreshed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("holdings", "last_price_refreshed_at")
    op.drop_column("holdings", "price_source")
    op.drop_column("holdings", "exchange_symbol")
