from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

AccountType = Literal["savings", "current", "salary", "fd", "other"]


class BankAccountBase(BaseModel):
    bank_name: str
    account_name: str | None = None
    account_type: AccountType
    account_number_last4: str | None = None
    balance: Decimal
    currency: str = "INR"
    notes: str | None = None
    as_of_date: date | None = None


class BankAccountCreate(BankAccountBase):
    pass


class BankAccountUpdate(BaseModel):
    bank_name: str | None = None
    account_name: str | None = None
    account_type: AccountType | None = None
    account_number_last4: str | None = None
    balance: Decimal | None = None
    currency: str | None = None
    notes: str | None = None
    as_of_date: date | None = None


class BankAccountRead(BankAccountBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class BankAccountsSummary(BaseModel):
    total_cash: Decimal = Decimal("0")
    accounts_count: int = 0
    currency: str = "INR"
