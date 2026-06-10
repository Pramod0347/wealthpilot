from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

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

    return DashboardSummary(
        total_invested=total_invested,
        current_value=current_value,
        total_pnl=total_pnl,
        total_return_pct=total_return_pct,
        holdings_count=holdings_count,
        allocations=allocations,
    )
