from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.credit_card import CreditCard
from app.models.credit_card_bill import CreditCardBill
from app.schemas.credit_card_bill import CreditCardBillRead, CreditCardBillUpdate
from app.services.credit_card_bills_service import (
    apply_credit_card_bill_updates,
    list_credit_card_bills_query,
    serialize_credit_card_bill,
)

router = APIRouter(prefix="/credit-card-bills", tags=["credit-card-bills"])


@router.get("", response_model=list[CreditCardBillRead])
def list_credit_card_bills(
    card_id: int | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[CreditCardBillRead]:
    bills = db.scalars(
        list_credit_card_bills_query(
            card_id=card_id,
            status_value=status_value,
            from_date=from_date,
            to_date=to_date,
        )
    ).all()
    return [serialize_credit_card_bill(bill) for bill in bills]


@router.patch("/{bill_id}", response_model=CreditCardBillRead)
def update_credit_card_bill(
    bill_id: int,
    payload: CreditCardBillUpdate,
    db: Session = Depends(get_db),
) -> CreditCardBillRead:
    bill = db.get(CreditCardBill, bill_id)
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card bill not found")

    apply_credit_card_bill_updates(bill, payload)
    db.commit()
    db.refresh(bill)
    return serialize_credit_card_bill(bill)


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_card_bill(bill_id: int, db: Session = Depends(get_db)) -> None:
    bill = db.get(CreditCardBill, bill_id)
    if bill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card bill not found")
    db.delete(bill)
    db.commit()
