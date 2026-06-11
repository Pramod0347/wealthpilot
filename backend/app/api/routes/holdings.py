from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.holding import Holding
from app.schemas.holding import (
    BulkPriceRefreshFailure,
    BulkPriceRefreshResponse,
    HoldingsAnalyticsResponse,
    HoldingCreate,
    HoldingRead,
    HoldingUpdate,
)
from app.services.holdings_analytics_service import build_holdings_analytics
from app.services.holdings_service import (
    mark_holding_priced_manually,
    mark_holding_refreshed,
    normalize_holding_location_fields,
    resolve_refresh_symbol,
    serialize_holding,
)
from app.services.portfolio_snapshot_service import upsert_today_snapshot
from app.services.market_price_service import fetch_latest_market_price, MarketPriceUnavailableError

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("", response_model=list[HoldingRead])
def list_holdings(db: Session = Depends(get_db)) -> list[HoldingRead]:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    return [serialize_holding(holding) for holding in holdings]


@router.get("/analytics", response_model=HoldingsAnalyticsResponse)
def get_holdings_analytics(db: Session = Depends(get_db)) -> HoldingsAnalyticsResponse:
    return build_holdings_analytics(db)


@router.get("/{holding_id}", response_model=HoldingRead)
def get_holding(holding_id: int, db: Session = Depends(get_db)) -> HoldingRead:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")
    return serialize_holding(holding)


@router.post("", response_model=HoldingRead, status_code=status.HTTP_201_CREATED)
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)) -> HoldingRead:
    holding = Holding(**payload.model_dump(exclude_none=True))
    mark_holding_priced_manually(holding)
    db.add(holding)
    db.commit()
    db.refresh(holding)
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass
    return serialize_holding(holding)


@router.patch("/{holding_id}", response_model=HoldingRead)
def update_holding(holding_id: int, payload: HoldingUpdate, db: Session = Depends(get_db)) -> HoldingRead:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(holding, field, value)

    normalize_holding_location_fields(holding)
    if "current_price" in updates:
        mark_holding_priced_manually(holding)

    db.commit()
    db.refresh(holding)
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass
    return serialize_holding(holding)


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_holding(holding_id: int, db: Session = Depends(get_db)) -> None:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")

    db.delete(holding)
    db.commit()
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass


@router.post("/{holding_id}/refresh-price", response_model=HoldingRead)
def refresh_price(holding_id: int, db: Session = Depends(get_db)) -> HoldingRead:
    holding = db.get(Holding, holding_id)
    if holding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")
    if holding.asset_type == "mutual_fund" or holding.price_source != "yfinance":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This holding is manual-only")

    exchange_symbol = resolve_refresh_symbol(holding)
    try:
        latest_price = fetch_latest_market_price(exchange_symbol)
    except HTTPException as exc:
        if exc.status_code >= 500:
            raise
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc
    except MarketPriceUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    holding.current_price = latest_price
    mark_holding_refreshed(holding)
    db.commit()
    db.refresh(holding)
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass
    return serialize_holding(holding)


@router.post("/refresh-prices", response_model=BulkPriceRefreshResponse)
def refresh_prices(db: Session = Depends(get_db)) -> BulkPriceRefreshResponse:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    updated_count = 0
    failures: list[BulkPriceRefreshFailure] = []

    for holding in holdings:
        if holding.asset_type == "mutual_fund" or holding.price_source != "yfinance":
            continue
        exchange_symbol = resolve_refresh_symbol(holding)
        try:
            latest_price = fetch_latest_market_price(exchange_symbol)
        except HTTPException as exc:
            failures.append(
                BulkPriceRefreshFailure(
                    holding_id=holding.id,
                    symbol=holding.symbol,
                    reason=str(exc.detail),
                )
            )
            continue
        except MarketPriceUnavailableError as exc:
            failures.append(
                BulkPriceRefreshFailure(
                    holding_id=holding.id,
                    symbol=holding.symbol,
                    reason=str(exc),
                )
            )
            continue

        holding.current_price = latest_price
        mark_holding_refreshed(holding)
        updated_count += 1

    db.commit()
    try:
        upsert_today_snapshot(db)
    except Exception:
        pass

    return BulkPriceRefreshResponse(
        updated_count=updated_count,
        failed_count=len(failures),
        failures=failures,
    )
