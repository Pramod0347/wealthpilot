from __future__ import annotations

from decimal import Decimal
from functools import lru_cache

from fastapi import HTTPException, status


class MarketPriceUnavailableError(Exception):
    pass


def _load_yfinance():
    try:
        import yfinance as yf  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency issue
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Price refresh is unavailable because yfinance is not installed in this backend environment.",
        ) from exc

    return yf


def _to_decimal(value: object) -> Decimal | None:
    if value is None:
        return None

    try:
        return Decimal(str(value))
    except Exception:
        return None


@lru_cache(maxsize=128)
def _latest_price_for_symbol(exchange_symbol: str) -> Decimal:
    yf = _load_yfinance()
    ticker = yf.Ticker(exchange_symbol)

    fast_info = getattr(ticker, "fast_info", None)
    if fast_info is not None:
        last_price = _to_decimal(getattr(fast_info, "lastPrice", None))
        if last_price is None and isinstance(fast_info, dict):
            last_price = _to_decimal(fast_info.get("lastPrice"))
        if last_price is not None and last_price > 0:
            return last_price

    history = ticker.history(period="5d", interval="1d", auto_adjust=False)
    if history is not None and not history.empty:
        for column in ("Close", "Adj Close"):
            if column in history.columns:
                last_value = _to_decimal(history[column].dropna().iloc[-1])
                if last_value is not None and last_value > 0:
                    return last_value

    raise MarketPriceUnavailableError(f"Price unavailable for {exchange_symbol}")


def fetch_latest_market_price(exchange_symbol: str) -> Decimal:
    if not exchange_symbol.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exchange symbol is required")

    try:
        return _latest_price_for_symbol(exchange_symbol.strip().upper())
    except HTTPException:
        raise
    except MarketPriceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
