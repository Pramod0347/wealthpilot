from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.bank_accounts import router as bank_accounts_router
from app.api.routes.cashflow import router as cashflow_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.credit_cards import router as credit_cards_router
from app.api.routes.fixed_savings import router as fixed_savings_router
from app.api.routes.holdings import router as holdings_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.market import router as market_router
from app.core.config import settings

_LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

def _build_allowed_origins() -> list[str]:
    origins = list(_LOCAL_ORIGINS)
    if settings.frontend_url:
        for url in settings.frontend_url.split(","):
            stripped = url.strip()
            if stripped and stripped not in origins:
                origins.append(stripped)
    return origins

app = FastAPI(title="WealthPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(holdings_router, prefix="/api")
app.include_router(credit_cards_router, prefix="/api")
app.include_router(bank_accounts_router, prefix="/api")
app.include_router(cashflow_router, prefix="/api")
app.include_router(fixed_savings_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(market_router, prefix="/api")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
