"""create deposits table

Revision ID: 0015_create_deposits_table
Revises: 0014_goal_tax_merge
Create Date: 2026-07-05 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0015_create_deposits_table"
down_revision = "0014_goal_tax_merge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "deposits",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False, server_default="other"),
        sa.Column("amount", sa.Numeric(precision=18, scale=2), nullable=False, server_default="0"),
        sa.Column("property_name", sa.String(length=200), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("paid_date", sa.Date(), nullable=True),
        sa.Column("refundable", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("returned_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(op.f("ix_deposits_id"), "deposits", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_deposits_id"), table_name="deposits")
    op.drop_table("deposits")
