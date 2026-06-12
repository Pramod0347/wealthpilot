from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.cashflow_entry import CashflowEntry
from app.schemas.cashflow import CashflowEntryCreate, CashflowEntryRead, CashflowEntryUpdate, CashflowSummary
from app.services.cashflow_service import build_cashflow_summary, list_cashflow_months, serialize_cashflow_entry

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


@router.get("", response_model=list[CashflowEntryRead])
def list_cashflow_entries(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CashflowEntryRead]:
    query = select(CashflowEntry)
    if month:
        query = query.where(CashflowEntry.month == month)
    entries = db.scalars(query.order_by(CashflowEntry.month.desc(), CashflowEntry.entry_type.asc(), CashflowEntry.created_at.desc())).all()
    return [serialize_cashflow_entry(entry) for entry in entries]


@router.get("/months", response_model=list[str])
def get_cashflow_months(db: Session = Depends(get_db)) -> list[str]:
    return list_cashflow_months(db)


@router.get("/summary", response_model=CashflowSummary)
def get_cashflow_summary(
    month: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> CashflowSummary:
    return build_cashflow_summary(db, month)


@router.get("/{entry_id}", response_model=CashflowEntryRead)
def get_cashflow_entry(entry_id: int, db: Session = Depends(get_db)) -> CashflowEntryRead:
    entry = db.get(CashflowEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashflow entry not found")
    return serialize_cashflow_entry(entry)


@router.post("", response_model=CashflowEntryRead, status_code=status.HTTP_201_CREATED)
def create_cashflow_entry(payload: CashflowEntryCreate, db: Session = Depends(get_db)) -> CashflowEntryRead:
    entry = CashflowEntry(**payload.model_dump(exclude_none=True))
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return serialize_cashflow_entry(entry)


@router.patch("/{entry_id}", response_model=CashflowEntryRead)
def update_cashflow_entry(entry_id: int, payload: CashflowEntryUpdate, db: Session = Depends(get_db)) -> CashflowEntryRead:
    entry = db.get(CashflowEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashflow entry not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return serialize_cashflow_entry(entry)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cashflow_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    entry = db.get(CashflowEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cashflow entry not found")
    db.delete(entry)
    db.commit()
