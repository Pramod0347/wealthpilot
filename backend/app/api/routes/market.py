from fastapi import APIRouter

from app.schemas.market import MarketOverviewItem
from app.services.market_service import fetch_market_overview

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/overview", response_model=list[MarketOverviewItem])
def get_market_overview() -> list[MarketOverviewItem]:
    return fetch_market_overview()
