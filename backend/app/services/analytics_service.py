from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.cashflow_entry import CashflowEntry
from app.models.credit_card import CreditCard
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.schemas.analytics import (
    AnalyticsCategoryAverageItem,
    AnalyticsFocusItem,
    AnalyticsMetricWindow,
    AnalyticsMonthlyTrendItem,
    AnalyticsSummaryResponse,
    AnalyticsTopCategoryItem,
    CashflowAnalyticsSummary,
    GoalsAnalyticsSummary,
    InvestmentAnalyticsSummary,
    InvestmentBucketSummaryItem,
    InvestmentTopHoldingItem,
)
from app.services.financial_goals_service import build_financial_goals_summary, list_financial_goals
from app.services.cashflow_service import current_month_string
from app.services.holdings_service import serialize_holding
from app.services.wealth_bucket_service import build_wealth_buckets


def _to_decimal(value: object | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def _safe_pct(amount: Decimal, total: Decimal) -> Decimal:
    if total == 0:
        return Decimal("0")
    return (amount / total) * Decimal("100")


def _build_cashflow_analytics(
    db: Session,
    total_bank_cash: Decimal,
    overdue_count: int,
    due_soon_count: int,
) -> CashflowAnalyticsSummary:
    current_month = current_month_string()
    monthly_rows = db.execute(
        select(
            CashflowEntry.month,
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", CashflowEntry.amount), else_=0)), 0),
            func.count(CashflowEntry.id),
        )
        .group_by(CashflowEntry.month)
        .order_by(CashflowEntry.month.asc())
    ).all()

    if not monthly_rows:
        return CashflowAnalyticsSummary(current_month=current_month)

    months_count = len(monthly_rows)
    tracked_months = [row[0] for row in monthly_rows]
    monthly_map: dict[str, tuple[Decimal, Decimal, int]] = {
        row[0]: (_to_decimal(row[1]), _to_decimal(row[2]), int(row[3])) for row in monthly_rows
    }

    total_income = sum((_to_decimal(row[1]) for row in monthly_rows), Decimal("0"))
    total_expense = sum((_to_decimal(row[2]) for row in monthly_rows), Decimal("0"))
    average_income = total_income / Decimal(months_count)
    average_expense = total_expense / Decimal(months_count)
    average_net_savings = average_income - average_expense
    average_savings_rate = (average_net_savings / average_income) * Decimal("100") if average_income != 0 else None
    cash_buffer_months = total_bank_cash / average_expense if average_expense != 0 else None

    current_income, current_expense, current_entries = monthly_map.get(current_month, (Decimal("0"), Decimal("0"), 0))
    current_net_savings = current_income - current_expense
    current_savings_rate = (current_net_savings / current_income) * Decimal("100") if current_income != 0 else None

    expense_rows = db.execute(
        select(
            CashflowEntry.category,
            func.coalesce(func.sum(CashflowEntry.amount), 0),
            func.count(func.distinct(CashflowEntry.month)),
        )
        .where(CashflowEntry.entry_type == "expense")
        .group_by(CashflowEntry.category)
        .order_by(func.sum(CashflowEntry.amount).desc(), CashflowEntry.category.asc())
    ).all()
    income_rows = db.execute(
        select(
            CashflowEntry.category,
            func.coalesce(func.sum(CashflowEntry.amount), 0),
            func.count(func.distinct(CashflowEntry.month)),
        )
        .where(CashflowEntry.entry_type == "income")
        .group_by(CashflowEntry.category)
        .order_by(func.sum(CashflowEntry.amount).desc(), CashflowEntry.category.asc())
    ).all()

    average_expense_by_category = [
        AnalyticsCategoryAverageItem(
            category=category,
            average_amount=_to_decimal(amount) / Decimal(months_count),
            total_amount=_to_decimal(amount),
            percentage_of_avg_spend=_safe_pct(_to_decimal(amount) / Decimal(months_count), average_expense)
            if average_expense > 0
            else Decimal("0"),
            months_present=int(months_present),
        )
        for category, amount, months_present in expense_rows
    ]
    average_income_by_category = [
        AnalyticsCategoryAverageItem(
            category=category,
            average_amount=_to_decimal(amount) / Decimal(months_count),
            total_amount=_to_decimal(amount),
            percentage_of_avg_income=_safe_pct(_to_decimal(amount) / Decimal(months_count), average_income)
            if average_income > 0
            else Decimal("0"),
            months_present=int(months_present),
        )
        for category, amount, months_present in income_rows
    ]

    monthly_trend = [
        AnalyticsMonthlyTrendItem(
            month=row[0],
            income=_to_decimal(row[1]),
            expense=_to_decimal(row[2]),
            net_savings=_to_decimal(row[1]) - _to_decimal(row[2]),
            savings_rate=((_to_decimal(row[1]) - _to_decimal(row[2])) / _to_decimal(row[1])) * Decimal("100")
            if _to_decimal(row[1]) != 0
            else None,
        )
        for row in monthly_rows
    ]

    top_spending_categories = [
        AnalyticsTopCategoryItem(
            category=item.category,
            average_amount=item.average_amount,
            percentage_of_avg_spend=item.percentage_of_avg_spend or Decimal("0"),
        )
        for item in average_expense_by_category[:5]
    ]

    focus_items: list[AnalyticsFocusItem] = []
    top_expense = average_expense_by_category[0] if average_expense_by_category else None
    if top_expense and (top_expense.percentage_of_avg_spend or Decimal("0")) > Decimal("35"):
        focus_items.append(
            AnalyticsFocusItem(
                type="expense",
                severity="watch",
                title="High spend concentration",
                message=f"{top_expense.category} is your largest monthly expense category.",
                action="Review whether this category can be optimized.",
            )
        )

    if average_income > 0:
        savings_severity = "healthy" if (average_savings_rate or Decimal("0")) >= Decimal("25") else "watch"
        if (average_savings_rate or Decimal("0")) < Decimal("10"):
            savings_severity = "risk"
        focus_items.append(
            AnalyticsFocusItem(
                type="saving",
                severity=savings_severity,
                title="Savings trend",
                message="Your average savings trend is healthy."
                if savings_severity == "healthy"
                else "Your savings trend needs attention.",
                action="Keep your expense growth below income growth."
                if savings_severity == "healthy"
                else "Increase savings or reduce discretionary spending.",
            )
        )
    else:
        focus_items.append(
            AnalyticsFocusItem(
                type="saving",
                severity="watch",
                title="Savings rate unavailable",
                message="No income data is available to calculate savings rate.",
                action="Add income entries to unlock savings-rate analytics.",
            )
        )

    if average_expense > average_income and months_count > 0:
        focus_items.append(
            AnalyticsFocusItem(
                type="expense",
                severity="risk",
                title="Spending exceeds income",
                message="Average monthly spending is higher than tracked income.",
                action="Reduce discretionary categories or increase income.",
            )
        )

    if current_entries > 0 and average_expense > 0 and current_expense > (average_expense * Decimal("1.2")):
        focus_items.append(
            AnalyticsFocusItem(
                type="expense",
                severity="watch",
                title="Current month spend is above average",
                message="Current month spending is above your tracked average.",
                action="Check variable categories before month end.",
            )
        )

    if overdue_count > 0:
        focus_items.append(
            AnalyticsFocusItem(
                type="credit",
                severity="risk",
                title="Overdue credit card dues",
                message="One or more cards are already overdue.",
                action="Clear overdue dues first to avoid late fees.",
            )
        )
    elif due_soon_count > 0:
        focus_items.append(
            AnalyticsFocusItem(
                type="credit",
                severity="watch",
                title="Upcoming credit card dues",
                message="Some card payments are due soon.",
                action="Plan the next payments before the due date.",
            )
        )

    if average_expense > 0:
        cash_buffer_months = total_bank_cash / average_expense if average_expense != 0 else Decimal("0")
        if cash_buffer_months < Decimal("1"):
            focus_items.append(
                AnalyticsFocusItem(
                    type="cash_buffer",
                    severity="risk",
                    title="Low cash buffer",
                    message="Your cash buffer is below one month of average spend.",
                    action="Increase liquid cash to improve resilience.",
                )
            )
        elif cash_buffer_months < Decimal("3"):
            focus_items.append(
                AnalyticsFocusItem(
                    type="cash_buffer",
                    severity="watch",
                    title="Cash buffer needs work",
                    message="Your liquid cash covers less than three months of average spend.",
                    action="Build a larger emergency buffer over time.",
                )
            )
        else:
            focus_items.append(
                AnalyticsFocusItem(
                    type="cash_buffer",
                    severity="healthy",
                    title="Cash buffer looks healthy",
                    message="Your liquid cash covers multiple months of average spend.",
                    action="Maintain this buffer while investing excess cash intentionally.",
                )
            )

    return CashflowAnalyticsSummary(
        months_count=months_count,
        tracked_months=tracked_months,
        current_month=current_month,
        current_month_summary=AnalyticsMetricWindow(
            income=current_income,
            expense=current_expense,
            net_savings=current_net_savings,
            savings_rate=current_savings_rate,
            has_data=current_entries > 0,
        ),
        average_monthly_summary=AnalyticsMetricWindow(
            income=average_income,
            expense=average_expense,
            net_savings=average_net_savings,
            savings_rate=average_savings_rate,
            has_data=True,
        ),
        cash_buffer_months=cash_buffer_months,
        average_expense_by_category=average_expense_by_category,
        average_income_by_category=average_income_by_category,
        monthly_trend=monthly_trend,
        top_spending_categories=top_spending_categories,
        focus_items=focus_items[:5],
    )


def _build_investment_analytics(
    db: Session,
    total_assets: Decimal,
    total_liabilities: Decimal,
    net_worth: Decimal,
) -> InvestmentAnalyticsSummary:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]
    bank_accounts = db.scalars(select(BankAccount).order_by(BankAccount.updated_at.desc())).all()
    fixed_savings_accounts = db.scalars(select(FixedSavingsAccount).order_by(FixedSavingsAccount.updated_at.desc())).all()
    credit_cards = db.scalars(select(CreditCard).order_by(CreditCard.updated_at.desc())).all()

    dashboard_buckets, _ = build_wealth_buckets(
        holdings=holdings,
        bank_accounts=bank_accounts,
        fixed_savings_accounts=fixed_savings_accounts,
        credit_cards=credit_cards,
        total_assets=total_assets,
    )

    holdings_total = sum((item.current_value for item in serialized_holdings), Decimal("0"))
    bucket_allocation = [
        InvestmentBucketSummaryItem(
            key=item.asset_type,
            label=item.label,
            value=item.amount,
            percentage=item.percentage,
            items_count=len(item.items),
        )
        for item in dashboard_buckets
    ]

    top_holdings = sorted(serialized_holdings, key=lambda item: item.current_value, reverse=True)[:5]
    top_holding_items = [
        InvestmentTopHoldingItem(
            name=item.company_name,
            symbol=item.symbol,
            value=item.current_value,
            percentage_of_portfolio=_safe_pct(item.current_value, holdings_total),
            return_pct=item.return_pct,
        )
        for item in top_holdings
    ]

    focus_items: list[AnalyticsFocusItem] = []
    largest_bucket = max(bucket_allocation, key=lambda item: item.value, default=None)
    if largest_bucket and largest_bucket.percentage > Decimal("50"):
        focus_items.append(
            AnalyticsFocusItem(
                type="investment",
                severity="watch",
                title="Portfolio concentration",
                message=f"{largest_bucket.label} is your largest investment bucket.",
                action="Review whether this concentration matches your plan.",
            )
        )

    largest_holding = max(top_holding_items, key=lambda item: item.value, default=None)
    if largest_holding and largest_holding.percentage_of_portfolio > Decimal("25"):
        focus_items.append(
            AnalyticsFocusItem(
                type="investment",
                severity="watch",
                title="Single holding concentration",
                message=f"{largest_holding.symbol} is your largest individual holding.",
                action="Check whether one position is dominating the portfolio.",
            )
        )

    biggest_gainer = max(serialized_holdings, key=lambda item: item.pnl, default=None)
    if biggest_gainer and biggest_gainer.pnl > 0:
        focus_items.append(
            AnalyticsFocusItem(
                type="investment",
                severity="healthy",
                title="Top performer",
                message=f"{biggest_gainer.symbol} is currently your strongest contributor.",
                action="Review whether gains should be held, trimmed, or rebalanced.",
            )
        )

    biggest_loser = min(serialized_holdings, key=lambda item: item.pnl, default=None)
    if biggest_loser and biggest_loser.pnl < 0:
        focus_items.append(
            AnalyticsFocusItem(
                type="investment",
                severity="watch",
                title="Underperformer to review",
                message=f"{biggest_loser.symbol} is your weakest current holding.",
                action="Re-check conviction and allocation size.",
            )
        )

    return InvestmentAnalyticsSummary(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=net_worth,
        bucket_allocation=bucket_allocation,
        top_holdings=top_holding_items,
        investment_focus_items=focus_items[:5],
    )


