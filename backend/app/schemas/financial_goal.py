from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

GoalType = Literal["emergency_fund", "travel", "retirement", "house", "vehicle", "education", "custom"]
GoalLinkedSourceType = Literal["manual", "bank_accounts", "holdings", "fixed_savings", "total_networth"]
GoalPriority = Literal["low", "medium", "high"]
GoalStatus = Literal["completed", "on_track", "watch", "behind", "unknown"]


class FinancialGoalBase(BaseModel):
    name: str
    goal_type: GoalType
    target_amount: Decimal
    current_amount: Decimal = Decimal("0")
    target_date: date | None = None
    linked_source_type: GoalLinkedSourceType | None = None
    linked_source_ids: list[int] | None = None
    linked_source_types: list[GoalLinkedSourceType] | None = None
    linked_source_map: dict[str, list[int]] | None = None
    priority: GoalPriority | None = None
    notes: str | None = None
    is_active: bool = True


class FinancialGoalCreate(FinancialGoalBase):
    pass


class FinancialGoalUpdate(BaseModel):
    name: str | None = None
    goal_type: GoalType | None = None
    target_amount: Decimal | None = None
    current_amount: Decimal | None = None
    target_date: date | None = None
    linked_source_type: GoalLinkedSourceType | None = None
    linked_source_ids: list[int] | None = None
    linked_source_types: list[GoalLinkedSourceType] | None = None
    linked_source_map: dict[str, list[int]] | None = None
    priority: GoalPriority | None = None
    notes: str | None = None
    is_active: bool | None = None


class FinancialGoalRead(FinancialGoalBase):
    id: int
    resolved_current_amount: Decimal = Decimal("0")
    progress_pct: Decimal = Decimal("0")
    shortfall_amount: Decimal = Decimal("0")
    months_remaining: int | None = None
    required_monthly_saving: Decimal | None = None
    status: GoalStatus = "unknown"
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FinancialGoalSummary(BaseModel):
    active_goals_count: int = 0
    completed_goals_count: int = 0
    total_target_amount: Decimal = Decimal("0")
    total_current_amount: Decimal = Decimal("0")
    total_shortfall_amount: Decimal = Decimal("0")
    average_progress_pct: Decimal = Decimal("0")
    monthly_saving_needed_total: Decimal = Decimal("0")
    largest_shortfall_goal_name: str | None = None
    largest_shortfall_amount: Decimal = Decimal("0")
    status_counts: dict[str, int] = Field(default_factory=dict)
    top_goals: list[FinancialGoalRead] = Field(default_factory=list)
