from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.financial_goal import FinancialGoalSummary


class AnalyticsMetricWindow(BaseModel):
    income: Decimal = Decimal("0")
    expense: Decimal = Decimal("0")
    net_savings: Decimal = Decimal("0")
    savings_rate: Decimal | None = None
    has_data: bool = False


class AnalyticsCategoryAverageItem(BaseModel):
    category: str
    average_amount: Decimal = Decimal("0")
    total_amount: Decimal = Decimal("0")
    percentage_of_avg_spend: Decimal | None = None
    percentage_of_avg_income: Decimal | None = None
    months_present: int = 0


class AnalyticsMonthlyTrendItem(BaseModel):
    month: str
    income: Decimal = Decimal("0")
    expense: Decimal = Decimal("0")
    net_savings: Decimal = Decimal("0")
    savings_rate: Decimal | None = None


class AnalyticsTopCategoryItem(BaseModel):
    category: str
    average_amount: Decimal = Decimal("0")
    percentage_of_avg_spend: Decimal = Decimal("0")


class AnalyticsFocusItem(BaseModel):
    type: str
    severity: str
    title: str
    message: str
    action: str


class CashflowAnalyticsSummary(BaseModel):
    months_count: int = 0
    tracked_months: list[str] = Field(default_factory=list)
    current_month: str | None = None
    current_month_summary: AnalyticsMetricWindow = Field(default_factory=AnalyticsMetricWindow)
    average_monthly_summary: AnalyticsMetricWindow = Field(default_factory=AnalyticsMetricWindow)
    cash_buffer_months: Decimal | None = None
    average_expense_by_category: list[AnalyticsCategoryAverageItem] = Field(default_factory=list)
    average_income_by_category: list[AnalyticsCategoryAverageItem] = Field(default_factory=list)
    monthly_trend: list[AnalyticsMonthlyTrendItem] = Field(default_factory=list)
    top_spending_categories: list[AnalyticsTopCategoryItem] = Field(default_factory=list)
    focus_items: list[AnalyticsFocusItem] = Field(default_factory=list)


class InvestmentBucketSummaryItem(BaseModel):
    key: str
    label: str
    value: Decimal = Decimal("0")
    percentage: Decimal = Decimal("0")
    items_count: int = 0


class InvestmentTopHoldingItem(BaseModel):
    name: str
    symbol: str
    value: Decimal = Decimal("0")
    percentage_of_portfolio: Decimal = Decimal("0")
    return_pct: Decimal | None = None


class InvestmentAnalyticsSummary(BaseModel):
    total_assets: Decimal = Decimal("0")
    total_liabilities: Decimal = Decimal("0")
    net_worth: Decimal = Decimal("0")
    bucket_allocation: list[InvestmentBucketSummaryItem] = Field(default_factory=list)
    top_holdings: list[InvestmentTopHoldingItem] = Field(default_factory=list)
    investment_focus_items: list[AnalyticsFocusItem] = Field(default_factory=list)


class GoalsAnalyticsSummary(BaseModel):
    total_goals: int = 0
    completed_count: int = 0
    on_track_count: int = 0
    watch_count: int = 0
    behind_count: int = 0
    largest_shortfall_goal_name: str | None = None
    largest_shortfall_amount: Decimal = Decimal("0")
    monthly_saving_needed_total: Decimal = Decimal("0")
    summary: FinancialGoalSummary = Field(default_factory=FinancialGoalSummary)


class AnalyticsSummaryResponse(BaseModel):
    cashflow_analytics: CashflowAnalyticsSummary = Field(default_factory=CashflowAnalyticsSummary)
    investment_analytics: InvestmentAnalyticsSummary = Field(default_factory=InvestmentAnalyticsSummary)
    goals_analytics: GoalsAnalyticsSummary = Field(default_factory=GoalsAnalyticsSummary)
