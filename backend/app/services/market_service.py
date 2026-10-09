from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from multiprocessing import get_context
from multiprocessing.process import BaseProcess
import re
from queue import Empty
from threading import Lock
from time import monotonic
from urllib.error import URLError
from urllib.request import Request, urlopen

from app.schemas.market import MarketOverviewItem

TROY_OUNCE_IN_GRAMS = 31.1034768
GOLD_DISPLAY_GRAMS = 10
SILVER_DISPLAY_GRAMS = 1000


@dataclass(frozen=True)
class MarketSymbolConfig:
    name: str
    symbol: str
    currency: str
    grams_per_display_unit: float | None = None


MARKET_SYMBOLS: tuple[MarketSymbolConfig, ...] = (
    MarketSymbolConfig(name="NIFTY 50", symbol="^NSEI", currency="INR"),
    MarketSymbolConfig(name="SENSEX", symbol="^BSESN", currency="INR"),
    MarketSymbolConfig(name="GOLD", symbol="GC=F", currency="USD", grams_per_display_unit=GOLD_DISPLAY_GRAMS),
    MarketSymbolConfig(name="SILVER", symbol="SI=F", currency="USD", grams_per_display_unit=SILVER_DISPLAY_GRAMS),
)

USD_TO_INR_SYMBOL = "INR=X"
FX_CACHE_TTL = timedelta(minutes=5)
ET_COMMODITIES_NEWS_URL = "https://economictimes.indiatimes.com/markets/commodities/news"
_usd_to_inr_cache: dict[str, datetime | float | None] = {
    "value": None,
    "fetched_at": None,
}

# Market providers are external services and can occasionally stall despite their
# individual timeouts.  Never perform this work in an API request thread: an
# unavailable provider should leave the dashboard with its last known values, not
# make unrelated endpoints (including /health) wait.
_market_overview_cache: list[MarketOverviewItem] = []
_market_overview_lock = Lock()
_market_overview_process: BaseProcess | None = None
_market_overview_result_queue: object | None = None
_market_overview_refresh_started_at: float | None = None
MARKET_REFRESH_TIMEOUT_SECONDS = 30


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


def _fetch_html(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
            )
        },
    )
    with urlopen(request, timeout=10) as response:  # noqa: S310
        return response.read().decode("utf-8", errors="ignore")


def _latest_et_precious_metals_article_url() -> str | None:
    try:
        html = _fetch_html(ET_COMMODITIES_NEWS_URL)
    except (URLError, TimeoutError, OSError):
        return None

    article_urls = []
    for match in re.finditer(
        r'href="(?P<url>(?:https://economictimes\.indiatimes\.com)?/markets/(?:stocks|commodities)/news/[^"]*articleshow/\d+\.cms[^"]*)"',
        html,
        flags=re.IGNORECASE,
    ):
        raw_url = match.group("url")
        url = (
            raw_url
            if raw_url.startswith("https://economictimes.indiatimes.com")
            else f"https://economictimes.indiatimes.com{raw_url}"
        )
        article_urls.append(url)

    if not article_urls:
        return None

    def score(url: str) -> tuple[int, int]:
        slug = url.lower()
        keyword_score = 0
        if "gold" in slug:
            keyword_score += 3
        if "silver" in slug:
            keyword_score += 3
        if "prices-today" in slug or "rate-today" in slug:
            keyword_score += 2
        if "10-gm" in slug or "kg" in slug:
            keyword_score += 1
        article_id_match = re.search(r"articleshow/(\d+)\.cms", slug)
        article_id = int(article_id_match.group(1)) if article_id_match else 0
        return keyword_score, article_id

    best_url = max(dict.fromkeys(article_urls), key=score)
    if score(best_url)[0] <= 0:
        return None

    return best_url


def _parse_et_timestamp(value: str | None, fallback: datetime) -> datetime:
    if not value:
        return fallback

    cleaned = value.replace("IST", "").strip()
    for fmt in ("%b %d, %Y, %I:%M:%S %p", "%b %d, %Y, %I:%M %p"):
        try:
            parsed = datetime.strptime(cleaned, fmt)
            return parsed.replace(tzinfo=timezone(timedelta(hours=5, minutes=30))).astimezone(timezone.utc)
        except ValueError:
            continue

    return fallback


