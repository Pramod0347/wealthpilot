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
    KNOWN_AUTO_TICKERS,
    mark_holding_priced_manually,
    mark_holding_refreshed,
    normalize_holding_location_fields,
    resolve_refresh_symbol,
    serialize_holding,
)
from app.services.portfolio_snapshot_service import upsert_today_snapshot
from app.services.market_price_service import fetch_latest_market_price, MarketPriceUnavailableError
from app.models.investment_transaction import InvestmentTransaction
from app.services.investment_transactions_service import recalculate_holding

router = APIRouter(prefix="/holdings", tags=["holdings"])


@router.get("", response_model=list[HoldingRead])
def list_holdings(db: Session = Depends(get_db)) -> list[HoldingRead]:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    changed = False
    for holding in holdings:
        clean_sym = (holding.symbol or "").strip().upper()
        if clean_sym in KNOWN_AUTO_TICKERS and (holding.price_source == "manual" or not holding.exchange_symbol):
            holding.exchange_symbol = KNOWN_AUTO_TICKERS[clean_sym]
            holding.price_source = "mfapi" if holding.asset_type == "mutual_fund" else "yfinance"
            normalize_holding_location_fields(holding)
            changed = True
    if changed:
        db.commit()
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
    values = payload.model_dump(exclude_none=True)
    opening_quantity = values.pop("quantity")
    opening_price = values.pop("avg_buy_price")
    explicit_price_source = values.pop("price_source", None)
    holding = Holding(**values, quantity=0, avg_buy_price=0)
    normalize_holding_location_fields(holding)

    if explicit_price_source == "manual":
        mark_holding_priced_manually(holding)
    else:
        try:
            exchange_symbol = resolve_refresh_symbol(holding)
            latest_price = fetch_latest_market_price(exchange_symbol)
            if latest_price is not None and latest_price > 0:
                holding.current_price = latest_price
                mark_holding_refreshed(holding, source=explicit_price_source)
            else:
                mark_holding_priced_manually(holding)
        except Exception:
            mark_holding_priced_manually(holding)

    db.add(holding)
    db.flush()
    if opening_quantity > 0:
        db.add(InvestmentTransaction(
            investment_id=holding.id, transaction_type="BUY", transaction_mode="One Time",
            quantity=opening_quantity, price_per_unit=opening_price, fees=0, taxes=0,
            exchange_rate=holding.fx_rate_to_inr, transaction_date=holding.as_of_date,
            notes="Opening balance",
        ))
        db.flush()
    recalculate_holding(db, holding)
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
    requested_price_source = updates.pop("price_source", None)

    for field, value in updates.items():
        setattr(holding, field, value)

    normalize_holding_location_fields(holding)
    if requested_price_source == "manual" or ("current_price" in updates and requested_price_source is None):
        mark_holding_priced_manually(holding)
    elif requested_price_source in ("yfinance", "mfapi", "auto"):
        mark_holding_refreshed(holding, source=requested_price_source if requested_price_source != "auto" else None)
        try:
            exchange_symbol = resolve_refresh_symbol(holding)
            latest_price = fetch_latest_market_price(exchange_symbol)
            if latest_price is not None and latest_price > 0:
                holding.current_price = latest_price
        except Exception:
            pass

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

    clean_sym = (holding.symbol or "").strip().upper()
    if clean_sym in KNOWN_AUTO_TICKERS and (holding.price_source == "manual" or not holding.exchange_symbol):
        holding.exchange_symbol = KNOWN_AUTO_TICKERS[clean_sym]
        holding.price_source = "mfapi" if holding.asset_type == "mutual_fund" else "yfinance"
        normalize_holding_location_fields(holding)

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
    # Exited positions are valued from their ledger, not live prices, so skip them.
    holdings = db.scalars(
        select(Holding).where(Holding.quantity > 0).order_by(Holding.created_at.desc())
    ).all()
    updated_count = 0
    failures: list[BulkPriceRefreshFailure] = []

    for holding in holdings:
        clean_sym = (holding.symbol or "").strip().upper()
        if clean_sym in KNOWN_AUTO_TICKERS and (holding.price_source == "manual" or not holding.exchange_symbol):
            holding.exchange_symbol = KNOWN_AUTO_TICKERS[clean_sym]
            holding.price_source = "mfapi" if holding.asset_type == "mutual_fund" else "yfinance"
            normalize_holding_location_fields(holding)

        exchange_symbol = resolve_refresh_symbol(holding)
        try:
            latest_price = fetch_latest_market_price(exchange_symbol)
        except Exception as exc:
            failures.append(
                BulkPriceRefreshFailure(
                    holding_id=holding.id,
                    symbol=holding.symbol,
                    reason=str(getattr(exc, "detail", exc)),
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

