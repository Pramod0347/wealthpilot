from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class EMIPaymentBase(BaseModel):
    goal_id: int
    payment_month: str
    payment_date: date
    principal_amount: Decimal = Decimal("0")
    interest_amount: Decimal = Decimal("0")
    gst_amount: Decimal = Decimal("0")
    processing_fee: Decimal = Decimal("0")
    processing_fee_gst: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    notes: str | None = None


class EMIPaymentCreate(EMIPaymentBase):
    pass


class EMIPaymentUpdate(BaseModel):
    payment_month: str | None = None
    payment_date: date | None = None
    principal_amount: Decimal | None = None
    interest_amount: Decimal | None = None
    gst_amount: Decimal | None = None
    processing_fee: Decimal | None = None
    processing_fee_gst: Decimal | None = None
    amount: Decimal | None = None
    notes: str | None = None


class EMIPaymentRead(EMIPaymentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
