from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.portfolio_intelligence import PortfolioIntelligenceResponse
from app.schemas.portfolio_snapshot import PerformanceRange, PortfolioPerformanceResponse, PortfolioSnapshotRead
from app.services.portfolio_intelligence_service import build_portfolio_intelligence
from app.services.portfolio_snapshot_service import get_portfolio_performance, upsert_today_snapshot

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/snapshots/today", response_model=PortfolioSnapshotRead)
def save_today_snapshot(db: Session = Depends(get_db)) -> PortfolioSnapshotRead:
    return upsert_today_snapshot(db)


@router.get("/performance", response_model=PortfolioPerformanceResponse)
def portfolio_performance(
    time_range: PerformanceRange = Query("6M", alias="range"),
    db: Session = Depends(get_db),
) -> PortfolioPerformanceResponse:
    return get_portfolio_performance(db, time_range)


@router.get("/intelligence", response_model=PortfolioIntelligenceResponse)
def portfolio_intelligence(db: Session = Depends(get_db)) -> PortfolioIntelligenceResponse:
    return build_portfolio_intelligence(db)
