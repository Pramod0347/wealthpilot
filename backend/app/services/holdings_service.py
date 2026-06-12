from decimal import Decimal
from datetime import datetime, timezone

from app.models.holding import Holding
from app.schemas.holding import HoldingRead
from app.services.calculations import (
    calculate_native_current_value,
    calculate_native_invested_amount,
    calculate_native_pnl,
    calculate_pnl,
    calculate_return_pct,
    convert_to_inr,
    normalize_fx_rate,
)
from app.services.market_service import get_latest_usd_to_inr_rate


def _normalized_fx_rate(holding: Holding) -> Decimal:
    return normalize_fx_rate(getattr(holding, "fx_rate_to_inr", None))


def _effective_fx_rate(holding: Holding) -> Decimal:
    stored_rate = _normalized_fx_rate(holding)
    if holding.country != "US":
        return stored_rate

    try:
        return normalize_fx_rate(get_latest_usd_to_inr_rate())
    except Exception:
        return stored_rate


def normalize_holding_location_fields(holding: Holding) -> None:
    country = (holding.country or "IN").upper()
    holding.country = country
    holding.exchange_symbol = holding.exchange_symbol.strip().upper() if holding.exchange_symbol else None
    holding.exchange = holding.exchange.strip().upper() if holding.exchange else None

    if country == "US":
        holding.currency = "USD"
        if not holding.exchange:
            holding.exchange = "NASDAQ"
    else:
        holding.currency = "INR"
        if not holding.exchange:
            holding.exchange = "NSE"
        holding.fx_rate_to_inr = Decimal("1")

    if holding.fx_rate_to_inr is None:
        holding.fx_rate_to_inr = Decimal("1")


def resolve_refresh_symbol(holding: Holding) -> str:
    if holding.country == "US":
        return (holding.exchange_symbol or holding.symbol).strip().upper()

    return (holding.exchange_symbol or f"{holding.symbol}.NS").strip().upper()


def serialize_holding(holding: Holding) -> HoldingRead:
    stored_fx_rate = _normalized_fx_rate(holding)
    effective_fx_rate = _effective_fx_rate(holding)
    native_invested_amount = calculate_native_invested_amount(holding.quantity, holding.avg_buy_price)
    native_current_value = calculate_native_current_value(holding.quantity, holding.current_price)
    native_pnl = calculate_native_pnl(native_current_value, native_invested_amount)
    invested_amount = convert_to_inr(native_invested_amount, effective_fx_rate)
    current_value = convert_to_inr(native_current_value, effective_fx_rate)
    pnl = calculate_pnl(current_value, invested_amount)
    return_pct = calculate_return_pct(native_pnl, native_invested_amount)

    return HoldingRead(
        id=holding.id,
        symbol=holding.symbol,
        company_name=holding.company_name,
        asset_type=holding.asset_type,
        country=holding.country,
        currency=holding.currency,
        exchange=holding.exchange,
        exchange_symbol=holding.exchange_symbol,
        fx_rate_to_inr=stored_fx_rate,
        effective_fx_rate_to_inr=effective_fx_rate,
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
        native_invested_amount=native_invested_amount,
        native_current_value=native_current_value,
        native_pnl=native_pnl,
        native_currency=holding.currency,
        invested_amount=invested_amount,
        current_value=current_value,
        pnl=pnl,
        return_pct=return_pct,
    )


def mark_holding_priced_manually(holding: Holding) -> None:
    normalize_holding_location_fields(holding)
    holding.price_source = "manual"
    holding.last_price_refreshed_at = None


def mark_holding_refreshed(holding: Holding) -> None:
    normalize_holding_location_fields(holding)
    holding.price_source = "yfinance"
    holding.last_price_refreshed_at = datetime.now(timezone.utc)
