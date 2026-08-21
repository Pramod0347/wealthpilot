"""add emi breakdown columns

Revision ID: 0020_add_emi_breakdown_columns
Revises: 0019_create_emi_payments
Create Date: 2026-08-18 00:00:01.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_add_emi_breakdown_columns"
down_revision = "0019_create_emi_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("emi_payments", sa.Column("principal_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"))
    op.add_column("emi_payments", sa.Column("interest_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"))
    op.add_column("emi_payments", sa.Column("gst_amount", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"))
    op.add_column("emi_payments", sa.Column("processing_fee", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"))
    op.add_column("emi_payments", sa.Column("processing_fee_gst", sa.Numeric(precision=14, scale=2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("emi_payments", "processing_fee_gst")
    op.drop_column("emi_payments", "processing_fee")
    op.drop_column("emi_payments", "gst_amount")
    op.drop_column("emi_payments", "interest_amount")
    op.drop_column("emi_payments", "principal_amount")
