from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AssetType = Literal["stock", "etf", "mutual_fund", "cash", "other"]


class HoldingBase(BaseModel):
    symbol: str
    company_name: str
    asset_type: AssetType = "stock"
    exchange_symbol: str | None = None
    quantity: Decimal
    avg_buy_price: Decimal
    current_price: Decimal
    sector: str | None = None
    notes: str | None = None
    as_of_date: date | None = None


class HoldingCreate(HoldingBase):
    pass


class HoldingUpdate(BaseModel):
    symbol: str | None = None
    company_name: str | None = None
    asset_type: AssetType | None = None
    exchange_symbol: str | None = None
    quantity: Decimal | None = None
    avg_buy_price: Decimal | None = None
    current_price: Decimal | None = None
    sector: str | None = None
    notes: str | None = None
    as_of_date: date | None = None


class HoldingRead(HoldingBase):
    id: int
    exchange_symbol: str | None
    price_source: str
    last_price_refreshed_at: datetime | None
    as_of_date: date
    created_at: datetime
    updated_at: datetime
    invested_amount: Decimal
    current_value: Decimal
    pnl: Decimal
    return_pct: Decimal
    model_config = ConfigDict(from_attributes=True)


class BulkPriceRefreshFailure(BaseModel):
    holding_id: int
    symbol: str
    reason: str


class BulkPriceRefreshResponse(BaseModel):
    updated_count: int
    failed_count: int
    failures: list[BulkPriceRefreshFailure]


class HoldingAnalyticsItem(BaseModel):
    id: int
    symbol: str
    company_name: str
    asset_type: AssetType
    sector: str | None = None
    current_value: Decimal
    pnl: Decimal
    return_pct: Decimal


class AllocationItem(BaseModel):
    key: str
    label: str
    amount: Decimal = Decimal("0")
    percentage: Decimal = Decimal("0")


class HoldingsAnalyticsResponse(BaseModel):
    total_invested: Decimal = Decimal("0")
    current_value: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    total_return_pct: Decimal = Decimal("0")
    asset_type_allocation: list[AllocationItem] = Field(default_factory=list)
    sector_allocation: list[AllocationItem] = Field(default_factory=list)
    top_gainers: list[HoldingAnalyticsItem] = Field(default_factory=list)
    top_losers: list[HoldingAnalyticsItem] = Field(default_factory=list)
