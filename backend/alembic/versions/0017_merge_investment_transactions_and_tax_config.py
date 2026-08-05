"""merge investment transaction and tax configuration heads

Revision ID: 0017_merge_tax_config
Revises: 0016_investment_transactions, 0016_tax_year_config_only
"""


revision = "0017_merge_tax_config"
down_revision = ("0016_investment_transactions", "0016_tax_year_config_only")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
