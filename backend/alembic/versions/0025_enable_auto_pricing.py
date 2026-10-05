"""enable auto pricing for known holdings and mutual funds
 
Revision ID: 0025_auto_pricing
Revises: 0024_home_contributions
"""
 
from alembic import op
 
revision = "0025_auto_pricing"
down_revision = "0024_home_contributions"
branch_labels = None
depends_on = None
 
 
def upgrade() -> None:
    op.execute(
        """
        UPDATE holdings
        SET exchange_symbol = '122639', price_source = 'mfapi', exchange = 'AMFI'
        WHERE UPPER(symbol) = 'PPFAS_FLEXI_CAP';
        """
    )
    op.execute(
        """
        UPDATE holdings
        SET exchange_symbol = '120292', price_source = 'mfapi', exchange = 'AMFI'
        WHERE UPPER(symbol) = 'ICICI_SHORT_TERM_FUND';
        """
    )
    op.execute(
        """
        UPDATE holdings
        SET exchange_symbol = 'GOLDBEES.NS', price_source = 'yfinance', exchange = 'NSE'
        WHERE UPPER(symbol) = 'GOLDBEES';
        """
    )
    op.execute(
        """
        UPDATE holdings
        SET exchange_symbol = 'QQQ', price_source = 'yfinance', country = 'US', currency = 'USD', exchange = 'NASDAQ'
        WHERE UPPER(symbol) = 'QQQ';
        """
    )
    op.execute(
        """
        UPDATE holdings
        SET exchange_symbol = 'AMZN', price_source = 'yfinance', country = 'US', currency = 'USD', exchange = 'NASDAQ'
        WHERE UPPER(symbol) = 'AMZN';
        """
    )
 
 
def downgrade() -> None:
    pass
