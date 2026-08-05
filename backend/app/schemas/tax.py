from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

TaxYearStatus = Literal["Draft", "Filed", "Verified"]


class TaxYearBase(BaseModel):
    financial_year: str
    assessment_year: str | None = None
    status: TaxYearStatus = "Draft"
    filed_at: datetime | None = None


class TaxYearCreate(TaxYearBase):
    pass


class TaxYearUpdate(BaseModel):
    financial_year: str | None = None
    assessment_year: str | None = None
    status: TaxYearStatus | None = None
    filed_at: datetime | None = None


class TaxYearRead(TaxYearBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
