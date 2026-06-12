from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FixedSavingsAccountType = Literal["epf", "ppf", "vpf", "nps", "fd", "rd", "other"]


class FixedSavingsAccountBase(BaseModel):
    account_type: FixedSavingsAccountType
    account_name: str
    provider_name: str | None = None
    account_number_last4: str | None = None
    employee_contribution: Decimal = Decimal("0")
    employer_contribution: Decimal = Decimal("0")
    self_contribution: Decimal = Decimal("0")
    interest_earned: Decimal = Decimal("0")
    current_value: Decimal
    interest_rate: Decimal | None = None
    start_date: date | None = None
    maturity_date: date | None = None
    as_of_date: date | None = None
    notes: str | None = None


class FixedSavingsAccountCreate(FixedSavingsAccountBase):
    pass


class FixedSavingsAccountUpdate(BaseModel):
    account_type: FixedSavingsAccountType | None = None
    account_name: str | None = None
    provider_name: str | None = None
    account_number_last4: str | None = None
    employee_contribution: Decimal | None = None
    employer_contribution: Decimal | None = None
    self_contribution: Decimal | None = None
    interest_earned: Decimal | None = None
    current_value: Decimal | None = None
    interest_rate: Decimal | None = None
    start_date: date | None = None
    maturity_date: date | None = None
    as_of_date: date | None = None
    notes: str | None = None


class FixedSavingsAccountRead(FixedSavingsAccountBase):
    id: int
    created_at: datetime
    updated_at: datetime
    total_contribution: Decimal = Decimal("0")
    gain_or_interest: Decimal = Decimal("0")
    return_pct: Decimal = Decimal("0")
    model_config = ConfigDict(from_attributes=True)


class FixedSavingsByTypeSummary(BaseModel):
    account_type: FixedSavingsAccountType
    current_value: Decimal = Decimal("0")
    total_contribution: Decimal = Decimal("0")
    interest_earned: Decimal = Decimal("0")
    count: int = 0


class FixedSavingsSummary(BaseModel):
    total_value: Decimal = Decimal("0")
    total_contribution: Decimal = Decimal("0")
    total_interest: Decimal = Decimal("0")
    accounts_count: int = 0
    by_type: list[FixedSavingsByTypeSummary] = Field(default_factory=list)
