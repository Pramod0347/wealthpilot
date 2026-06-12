from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.cashflow_entry import CashflowEntry
from app.schemas.cashflow import CashflowCategoryBreakdownItem, CashflowEntryRead, CashflowSummary


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
