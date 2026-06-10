"""add asset type to holdings

Revision ID: 0003_asset_type
Revises: 0002_market_price_fields
Create Date: 2026-06-10 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0003_asset_type"
down_revision = "0002_market_price_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "holdings",
        sa.Column("asset_type", sa.String(length=32), nullable=False, server_default=sa.text("'stock'")),
    )
    op.execute("UPDATE holdings SET asset_type = 'stock' WHERE asset_type IS NULL")


def downgrade() -> None:
    op.drop_column("holdings", "asset_type")
