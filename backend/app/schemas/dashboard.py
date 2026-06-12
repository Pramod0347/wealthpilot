from decimal import Decimal

from pydantic import BaseModel, Field


class AssetAllocationItem(BaseModel):
    asset_type: str
    label: str
    amount: Decimal = Decimal("0")
    percentage: Decimal = Decimal("0")


class DashboardSummary(BaseModel):
    total_invested: Decimal = Decimal("0")
    current_value: Decimal = Decimal("0")
    total_bank_cash: Decimal = Decimal("0")
    bank_accounts_count: int = 0
    total_fixed_savings_value: Decimal = Decimal("0")
    fixed_savings_accounts_count: int = 0
    total_assets: Decimal = Decimal("0")
    total_liabilities: Decimal = Decimal("0")
    net_worth: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    total_return_pct: Decimal = Decimal("0")
    holdings_count: int = 0
    allocations: list[AssetAllocationItem] = Field(default_factory=list)
    total_credit_card_dues: Decimal = Decimal("0")
    total_card_limit: Decimal = Decimal("0")
    total_card_used: Decimal = Decimal("0")
    overall_card_utilization: Decimal = Decimal("0")
    due_soon_count: int = 0
    overdue_count: int = 0
    monthly_income: Decimal = Decimal("0")
    monthly_expense: Decimal = Decimal("0")
    monthly_net_savings: Decimal = Decimal("0")
    monthly_savings_rate: Decimal = Decimal("0")
    monthly_income_count: int = 0
    monthly_expense_count: int = 0
    cashflow_month: str | None = None
