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


KNOWN_AUTO_TICKERS: dict[str, str] = {
    # Indian Mutual Funds (AMFI Scheme Codes for api.mfapi.in)
    "PPFAS_FLEXI_CAP": "122639",
    "PPFAS": "122639",
    "PARAG_PARIKH_FLEXI_CAP": "122639",
    "122639": "122639",
    "ICICI_SHORT_TERM_FUND": "120292",
    "ICICI_SHORT_TERM": "120292",
    "120292": "120292",
    # Gold & Indian ETFs
    "GOLDBEES": "GOLDBEES.NS",
    "MID150BEES": "MID150BEES.NS",
    "NIFTYBEES": "NIFTYBEES.NS",
    "BANKBEES": "BANKBEES.NS",
    "ITBEES": "ITBEES.NS",
    "JUNIORBEES": "JUNIORBEES.NS",
    # US Stocks & ETFs
    "QQQ": "QQQ",
    "AMZN": "AMZN",
    "AAPL": "AAPL",
    "MSFT": "MSFT",
    "GOOGL": "GOOGL",
    "GOOG": "GOOG",
    "NVDA": "NVDA",
    "TSLA": "TSLA",
    "META": "META",
    "SPY": "SPY",
    "VOO": "VOO",
    "VTI": "VTI",
}


def normalize_holding_location_fields(holding: Holding) -> None:
    country = (holding.country or "IN").upper()
    holding.country = country
    holding.exchange_symbol = holding.exchange_symbol.strip() if holding.exchange_symbol else None
    holding.exchange = holding.exchange.strip().upper() if holding.exchange else None

    clean_sym = (holding.symbol or "").strip().upper()
    if not holding.exchange_symbol and clean_sym in KNOWN_AUTO_TICKERS:
        holding.exchange_symbol = KNOWN_AUTO_TICKERS[clean_sym]

    if country == "US":
        holding.currency = "USD"
        if not holding.exchange:
            holding.exchange = "NASDAQ"
    else:
        holding.currency = "INR"
        if not holding.exchange:
            holding.exchange = "AMFI" if holding.asset_type == "mutual_fund" else "NSE"
        holding.fx_rate_to_inr = Decimal("1")

    if holding.fx_rate_to_inr is None:
        holding.fx_rate_to_inr = Decimal("1")


def resolve_refresh_symbol(holding: Holding) -> str:
    clean_sym = (holding.symbol or "").strip().upper()

    # 1. If exchange_symbol is explicitly configured
    if holding.exchange_symbol:
        ex_sym = holding.exchange_symbol.strip()
        if ex_sym.upper() in KNOWN_AUTO_TICKERS:
            return KNOWN_AUTO_TICKERS[ex_sym.upper()]
        return ex_sym if ex_sym.isdigit() else ex_sym.upper()

    # 2. If symbol is in KNOWN_AUTO_TICKERS
    if clean_sym in KNOWN_AUTO_TICKERS:
        return KNOWN_AUTO_TICKERS[clean_sym]

    # 3. If mutual fund with numeric symbol
    if holding.asset_type == "mutual_fund" and clean_sym.isdigit():
        return clean_sym

    # 4. US assets
    if holding.country == "US":
        return clean_sym

    # 5. Indian assets - default to NSE (.NS) if not specified
    if clean_sym.endswith(".NS") or clean_sym.endswith(".BO"):
        return clean_sym

    return f"{clean_sym}.NS"


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
        tags=holding.tags,
        status=holding.status,
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


def mark_holding_refreshed(holding: Holding, source: str | None = None) -> None:
    normalize_holding_location_fields(holding)
    if source and source in ("yfinance", "mfapi", "manual"):
        holding.price_source = source
    elif holding.asset_type == "mutual_fund" or (holding.exchange_symbol and holding.exchange_symbol.isdigit()):
        holding.price_source = "mfapi"
    else:
        holding.price_source = "yfinance"
    holding.last_price_refreshed_at = datetime.now(timezone.utc)

