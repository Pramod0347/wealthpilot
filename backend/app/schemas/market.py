from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class MarketOverviewItem(BaseModel):
    name: str
    symbol: str
    price: float | None = None
    change: float | None = None
    change_pct: float | None = None
    currency: str
    source: Literal["yfinance"]
    last_updated: datetime
    error: str | None = None
