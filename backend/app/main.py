from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.deps import require_auth
from app.api.routes.auth import router as auth_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.bank_accounts import router as bank_accounts_router
from app.api.routes.cashflow import router as cashflow_router
from app.api.routes.credit_card_bills import router as credit_card_bills_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.credit_cards import router as credit_cards_router
from app.api.routes.deposits import router as deposits_router
from app.api.routes.fixed_savings import router as fixed_savings_router
from app.api.routes.goals import router as goals_router
from app.api.routes.holdings import router as holdings_router
from app.api.routes.home_contributions import router as home_contributions_router
from app.api.routes.investment_transactions import router as investment_transactions_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.market import router as market_router
from app.api.routes.reports import router as reports_router
from app.api.routes.tax import router as tax_router
from app.core.config import settings

_LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _normalize_origin(url: str) -> str:
    return url.strip().rstrip("/")


def _build_allowed_origins() -> list[str]:
    origins = [_normalize_origin(url) for url in _LOCAL_ORIGINS]
    if settings.frontend_url:
        for url in settings.frontend_url.split(","):
            stripped = _normalize_origin(url)
            if stripped and stripped not in origins:
                origins.append(stripped)
    return origins


_IS_PRODUCTION = settings.app_env == "production"

app = FastAPI(
    title="WealthPilot API",
    docs_url=None if _IS_PRODUCTION else "/docs",
    redoc_url=None if _IS_PRODUCTION else "/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

_PROTECTED = [Depends(require_auth)]

app.include_router(auth_router, prefix="/api")
app.include_router(analytics_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(holdings_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(home_contributions_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(investment_transactions_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(credit_cards_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(credit_card_bills_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(bank_accounts_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(deposits_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(cashflow_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(fixed_savings_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(goals_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(portfolio_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(dashboard_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(market_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(reports_router, prefix="/api", dependencies=_PROTECTED)
app.include_router(tax_router, prefix="/api", dependencies=_PROTECTED)


# Auto-migrate known holdings and mutual fund AMFI scheme codes (122639 for PPFAS, 120754 for ICICI)
@app.on_event("startup")
def auto_migrate_holdings():
    try:
        from datetime import datetime, timezone
        from app.core.database import SessionLocal
        from app.models.holding import Holding
        from app.services.holdings_service import KNOWN_AUTO_TICKERS, normalize_holding_location_fields
        from app.services.market_price_service import fetch_latest_market_price

        dump_lines = []
        with SessionLocal() as db:
            holdings = db.query(Holding).all()
            for h in holdings:
                sym = (h.symbol or "").strip().upper()
                if sym in KNOWN_AUTO_TICKERS:
                    h.exchange_symbol = KNOWN_AUTO_TICKERS[sym]
                    h.price_source = "mfapi" if h.asset_type == "mutual_fund" else "yfinance"
                    normalize_holding_location_fields(h)
                    if h.asset_type == "mutual_fund" or h.exchange_symbol:
                        try:
                            price = fetch_latest_market_price(h.exchange_symbol)
                            if price and price > 0:
                                h.current_price = price
                                h.last_price_refreshed_at = datetime.now(timezone.utc)
                        except Exception as p_err:
                            dump_lines.append(f"Price fetch error for {sym}: {p_err}")
                dump_lines.append(f"id={h.id} sym={h.symbol} type={h.asset_type} exch_sym={h.exchange_symbol} src={h.price_source} price={h.current_price}")
            db.commit()

        with open("/Users/pramodgoudar/.gemini/antigravity/brain/0626d531-e8b4-4d7c-9c20-de0f60cb14b8/scratch/holdings_dump.txt", "w") as f:
            f.write("\n".join(dump_lines))
    except Exception as e:
        with open("/Users/pramodgoudar/.gemini/antigravity/brain/0626d531-e8b4-4d7c-9c20-de0f60cb14b8/scratch/holdings_dump.txt", "w") as f:
            f.write(f"Startup error: {e}")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
