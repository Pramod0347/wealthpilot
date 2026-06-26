"""create financial goals table

Revision ID: 0011_financial_goals
Revises: 0010_credit_card_bills
Create Date: 2026-06-25 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0011_financial_goals"
down_revision = "0010_credit_card_bills"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("goal_type", sa.String(length=32), nullable=False),
        sa.Column("target_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("linked_source_type", sa.String(length=32), nullable=True),
        sa.Column("linked_source_ids", sa.JSON(), nullable=True),
        sa.Column("priority", sa.String(length=16), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_financial_goals_id"), "financial_goals", ["id"], unique=False)
    op.create_index("ix_financial_goals_goal_type", "financial_goals", ["goal_type"], unique=False)
    op.create_index("ix_financial_goals_is_active", "financial_goals", ["is_active"], unique=False)
    op.create_index("ix_financial_goals_priority", "financial_goals", ["priority"], unique=False)
    op.create_index("ix_financial_goals_target_date", "financial_goals", ["target_date"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_financial_goals_target_date", table_name="financial_goals")
    op.drop_index("ix_financial_goals_priority", table_name="financial_goals")
    op.drop_index("ix_financial_goals_is_active", table_name="financial_goals")
    op.drop_index("ix_financial_goals_goal_type", table_name="financial_goals")
    op.drop_index(op.f("ix_financial_goals_id"), table_name="financial_goals")
    op.drop_table("financial_goals")
