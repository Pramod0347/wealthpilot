from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.financial_goal import FinancialGoal
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


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db)) -> None:
    goal = db.get(FinancialGoal, goal_id)
    if goal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Financial goal not found")
    db.delete(goal)
    db.commit()
