from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DepositType = Literal["rent_deposit", "security_deposit", "office_deposit", "other"]
DepositStatus = Literal["active", "returned"]


class DepositBase(BaseModel):
    name: str
    type: DepositType = "other"
    amount: Decimal = Field(gt=0)
    property_name: str | None = None
    description: str | None = None
    paid_date: date | None = None
    refundable: bool = False
    status: DepositStatus = "active"
    returned_date: date | None = None
    returned_amount: Decimal | None = Field(default=None, ge=0)
    return_deduction: Decimal | None = Field(default=None, ge=0)
    return_notes: str | None = None


class DepositCreate(DepositBase):
    pass


class DepositUpdate(BaseModel):
    name: str | None = None
    type: DepositType | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    property_name: str | None = None
    description: str | None = None
    paid_date: date | None = None
    refundable: bool | None = None
    status: DepositStatus | None = None
    returned_date: date | None = None
    returned_amount: Decimal | None = Field(default=None, ge=0)
    return_deduction: Decimal | None = Field(default=None, ge=0)
    return_notes: str | None = None


class DepositRead(DepositBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DepositSummary(BaseModel):
    total_deposits: Decimal = Decimal("0")
    active_deposits: Decimal = Decimal("0")
    refundable_amount: Decimal = Decimal("0")
    deposits_count: int = 0
    active_count: int = 0
