from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

PerformanceRange = Literal["1M", "3M", "6M", "1Y", "ALL"]


class PortfolioSnapshotRead(BaseModel):
    id: int
    snapshot_date: date
    total_invested: Decimal = Decimal("0")
    current_value: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    total_return_pct: Decimal = Decimal("0")
    source: str = "manual"
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class PortfolioPerformancePoint(BaseModel):
    date: date
    current_value: Decimal = Decimal("0")
    total_invested: Decimal = Decimal("0")
    total_pnl: Decimal = Decimal("0")
    total_return_pct: Decimal = Decimal("0")


class PortfolioPredictedPoint(BaseModel):
    date: date
    current_value: Decimal = Decimal("0")
    is_predicted: bool = True


class PortfolioPerformanceResponse(BaseModel):
    range: PerformanceRange
    actual: list[PortfolioPerformancePoint]
    predicted: list[PortfolioPredictedPoint]
    message: str | None = None
