from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

BillStatus = Literal["generated", "paid", "partial", "waived", "missed"]


class CreditCardBillBase(BaseModel):
    billing_cycle_start: date | None = None
    billing_cycle_end: date | None = None
    bill_generated_date: date | None = None
    due_date: date | None = None
    bill_amount: Decimal = Decimal("0")
    paid_amount: Decimal | None = None
    paid_date: date | None = None
    status: BillStatus
    notes: str | None = None


class CreditCardBillCreate(CreditCardBillBase):
    credit_card_id: int


class CreditCardBillUpdate(BaseModel):
    billing_cycle_start: date | None = None
    billing_cycle_end: date | None = None
    bill_generated_date: date | None = None
    due_date: date | None = None
    bill_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    paid_date: date | None = None
    status: BillStatus | None = None
    notes: str | None = None


class CreditCardBillRead(CreditCardBillBase):
    id: int
    credit_card_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MarkCreditCardPaidRequest(BaseModel):
    paid_amount: Decimal | None = None
    paid_date: date | None = None
    notes: str | None = None


class MarkCreditCardPaidResponse(BaseModel):
    credit_card: "CreditCardRead"
    bill_record: CreditCardBillRead


from app.schemas.credit_card import CreditCardRead  # noqa: E402

MarkCreditCardPaidResponse.model_rebuild()