def _parse_domestic_precious_metals_from_et() -> dict[str, MarketOverviewItem]:
    article_url = _latest_et_precious_metals_article_url()
    if article_url is None:
        return {}

    try:
        article_html = _fetch_html(article_url)
    except (URLError, TimeoutError, OSError):
        return {}

    now = datetime.now(timezone.utc)
    timestamp_match = re.search(
        r"Last Updated:\s*(?P<updated>[A-Za-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}(?::\d{2})?\s+[AP]M\s+IST)",
        article_html,
        flags=re.IGNORECASE,
    )
    article_updated = _parse_et_timestamp(timestamp_match.group("updated") if timestamp_match else None, now)

    gold_match = re.search(
        r"Gold.*?Rs\s*(?P<change>-?[\d,]+(?:\.\d+)?)\s*(?:\((?P<change_pct_a>-?[\d.]+)%\)|or\s*(?P<change_pct_b>-?[\d.]+)%)?.*?to\s*Rs\s*(?P<price>[\d,]+(?:\.\d+)?)\s*per\s*10\s*g",
        article_html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    silver_match = re.search(
        r"Silver.*?Rs\s*(?P<change>-?[\d,]+(?:\.\d+)?)\s*(?:\((?P<change_pct_a>-?[\d.]+)%\)|or\s*(?P<change_pct_b>-?[\d.]+)%)?.*?to\s*Rs\s*(?P<price>[\d,]+(?:\.\d+)?)\s*per\s*kg",
        article_html,
        flags=re.IGNORECASE | re.DOTALL,
    )

    items: dict[str, MarketOverviewItem] = {}
    if gold_match:
        gold_price = _to_float(gold_match.group("price").replace(",", ""))
        gold_change = _to_float(gold_match.group("change").replace(",", ""))
        gold_change_pct = _to_float(gold_match.group("change_pct_a") or gold_match.group("change_pct_b"))
        if gold_change_pct is None and gold_price is not None and gold_change is not None:
            prev_gold_price = gold_price - gold_change
            if prev_gold_price > 0:
                gold_change_pct = round((gold_change / prev_gold_price) * 100, 2)

        items["GC=F"] = MarketOverviewItem(
            name="GOLD",
            symbol="GC=F",
            price=gold_price,
            change=gold_change,
            change_pct=gold_change_pct,
            currency="INR",
            source="economic_times",
            last_updated=article_updated,
        )

    if silver_match:
        silver_price = _to_float(silver_match.group("price").replace(",", ""))
        silver_change = _to_float(silver_match.group("change").replace(",", ""))
        silver_change_pct = _to_float(silver_match.group("change_pct_a") or silver_match.group("change_pct_b"))
        if silver_change_pct is None and silver_price is not None and silver_change is not None:
            prev_silver_price = silver_price - silver_change
            if prev_silver_price > 0:
                silver_change_pct = round((silver_change / prev_silver_price) * 100, 2)

        items["SI=F"] = MarketOverviewItem(
            name="SILVER",
            symbol="SI=F",
            price=silver_price,
            change=silver_change,
            change_pct=silver_change_pct,
            currency="INR",
            source="economic_times",
            last_updated=article_updated,
        )

    return items


# In India, domestic retail and MCX prices trade at international spot plus
# customs duty (6%), AIDC cess (5.35%), and GST (3%), giving an effective landed factor ~1.145.
INDIA_BULLION_LANDED_PREMIUM = 1.145


def _convert_commodity_price_to_inr_display_unit(
    price: float | None,
    change: float | None,
    usd_to_inr_rate: float | None,
    grams_per_display_unit: float | None,
) -> tuple[float | None, float | None]:
    if price is None or usd_to_inr_rate is None or grams_per_display_unit is None:
        return price, change

    unit_multiplier = (grams_per_display_unit / TROY_OUNCE_IN_GRAMS) * INDIA_BULLION_LANDED_PREMIUM
    converted_price = price * usd_to_inr_rate * unit_multiplier
    converted_change = change * usd_to_inr_rate * unit_multiplier if change is not None else None
    return converted_price, converted_change


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
    domestic_precious_metals = _parse_domestic_precious_metals_from_et()
    items: list[MarketOverviewItem] = []
    for config in MARKET_SYMBOLS:
        if config.symbol in domestic_precious_metals:
            items.append(domestic_precious_metals[config.symbol])
            continue

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
            if config.symbol in {"GC=F", "SI=F"}:
                price, change = _convert_commodity_price_to_inr_display_unit(
                    price=price,
                    change=change,
                    usd_to_inr_rate=usd_to_inr_rate,
                    grams_per_display_unit=config.grams_per_display_unit,
                )
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


def get_cached_market_overview() -> list[MarketOverviewItem]:
    """Return the latest market snapshot without doing network I/O."""
    _collect_market_refresh_result()
    with _market_overview_lock:
        return list(_market_overview_cache)


def _fetch_market_overview_in_worker(result_queue: object) -> None:
    """Run provider code outside the API process."""
    try:
        latest = fetch_market_overview()
        result_queue.put([item.model_dump(mode="json") for item in latest])  # type: ignore[attr-defined]
    except Exception:
        result_queue.put(None)  # type: ignore[attr-defined]


def _clear_market_refresh_locked() -> None:
    global _market_overview_process, _market_overview_result_queue, _market_overview_refresh_started_at
    _market_overview_process = None
    _market_overview_result_queue = None
    _market_overview_refresh_started_at = None


def _collect_market_refresh_result() -> None:
    """Collect or terminate the isolated worker without blocking a request."""
    global _market_overview_cache

    with _market_overview_lock:
        process = _market_overview_process
        result_queue = _market_overview_result_queue
        started_at = _market_overview_refresh_started_at
        if process is None or result_queue is None:
            return

        try:
            payload = result_queue.get_nowait()  # type: ignore[attr-defined]
        except Empty:
            if started_at is not None and monotonic() - started_at >= MARKET_REFRESH_TIMEOUT_SECONDS:
                if process.is_alive():
                    process.terminate()
                process.join(timeout=0.1)
                _clear_market_refresh_locked()
            elif not process.is_alive():
                process.join(timeout=0.1)
                _clear_market_refresh_locked()
            return

        process.join(timeout=0.1)
        _clear_market_refresh_locked()
        if payload is not None:
            _market_overview_cache = [MarketOverviewItem.model_validate(item) for item in payload]


def request_market_overview_refresh() -> None:
    """Start one best-effort refresh and return immediately.

    A single isolated worker is deliberately allowed. If a provider hangs or
    spins, it cannot consume the API process or degrade other routes.
    """
    global _market_overview_process, _market_overview_result_queue, _market_overview_refresh_started_at

    _collect_market_refresh_result()

    with _market_overview_lock:
        if _market_overview_process is not None:
            return

        context = get_context("spawn")
        result_queue = context.Queue()
        process = context.Process(target=_fetch_market_overview_in_worker, args=(result_queue,), daemon=True)
        process.start()
        _market_overview_process = process
        _market_overview_result_queue = result_queue
        _market_overview_refresh_started_at = monotonic()
