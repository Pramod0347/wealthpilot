from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tax_deduction import TaxDeduction
from app.models.tax_document import TaxDocument
from app.models.tax_income_item import TaxIncomeItem
from app.models.tax_payment import TaxPayment
from app.models.tax_year import TaxYear
from app.schemas.tax import (
    TaxDeductionCreate,
    TaxDeductionRead,
    TaxDeductionUpdate,
    TaxDocumentCreate,
    TaxDocumentRead,
    TaxDocumentUpdate,
    TaxIncomeItemCreate,
    TaxIncomeItemRead,
    TaxIncomeItemUpdate,
    TaxPaymentCreate,
    TaxPaymentRead,
    TaxPaymentUpdate,
    TaxYearCreate,
    TaxYearRead,
    TaxYearSummary,
    TaxYearUpdate,
)
from app.services.tax_service import (
    build_tax_year_summary,
    ensure_required_documents,
    get_tax_year_or_404,
    serialize_tax_deduction,
    serialize_tax_document,
    serialize_tax_income_item,
    serialize_tax_payment,
    serialize_tax_year,
)
from app.services.tax_rules import NEW_REGIME_ASSESSMENT_YEAR, NEW_REGIME_FINANCIAL_YEAR

router = APIRouter(prefix="/tax", tags=["tax"])


def require_tax_year(db: Session, tax_year_id: int) -> TaxYear:
    tax_year = get_tax_year_or_404(db, tax_year_id)
    if tax_year is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax year not found")
    return tax_year


def require_item(db: Session, model: type, item_id: int, label: str):
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found")
    return item


@router.get("/years", response_model=list[TaxYearRead])
def get_tax_years(db: Session = Depends(get_db)) -> list[TaxYearRead]:
    years = db.scalars(select(TaxYear).order_by(TaxYear.financial_year.desc(), TaxYear.created_at.desc())).all()
    return [serialize_tax_year(year) for year in years]


@router.post("/years", response_model=TaxYearRead, status_code=status.HTTP_201_CREATED)
def create_tax_year(payload: TaxYearCreate, db: Session = Depends(get_db)) -> TaxYearRead:
    year = TaxYear(
        financial_year=payload.financial_year or NEW_REGIME_FINANCIAL_YEAR,
        assessment_year=payload.assessment_year or NEW_REGIME_ASSESSMENT_YEAR,
        regime="new",
        filing_status=payload.filing_status,
        filing_date=payload.filing_date,
        notes=payload.notes,
    )
    db.add(year)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This financial year already exists.") from exc
    ensure_required_documents(db, year)
    db.commit()
    db.refresh(year)
    return serialize_tax_year(year)


@router.get("/years/{tax_year_id}", response_model=TaxYearRead)
def get_tax_year(tax_year_id: int, db: Session = Depends(get_db)) -> TaxYearRead:
    return serialize_tax_year(require_tax_year(db, tax_year_id))


