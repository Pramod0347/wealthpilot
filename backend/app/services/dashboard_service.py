from decimal import Decimal

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.credit_card import CreditCard
from app.models.holding import Holding
from app.schemas.dashboard import AssetAllocationItem, DashboardSummary

ASSET_TYPE_LABELS = {
    "stock": "Stocks",
    "etf": "ETFs",
    "mutual_fund": "Mutual Funds",
    "cash": "Cash",
    "other": "Other Assets",
}


def build_dashboard_summary(db: Session) -> DashboardSummary:
    aggregated = db.query(
        func.coalesce(func.sum(Holding.quantity * Holding.avg_buy_price), 0),
        func.coalesce(func.sum(Holding.quantity * Holding.current_price), 0),
        func.count(Holding.id),
    ).one()

    total_invested = Decimal(aggregated[0])
    current_value = Decimal(aggregated[1])
    holdings_count = int(aggregated[2])
    total_pnl = current_value - total_invested
    total_return_pct = Decimal("0")
    if total_invested != 0:
        total_return_pct = (total_pnl / total_invested) * Decimal("100")

    allocation_rows = db.query(
        Holding.asset_type,
        func.coalesce(func.sum(Holding.quantity * Holding.current_price), 0),
    ).group_by(Holding.asset_type).all()

    allocations = []
    for asset_type, amount in allocation_rows:
        allocated_amount = Decimal(amount)
        percentage = Decimal("0")
        if current_value != 0:
            percentage = (allocated_amount / current_value) * Decimal("100")
        allocations.append(
            AssetAllocationItem(
                asset_type=asset_type or "stock",
                label=ASSET_TYPE_LABELS.get(asset_type or "stock", "Other Assets"),
                amount=allocated_amount,
                percentage=percentage,
            )
        )

    allocations.sort(key=lambda item: item.amount, reverse=True)

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

    return DashboardSummary(
        total_invested=total_invested,
        current_value=current_value,
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
