from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.schemas.dashboard import DashboardSummary
from app.services.cashflow_service import build_cashflow_summary, build_dashboard_cashflow_metrics, current_month_string
from app.services.holdings_service import serialize_holding
from app.services.wealth_bucket_service import build_wealth_buckets


def build_dashboard_summary(db: Session) -> DashboardSummary:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]

    total_invested = sum((holding.invested_amount for holding in serialized_holdings), Decimal("0"))
    current_value = sum((holding.current_value for holding in serialized_holdings), Decimal("0"))
    holdings_count = len(serialized_holdings)
    total_pnl = current_value - total_invested
    total_return_pct = Decimal("0")
    if total_invested != 0:
        total_return_pct = (total_pnl / total_invested) * Decimal("100")

    bank_stats = db.execute(
        select(
            func.coalesce(func.sum(BankAccount.balance), 0),
            func.count(BankAccount.id),
        )
    ).one()
    total_bank_cash = Decimal(bank_stats[0])
    bank_accounts_count = int(bank_stats[1])

    fixed_savings_stats = db.execute(
        select(
            func.coalesce(func.sum(FixedSavingsAccount.current_value), 0),
            func.count(FixedSavingsAccount.id),
        )
    ).one()
    total_fixed_savings_value = Decimal(fixed_savings_stats[0])
    fixed_savings_accounts_count = int(fixed_savings_stats[1])

    total_assets = current_value + total_bank_cash + total_fixed_savings_value
    bank_accounts = db.scalars(select(BankAccount).order_by(BankAccount.updated_at.desc())).all()
    fixed_savings_accounts = db.scalars(select(FixedSavingsAccount).order_by(FixedSavingsAccount.updated_at.desc())).all()

    card_stats = db.query(
        func.coalesce(func.sum(CreditCard.current_bill_amount), 0),
        func.coalesce(func.sum(CreditCard.total_limit), 0),
        func.coalesce(func.sum(CreditCard.used_amount), 0),
        func.coalesce(func.sum(case((CreditCard.status == "due_soon", 1), else_=0)), 0),
        func.coalesce(func.sum(case((CreditCard.status == "overdue", 1), else_=0)), 0),
    ).one()

    total_credit_card_dues = Decimal(card_stats[0])
    total_card_limit = Decimal(card_stats[1])
    total_card_used = Decimal(card_stats[2])
    due_soon_count = int(card_stats[3])
    overdue_count = int(card_stats[4])
    overall_card_utilization = Decimal("0")
    if total_card_limit != 0:
        overall_card_utilization = (total_card_used / total_card_limit) * Decimal("100")
    total_liabilities = total_credit_card_dues
    net_worth = total_assets - total_liabilities
    credit_cards = db.scalars(select(CreditCard).order_by(CreditCard.updated_at.desc())).all()
    allocations, _ = build_wealth_buckets(
        holdings=holdings,
        bank_accounts=bank_accounts,
        fixed_savings_accounts=fixed_savings_accounts,
        credit_cards=credit_cards,
        total_assets=total_assets,
    )
    cashflow_month = current_month_string()
    cashflow_summary = build_cashflow_summary(db, cashflow_month)
    cashflow_metrics = build_dashboard_cashflow_metrics(db, cashflow_month)

    return DashboardSummary(
        total_invested=total_invested,
        current_value=current_value,
        total_bank_cash=total_bank_cash,
        bank_accounts_count=bank_accounts_count,
        total_fixed_savings_value=total_fixed_savings_value,
        fixed_savings_accounts_count=fixed_savings_accounts_count,
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=net_worth,
        total_pnl=total_pnl,
        total_return_pct=total_return_pct,
        holdings_count=holdings_count,
        allocations=allocations,
        total_credit_card_dues=total_credit_card_dues,
        total_card_limit=total_card_limit,
        total_card_used=total_card_used,
        overall_card_utilization=overall_card_utilization,
        due_soon_count=due_soon_count,
        overdue_count=overdue_count,
        cashflow_metrics=cashflow_metrics,
        monthly_income=cashflow_metrics.current.income,
        monthly_expense=cashflow_metrics.current.expense,
        monthly_net_savings=cashflow_metrics.current.net_savings,
        monthly_savings_rate=cashflow_metrics.current.savings_rate,
        monthly_income_count=cashflow_summary.income_count,
        monthly_expense_count=cashflow_summary.expense_count,
        cashflow_month=cashflow_summary.month,
    )
