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
    total_pnl: Decimal = Decimal("0")
    total_return_pct: Decimal = Decimal("0")
    holdings_count: int = 0
    allocations: list[AssetAllocationItem] = Field(default_factory=list)
