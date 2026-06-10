from decimal import Decimal
from datetime import datetime, timezone

from app.models.holding import Holding
from app.schemas.holding import HoldingRead


def calculate_invested_amount(quantity: Decimal, avg_buy_price: Decimal) -> Decimal:
    return quantity * avg_buy_price


def calculate_current_value(quantity: Decimal, current_price: Decimal) -> Decimal:
    return quantity * current_price


def calculate_pnl(current_value: Decimal, invested_amount: Decimal) -> Decimal:
    return current_value - invested_amount


def calculate_return_pct(pnl: Decimal, invested_amount: Decimal) -> Decimal:
    if invested_amount == 0:
        return Decimal("0")
    return (pnl / invested_amount) * Decimal("100")


def serialize_holding(holding: Holding) -> HoldingRead:
    invested_amount = calculate_invested_amount(holding.quantity, holding.avg_buy_price)
    current_value = calculate_current_value(holding.quantity, holding.current_price)
    pnl = calculate_pnl(current_value, invested_amount)
    return_pct = calculate_return_pct(pnl, invested_amount)

    return HoldingRead(
        id=holding.id,
        symbol=holding.symbol,
        company_name=holding.company_name,
        asset_type=holding.asset_type,
        exchange_symbol=holding.exchange_symbol,
        quantity=holding.quantity,
        avg_buy_price=holding.avg_buy_price,
        current_price=holding.current_price,
        price_source=holding.price_source,
        last_price_refreshed_at=holding.last_price_refreshed_at,
        sector=holding.sector,
        notes=holding.notes,
        as_of_date=holding.as_of_date,
        created_at=holding.created_at,
        updated_at=holding.updated_at,
        invested_amount=invested_amount,
        current_value=current_value,
        pnl=pnl,
        return_pct=return_pct,
    )


def mark_holding_priced_manually(holding: Holding) -> None:
    holding.price_source = "manual"
    holding.last_price_refreshed_at = None


def mark_holding_refreshed(holding: Holding) -> None:
    holding.price_source = "yfinance"
    holding.last_price_refreshed_at = datetime.now(timezone.utc)
