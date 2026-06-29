from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.cashflow_entry import CashflowEntry
from app.models.financial_goal import FinancialGoal
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.schemas.financial_goal import FinancialGoalRead, FinancialGoalSummary
from app.services.holdings_service import serialize_holding

ZERO = Decimal("0")
HUNDRED = Decimal("100")


@dataclass
class GoalComputation:
    resolved_current_amount: Decimal
    progress_pct: Decimal
    shortfall_amount: Decimal
    months_remaining: int | None
    required_monthly_saving: Decimal | None
    progress_status: str
    is_achieved: bool
    final_amount: Decimal
    variance_amount: Decimal
    variance_pct: Decimal | None


def _to_decimal(value: object | None) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(value)


def _sum_selected_bank_accounts(db: Session, ids: list[int]) -> Decimal:
    if not ids:
        return ZERO
    return _to_decimal(db.scalar(select(func.coalesce(func.sum(BankAccount.balance), 0)).where(BankAccount.id.in_(ids))))


def _sum_selected_fixed_savings(db: Session, ids: list[int]) -> Decimal:
    if not ids:
        return ZERO
    return _to_decimal(
        db.scalar(select(func.coalesce(func.sum(FixedSavingsAccount.current_value), 0)).where(FixedSavingsAccount.id.in_(ids)))
    )


def _sum_selected_holdings(db: Session, ids: list[int]) -> Decimal:
    if not ids:
        return ZERO
    holdings = db.scalars(select(Holding).where(Holding.id.in_(ids))).all()
    return sum((serialize_holding(holding).current_value for holding in holdings), ZERO)


def _compute_total_net_worth(db: Session) -> Decimal:
    holdings = db.scalars(select(Holding)).all()
    holdings_value = sum((serialize_holding(holding).current_value for holding in holdings), ZERO)
    bank_cash = _to_decimal(db.scalar(select(func.coalesce(func.sum(BankAccount.balance), 0))))
    fixed_savings = _to_decimal(db.scalar(select(func.coalesce(func.sum(FixedSavingsAccount.current_value), 0))))
    return holdings_value + bank_cash + fixed_savings


def _average_monthly_net_savings(db: Session) -> Decimal | None:
    monthly_rows = db.execute(
        select(
            CashflowEntry.month,
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", CashflowEntry.amount), else_=0)), 0),
        )
        .group_by(CashflowEntry.month)
    ).all()
    if not monthly_rows:
        return None
    total_net = sum((_to_decimal(row[1]) - _to_decimal(row[2]) for row in monthly_rows), ZERO)
    return total_net / Decimal(len(monthly_rows))


def _months_remaining(target_date: date | None, today: date) -> int | None:
    if target_date is None:
        return None
    if target_date <= today:
        return 0
    months = (target_date.year - today.year) * 12 + (target_date.month - today.month)
    if target_date.day > today.day:
        months += 1
    return max(months, 1)


def _months_between(start_date: date, end_date: date) -> int:
    if end_date <= start_date:
        return 0
    months = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month)
    if end_date.day > start_date.day:
        months += 1
    return max(months, 1)


def _resolve_current_amount(db: Session, goal: FinancialGoal) -> Decimal:
    linked_types = goal.linked_source_types or ([goal.linked_source_type] if goal.linked_source_type else ["manual"])
    linked_source_map = goal.linked_source_map or (
        {goal.linked_source_type: goal.linked_source_ids}
        if goal.linked_source_type and goal.linked_source_ids is not None
        else {}
    )

    if "total_networth" in linked_types:
        return _compute_total_net_worth(db)

    resolved_amount = ZERO
    if "manual" in linked_types:
        resolved_amount += _to_decimal(goal.current_amount)
    if "bank_accounts" in linked_types:
        linked_ids = [int(value) for value in (linked_source_map.get("bank_accounts") or []) if isinstance(value, int) or str(value).isdigit()]
        resolved_amount += _sum_selected_bank_accounts(db, linked_ids)
    if "fixed_savings" in linked_types:
        linked_ids = [int(value) for value in (linked_source_map.get("fixed_savings") or []) if isinstance(value, int) or str(value).isdigit()]
        resolved_amount += _sum_selected_fixed_savings(db, linked_ids)
    if "holdings" in linked_types:
        linked_ids = [int(value) for value in (linked_source_map.get("holdings") or []) if isinstance(value, int) or str(value).isdigit()]
        resolved_amount += _sum_selected_holdings(db, linked_ids)
    return resolved_amount


