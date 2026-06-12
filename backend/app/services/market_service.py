from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.schemas.market import MarketOverviewItem


@dataclass(frozen=True)
class MarketSymbolConfig:
    name: str
    symbol: str
    currency: str


MARKET_SYMBOLS: tuple[MarketSymbolConfig, ...] = (
    MarketSymbolConfig(name="NIFTY 50", symbol="^NSEI", currency="INR"),
    MarketSymbolConfig(name="SENSEX", symbol="^BSESN", currency="INR"),
    MarketSymbolConfig(name="GOLD", symbol="GC=F", currency="USD"),
    MarketSymbolConfig(name="SILVER", symbol="SI=F", currency="USD"),
)

USD_TO_INR_SYMBOL = "INR=X"
FX_CACHE_TTL = timedelta(minutes=5)
_usd_to_inr_cache: dict[str, datetime | float | None] = {
    "value": None,
    "fetched_at": None,
}


def _load_yfinance():
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency issue
        raise RuntimeError("yfinance is not installed in this backend environment.") from exc

    return yf


def _to_float(value: object) -> float | None:
    if value is None:
        return None

    try:
        return float(Decimal(str(value)))
    except Exception:
        return None


def _extract_last_price_and_timestamp(history: object) -> tuple[float | None, datetime | None]:
    if history is None or history.empty or "Close" not in history.columns:
        return None, None

    valid_rows = history.dropna(subset=["Close"])
    if valid_rows.empty:
        return None, None

    last_row = valid_rows.tail(1)
    price = _to_float(last_row["Close"].iloc[0])
    timestamp = last_row.index[-1].to_pydatetime()
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=timezone.utc)
    else:
        timestamp = timestamp.astimezone(timezone.utc)
    return price, timestamp


def _extract_change(history: object) -> tuple[float | None, float | None]:
    if history is None or history.empty or "Close" not in history.columns:
        return None, None

    closes = history["Close"].dropna().tail(2).tolist()
    if not closes:
        return None, None

    last_price = _to_float(closes[-1])
    if last_price is None:
        return None, None

    if len(closes) == 1:
        return 0.0, 0.0

    previous_price = _to_float(closes[-2])
    if previous_price is None or previous_price == 0:
        return 0.0, 0.0

    change = last_price - previous_price
    change_pct = (change / previous_price) * 100
    return change, change_pct


def _fetch_usd_to_inr_rate(yf: object) -> float | None:
    try:
        ticker = yf.Ticker(USD_TO_INR_SYMBOL)
        history = ticker.history(period="5d", interval="1d", auto_adjust=False)
        price, _ = _extract_last_price_and_timestamp(history)
        if price is not None:
            return price

        fast_info = getattr(ticker, "fast_info", None)
        if fast_info is not None:
            if isinstance(fast_info, dict):
                return _to_float(fast_info.get("lastPrice") or fast_info.get("last_price"))
            return _to_float(getattr(fast_info, "lastPrice", None) or getattr(fast_info, "last_price", None))
    except Exception:
        return None

    return None


def get_latest_usd_to_inr_rate() -> Decimal:
    cached_value = _usd_to_inr_cache.get("value")
    fetched_at = _usd_to_inr_cache.get("fetched_at")
    now = datetime.now(timezone.utc)

    if isinstance(cached_value, float) and isinstance(fetched_at, datetime) and now - fetched_at < FX_CACHE_TTL:
        return Decimal(str(cached_value))

    yf = _load_yfinance()
    rate = _fetch_usd_to_inr_rate(yf)
    if rate is None:
        raise RuntimeError("USD to INR exchange rate is unavailable from yfinance.")

    _usd_to_inr_cache["value"] = rate
    _usd_to_inr_cache["fetched_at"] = now
    return Decimal(str(rate))


def fetch_market_overview() -> list[MarketOverviewItem]:
    now = datetime.now(timezone.utc)

    try:
        yf = _load_yfinance()
    except RuntimeError as exc:
        return [
            MarketOverviewItem(
                name=config.name,
                symbol=config.symbol,
                currency=config.currency,
                source="yfinance",
                last_updated=now,
                error=str(exc),
            )
            for config in MARKET_SYMBOLS
        ]

    usd_to_inr_rate = _fetch_usd_to_inr_rate(yf)
    items: list[MarketOverviewItem] = []
    for config in MARKET_SYMBOLS:
        try:
            ticker = yf.Ticker(config.symbol)
            history = ticker.history(period="5d", interval="1d", auto_adjust=False)
            price, last_updated = _extract_last_price_and_timestamp(history)
            change, change_pct = _extract_change(history)

            if price is None:
                fast_info = getattr(ticker, "fast_info", None)
                if fast_info is not None:
                    if isinstance(fast_info, dict):
                        price = _to_float(fast_info.get("lastPrice") or fast_info.get("last_price"))
                    else:
                        price = _to_float(
                            getattr(fast_info, "lastPrice", None) or getattr(fast_info, "last_price", None)
                        )
                if last_updated is None:
                    last_updated = now

            item_currency = config.currency
            if config.symbol in {"GC=F", "SI=F"} and usd_to_inr_rate is not None:
                if price is not None:
                    price = price * usd_to_inr_rate
                if change is not None:
                    change = change * usd_to_inr_rate
                item_currency = "INR"

            items.append(
                MarketOverviewItem(
                    name=config.name,
                    symbol=config.symbol,
                    price=price,
                    change=change,
                    change_pct=change_pct,
                    currency=item_currency,
                    source="yfinance",
                    last_updated=now,
                )
            )
        except Exception as exc:  # pragma: no cover - network/data variability
            items.append(
                MarketOverviewItem(
                    name=config.name,
                    symbol=config.symbol,
                    currency=config.currency,
                    source="yfinance",
                    last_updated=now,
                    error=str(exc),
                )
            )

    return items
