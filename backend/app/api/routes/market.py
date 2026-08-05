from fastapi import APIRouter

from app.schemas.market import MarketOverviewItem
from app.services.market_service import get_cached_market_overview, request_market_overview_refresh

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/overview", response_model=list[MarketOverviewItem])
def get_market_overview() -> list[MarketOverviewItem]:
    # Price providers are contacted asynchronously.  The endpoint itself stays
    # fast even when an upstream provider is slow or unavailable.
    request_market_overview_refresh()
    return get_cached_market_overview()
