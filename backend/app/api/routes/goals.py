from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.emi_payment import EMIPayment
from app.models.financial_goal import FinancialGoal
from app.schemas.emi_payment import EMIPaymentCreate, EMIPaymentRead
from app.schemas.financial_goal import (
    FinancialGoalCreate,
    FinancialGoalRead,
    FinancialGoalSummary,
    FinancialGoalUpdate,
    MarkGoalAchievedRequest,
    QuickAchievementCreate,
)
from app.services.financial_goals_service import build_financial_goals_summary, list_financial_goals, serialize_financial_goal

router = APIRouter(prefix="/goals", tags=["goals"])


def _validate_goal_linked_sources(
    linked_source_types: list[str] | None,
    linked_source_map: dict[str, list[int]] | None,
) -> None:
    source_types = linked_source_types or []
    if not source_types:
        return
    if "total_networth" in source_types and len(source_types) > 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Total net worth cannot be combined with other linked source types.")
    source_map = linked_source_map or {}
    if "bank_accounts" in source_types and not source_map.get("bank_accounts"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Select at least one bank account.")
    if "fixed_savings" in source_types and not source_map.get("fixed_savings"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Select at least one fixed savings account.")


@router.get("", response_model=list[FinancialGoalRead])
def get_goals(
    active_only: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[FinancialGoalRead]:
    return list_financial_goals(db, active_only=active_only)


@router.get("/summary", response_model=FinancialGoalSummary)
def get_goals_summary(db: Session = Depends(get_db)) -> FinancialGoalSummary:
    goals = list_financial_goals(db)
    return build_financial_goals_summary(db, goals)


@router.get("/{goal_id}", response_model=FinancialGoalRead)
def get_goal(goal_id: int, db: Session = Depends(get_db)) -> FinancialGoalRead:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")
    return serialize_financial_goal(db, goal)


@router.post("", response_model=FinancialGoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: FinancialGoalCreate, db: Session = Depends(get_db)) -> FinancialGoalRead:
    _validate_goal_linked_sources(payload.linked_source_types, payload.linked_source_map)
    values = payload.model_dump(exclude_none=True)
    values["is_active"] = values.get("status", "active") in {"active", "paused"}
    values["is_big_purchase"] = values.get("is_big_purchase", False) or (values.get("achieved_amount") or 0) >= 20000
    goal = FinancialGoal(**values)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return serialize_financial_goal(db, goal)


@router.patch("/{goal_id}", response_model=FinancialGoalRead)
def update_goal(goal_id: int, payload: FinancialGoalUpdate, db: Session = Depends(get_db)) -> FinancialGoalRead:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")

    updates = payload.model_dump(exclude_unset=True)
    _validate_goal_linked_sources(
        updates.get("linked_source_types", goal.linked_source_types),
        updates.get("linked_source_map", goal.linked_source_map),
    )
    if "status" in updates and "is_active" not in updates:
        updates["is_active"] = updates["status"] in {"active", "paused"}
    if "achieved_amount" in updates or "is_big_purchase" in updates:
        achieved_amount = updates.get("achieved_amount", goal.achieved_amount)
        if achieved_amount is not None:
            updates["is_big_purchase"] = updates.get("is_big_purchase", goal.is_big_purchase) or achieved_amount >= 20000
    for field, value in updates.items():
        setattr(goal, field, value)

    db.commit()
    db.refresh(goal)
    return serialize_financial_goal(db, goal)


@router.post("/{goal_id}/mark-achieved", response_model=FinancialGoalRead)
def mark_goal_achieved(goal_id: int, payload: MarkGoalAchievedRequest, db: Session = Depends(get_db)) -> FinancialGoalRead:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")

    goal.status = "achieved"
    goal.is_active = False
    goal.achieved_date = payload.achieved_date
    goal.achieved_amount = payload.achieved_amount
    goal.achievement_type = payload.achievement_type
    goal.payment_source = payload.payment_source
    goal.purchase_notes = payload.purchase_notes
    goal.is_big_purchase = payload.achieved_amount >= 20000
    if goal.current_amount is None or goal.current_amount == 0:
        goal.current_amount = payload.achieved_amount

    db.commit()
    db.refresh(goal)
    return serialize_financial_goal(db, goal)


@router.post("/quick-achievement", response_model=FinancialGoalRead, status_code=status.HTTP_201_CREATED)
def create_quick_achievement(payload: QuickAchievementCreate, db: Session = Depends(get_db)) -> FinancialGoalRead:
    amount = payload.achieved_amount
    goal = FinancialGoal(
        name=payload.name,
        goal_type=payload.goal_type,
        target_amount=amount,
        current_amount=amount,
        linked_source_type="manual",
        linked_source_types=["manual"],
        status="achieved",
        achieved_date=payload.achieved_date,
        achieved_amount=amount,
        achievement_type=payload.achievement_type,
        payment_source=payload.payment_source,
        purchase_notes=payload.purchase_notes,
        is_big_purchase=amount >= 20000,
        is_active=False,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return serialize_financial_goal(db, goal)


@router.get("/{goal_id}/emi-payments", response_model=list[EMIPaymentRead])
def get_goal_emi_payments(goal_id: int, db: Session = Depends(get_db)) -> list[EMIPaymentRead]:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")

    rows = db.scalars(
        select(EMIPayment)
        .where(EMIPayment.goal_id == goal_id)
        .order_by(EMIPayment.payment_date.desc(), EMIPayment.created_at.desc())
    ).all()
    return rows


@router.post("/{goal_id}/emi-payments", response_model=EMIPaymentRead, status_code=status.HTTP_201_CREATED)
def create_goal_emi_payment(goal_id: int, payload: EMIPaymentCreate, db: Session = Depends(get_db)) -> EMIPaymentRead:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")

    principal_amount = payload.principal_amount or Decimal("0")
    interest_amount = payload.interest_amount or Decimal("0")
    gst_amount = payload.gst_amount or Decimal("0")
    processing_fee = payload.processing_fee or Decimal("0")
    processing_fee_gst = payload.processing_fee_gst or Decimal("0")
    total_amount = payload.amount if payload.amount is not None else Decimal("0")
    if total_amount <= 0:
        total_amount = principal_amount + interest_amount + gst_amount + processing_fee + processing_fee_gst

    if total_amount <= 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="EMI payment amount must be greater than zero.")
    if len(payload.payment_month) != 7 or payload.payment_month[4] != '-':
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="payment_month must be in YYYY-MM format.")

    payment = db.scalar(
        select(EMIPayment).where(
            EMIPayment.goal_id == goal_id,
            EMIPayment.payment_month == payload.payment_month,
        )
    )
    previous_amount = payment.amount if payment is not None else Decimal("0")
    if payment is None:
        payment = EMIPayment(goal_id=goal_id, payment_month=payload.payment_month)
        db.add(payment)

    payment.payment_date = payload.payment_date
    payment.principal_amount = principal_amount
    payment.interest_amount = interest_amount
    payment.gst_amount = gst_amount
    payment.processing_fee = processing_fee
    payment.processing_fee_gst = processing_fee_gst
    payment.amount = total_amount
    payment.notes = payload.notes
    goal.current_amount = (goal.current_amount or Decimal("0")) - previous_amount + total_amount
    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/{goal_id}/emi-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal_emi_payment(goal_id: int, payment_id: int, db: Session = Depends(get_db)) -> None:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")

    payment = db.get(EMIPayment, payment_id)
    if payment is None or payment.goal_id != goal_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="EMI payment not found")

    goal.current_amount = max((goal.current_amount or Decimal("0")) - payment.amount, Decimal("0"))
    db.delete(payment)
    db.commit()


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db)) -> None:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")
    db.delete(goal)
    db.commit()
