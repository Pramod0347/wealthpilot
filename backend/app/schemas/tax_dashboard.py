"""Tax API schemas with configuration-driven data."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


TaxYearStatus = Literal["Draft", "Filed", "Verified"]


# ========== TaxYear Models ==========


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


# ========== Tax Dashboard Models (Configuration-Driven) ==========


class TaxHeader(BaseModel):
    """Header information from ITR form"""

    financial_year: str
    assessment_year: str
    form_name: str
    schema_version: str
    tax_regime: str
    residential_status: str
    return_section: str
    assessee_name: str
    verification_place: str
    verification_date: str


class SummaryCard(BaseModel):
    """Summary card for dashboard"""

    label: str
    value: float
    meta: str
    tone: Literal["emerald", "sky", "red", "amber"] | None = None
    badge: str | None = None


class IncomeRow(BaseModel):
    """Income breakdown row"""

    label: str
    value: float


class IncomeBreakdown(BaseModel):
    """Income breakdown section"""

    title: str
    total: float
    rows: list[IncomeRow]


class TaxBreakdownRow(BaseModel):
    """Tax breakdown row"""

    label: str
    value: float
    tone: Literal["emerald", "sky", "red", "amber"] | None = None


class TaxBreakdown(BaseModel):
    """Tax breakdown section"""

    title: str
    rows: list[TaxBreakdownRow]


class CapitalGainsSummary(BaseModel):
    """Capital gains summary"""

    title: str
    summary: list[dict]


class ForeignIncomeItem(BaseModel):
    """Foreign income entry"""

    country: str
    foreign_income: float
    foreign_tax_paid: float
    dtaa_relief: str


class TRDetail(BaseModel):
    """Tax relief detail"""

    country: str
    tax_paid_outside: float
    relief_section: str


class ForeignIncome(BaseModel):
    """Foreign income and assets section"""

    title: str
    foreign_income_list: list[ForeignIncomeItem]
    tr_details: list[TRDetail]
    foreign_assets_count: int


class PaymentDetail(BaseModel):
    """Tax payment detail"""

    bsr_code: str
    date: str
    amount: float


class TaxPayments(BaseModel):
    """Tax payments section"""

    title: str
    total_advance_tax: float
    total_tds: float
    total_self_assessment: float
    payment_details: list[PaymentDetail]


class TaxDashboardResponse(BaseModel):
    """Complete tax dashboard response - all data from ITR JSON"""

    header: TaxHeader
    summary_cards: list[SummaryCard]
    income_breakdown: IncomeBreakdown
    tax_breakdown: TaxBreakdown
    capital_gains: CapitalGainsSummary
    foreign_income: ForeignIncome
    tax_payments: TaxPayments
