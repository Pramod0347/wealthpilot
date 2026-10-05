from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class HomeContributionBase(BaseModel):
    amount: Decimal = Field(gt=0)
    contribution_date: date
    reason: str = Field(min_length=1, max_length=160)
    purpose: str = Field(min_length=1, max_length=160)
    notes: str | None = None


class HomeContributionCreate(HomeContributionBase):
    pass


class HomeContributionUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    contribution_date: date | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=160)
    purpose: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = None


class HomeContributionRead(HomeContributionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
