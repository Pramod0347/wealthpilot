"""replace tax detail tables with a filed-return index

Revision ID: 0016_tax_year_config_only
Revises: 0015_create_deposits_table
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_tax_year_config_only"
down_revision = "0015_create_deposits_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Configuration files become the source of all detailed tax dashboard data.
    # These tables are intentionally dropped along with their stored detail rows.
    op.drop_table("tax_payments")
    op.drop_table("tax_documents")
    op.drop_table("tax_deductions")
    op.drop_table("tax_income_items")

    op.add_column("tax_years", sa.Column("user_id", sa.String(length=128), nullable=False, server_default="owner"))
    op.add_column("tax_years", sa.Column("status", sa.String(length=16), nullable=False, server_default="Draft"))
    op.add_column("tax_years", sa.Column("filed_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE tax_years SET status = CASE WHEN filing_status = 'filed' THEN 'Filed' ELSE 'Draft' END")
    op.execute("UPDATE tax_years SET filed_at = filing_date WHERE filing_date IS NOT NULL")
    op.drop_constraint("tax_years_financial_year_key", "tax_years", type_="unique")
    op.create_unique_constraint("uq_tax_years_user_financial_year", "tax_years", ["user_id", "financial_year"])
    op.drop_column("tax_years", "notes")
    op.drop_column("tax_years", "filing_date")
    op.drop_column("tax_years", "filing_status")
    op.drop_column("tax_years", "regime")


def downgrade() -> None:
    raise RuntimeError("This migration drops tax detail data and cannot be safely downgraded.")
