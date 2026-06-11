"""create portfolio snapshots table

Revision ID: 0005_portfolio_snapshots
Revises: 0004_credit_cards
Create Date: 2026-06-11 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0005_portfolio_snapshots"
down_revision = "0004_credit_cards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("total_invested", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("current_value", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_pnl", sa.Numeric(18, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("total_return_pct", sa.Numeric(10, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("source", sa.String(length=32), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("snapshot_date", name="uq_portfolio_snapshots_snapshot_date"),
    )
    op.create_index(op.f("ix_portfolio_snapshots_id"), "portfolio_snapshots", ["id"], unique=False)
    op.create_index(op.f("ix_portfolio_snapshots_snapshot_date"), "portfolio_snapshots", ["snapshot_date"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_portfolio_snapshots_snapshot_date"), table_name="portfolio_snapshots")
    op.drop_index(op.f("ix_portfolio_snapshots_id"), table_name="portfolio_snapshots")
    op.drop_table("portfolio_snapshots")
