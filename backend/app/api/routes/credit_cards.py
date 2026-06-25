from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.credit_card import CreditCard
from app.schemas.credit_card_bill import CreditCardBillRead, MarkCreditCardPaidRequest, MarkCreditCardPaidResponse
from app.schemas.credit_card import CreditCardCreate, CreditCardRead, CreditCardUpdate
from app.services.credit_card_bills_service import list_credit_card_bills_query, mark_credit_card_paid, serialize_credit_card_bill
from app.services.credit_cards_service import serialize_credit_card

router = APIRouter(prefix="/credit-cards", tags=["credit-cards"])


@router.get("", response_model=list[CreditCardRead])
def list_credit_cards(db: Session = Depends(get_db)) -> list[CreditCardRead]:
    cards = db.scalars(select(CreditCard).order_by(CreditCard.created_at.desc())).all()
    return [serialize_credit_card(card) for card in cards]


@router.get("/{card_id}", response_model=CreditCardRead)
def get_credit_card(card_id: int, db: Session = Depends(get_db)) -> CreditCardRead:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")
    return serialize_credit_card(card)


@router.get("/{card_id}/bills", response_model=list[CreditCardBillRead])
def list_credit_card_bill_history(card_id: int, db: Session = Depends(get_db)) -> list[CreditCardBillRead]:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    bills = db.scalars(list_credit_card_bills_query(card_id=card_id)).all()
    return [serialize_credit_card_bill(bill) for bill in bills]


@router.post("", response_model=CreditCardRead, status_code=status.HTTP_201_CREATED)
def create_credit_card(payload: CreditCardCreate, db: Session = Depends(get_db)) -> CreditCardRead:
    card = CreditCard(**payload.model_dump(exclude_none=True))
    db.add(card)
    db.commit()
    db.refresh(card)
    return serialize_credit_card(card)


@router.patch("/{card_id}", response_model=CreditCardRead)
def update_credit_card(card_id: int, payload: CreditCardUpdate, db: Session = Depends(get_db)) -> CreditCardRead:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(card, field, value)

    db.commit()
    db.refresh(card)
    return serialize_credit_card(card)


@router.post("/{card_id}/mark-paid", response_model=MarkCreditCardPaidResponse)
def mark_credit_card_bill_paid(
    card_id: int,
    payload: MarkCreditCardPaidRequest,
    db: Session = Depends(get_db),
) -> MarkCreditCardPaidResponse:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    updated_card, bill_record = mark_credit_card_paid(
        db=db,
        card=card,
        paid_amount=payload.paid_amount,
        paid_date=payload.paid_date,
        notes=payload.notes,
    )
    return MarkCreditCardPaidResponse(credit_card=updated_card, bill_record=bill_record)


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_credit_card(card_id: int, db: Session = Depends(get_db)) -> None:
    card = db.get(CreditCard, card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card not found")

    db.delete(card)
    db.commit()
