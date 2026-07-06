from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.deposit import Deposit
from app.schemas.deposit import DepositCreate, DepositRead, DepositSummary, DepositUpdate
from app.services.deposit_service import build_deposit_summary, serialize_deposit

router = APIRouter(prefix="/deposits", tags=["deposits"])


@router.get("", response_model=list[DepositRead])
def list_deposits(db: Session = Depends(get_db)) -> list[DepositRead]:
    deposits = db.scalars(select(Deposit).order_by(Deposit.status.asc(), Deposit.created_at.desc())).all()
    return [serialize_deposit(deposit) for deposit in deposits]


@router.get("/summary", response_model=DepositSummary)
def get_deposit_summary(db: Session = Depends(get_db)) -> DepositSummary:
    return build_deposit_summary(db)


@router.get("/{deposit_id}", response_model=DepositRead)
def get_deposit(deposit_id: int, db: Session = Depends(get_db)) -> DepositRead:
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deposit not found")
    return serialize_deposit(deposit)


@router.post("", response_model=DepositRead, status_code=status.HTTP_201_CREATED)
def create_deposit(payload: DepositCreate, db: Session = Depends(get_db)) -> DepositRead:
    deposit = Deposit(**payload.model_dump(exclude_none=True))
    db.add(deposit)
    db.commit()
    db.refresh(deposit)
    return serialize_deposit(deposit)


@router.put("/{deposit_id}", response_model=DepositRead)
def update_deposit(deposit_id: int, payload: DepositUpdate, db: Session = Depends(get_db)) -> DepositRead:
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deposit not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(deposit, field, value)

    db.commit()
    db.refresh(deposit)
    return serialize_deposit(deposit)


@router.delete("/{deposit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deposit(deposit_id: int, db: Session = Depends(get_db)) -> None:
    deposit = db.get(Deposit, deposit_id)
    if deposit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deposit not found")

    db.delete(deposit)
    db.commit()
