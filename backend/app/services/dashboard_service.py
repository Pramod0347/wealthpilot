from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.holding import Holding
from app.schemas.dashboard import AssetAllocationItem, DashboardSummary
from app.services.holdings_service import serialize_holding


def _allocation_entry(key: str, label: str, amount: Decimal, total: Decimal) -> AssetAllocationItem:
    percentage = Decimal("0")
    if total != 0:
        percentage = (amount / total) * Decimal("100")
    return AssetAllocationItem(asset_type=key, label=label, amount=amount, percentage=percentage)


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

    indian_stocks = sum(
        (holding.current_value for holding in serialized_holdings if holding.asset_type == "stock" and holding.country == "IN"),
        Decimal("0"),
    )
    us_stocks = sum(
        (holding.current_value for holding in serialized_holdings if holding.country == "US"),
        Decimal("0"),
    )
    etfs = sum((holding.current_value for holding in serialized_holdings if holding.asset_type == "etf"), Decimal("0"))
    mutual_funds = sum((holding.current_value for holding in serialized_holdings if holding.asset_type == "mutual_fund"), Decimal("0"))
    cash = sum((holding.current_value for holding in serialized_holdings if holding.asset_type == "cash"), Decimal("0"))
    other = sum(
        (
            holding.current_value
            for holding in serialized_holdings
            if holding.asset_type not in {"stock", "etf", "mutual_fund", "cash"} and holding.country != "US"
        ),
        Decimal("0"),
    )

    bank_stats = db.execute(
        select(
            func.coalesce(func.sum(BankAccount.balance), 0),
            func.count(BankAccount.id),
        )
    ).one()
    total_bank_cash = Decimal(bank_stats[0])
    bank_accounts_count = int(bank_stats[1])

    total_assets = current_value + total_bank_cash

    allocation_entries = [
        ("stock_in", "Indian Stocks", indian_stocks),
        ("stock_us", "US Stocks", us_stocks),
        ("etf", "ETFs", etfs),
        ("mutual_fund", "Mutual Funds", mutual_funds),
        ("cash", "Cash", cash),
        ("other", "Other Assets", other),
    ]
    if total_bank_cash > 0:
        allocation_entries.append(("banks", "Banks", total_bank_cash))

    allocations = [
        _allocation_entry(key, label, amount, total_assets)
        for key, label, amount in allocation_entries
        if amount != 0
    ]

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

    return DashboardSummary(
        total_invested=total_invested,
        current_value=current_value,
        total_bank_cash=total_bank_cash,
        bank_accounts_count=bank_accounts_count,
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
    )