def compute_goal_metrics(db: Session, goal: FinancialGoal, average_monthly_net_savings: Decimal | None = None) -> GoalComputation:
    today = date.today()
    target_amount = max(_to_decimal(goal.target_amount), ZERO)
    resolved_current_amount = max(_resolve_current_amount(db, goal), ZERO)
    is_achieved = goal.status == "achieved"
    final_amount = max(_to_decimal(goal.achieved_amount), ZERO) if goal.achieved_amount is not None else resolved_current_amount
    variance_amount = final_amount - target_amount
    variance_pct = ((variance_amount / target_amount) * HUNDRED) if target_amount > 0 else None
    raw_progress_pct = (resolved_current_amount / target_amount) * HUNDRED if target_amount > 0 else ZERO
    progress_pct = min(raw_progress_pct, HUNDRED)
    shortfall_amount = max(target_amount - resolved_current_amount, ZERO)
    months_remaining = _months_remaining(goal.target_date, today)
    required_monthly_saving = None
    if months_remaining is not None and months_remaining > 0 and shortfall_amount > 0:
        required_monthly_saving = shortfall_amount / Decimal(months_remaining)

    if is_achieved or raw_progress_pct >= HUNDRED:
        progress_status = "completed"
    elif goal.target_date is not None and goal.target_date < today:
        progress_status = "behind"
    else:
        progress_status = "unknown"
        if required_monthly_saving is not None and average_monthly_net_savings is not None:
            if average_monthly_net_savings <= 0:
                progress_status = "behind"
            else:
                ratio = required_monthly_saving / average_monthly_net_savings
                if ratio <= Decimal("0.7"):
                    progress_status = "on_track"
                elif ratio <= Decimal("1"):
                    progress_status = "watch"
                else:
                    progress_status = "behind"
        elif goal.target_date is None:
            progress_status = "unknown"
        elif progress_pct > 0:
            progress_status = "watch"

        if goal.target_date is not None and goal.target_date > today:
            total_months = _months_between(goal.created_at.date(), goal.target_date) if goal.created_at else None
            months_elapsed = _months_between(goal.created_at.date(), today) if goal.created_at else None
            if total_months and months_elapsed is not None and total_months > 0:
                expected_progress = (Decimal(months_elapsed) / Decimal(total_months)) * HUNDRED
                if raw_progress_pct + Decimal("5") < expected_progress and progress_status in {"on_track", "watch", "unknown"}:
                    progress_status = "watch" if progress_status != "unknown" else "behind"

    return GoalComputation(
        resolved_current_amount=resolved_current_amount,
        progress_pct=progress_pct,
        shortfall_amount=shortfall_amount,
        months_remaining=months_remaining,
        required_monthly_saving=required_monthly_saving,
        progress_status=progress_status,
        is_achieved=is_achieved,
        final_amount=final_amount,
        variance_amount=variance_amount,
        variance_pct=variance_pct,
    )


