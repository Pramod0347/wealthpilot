from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.credit_card_bill import CreditCardBill
from app.schemas.credit_card import CreditCardRead
from app.schemas.credit_card_bill import CreditCardBillRead, CreditCardBillUpdate
from app.services.credit_cards_service import serialize_credit_card


def _to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def serialize_credit_card_bill(bill: CreditCardBill) -> CreditCardBillRead:
    return CreditCardBillRead(
        id=bill.id,
        credit_card_id=bill.credit_card_id,
        billing_cycle_start=bill.billing_cycle_start,
        billing_cycle_end=bill.billing_cycle_end,
        bill_generated_date=bill.bill_generated_date,
        due_date=bill.due_date,
        bill_amount=bill.bill_amount,
        paid_amount=bill.paid_amount,
        paid_date=bill.paid_date,
        status=bill.status,
        notes=bill.notes,
        created_at=bill.created_at,
        updated_at=bill.updated_at,
    )


def list_credit_card_bills_query(
    *,
    card_id: int | None = None,
    status_value: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> Select[tuple[CreditCardBill]]:
    query = select(CreditCardBill)
    if card_id is not None:
        query = query.where(CreditCardBill.credit_card_id == card_id)
    if status_value:
        query = query.where(CreditCardBill.status == status_value)
    if from_date is not None:
        query = query.where(CreditCardBill.due_date >= from_date)
    if to_date is not None:
        query = query.where(CreditCardBill.due_date <= to_date)
    return query.order_by(CreditCardBill.paid_date.desc().nullslast(), CreditCardBill.created_at.desc())


def mark_credit_card_paid(
    *,
    db: Session,
    card: CreditCard,
    paid_amount: Decimal | None,
    paid_date: date | None,
    notes: str | None,
) -> tuple[CreditCardRead, CreditCardBillRead]:
    outstanding_amount = _to_decimal(card.current_bill_amount)
    if outstanding_amount <= 0 or (card.status == "paid" and outstanding_amount == 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No outstanding bill to mark as paid.",
        )

    effective_paid_amount = _to_decimal(paid_amount if paid_amount is not None else card.current_bill_amount)
    if effective_paid_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Paid amount must be greater than zero.",
        )

    effective_paid_date = paid_date or date.today()
    is_full_payment = effective_paid_amount >= outstanding_amount

    bill = CreditCardBill(
        credit_card_id=card.id,
        billing_cycle_start=card.billing_cycle_start,
        billing_cycle_end=card.billing_cycle_end,
        bill_generated_date=date.today(),
        due_date=card.due_date,
        bill_amount=outstanding_amount,
        paid_amount=effective_paid_amount,
        paid_date=effective_paid_date,
        status="paid" if is_full_payment else "partial",
        notes=notes,
    )
    db.add(bill)

    if is_full_payment:
        card.current_bill_amount = Decimal("0")
        card.used_amount = Decimal("0")
        card.status = "paid"
    else:
        remaining_amount = outstanding_amount - effective_paid_amount
        card.current_bill_amount = remaining_amount if remaining_amount > 0 else Decimal("0")
        used_amount = _to_decimal(card.used_amount)
        remaining_used_amount = used_amount - effective_paid_amount
        card.used_amount = remaining_used_amount if remaining_used_amount > 0 else Decimal("0")
        card.status = "overdue" if card.due_date < effective_paid_date else "due_soon"

    db.commit()
    db.refresh(card)
    db.refresh(bill)
    return serialize_credit_card(card), serialize_credit_card_bill(bill)


def apply_credit_card_bill_updates(bill: CreditCardBill, payload: CreditCardBillUpdate) -> CreditCardBill:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(bill, field, value)
    return bill
