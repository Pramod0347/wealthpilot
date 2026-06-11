from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.schemas.holding import AllocationItem, HoldingAnalyticsItem, HoldingsAnalyticsResponse
from app.services.holdings_service import serialize_holding


ASSET_TYPE_LABELS = {
    "stock_in": "Indian Stocks",
    "stock_us": "US Stocks",
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
        normalized_key = key or "other"
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


def _asset_type_key(holding: Holding) -> str:
    if holding.country == "US":
        return "stock_us"
    if holding.asset_type == "stock":
        return "stock_in"
    if holding.asset_type in {"etf", "mutual_fund", "cash"}:
        return holding.asset_type
    return "other"


def _build_holding_item(holding: Holding) -> HoldingAnalyticsItem:
    serialized = serialize_holding(holding)
    return HoldingAnalyticsItem(
        id=serialized.id,
        symbol=serialized.symbol,
        company_name=serialized.company_name,
        asset_type=serialized.asset_type,
        country=serialized.country,
        currency=serialized.currency,
        sector=serialized.sector,
        native_current_value=serialized.native_current_value,
        native_pnl=serialized.native_pnl,
        current_value=serialized.current_value,
        pnl=serialized.pnl,
        return_pct=serialized.return_pct,
    )


def build_holdings_analytics(db: Session) -> HoldingsAnalyticsResponse:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]

    total_invested = sum((item.invested_amount for item in serialized_holdings), Decimal("0"))
    current_value = sum((item.current_value for item in serialized_holdings), Decimal("0"))
    total_pnl = current_value - total_invested
    total_return_pct = Decimal("0")
    if total_invested != 0:
        total_return_pct = (total_pnl / total_invested) * Decimal("100")

    asset_type_totals: dict[str, Decimal] = {}
    sector_totals: dict[str, Decimal] = {}

    for holding, serialized in zip(holdings, serialized_holdings, strict=False):
        asset_key = _asset_type_key(holding)
        asset_type_totals[asset_key] = asset_type_totals.get(asset_key, Decimal("0")) + serialized.current_value
        sector_key = holding.sector or "Uncategorized"
        sector_totals[sector_key] = sector_totals.get(sector_key, Decimal("0")) + serialized.current_value

    asset_type_rows = [(key, amount) for key, amount in asset_type_totals.items()]
    sector_rows = [(key, amount) for key, amount in sector_totals.items()]

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
