from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TaxFilingStatus = Literal["planning", "ready", "filed"]
TaxIncomeType = Literal["salary", "interest", "dividend", "capital_gains", "freelance", "other"]
TaxDeductionSection = Literal["STANDARD_DEDUCTION", "NPS_EMPLOYER", "OTHER_ALLOWED", "INFO_ONLY"]
TaxProofStatus = Literal["missing", "available", "verified"]
TaxDocumentType = Literal["FORM_16", "AIS", "TIS", "FORM_26AS", "CAPITAL_GAINS_STATEMENT", "BANK_INTEREST_CERTIFICATE", "OTHER"]
TaxDocumentStatus = Literal["missing", "uploaded", "verified"]
TaxPaymentType = Literal["tds", "advance_tax", "self_assessment_tax", "refund"]
TaxReadinessStatus = Literal["not_ready", "in_progress", "ready"]


class TaxYearBase(BaseModel):
    financial_year: str
    assessment_year: str | None = None
    regime: Literal["new"] = "new"
    filing_status: TaxFilingStatus = "planning"
    filing_date: date | None = None
    notes: str | None = None


class TaxYearCreate(TaxYearBase):
    pass


class TaxYearUpdate(BaseModel):
    financial_year: str | None = None
    assessment_year: str | None = None
    regime: Literal["new"] | None = None
    filing_status: TaxFilingStatus | None = None
    filing_date: date | None = None
    notes: str | None = None


class TaxYearRead(TaxYearBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxIncomeItemBase(BaseModel):
    income_type: TaxIncomeType
    source: str | None = None
    description: str | None = None
    gross_amount: Decimal = Decimal("0")
    exempt_amount: Decimal = Decimal("0")
    taxable_amount: Decimal | None = None
    tds_amount: Decimal = Decimal("0")
    received_date: date | None = None


class TaxIncomeItemCreate(TaxIncomeItemBase):
    pass


class TaxIncomeItemUpdate(BaseModel):
    income_type: TaxIncomeType | None = None
    source: str | None = None
    description: str | None = None
    gross_amount: Decimal | None = None
    exempt_amount: Decimal | None = None
    taxable_amount: Decimal | None = None
    tds_amount: Decimal | None = None
    received_date: date | None = None


class TaxIncomeItemRead(TaxIncomeItemBase):
    id: int
    tax_year_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxDeductionBase(BaseModel):
    section: TaxDeductionSection
    description: str | None = None
    amount: Decimal = Decimal("0")
    eligible_amount: Decimal | None = None
    proof_status: TaxProofStatus = "missing"


class TaxDeductionCreate(TaxDeductionBase):
    pass


class TaxDeductionUpdate(BaseModel):
    section: TaxDeductionSection | None = None
    description: str | None = None
    amount: Decimal | None = None
    eligible_amount: Decimal | None = None
    proof_status: TaxProofStatus | None = None


class TaxDeductionRead(TaxDeductionBase):
    id: int
    tax_year_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxDocumentBase(BaseModel):
    document_type: TaxDocumentType
    name: str
    status: TaxDocumentStatus = "missing"
    file_name: str | None = None
    file_path: str | None = None
    notes: str | None = None
    uploaded_at: datetime | None = None


class TaxDocumentCreate(TaxDocumentBase):
    pass


class TaxDocumentUpdate(BaseModel):
    document_type: TaxDocumentType | None = None
    name: str | None = None
    status: TaxDocumentStatus | None = None
    file_name: str | None = None
    file_path: str | None = None
    notes: str | None = None
    uploaded_at: datetime | None = None


class TaxDocumentRead(TaxDocumentBase):
    id: int
    tax_year_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxPaymentBase(BaseModel):
    payment_type: TaxPaymentType
    amount: Decimal = Decimal("0")
    payment_date: date | None = None
    challan_or_reference: str | None = None
    notes: str | None = None


class TaxPaymentCreate(TaxPaymentBase):
    pass


class TaxPaymentUpdate(BaseModel):
    payment_type: TaxPaymentType | None = None
    amount: Decimal | None = None
    payment_date: date | None = None
    challan_or_reference: str | None = None
    notes: str | None = None


class TaxPaymentRead(TaxPaymentBase):
    id: int
    tax_year_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TaxIncomeTypeSummary(BaseModel):
    income_type: TaxIncomeType
    gross_amount: Decimal = Decimal("0")
    taxable_amount: Decimal = Decimal("0")
    tds_amount: Decimal = Decimal("0")


class TaxIncomeSummary(BaseModel):
    gross_income: Decimal = Decimal("0")
    exempt_income: Decimal = Decimal("0")
    taxable_income_before_adjustments: Decimal = Decimal("0")
    by_type: list[TaxIncomeTypeSummary] = Field(default_factory=list)


class TaxEstimateSummary(BaseModel):
    taxable_income: Decimal = Decimal("0")
    standard_deduction: Decimal = Decimal("0")
    allowed_adjustments: Decimal = Decimal("0")
    tax_before_rebate: Decimal = Decimal("0")
    rebate: Decimal = Decimal("0")
    tax_before_cess: Decimal = Decimal("0")
    cess: Decimal = Decimal("0")
    total_tax: Decimal = Decimal("0")
    effective_tax_rate: Decimal | None = None


class TaxTdsSummary(BaseModel):
    total_tds: Decimal = Decimal("0")
    total_advance_tax: Decimal = Decimal("0")
    total_self_assessment_tax: Decimal = Decimal("0")
    total_refunds_received: Decimal = Decimal("0")
    total_tax_paid_or_credited: Decimal = Decimal("0")


class TaxPayableSummary(BaseModel):
    net_tax_balance: Decimal = Decimal("0")
    estimated_refund: Decimal = Decimal("0")
    estimated_payable: Decimal = Decimal("0")
    balance_label: str = "settled"


class TaxDocumentsSummary(BaseModel):
    total_required: int = 0
    available_count: int = 0
    verified_count: int = 0
    missing_count: int = 0
    readiness_score: Decimal = Decimal("0")
    missing_documents: list[str] = Field(default_factory=list)


class TaxChecklistItem(BaseModel):
    label: str
    done: bool


class TaxReadinessSummary(BaseModel):
    status: TaxReadinessStatus = "not_ready"
    message: str
    checklist: list[TaxChecklistItem] = Field(default_factory=list)
    disclaimer: str = "Estimated only. Verify before filing."


class TaxYearSummary(BaseModel):
    tax_year: TaxYearRead
    income_summary: TaxIncomeSummary
    new_regime_estimate: TaxEstimateSummary
    tds_summary: TaxTdsSummary
    payable_summary: TaxPayableSummary
    documents_summary: TaxDocumentsSummary
    filing_readiness: TaxReadinessSummary
