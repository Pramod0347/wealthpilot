from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field
from app.schemas.dashboard import WealthBucketItem


class PortfolioMetricCard(BaseModel):
    label: str
    amount: Decimal = Decimal("0")
    percentage: Decimal | None = None


class PortfolioAllocationItem(BaseModel):
    key: str
    label: str
    amount: Decimal = Decimal("0")
    percentage: Decimal = Decimal("0")
    kind: str = "asset"
    items: list[WealthBucketItem] = Field(default_factory=list)


class PortfolioNetWorthOverview(BaseModel):
    total_assets: Decimal = Decimal("0")
    total_liabilities: Decimal = Decimal("0")
    net_worth: Decimal = Decimal("0")
    liquid_assets: Decimal = Decimal("0")
    long_term_assets: Decimal = Decimal("0")
    credit_exposure: Decimal = Decimal("0")


class PortfolioLiquidityView(BaseModel):
    immediate_cash: Decimal = Decimal("0")
    market_linked: Decimal = Decimal("0")
    locked_long_term: Decimal = Decimal("0")
    liabilities: Decimal = Decimal("0")


class PortfolioHoldingMover(BaseModel):
    id: int
    symbol: str
    company_name: str
    asset_type: str
    country: str
    current_value: Decimal = Decimal("0")
    pnl: Decimal = Decimal("0")
    return_pct: Decimal = Decimal("0")


class PortfolioAttentionItem(BaseModel):
    label: str
    detail: str
    tone: str = "slate"


class PortfolioTopMovers(BaseModel):
    biggest_gainers: list[PortfolioHoldingMover] = Field(default_factory=list)
    biggest_losers: list[PortfolioHoldingMover] = Field(default_factory=list)
    largest_allocation: PortfolioAllocationItem | None = None
    attention: list[PortfolioAttentionItem] = Field(default_factory=list)


class PortfolioPerformanceOverview(BaseModel):
    has_snapshots: bool = False
    latest_snapshot_date: date | None = None
    latest_snapshot_value: Decimal = Decimal("0")
    latest_snapshot_return_pct: Decimal = Decimal("0")
    message: str | None = None


class PortfolioCashflowContext(BaseModel):
    month: str | None = None
    income: Decimal = Decimal("0")
    spend: Decimal = Decimal("0")
    savings: Decimal = Decimal("0")
    savings_rate: Decimal = Decimal("0")
    has_data: bool = False
    note: str = "Cashflow is monthly summary only. Bank balances are manually managed."


class PortfolioIntelligenceResponse(BaseModel):
    net_worth: PortfolioNetWorthOverview
    asset_allocation: list[PortfolioAllocationItem] = Field(default_factory=list)
    risk_allocation: list[PortfolioAllocationItem] = Field(default_factory=list)
    liquidity: PortfolioLiquidityView
    performance: PortfolioPerformanceOverview
    top_movers: PortfolioTopMovers
    insights: list[str] = Field(default_factory=list)
    cashflow_context: PortfolioCashflowContext
