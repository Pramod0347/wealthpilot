from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.cashflow_entry import CashflowEntry
from app.schemas.cashflow import CashflowCategoryBreakdownItem, CashflowEntryRead, CashflowSummary
from app.schemas.dashboard import CashflowAverageMetrics, CashflowMetricWindow, DashboardCashflowMetrics


def current_month_string() -> str:
    return date.today().strftime("%Y-%m")


def serialize_cashflow_entry(entry: CashflowEntry) -> CashflowEntryRead:
    return CashflowEntryRead.model_validate(entry)


def _to_decimal(value: Decimal | int | float | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def _build_category_breakdown(rows: list[tuple[str, Decimal]], total: Decimal) -> list[CashflowCategoryBreakdownItem]:
    items: list[CashflowCategoryBreakdownItem] = []
    for category, amount in rows:
        decimal_amount = _to_decimal(amount)
        percentage = Decimal("0")
        if total != 0:
            percentage = (decimal_amount / total) * Decimal("100")
        items.append(
            CashflowCategoryBreakdownItem(
                category=category,
                amount=decimal_amount,
                percentage=percentage,
            )
        )
    return items


def build_cashflow_summary(db: Session, month: str | None = None) -> CashflowSummary:
    selected_month = month or current_month_string()

    totals = db.execute(
        select(
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", 1), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", 1), else_=0)), 0),
        ).where(CashflowEntry.month == selected_month)
    ).one()

    total_income = _to_decimal(totals[0])
    total_expense = _to_decimal(totals[1])
    income_count = int(totals[2])
    expense_count = int(totals[3])
    net_savings = total_income - total_expense
    savings_rate = Decimal("0")
    if total_income != 0:
        savings_rate = (net_savings / total_income) * Decimal("100")

    expense_rows = db.execute(
        select(CashflowEntry.category, func.coalesce(func.sum(CashflowEntry.amount), 0))
        .where(CashflowEntry.month == selected_month, CashflowEntry.entry_type == "expense")
        .group_by(CashflowEntry.category)
        .order_by(func.sum(CashflowEntry.amount).desc(), CashflowEntry.category.asc())
    ).all()
    income_rows = db.execute(
        select(CashflowEntry.category, func.coalesce(func.sum(CashflowEntry.amount), 0))
        .where(CashflowEntry.month == selected_month, CashflowEntry.entry_type == "income")
        .group_by(CashflowEntry.category)
        .order_by(func.sum(CashflowEntry.amount).desc(), CashflowEntry.category.asc())
    ).all()

    return CashflowSummary(
        month=selected_month,
        total_income=total_income,
        total_expense=total_expense,
        net_savings=net_savings,
        savings_rate=savings_rate,
        income_count=income_count,
        expense_count=expense_count,
        expenses_by_category=_build_category_breakdown(expense_rows, total_expense),
        income_by_category=_build_category_breakdown(income_rows, total_income),
    )


def list_cashflow_months(db: Session) -> list[str]:
    rows = db.scalars(select(CashflowEntry.month).distinct().order_by(CashflowEntry.month.desc())).all()
    return list(rows)


def build_dashboard_cashflow_metrics(db: Session, month: str | None = None) -> DashboardCashflowMetrics:
    selected_month = month or current_month_string()

    monthly_rows = db.execute(
        select(
            CashflowEntry.month,
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", CashflowEntry.amount), else_=0)), 0),
            func.count(CashflowEntry.id),
        )
        .group_by(CashflowEntry.month)
        .order_by(CashflowEntry.month.desc())
    ).all()

    current = CashflowMetricWindow()
    if monthly_rows:
        monthly_map: dict[str, tuple[Decimal, Decimal, int]] = {
            month_key: (_to_decimal(income), _to_decimal(expense), int(entries_count))
            for month_key, income, expense, entries_count in monthly_rows
        }

        current_income, current_expense, current_entries = monthly_map.get(
            selected_month,
            (Decimal("0"), Decimal("0"), 0),
        )
        current_net_savings = current_income - current_expense
        current_savings_rate: Decimal | None = None
        if current_income != 0:
            current_savings_rate = (current_net_savings / current_income) * Decimal("100")

        current = CashflowMetricWindow(
            income=current_income,
            expense=current_expense,
            net_savings=current_net_savings,
            savings_rate=current_savings_rate,
            has_data=current_entries > 0,
        )

        months_count = len(monthly_rows)
        total_income = sum((_to_decimal(row[1]) for row in monthly_rows), Decimal("0"))
        total_expense = sum((_to_decimal(row[2]) for row in monthly_rows), Decimal("0"))
        average_income = total_income / Decimal(months_count)
        average_expense = total_expense / Decimal(months_count)
        average_net_savings = average_income - average_expense
        average_savings_rate: Decimal | None = None
        if average_income != 0:
            average_savings_rate = (average_net_savings / average_income) * Decimal("100")

        average = CashflowAverageMetrics(
            months_count=months_count,
            income=average_income,
            expense=average_expense,
            net_savings=average_net_savings,
            savings_rate=average_savings_rate,
            has_data=True,
        )
    else:
        average = CashflowAverageMetrics()

    return DashboardCashflowMetrics(
        current_month=selected_month,
        current=current,
        average=average,
    )
