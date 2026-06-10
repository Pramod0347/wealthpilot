from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


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
    status: str
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
    status: str | None = None
    notes: str | None = None


class CreditCardRead(CreditCardBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
