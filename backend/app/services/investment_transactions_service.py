from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.investment_transaction import InvestmentTransaction


ZERO = Decimal("0")


def recalculate_holding(db: Session, holding: Holding) -> Holding:
    """Replay the ledger so edits/deletes and back-dated trades remain deterministic."""
    rows = db.scalars(
        select(InvestmentTransaction)
        .where(InvestmentTransaction.investment_id == holding.id)
        .order_by(InvestmentTransaction.transaction_date, InvestmentTransaction.id)
    ).all()
    quantity = ZERO
    average_price = ZERO
    for row in rows:
        trade_quantity = Decimal(row.quantity)
        if row.transaction_type == "BUY":
            new_quantity = quantity + trade_quantity
            average_price = (
                ((quantity * average_price) + (trade_quantity * Decimal(row.price_per_unit))) / new_quantity
                if new_quantity else ZERO
            )
            quantity = new_quantity
        else:
            if trade_quantity > quantity:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Cannot sell {trade_quantity}; only {quantity} is available at this transaction date.",
                )
            quantity -= trade_quantity
            if quantity == ZERO:
                average_price = ZERO

    holding.quantity = quantity
    holding.avg_buy_price = average_price
    holding.status = "Closed" if quantity == ZERO else "Active"
    db.flush()
    return holding


def serialize_transaction(row: InvestmentTransaction) -> dict[str, object]:
    return {
        "id": row.id,
        "investment_id": row.investment_id,
        "investment_name": row.investment.company_name,
        "investment_symbol": row.investment.symbol,
        "investment_asset_type": row.investment.asset_type,
        "transaction_type": row.transaction_type,
        "transaction_mode": row.transaction_mode,
        "quantity": row.quantity,
        "price_per_unit": row.price_per_unit,
        "fees": row.fees,
        "taxes": row.taxes,
        "exchange_rate": row.exchange_rate,
        "transaction_date": row.transaction_date,
        "notes": row.notes,
        "total": (
            (row.quantity * row.price_per_unit + row.fees + row.taxes)
            if row.transaction_type == "BUY"
            else (row.quantity * row.price_per_unit - row.fees - row.taxes)
        ) * row.exchange_rate,
        "created_at": row.created_at,
    }
