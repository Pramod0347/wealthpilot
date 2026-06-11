from __future__ import annotations

from datetime import date

from app.models.credit_card import CreditCard
from app.schemas.credit_card import CreditCardRead
from app.services.calculations import calculate_available_limit, calculate_utilization_pct


def calculate_days_until_due(due_date: date) -> int:
    return (due_date - date.today()).days


def serialize_credit_card(card: CreditCard) -> CreditCardRead:
    available_limit = calculate_available_limit(card.total_limit, card.used_amount)
    utilization_pct = calculate_utilization_pct(card.used_amount, card.total_limit)

    return CreditCardRead(
        id=card.id,
        card_name=card.card_name,
        bank_name=card.bank_name,
        last4=card.last4,
        total_limit=card.total_limit,
        billing_cycle_start=card.billing_cycle_start,
        billing_cycle_end=card.billing_cycle_end,
        due_date=card.due_date,
        current_bill_amount=card.current_bill_amount,
        used_amount=card.used_amount,
        status=card.status,
        notes=card.notes,
        created_at=card.created_at,
        updated_at=card.updated_at,
        available_limit=available_limit,
        utilization_pct=utilization_pct,
        days_until_due=calculate_days_until_due(card.due_date),
    )
