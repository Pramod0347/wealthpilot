from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.tax_deduction import TaxDeduction
from app.models.tax_document import TaxDocument
from app.models.tax_income_item import TaxIncomeItem
from app.models.tax_payment import TaxPayment
from app.models.tax_year import TaxYear
from app.schemas.tax import (
    TaxChecklistItem,
    TaxDeductionRead,
    TaxDocumentRead,
    TaxDocumentsSummary,
    TaxEstimateSummary,
    TaxIncomeItemRead,
    TaxIncomeSummary,
    TaxIncomeTypeSummary,
    TaxPayableSummary,
    TaxPaymentRead,
    TaxReadinessSummary,
    TaxTdsSummary,
    TaxYearRead,
    TaxYearSummary,
)
from app.services.tax_rules import (
    ALLOWED_NEW_REGIME_DEDUCTION_SECTIONS,
    BASE_REQUIRED_DOCUMENTS,
    CESS_RATE,
    INCOME_DOCUMENT_REQUIREMENTS,
    NEW_REGIME_REBATE_LIMIT,
    NEW_REGIME_SLABS,
    NEW_REGIME_STANDARD_DEDUCTION,
)

ZERO = Decimal("0")
HUNDRED = Decimal("100")


def to_decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(value)


def normalize_taxable_income(item: TaxIncomeItem) -> Decimal:
    if item.taxable_amount is not None:
        return max(to_decimal(item.taxable_amount), ZERO)
    return max(to_decimal(item.gross_amount) - to_decimal(item.exempt_amount), ZERO)


def serialize_tax_year(year: TaxYear) -> TaxYearRead:
    return TaxYearRead.model_validate(year)


def serialize_tax_income_item(item: TaxIncomeItem) -> TaxIncomeItemRead:
    return TaxIncomeItemRead.model_validate(item)


def serialize_tax_deduction(item: TaxDeduction) -> TaxDeductionRead:
    return TaxDeductionRead.model_validate(item)


def serialize_tax_document(item: TaxDocument) -> TaxDocumentRead:
    return TaxDocumentRead.model_validate(item)


def serialize_tax_payment(item: TaxPayment) -> TaxPaymentRead:
    return TaxPaymentRead.model_validate(item)


def get_tax_year_or_404(db: Session, tax_year_id: int) -> TaxYear | None:
    return db.get(TaxYear, tax_year_id)


def required_documents_for_year(income_types: set[str]) -> list[tuple[str, str]]:
    required = list(BASE_REQUIRED_DOCUMENTS)
    for income_type, docs in INCOME_DOCUMENT_REQUIREMENTS.items():
        if income_type in income_types:
            required.extend(docs)
    return required


def ensure_required_documents(db: Session, tax_year: TaxYear) -> None:
    income_types = {
        income_type
        for income_type in db.scalars(select(TaxIncomeItem.income_type).where(TaxIncomeItem.tax_year_id == tax_year.id)).all()
    }
    required = required_documents_for_year(income_types)
    existing = {
        (doc.document_type, doc.name)
        for doc in db.scalars(select(TaxDocument).where(TaxDocument.tax_year_id == tax_year.id)).all()
    }
    created = False
    for document_type, name in required:
        if (document_type, name) in existing:
            continue
        db.add(
            TaxDocument(
                tax_year_id=tax_year.id,
                document_type=document_type,
                name=name,
                status="missing",
            )
        )
        created = True
    if created:
        db.flush()


def compute_tax_from_slabs(taxable_income: Decimal) -> Decimal:
    if taxable_income <= 0:
        return ZERO

    previous_limit = ZERO
    tax = ZERO
    for slab_limit, rate in NEW_REGIME_SLABS:
        if slab_limit is None:
            tax += max(taxable_income - previous_limit, ZERO) * rate
            break
        taxable_slice = min(taxable_income, slab_limit) - previous_limit
        if taxable_slice > 0:
            tax += taxable_slice * rate
        if taxable_income <= slab_limit:
            break
        previous_limit = slab_limit
    return tax.quantize(Decimal("0.01"))


