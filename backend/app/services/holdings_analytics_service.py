from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.schemas.holding import AllocationItem, HoldingAnalyticsItem, HoldingsAnalyticsResponse
from app.services.holdings_service import serialize_holding

ASSET_TYPE_LABELS = {
    "stock": "Stocks",
    "etf": "ETFs",
    "mutual_fund": "Mutual Funds",
    "cash": "Cash",
    "other": "Other Assets",
}


def _to_decimal(value: object) -> Decimal:
    return Decimal(value)


def _build_allocation(rows: list[tuple[str | None, Decimal]], total: Decimal) -> list[AllocationItem]:
    allocations: list[AllocationItem] = []
    for key, amount in rows:
        normalized_key = key or "uncategorized"
        amount_decimal = _to_decimal(amount)
        percentage = Decimal("0")
        if total != 0:
            percentage = (amount_decimal / total) * Decimal("100")
        allocations.append(
            AllocationItem(
                key=normalized_key,
                label=ASSET_TYPE_LABELS.get(normalized_key, "Uncategorized"),
                amount=amount_decimal,
                percentage=percentage,
            )
        )

    allocations.sort(key=lambda item: item.amount, reverse=True)
    return allocations


def _build_holding_item(holding: Holding) -> HoldingAnalyticsItem:
    serialized = serialize_holding(holding)
    return HoldingAnalyticsItem(
        id=serialized.id,
        symbol=serialized.symbol,
        company_name=serialized.company_name,
        asset_type=serialized.asset_type,
        sector=serialized.sector,
        current_value=serialized.current_value,
        pnl=serialized.pnl,
        return_pct=serialized.return_pct,
    )


def build_holdings_analytics(db: Session) -> HoldingsAnalyticsResponse:
    aggregated = db.query(
        func.coalesce(func.sum(Holding.quantity * Holding.avg_buy_price), 0),
        func.coalesce(func.sum(Holding.quantity * Holding.current_price), 0),
    ).one()

    total_invested = _to_decimal(aggregated[0])
    current_value = _to_decimal(aggregated[1])
    total_pnl = current_value - total_invested
    total_return_pct = Decimal("0")
    if total_invested != 0:
        total_return_pct = (total_pnl / total_invested) * Decimal("100")

    asset_type_rows = db.query(
        Holding.asset_type,
        func.coalesce(func.sum(Holding.quantity * Holding.current_price), 0),
    ).group_by(Holding.asset_type).all()

    sector_rows = db.query(
        Holding.sector,
        func.coalesce(func.sum(Holding.quantity * Holding.current_price), 0),
    ).group_by(Holding.sector).all()

    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    holding_items = [_build_holding_item(holding) for holding in holdings]
    top_gainers = sorted(holding_items, key=lambda item: item.pnl, reverse=True)[:5]
    top_losers = sorted(holding_items, key=lambda item: item.pnl)[:5]

    return HoldingsAnalyticsResponse(
        total_invested=total_invested,
        current_value=current_value,
        total_pnl=total_pnl,
        total_return_pct=total_return_pct,
        asset_type_allocation=_build_allocation(asset_type_rows, current_value),
        sector_allocation=_build_allocation(sector_rows, current_value),
        top_gainers=top_gainers,
        top_losers=top_losers,
    )
