from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.holding import Holding
from app.models.investment_transaction import InvestmentTransaction
from app.schemas.investment_transaction import (
    InvestmentTransactionCreate, InvestmentTransactionRead, InvestmentTransactionUpdate,
)
from app.services.investment_transactions_service import (
    calculate_realized_pnl,
    realized_pnl_by_transaction,
    recalculate_holding,
    serialize_transaction,
)
from app.services.portfolio_snapshot_service import upsert_today_snapshot

router = APIRouter(prefix="/investment-transactions", tags=["investment transactions"])


def _row(db: Session, transaction_id: int) -> InvestmentTransaction:
    row = db.scalar(select(InvestmentTransaction).options(joinedload(InvestmentTransaction.investment)).where(InvestmentTransaction.id == transaction_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Investment transaction not found")
    return row


@router.get("", response_model=list[InvestmentTransactionRead])
def list_transactions(investment_id: int | None = Query(default=None), db: Session = Depends(get_db)):
    query = select(InvestmentTransaction).options(joinedload(InvestmentTransaction.investment))
    if investment_id is not None:
        query = query.where(InvestmentTransaction.investment_id == investment_id)
    rows = db.scalars(query.order_by(InvestmentTransaction.transaction_date.desc(), InvestmentTransaction.id.desc())).all()
    realized = realized_pnl_by_transaction(db, (row.investment_id for row in rows))
    return [serialize_transaction(row, realized.get(row.id, Decimal("0"))) for row in rows]


@router.post("/investments/{investment_id}", response_model=InvestmentTransactionRead, status_code=201)
def create_transaction(investment_id: int, payload: InvestmentTransactionCreate, db: Session = Depends(get_db)):
    holding = db.get(Holding, investment_id)
    if holding is None:
        raise HTTPException(status_code=404, detail="Investment not found")
    row = InvestmentTransaction(investment_id=investment_id, **payload.model_dump())
    try:
        db.add(row)
        db.flush()
        recalculate_holding(db, holding)
        db.commit()
    except Exception:
        db.rollback()
        raise
    row = _row(db, row.id)
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass
    return serialize_transaction(row, calculate_realized_pnl(db, row))


@router.patch("/{transaction_id}", response_model=InvestmentTransactionRead)
def update_transaction(transaction_id: int, payload: InvestmentTransactionUpdate, db: Session = Depends(get_db)):
    row = _row(db, transaction_id)
    try:
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        db.flush()
        recalculate_holding(db, row.investment)
        db.commit()
    except Exception:
        db.rollback()
        raise
    updated = _row(db, transaction_id)
    return serialize_transaction(updated, calculate_realized_pnl(db, updated))


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db)):
    row = _row(db, transaction_id)
    holding = row.investment
    try:
        db.delete(row)
        db.flush()
        recalculate_holding(db, holding)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return Response(status_code=status.HTTP_204_NO_CONTENT)
