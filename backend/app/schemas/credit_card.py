from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

CardStatus = Literal["paid", "due_soon", "overdue"]


class CreditCardBase(BaseModel):
    card_name: str
    bank_name: str
    last4: str
    total_limit: Decimal
    billing_cycle_start: date
    billing_cycle_end: date
    due_date: date
    current_bill_amount: Decimal
    used_amount: Decimal
    status: CardStatus = "due_soon"
    notes: str | None = None


class CreditCardCreate(CreditCardBase):
    pass


class CreditCardUpdate(BaseModel):
    card_name: str | None = None
    bank_name: str | None = None
    last4: str | None = None
    total_limit: Decimal | None = None
    billing_cycle_start: date | None = None
    billing_cycle_end: date | None = None
    due_date: date | None = None
    current_bill_amount: Decimal | None = None
    used_amount: Decimal | None = None
    status: CardStatus | None = None
    notes: str | None = None


class CreditCardRead(CreditCardBase):
    id: int
    available_limit: Decimal
    utilization_pct: Decimal
    days_until_due: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