def build_analytics_summary(db: Session) -> AnalyticsSummaryResponse:
    total_bank_cash = _to_decimal(db.scalar(select(func.coalesce(func.sum(BankAccount.balance), 0))))
    holdings = db.scalars(select(Holding)).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]
    total_holdings_value = sum((item.current_value for item in serialized_holdings), Decimal("0"))
    total_fixed_savings_value = _to_decimal(db.scalar(select(func.coalesce(func.sum(FixedSavingsAccount.current_value), 0))))
    total_credit_card_dues = _to_decimal(db.scalar(select(func.coalesce(func.sum(CreditCard.current_bill_amount), 0))))
    overdue_count = int(db.scalar(select(func.count()).select_from(CreditCard).where(CreditCard.status == "overdue")) or 0)
    due_soon_count = int(db.scalar(select(func.count()).select_from(CreditCard).where(CreditCard.status == "due_soon")) or 0)

    total_assets = total_holdings_value + total_bank_cash + total_fixed_savings_value
    total_liabilities = total_credit_card_dues
    net_worth = total_assets - total_liabilities

    goals = list_financial_goals(db, active_only=True)
    goals_summary = build_financial_goals_summary(db, goals)

    return AnalyticsSummaryResponse(
        cashflow_analytics=_build_cashflow_analytics(
            db=db,
            total_bank_cash=total_bank_cash,
            overdue_count=overdue_count,
            due_soon_count=due_soon_count,
        ),
        investment_analytics=_build_investment_analytics(
            db=db,
            total_assets=total_assets,
            total_liabilities=total_liabilities,
            net_worth=net_worth,
        ),
        goals_analytics=GoalsAnalyticsSummary(
            total_goals=goals_summary.active_goals_count,
            completed_count=goals_summary.achieved_goals_count,
            on_track_count=goals_summary.status_counts.get("on_track", 0),
            watch_count=goals_summary.status_counts.get("watch", 0),
            behind_count=goals_summary.status_counts.get("behind", 0),
            largest_shortfall_goal_name=goals_summary.largest_shortfall_goal_name,
            largest_shortfall_amount=goals_summary.largest_shortfall_amount,
            monthly_saving_needed_total=goals_summary.monthly_saving_needed_total,
            summary=goals_summary,
        ),
    )
