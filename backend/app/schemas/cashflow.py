from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

CashflowEntryType = Literal["income", "expense"]


class CashflowEntryBase(BaseModel):
    month: str
    entry_type: CashflowEntryType
    category: str
    source: str | None = None
    amount: Decimal
    notes: str | None = None


class CashflowEntryCreate(CashflowEntryBase):
    pass


class CashflowEntryUpdate(BaseModel):
    month: str | None = None
    entry_type: CashflowEntryType | None = None
    category: str | None = None
    source: str | None = None
    amount: Decimal | None = None
    notes: str | None = None


class CashflowEntryRead(CashflowEntryBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class CashflowCategoryBreakdownItem(BaseModel):
    category: str
    amount: Decimal = Decimal("0")
    percentage: Decimal = Decimal("0")


class CashflowSummary(BaseModel):
    month: str
    total_income: Decimal = Decimal("0")
    total_expense: Decimal = Decimal("0")
    net_savings: Decimal = Decimal("0")
    savings_rate: Decimal = Decimal("0")
    income_count: int = 0
    expense_count: int = 0
    expenses_by_category: list[CashflowCategoryBreakdownItem] = Field(default_factory=list)
    income_by_category: list[CashflowCategoryBreakdownItem] = Field(default_factory=list)
