"""create tax center tables

Revision ID: 0013_tax_center
Revises: 0012_goal_sources
Create Date: 2026-06-26 11:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "0013_tax_center"
down_revision = "0012_goal_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tax_years",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("financial_year", sa.String(length=16), nullable=False),
        sa.Column("assessment_year", sa.String(length=16), nullable=True),
        sa.Column("regime", sa.String(length=16), server_default="new", nullable=False),
        sa.Column("filing_status", sa.String(length=16), server_default="planning", nullable=False),
        sa.Column("filing_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("financial_year"),
    )
    op.create_index(op.f("ix_tax_years_id"), "tax_years", ["id"], unique=False)

    op.create_table(
        "tax_income_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year_id", sa.Integer(), nullable=False),
        sa.Column("income_type", sa.String(length=32), nullable=False),
        sa.Column("source", sa.String(length=160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("gross_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("exempt_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("taxable_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("tds_amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("received_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tax_year_id"], ["tax_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tax_income_items_id"), "tax_income_items", ["id"], unique=False)
    op.create_index("ix_tax_income_items_tax_year_id", "tax_income_items", ["tax_year_id"], unique=False)
    op.create_index("ix_tax_income_items_income_type", "tax_income_items", ["income_type"], unique=False)

    op.create_table(
        "tax_deductions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year_id", sa.Integer(), nullable=False),
        sa.Column("section", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("eligible_amount", sa.Numeric(14, 2), nullable=True),
        sa.Column("proof_status", sa.String(length=16), server_default="missing", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tax_year_id"], ["tax_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tax_deductions_id"), "tax_deductions", ["id"], unique=False)
    op.create_index("ix_tax_deductions_tax_year_id", "tax_deductions", ["tax_year_id"], unique=False)
    op.create_index("ix_tax_deductions_section", "tax_deductions", ["section"], unique=False)

    op.create_table(
        "tax_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year_id", sa.Integer(), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="missing", nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("file_path", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tax_year_id"], ["tax_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tax_documents_id"), "tax_documents", ["id"], unique=False)
    op.create_index("ix_tax_documents_tax_year_id", "tax_documents", ["tax_year_id"], unique=False)
    op.create_index("ix_tax_documents_document_type", "tax_documents", ["document_type"], unique=False)

    op.create_table(
        "tax_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tax_year_id", sa.Integer(), nullable=False),
        sa.Column("payment_type", sa.String(length=32), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), server_default="0", nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("challan_or_reference", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tax_year_id"], ["tax_years.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_tax_payments_id"), "tax_payments", ["id"], unique=False)
    op.create_index("ix_tax_payments_tax_year_id", "tax_payments", ["tax_year_id"], unique=False)
    op.create_index("ix_tax_payments_payment_type", "tax_payments", ["payment_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tax_payments_payment_type", table_name="tax_payments")
    op.drop_index("ix_tax_payments_tax_year_id", table_name="tax_payments")
    op.drop_index(op.f("ix_tax_payments_id"), table_name="tax_payments")
    op.drop_table("tax_payments")

    op.drop_index("ix_tax_documents_document_type", table_name="tax_documents")
    op.drop_index("ix_tax_documents_tax_year_id", table_name="tax_documents")
    op.drop_index(op.f("ix_tax_documents_id"), table_name="tax_documents")
    op.drop_table("tax_documents")

    op.drop_index("ix_tax_deductions_section", table_name="tax_deductions")
    op.drop_index("ix_tax_deductions_tax_year_id", table_name="tax_deductions")
    op.drop_index(op.f("ix_tax_deductions_id"), table_name="tax_deductions")
    op.drop_table("tax_deductions")

    op.drop_index("ix_tax_income_items_income_type", table_name="tax_income_items")
    op.drop_index("ix_tax_income_items_tax_year_id", table_name="tax_income_items")
    op.drop_index(op.f("ix_tax_income_items_id"), table_name="tax_income_items")
    op.drop_table("tax_income_items")

    op.drop_index(op.f("ix_tax_years_id"), table_name="tax_years")
    op.drop_table("tax_years")