def serialize_financial_goal(
    db: Session,
    goal: FinancialGoal,
    average_monthly_net_savings: Decimal | None = None,
) -> FinancialGoalRead:
    metrics = compute_goal_metrics(db, goal, average_monthly_net_savings=average_monthly_net_savings)
    return FinancialGoalRead(
        id=goal.id,
        name=goal.name,
        goal_type=goal.goal_type,
        target_amount=_to_decimal(goal.target_amount),
        current_amount=_to_decimal(goal.current_amount),
        target_date=goal.target_date,
        linked_source_type=goal.linked_source_type,
        linked_source_ids=goal.linked_source_ids,
        linked_source_types=goal.linked_source_types,
        linked_source_map=goal.linked_source_map,
        priority=goal.priority,
        notes=goal.notes,
        status=goal.status,
        achieved_date=goal.achieved_date,
        achieved_amount=_to_decimal(goal.achieved_amount) if goal.achieved_amount is not None else None,
        achievement_type=goal.achievement_type,
        payment_source=goal.payment_source,
        is_big_purchase=goal.is_big_purchase,
        purchase_notes=goal.purchase_notes,
        is_active=goal.is_active,
        resolved_current_amount=metrics.resolved_current_amount,
        progress_pct=metrics.progress_pct,
        shortfall_amount=metrics.shortfall_amount,
        months_remaining=metrics.months_remaining,
        required_monthly_saving=metrics.required_monthly_saving,
        progress_status=metrics.progress_status,
        is_achieved=metrics.is_achieved,
        final_amount=metrics.final_amount,
        variance_amount=metrics.variance_amount,
        variance_pct=metrics.variance_pct,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


def list_financial_goals(db: Session, active_only: bool | None = None) -> list[FinancialGoalRead]:
    query = select(FinancialGoal).order_by(
        FinancialGoal.is_active.desc(),
        FinancialGoal.updated_at.desc(),
        FinancialGoal.created_at.desc(),
    )
    if active_only is True:
        query = query.where(FinancialGoal.status.in_(["active", "paused"]))
    elif active_only is False:
        query = query.where(FinancialGoal.status.in_(["achieved", "cancelled"]))

    average_monthly_net_savings = _average_monthly_net_savings(db)
    goals = db.scalars(query).all()
    return [serialize_financial_goal(db, goal, average_monthly_net_savings=average_monthly_net_savings) for goal in goals]


def build_financial_goals_summary(db: Session, goals: list[FinancialGoalRead] | None = None) -> FinancialGoalSummary:
    goal_rows = goals or list_financial_goals(db)
    active_goals = [goal for goal in goal_rows if goal.status in {"active", "paused"}]
    achieved_goals = [goal for goal in goal_rows if goal.status == "achieved"]
    total_target_amount = sum((goal.target_amount for goal in active_goals), ZERO)
    total_current_amount = sum((goal.resolved_current_amount for goal in active_goals), ZERO)
    total_shortfall_amount = sum((goal.shortfall_amount for goal in active_goals), ZERO)
    average_progress_pct = (
        sum((goal.progress_pct for goal in active_goals), ZERO) / Decimal(len(active_goals))
        if active_goals
        else ZERO
    )
    monthly_saving_needed_total = sum(
        (goal.required_monthly_saving or ZERO for goal in active_goals if goal.progress_status != "completed"),
        ZERO,
    )
    status_counts: dict[str, int] = {}
    for goal in active_goals:
        status_counts[goal.progress_status] = status_counts.get(goal.progress_status, 0) + 1

    priority_rank = {"high": 0, "medium": 1, "low": 2, None: 3}
    top_goals = sorted(
        active_goals,
        key=lambda goal: (
            priority_rank.get(goal.priority, 3),
            0 if goal.progress_status == "behind" else 1 if goal.progress_status == "watch" else 2 if goal.progress_status == "on_track" else 3,
            -(goal.shortfall_amount),
        ),
    )[:3]
    largest_shortfall_goal = max(active_goals, key=lambda goal: goal.shortfall_amount, default=None)
    current_year = date.today().year
    total_achieved_amount = sum((goal.final_amount for goal in achieved_goals), ZERO)
    big_purchases_count = sum(1 for goal in achieved_goals if goal.is_big_purchase)
    this_year_achieved_amount = sum(
        (goal.final_amount for goal in achieved_goals if goal.achieved_date and goal.achieved_date.year == current_year),
        ZERO,
    )
    average_achieved_amount = total_achieved_amount / Decimal(len(achieved_goals)) if achieved_goals else ZERO
    recent_achieved_goal = max(
        achieved_goals,
        key=lambda goal: goal.achieved_date or goal.updated_at.date(),
        default=None,
    )

    return FinancialGoalSummary(
        active_goals_count=len(active_goals),
        achieved_goals_count=len(achieved_goals),
        total_target_amount=total_target_amount,
        total_current_amount=total_current_amount,
        total_shortfall_amount=total_shortfall_amount,
        average_progress_pct=average_progress_pct,
        monthly_saving_needed_total=monthly_saving_needed_total,
        largest_shortfall_goal_name=largest_shortfall_goal.name if largest_shortfall_goal else None,
        largest_shortfall_amount=largest_shortfall_goal.shortfall_amount if largest_shortfall_goal else ZERO,
        total_achieved_amount=total_achieved_amount,
        big_purchases_count=big_purchases_count,
        this_year_achieved_amount=this_year_achieved_amount,
        average_achieved_amount=average_achieved_amount,
        recent_achieved_goal=recent_achieved_goal,
        status_counts=status_counts,
        top_goals=top_goals,
    )
