from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class TransactionBase(BaseModel):
    transaction_date: date
    merchant: str
    amount: Decimal
    category: str
    payment_method: str
    card_id: int | None = None
    notes: str | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    transaction_date: date | None = None
    merchant: str | None = None
    amount: Decimal | None = None
    category: str | None = None
    payment_method: str | None = None
    card_id: int | None = None
    notes: str | None = None


class TransactionRead(TransactionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
