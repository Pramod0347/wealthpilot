"""create holdings table

Revision ID: 0001_create_holdings_table
Revises:
Create Date: 2026-06-09 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_create_holdings_table"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "holdings",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("company_name", sa.String(length=128), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
        sa.Column("avg_buy_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("current_price", sa.Numeric(18, 2), nullable=False),
        sa.Column("sector", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("as_of_date", sa.Date(), server_default=sa.text("CURRENT_DATE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index(op.f("ix_holdings_id"), "holdings", ["id"], unique=False)
    op.create_index(op.f("ix_holdings_symbol"), "holdings", ["symbol"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_holdings_symbol"), table_name="holdings")
    op.drop_index(op.f("ix_holdings_id"), table_name="holdings")
    op.drop_table("holdings")
