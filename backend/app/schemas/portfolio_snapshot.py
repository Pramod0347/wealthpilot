from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

PerformanceRange = Literal["1M", "3M", "6M", "1Y", "ALL"]
PredictionMethod = Literal["median_daily_return", "linear_regression", "insufficient_data"]
PredictionConfidence = Literal["low", "medium", "high"]


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


class PortfolioSnapshotPerformancePoint(BaseModel):
    date: date
    timestamp: datetime
    total_value: Decimal = Decimal("0")
    net_worth: Decimal | None = None
    invested_value: Decimal | None = None


class PortfolioPredictionPoint(BaseModel):
    date: date
    estimated_value: Decimal = Decimal("0")


class PortfolioPredictionSummary(BaseModel):
    available: bool = False
    method: PredictionMethod = "insufficient_data"
    confidence: PredictionConfidence | None = None
    reason: str
    points: list[PortfolioPredictionPoint]
    estimated_change_amount: Decimal | None = None
    estimated_change_pct: Decimal | None = None


class PortfolioPerformanceSummary(BaseModel):
    first_value: Decimal | None = None
    latest_value: Decimal | None = None
    change_amount: Decimal | None = None
    change_pct: Decimal | None = None
    snapshot_count: int = 0
    projected_value: Decimal | None = None
    projected_change_pct: Decimal | None = None


class PortfolioPerformanceResponse(BaseModel):
    range: PerformanceRange
    start_date: date
    end_date: date
    snapshots: list[PortfolioSnapshotPerformancePoint]
    prediction: PortfolioPredictionSummary
    summary: PortfolioPerformanceSummary
