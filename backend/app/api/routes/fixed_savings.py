from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.fixed_savings_account import FixedSavingsAccount
from app.schemas.fixed_savings_account import (
    FixedSavingsAccountCreate,
    FixedSavingsAccountRead,
    FixedSavingsAccountUpdate,
    FixedSavingsSummary,
)
from app.services.fixed_savings_service import (
    build_fixed_savings_summary,
    serialize_fixed_savings_account,
)

router = APIRouter(prefix="/fixed-savings", tags=["fixed-savings"])


@router.get("", response_model=list[FixedSavingsAccountRead])
def list_fixed_savings_accounts(db: Session = Depends(get_db)) -> list[FixedSavingsAccountRead]:
    accounts = db.scalars(
        select(FixedSavingsAccount).order_by(
            FixedSavingsAccount.current_value.desc(),
            FixedSavingsAccount.created_at.desc(),
        )
    ).all()
    return [serialize_fixed_savings_account(account) for account in accounts]


@router.get("/summary", response_model=FixedSavingsSummary)
def get_fixed_savings_summary(db: Session = Depends(get_db)) -> FixedSavingsSummary:
    return build_fixed_savings_summary(db)


@router.get("/{account_id}", response_model=FixedSavingsAccountRead)
def get_fixed_savings_account(account_id: int, db: Session = Depends(get_db)) -> FixedSavingsAccountRead:
    account = db.get(FixedSavingsAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed savings account not found")
    return serialize_fixed_savings_account(account)


@router.post("", response_model=FixedSavingsAccountRead, status_code=status.HTTP_201_CREATED)
def create_fixed_savings_account(payload: FixedSavingsAccountCreate, db: Session = Depends(get_db)) -> FixedSavingsAccountRead:
    account = FixedSavingsAccount(**payload.model_dump(exclude_none=True))
    db.add(account)
    db.commit()
    db.refresh(account)
    return serialize_fixed_savings_account(account)


@router.patch("/{account_id}", response_model=FixedSavingsAccountRead)
def update_fixed_savings_account(
    account_id: int, payload: FixedSavingsAccountUpdate, db: Session = Depends(get_db)
) -> FixedSavingsAccountRead:
    account = db.get(FixedSavingsAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed savings account not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(account, field, value)

    db.commit()
    db.refresh(account)
    return serialize_fixed_savings_account(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_fixed_savings_account(account_id: int, db: Session = Depends(get_db)) -> None:
    account = db.get(FixedSavingsAccount, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fixed savings account not found")

    db.delete(account)
    db.commit()
