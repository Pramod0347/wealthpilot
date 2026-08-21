from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.deposit import Deposit
from app.schemas.deposit import DepositRead, DepositSummary


def serialize_deposit(deposit: Deposit) -> DepositRead:
    return DepositRead.model_validate(deposit)


def build_deposit_summary(db: Session) -> DepositSummary:
    stats = db.execute(
        select(
            func.coalesce(func.sum(Deposit.amount), 0),
            func.coalesce(func.sum(case((Deposit.status == "active", Deposit.amount), else_=0)), 0),
            func.coalesce(func.sum(case(((Deposit.refundable.is_(True)) & (Deposit.status == "active"), Deposit.amount), else_=0)), 0),
            func.count(Deposit.id),
            func.coalesce(func.sum(case((Deposit.status == "active", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Deposit.status == "returned", Deposit.returned_amount), else_=0)), 0),
            func.coalesce(func.sum(case((Deposit.status == "returned", Deposit.return_deduction), else_=0)), 0),
            func.coalesce(func.sum(case((Deposit.status == "returned", 1), else_=0)), 0),
        )
    ).one()

    return DepositSummary(
        total_deposits=Decimal(stats[1]),
        active_deposits=Decimal(stats[1]),
        refundable_amount=Decimal(stats[2]),
        deposits_count=int(stats[3]),
        active_count=int(stats[4]),
        returned_amount=Decimal(stats[5]),
        return_deductions=Decimal(stats[6]),
        returned_count=int(stats[7]),
    )
