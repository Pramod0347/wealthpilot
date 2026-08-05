from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tax_year import TaxYear
from app.schemas.tax import TaxYearCreate, TaxYearRead, TaxYearUpdate
from app.services.tax_config_service import tax_config_service

router = APIRouter(prefix="/tax", tags=["tax"])
_OWNER_USER_ID = "owner"


def require_tax_year(db: Session, tax_year_id: int) -> TaxYear:
    """Fetch tax year or raise 404"""
    tax_year = db.get(TaxYear, tax_year_id)
    if tax_year is None or tax_year.user_id != _OWNER_USER_ID:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax year not found")
    return tax_year


@router.get("/years", response_model=list[TaxYearRead])
def get_tax_years(db: Session = Depends(get_db)) -> list[TaxYear]:
    """List all filed tax years for the user"""
    return list(
        db.scalars(
            select(TaxYear)
            .where(TaxYear.user_id == _OWNER_USER_ID)
            .order_by(TaxYear.financial_year.desc())
        ).all()
    )


@router.get("/years/{tax_year_id}/dashboard")
def get_tax_dashboard(tax_year_id: int, db: Session = Depends(get_db)) -> dict:
    """
    Get complete tax dashboard data for a fiscal year.
    
    Data is sourced entirely from the ITR JSON configuration file.
    No hardcoded values exist in this endpoint.
    
    Requires:
    - Tax year must be marked as "Filed" or "Verified"
    - Corresponding ITR JSON file must exist in backend/app/config/
    """
    tax_year = require_tax_year(db, tax_year_id)
    if tax_year.status not in {"Filed", "Verified"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No return filed for this financial year.",
        )
    return tax_config_service.get_tax_data(tax_year.financial_year, tax_year.assessment_year)


@router.post("/years", response_model=TaxYearRead, status_code=status.HTTP_201_CREATED)
def create_tax_year(payload: TaxYearCreate, db: Session = Depends(get_db)) -> TaxYear:
    """Create a new tax year entry"""
    year = TaxYear(user_id=_OWNER_USER_ID, **payload.model_dump())
    db.add(year)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This financial year already exists.",
        ) from exc
    db.refresh(year)
    return year


@router.patch("/years/{tax_year_id}", response_model=TaxYearRead)
def update_tax_year(tax_year_id: int, payload: TaxYearUpdate, db: Session = Depends(get_db)) -> TaxYear:
    """Update tax year metadata"""
    year = require_tax_year(db, tax_year_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(year, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This financial year already exists.",
        ) from exc
    db.refresh(year)
    return year


@router.delete("/years/{tax_year_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_year(tax_year_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a tax year entry"""
    db.delete(require_tax_year(db, tax_year_id))
    db.commit()