def build_tax_year_summary(db: Session, tax_year: TaxYear) -> TaxYearSummary:
    ensure_required_documents(db, tax_year)

    incomes = db.scalars(
        select(TaxIncomeItem).where(TaxIncomeItem.tax_year_id == tax_year.id).order_by(TaxIncomeItem.received_date.desc(), TaxIncomeItem.created_at.desc())
    ).all()
    deductions = db.scalars(
        select(TaxDeduction).where(TaxDeduction.tax_year_id == tax_year.id).order_by(TaxDeduction.created_at.desc())
    ).all()
    documents = db.scalars(
        select(TaxDocument).where(TaxDocument.tax_year_id == tax_year.id).order_by(TaxDocument.created_at.asc())
    ).all()
    payments = db.scalars(
        select(TaxPayment).where(TaxPayment.tax_year_id == tax_year.id).order_by(TaxPayment.payment_date.desc(), TaxPayment.created_at.desc())
    ).all()

    gross_income = sum((to_decimal(item.gross_amount) for item in incomes), ZERO)
    exempt_income = sum((to_decimal(item.exempt_amount) for item in incomes), ZERO)
    taxable_before_adjustments = sum((normalize_taxable_income(item) for item in incomes), ZERO)
    salary_income_present = any(item.income_type == "salary" for item in incomes)
    standard_deduction = NEW_REGIME_STANDARD_DEDUCTION if salary_income_present else ZERO
    allowed_adjustments = sum(
        (
            max(to_decimal(item.eligible_amount if item.eligible_amount is not None else item.amount), ZERO)
            for item in deductions
            if item.section in ALLOWED_NEW_REGIME_DEDUCTION_SECTIONS
        ),
        ZERO,
    )
    taxable_income = max(taxable_before_adjustments - standard_deduction - allowed_adjustments, ZERO)
    tax_before_rebate = compute_tax_from_slabs(taxable_income)
    rebate = tax_before_rebate if taxable_income <= NEW_REGIME_REBATE_LIMIT else ZERO
    tax_before_cess = max(tax_before_rebate - rebate, ZERO)
    cess = (tax_before_cess * CESS_RATE).quantize(Decimal("0.01"))
    total_tax = (tax_before_cess + cess).quantize(Decimal("0.01"))
    effective_tax_rate = ((total_tax / gross_income) * HUNDRED).quantize(Decimal("0.01")) if gross_income > 0 else None

    grouped_by_type: dict[str, TaxIncomeTypeSummary] = {}
    for item in incomes:
        if item.income_type not in grouped_by_type:
            grouped_by_type[item.income_type] = TaxIncomeTypeSummary(
                income_type=item.income_type,
                gross_amount=ZERO,
                taxable_amount=ZERO,
                tds_amount=ZERO,
            )
        summary = grouped_by_type[item.income_type]
        summary.gross_amount += to_decimal(item.gross_amount)
        summary.taxable_amount += normalize_taxable_income(item)
        summary.tds_amount += to_decimal(item.tds_amount)

    total_tds_from_income = sum((to_decimal(item.tds_amount) for item in incomes), ZERO)
    total_tds_payments = sum((to_decimal(item.amount) for item in payments if item.payment_type == "tds"), ZERO)
    total_advance_tax = sum((to_decimal(item.amount) for item in payments if item.payment_type == "advance_tax"), ZERO)
    total_self_assessment_tax = sum((to_decimal(item.amount) for item in payments if item.payment_type == "self_assessment_tax"), ZERO)
    total_refunds_received = sum((to_decimal(item.amount) for item in payments if item.payment_type == "refund"), ZERO)
    total_tds = total_tds_from_income + total_tds_payments
    total_tax_paid_or_credited = total_tds + total_advance_tax + total_self_assessment_tax
    net_tax_balance = (total_tax - total_tax_paid_or_credited + total_refunds_received).quantize(Decimal("0.01"))
    estimated_refund = abs(net_tax_balance) if net_tax_balance < 0 else ZERO
    estimated_payable = net_tax_balance if net_tax_balance > 0 else ZERO

    required_names = [name for _, name in required_documents_for_year({item.income_type for item in incomes})]
    available_count = sum(1 for item in documents if item.status in {"uploaded", "verified"})
    verified_count = sum(1 for item in documents if item.status == "verified")
    missing_documents = [item.name for item in documents if item.status == "missing"]
    total_required = len(required_names)
    missing_count = len(missing_documents)
    readiness_score = (
        (Decimal(total_required - missing_count) / Decimal(total_required) * HUNDRED).quantize(Decimal("0.01"))
        if total_required > 0
        else ZERO
    )

    checklist = [
        TaxChecklistItem(label="Tax year selected", done=True),
        TaxChecklistItem(label="Income items added", done=len(incomes) > 0),
        TaxChecklistItem(label="Required documents tracked", done=total_required > 0 and missing_count == 0),
        TaxChecklistItem(label="TDS or tax payments recorded", done=total_tax_paid_or_credited > 0),
    ]
    if tax_year.filing_status == "filed":
        checklist.append(TaxChecklistItem(label="Return filed", done=True))

    done_count = sum(1 for item in checklist if item.done)
    if tax_year.filing_status == "filed":
        readiness_status = "ready"
        readiness_message = "Return marked as filed for this tax year."
    elif done_count == len(checklist):
        readiness_status = "ready"
        readiness_message = "Core items are in place. Review numbers before filing."
    elif done_count == 0:
        readiness_status = "not_ready"
        readiness_message = "Start by adding income, tax credits, and document status."
    else:
        readiness_status = "in_progress"
        readiness_message = "Some tax inputs are tracked, but filing readiness is incomplete."

    return TaxYearSummary(
        tax_year=serialize_tax_year(tax_year),
        income_summary=TaxIncomeSummary(
            gross_income=gross_income,
            exempt_income=exempt_income,
            taxable_income_before_adjustments=taxable_before_adjustments,
            by_type=sorted(grouped_by_type.values(), key=lambda item: item.gross_amount, reverse=True),
        ),
        new_regime_estimate=TaxEstimateSummary(
            taxable_income=taxable_income,
            standard_deduction=standard_deduction,
            allowed_adjustments=allowed_adjustments,
            tax_before_rebate=tax_before_rebate,
            rebate=rebate,
            tax_before_cess=tax_before_cess,
            cess=cess,
            total_tax=total_tax,
            effective_tax_rate=effective_tax_rate,
        ),
        tds_summary=TaxTdsSummary(
            total_tds=total_tds,
            total_advance_tax=total_advance_tax,
            total_self_assessment_tax=total_self_assessment_tax,
            total_refunds_received=total_refunds_received,
            total_tax_paid_or_credited=total_tax_paid_or_credited,
        ),
        payable_summary=TaxPayableSummary(
            net_tax_balance=net_tax_balance,
            estimated_refund=estimated_refund,
            estimated_payable=estimated_payable,
            balance_label="refund" if estimated_refund > 0 else "payable" if estimated_payable > 0 else "settled",
        ),
        documents_summary=TaxDocumentsSummary(
            total_required=total_required,
            available_count=available_count,
            verified_count=verified_count,
            missing_count=missing_count,
            readiness_score=readiness_score,
            missing_documents=missing_documents,
        ),
        filing_readiness=TaxReadinessSummary(
            status=readiness_status,
            message=readiness_message,
            checklist=checklist,
        ),
    )
