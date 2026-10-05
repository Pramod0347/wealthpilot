from __future__ import annotations

import json
import urllib.request
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
def _fetch_mf_nav_from_mfapi(scheme_code: str) -> Decimal:
    clean_code = scheme_code.strip()
    url = f"https://api.mfapi.in/mf/{clean_code}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "WealthPilot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
            if payload.get("status") == "SUCCESS" and payload.get("data"):
                latest_entry = payload["data"][0]
                nav_val = _to_decimal(latest_entry.get("nav"))
                if nav_val is not None and nav_val > 0:
                    return nav_val
    except Exception as exc:
        raise MarketPriceUnavailableError(f"Failed to fetch NAV from MFAPI for scheme {scheme_code}: {exc}") from exc

    raise MarketPriceUnavailableError(f"NAV unavailable for mutual fund scheme {scheme_code}")


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
    symbol = exchange_symbol.strip()
    if not symbol:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exchange symbol is required")

    # Map legacy/typo scheme code 120292 to official 120754
    if symbol == "120292":
        symbol = "120754"

    # If the exchange symbol is numeric, it is an Indian AMFI mutual fund scheme code
    if symbol.isdigit():
        try:
            return _fetch_mf_nav_from_mfapi(symbol)
        except MarketPriceUnavailableError as exc:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    try:
        return _latest_price_for_symbol(symbol.upper())
    except HTTPException:
        raise
    except MarketPriceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

