from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class InvestmentTransactionBase(BaseModel):
    transaction_type: Literal["BUY", "SELL"]
    transaction_mode: Literal["One Time", "SIP", "IPO"] = "One Time"
    quantity: Decimal = Field(gt=0)
    price_per_unit: Decimal = Field(ge=0)
    fees: Decimal = Field(default=Decimal("0"), ge=0)
    taxes: Decimal = Field(default=Decimal("0"), ge=0)
    exchange_rate: Decimal = Field(default=Decimal("1"), gt=0)
    transaction_date: date
    notes: str | None = None


class InvestmentTransactionCreate(InvestmentTransactionBase):
    pass


class InvestmentTransactionUpdate(BaseModel):
    transaction_type: Literal["BUY", "SELL"] | None = None
    transaction_mode: Literal["One Time", "SIP", "IPO"] | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    price_per_unit: Decimal | None = Field(default=None, ge=0)
    fees: Decimal | None = Field(default=None, ge=0)
    taxes: Decimal | None = Field(default=None, ge=0)
    exchange_rate: Decimal | None = Field(default=None, gt=0)
    transaction_date: date | None = None
    notes: str | None = None


class InvestmentTransactionRead(InvestmentTransactionBase):
    id: int
    investment_id: int
    investment_name: str
    investment_symbol: str
    investment_asset_type: str
    total: Decimal
    realized_pnl: Decimal = Decimal("0")
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
