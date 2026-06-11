from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.bank_accounts import router as bank_accounts_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.credit_cards import router as credit_cards_router
from app.api.routes.holdings import router as holdings_router
from app.api.routes.portfolio import router as portfolio_router
from app.api.routes.market import router as market_router

app = FastAPI(title="WealthPilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(holdings_router, prefix="/api")
app.include_router(credit_cards_router, prefix="/api")
app.include_router(bank_accounts_router, prefix="/api")
app.include_router(portfolio_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(market_router, prefix="/api")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