@router.patch("/years/{tax_year_id}", response_model=TaxYearRead)
def update_tax_year(tax_year_id: int, payload: TaxYearUpdate, db: Session = Depends(get_db)) -> TaxYearRead:
    year = require_tax_year(db, tax_year_id)
    updates = payload.model_dump(exclude_unset=True)
    if "regime" in updates:
        updates["regime"] = "new"
    for field, value in updates.items():
        setattr(year, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This financial year already exists.") from exc
    db.refresh(year)
    return serialize_tax_year(year)


@router.delete("/years/{tax_year_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_year(tax_year_id: int, db: Session = Depends(get_db)) -> None:
    year = require_tax_year(db, tax_year_id)
    db.delete(year)
    db.commit()


@router.get("/years/{tax_year_id}/income", response_model=list[TaxIncomeItemRead])
def get_tax_income(tax_year_id: int, db: Session = Depends(get_db)) -> list[TaxIncomeItemRead]:
    require_tax_year(db, tax_year_id)
    items = db.scalars(
        select(TaxIncomeItem).where(TaxIncomeItem.tax_year_id == tax_year_id).order_by(TaxIncomeItem.received_date.desc(), TaxIncomeItem.created_at.desc())
    ).all()
    return [serialize_tax_income_item(item) for item in items]


@router.post("/years/{tax_year_id}/income", response_model=TaxIncomeItemRead, status_code=status.HTTP_201_CREATED)
def create_tax_income(tax_year_id: int, payload: TaxIncomeItemCreate, db: Session = Depends(get_db)) -> TaxIncomeItemRead:
    tax_year = require_tax_year(db, tax_year_id)
    item = TaxIncomeItem(tax_year_id=tax_year.id, **payload.model_dump())
    db.add(item)
    db.flush()
    ensure_required_documents(db, tax_year)
    db.commit()
    db.refresh(item)
    return serialize_tax_income_item(item)


@router.patch("/income/{income_id}", response_model=TaxIncomeItemRead)
def update_tax_income(income_id: int, payload: TaxIncomeItemUpdate, db: Session = Depends(get_db)) -> TaxIncomeItemRead:
    item = require_item(db, TaxIncomeItem, income_id, "Tax income item")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    tax_year = require_tax_year(db, item.tax_year_id)
    ensure_required_documents(db, tax_year)
    db.commit()
    db.refresh(item)
    return serialize_tax_income_item(item)


@router.delete("/income/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_income(income_id: int, db: Session = Depends(get_db)) -> None:
    item = require_item(db, TaxIncomeItem, income_id, "Tax income item")
    db.delete(item)
    db.commit()


@router.get("/years/{tax_year_id}/deductions", response_model=list[TaxDeductionRead])
def get_tax_deductions(tax_year_id: int, db: Session = Depends(get_db)) -> list[TaxDeductionRead]:
    require_tax_year(db, tax_year_id)
    items = db.scalars(select(TaxDeduction).where(TaxDeduction.tax_year_id == tax_year_id).order_by(TaxDeduction.created_at.desc())).all()
    return [serialize_tax_deduction(item) for item in items]


@router.post("/years/{tax_year_id}/deductions", response_model=TaxDeductionRead, status_code=status.HTTP_201_CREATED)
def create_tax_deduction(tax_year_id: int, payload: TaxDeductionCreate, db: Session = Depends(get_db)) -> TaxDeductionRead:
    require_tax_year(db, tax_year_id)
    item = TaxDeduction(tax_year_id=tax_year_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_tax_deduction(item)


@router.patch("/deductions/{deduction_id}", response_model=TaxDeductionRead)
def update_tax_deduction(deduction_id: int, payload: TaxDeductionUpdate, db: Session = Depends(get_db)) -> TaxDeductionRead:
    item = require_item(db, TaxDeduction, deduction_id, "Tax deduction")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return serialize_tax_deduction(item)


@router.delete("/deductions/{deduction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_deduction(deduction_id: int, db: Session = Depends(get_db)) -> None:
    item = require_item(db, TaxDeduction, deduction_id, "Tax deduction")
    db.delete(item)
    db.commit()


@router.get("/years/{tax_year_id}/documents", response_model=list[TaxDocumentRead])
def get_tax_documents(tax_year_id: int, db: Session = Depends(get_db)) -> list[TaxDocumentRead]:
    tax_year = require_tax_year(db, tax_year_id)
    ensure_required_documents(db, tax_year)
    db.commit()
    items = db.scalars(select(TaxDocument).where(TaxDocument.tax_year_id == tax_year_id).order_by(TaxDocument.created_at.asc())).all()
    return [serialize_tax_document(item) for item in items]


@router.post("/years/{tax_year_id}/documents", response_model=TaxDocumentRead, status_code=status.HTTP_201_CREATED)
def create_tax_document(tax_year_id: int, payload: TaxDocumentCreate, db: Session = Depends(get_db)) -> TaxDocumentRead:
    require_tax_year(db, tax_year_id)
    item = TaxDocument(tax_year_id=tax_year_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_tax_document(item)


@router.patch("/documents/{document_id}", response_model=TaxDocumentRead)
def update_tax_document(document_id: int, payload: TaxDocumentUpdate, db: Session = Depends(get_db)) -> TaxDocumentRead:
    item = require_item(db, TaxDocument, document_id, "Tax document")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return serialize_tax_document(item)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_document(document_id: int, db: Session = Depends(get_db)) -> None:
    item = require_item(db, TaxDocument, document_id, "Tax document")
    db.delete(item)
    db.commit()


@router.get("/years/{tax_year_id}/payments", response_model=list[TaxPaymentRead])
def get_tax_payments(tax_year_id: int, db: Session = Depends(get_db)) -> list[TaxPaymentRead]:
    require_tax_year(db, tax_year_id)
    items = db.scalars(
        select(TaxPayment).where(TaxPayment.tax_year_id == tax_year_id).order_by(TaxPayment.payment_date.desc(), TaxPayment.created_at.desc())
    ).all()
    return [serialize_tax_payment(item) for item in items]


@router.post("/years/{tax_year_id}/payments", response_model=TaxPaymentRead, status_code=status.HTTP_201_CREATED)
def create_tax_payment(tax_year_id: int, payload: TaxPaymentCreate, db: Session = Depends(get_db)) -> TaxPaymentRead:
    require_tax_year(db, tax_year_id)
    item = TaxPayment(tax_year_id=tax_year_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return serialize_tax_payment(item)


@router.patch("/payments/{payment_id}", response_model=TaxPaymentRead)
def update_tax_payment(payment_id: int, payload: TaxPaymentUpdate, db: Session = Depends(get_db)) -> TaxPaymentRead:
    item = require_item(db, TaxPayment, payment_id, "Tax payment")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return serialize_tax_payment(item)


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_payment(payment_id: int, db: Session = Depends(get_db)) -> None:
    item = require_item(db, TaxPayment, payment_id, "Tax payment")
    db.delete(item)
    db.commit()


@router.get("/years/{tax_year_id}/summary", response_model=TaxYearSummary)
def get_tax_year_summary(tax_year_id: int, db: Session = Depends(get_db)) -> TaxYearSummary:
    tax_year = require_tax_year(db, tax_year_id)
    summary = build_tax_year_summary(db, tax_year)
    db.commit()
    return summary
