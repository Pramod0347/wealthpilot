from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.bank_account import BankAccount
from app.schemas.bank_account import (
    BankAccountCreate,
    BankAccountRead,
    BankAccountsSummary,
    BankAccountUpdate,
)
from app.services.bank_accounts_service import build_bank_accounts_summary, serialize_bank_account

router = APIRouter(prefix="/bank-accounts", tags=["bank-accounts"])


@router.get("", response_model=list[BankAccountRead])
def list_bank_accounts(db: Session = Depends(get_db)) -> list[BankAccountRead]:
    accounts = db.scalars(select(BankAccount).order_by(BankAccount.balance.desc(), BankAccount.created_at.desc())).all()
    return [serialize_bank_account(account) for account in accounts]


@router.get("/summary", response_model=BankAccountsSummary)
def get_bank_accounts_summary(db: Session = Depends(get_db)) -> BankAccountsSummary:
    return build_bank_accounts_summary(db)


@router.get("/{account_id}", response_model=BankAccountRead)
def get_bank_account(account_id: int, db: Session = Depends(get_db)) -> BankAccountRead:
    account = db.get(BankAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")
    return serialize_bank_account(account)


@router.post("", response_model=BankAccountRead, status_code=status.HTTP_201_CREATED)
def create_bank_account(payload: BankAccountCreate, db: Session = Depends(get_db)) -> BankAccountRead:
    account = BankAccount(**payload.model_dump(exclude_none=True))
    db.add(account)
    db.commit()
    db.refresh(account)
    return serialize_bank_account(account)


@router.patch("/{account_id}", response_model=BankAccountRead)
def update_bank_account(account_id: int, payload: BankAccountUpdate, db: Session = Depends(get_db)) -> BankAccountRead:
    account = db.get(BankAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)
    return serialize_bank_account(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bank_account(account_id: int, db: Session = Depends(get_db)) -> None:
    account = db.get(BankAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bank account not found")

    db.delete(account)
    db.commit()
