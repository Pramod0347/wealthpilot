from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from math import fsum

from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.schemas.portfolio_snapshot import (
    PerformanceRange,
    PortfolioPerformancePoint,
    PortfolioPerformanceResponse,
    PortfolioPredictedPoint,
    PortfolioSnapshotRead,
)
from app.services.calculations import (
    calculate_current_value,
    calculate_invested_amount,
    calculate_pnl,
    calculate_return_pct,
)

logger = logging.getLogger(__name__)


def _today() -> date:
    return datetime.now(timezone.utc).astimezone().date()


def calculate_current_snapshot_from_holdings(db: Session) -> PortfolioSnapshotRead:
    holdings = db.scalars(select(Holding)).all()

    total_invested = sum(
        (calculate_invested_amount(holding.quantity, holding.avg_buy_price) for holding in holdings),
        Decimal("0"),
    )
    current_value = sum(
        (calculate_current_value(holding.quantity, holding.current_price) for holding in holdings),
        Decimal("0"),
    )
    total_pnl = calculate_pnl(current_value, total_invested)
    total_return_pct = calculate_return_pct(total_pnl, total_invested)

    now = datetime.now(timezone.utc)
    return PortfolioSnapshotRead(
        id=0,
        snapshot_date=_today(),
        total_invested=total_invested,
        current_value=current_value,
        total_pnl=total_pnl,
        total_return_pct=total_return_pct,
        source="manual",
        created_at=now,
        updated_at=now,
    )


def upsert_today_snapshot(db: Session) -> PortfolioSnapshotRead:
    current_snapshot = calculate_current_snapshot_from_holdings(db)
    today = current_snapshot.snapshot_date
    snapshot = db.scalar(select(PortfolioSnapshot).where(PortfolioSnapshot.snapshot_date == today))

    if snapshot is None:
        snapshot = PortfolioSnapshot(
            snapshot_date=today,
            total_invested=current_snapshot.total_invested,
            current_value=current_snapshot.current_value,
            total_pnl=current_snapshot.total_pnl,
            total_return_pct=current_snapshot.total_return_pct,
            source="manual",
        )
        db.add(snapshot)
    else:
        snapshot.total_invested = current_snapshot.total_invested
        snapshot.current_value = current_snapshot.current_value
        snapshot.total_pnl = current_snapshot.total_pnl
        snapshot.total_return_pct = current_snapshot.total_return_pct
        snapshot.source = "manual"

    db.commit()
    db.refresh(snapshot)
    return PortfolioSnapshotRead.model_validate(snapshot)


def _range_start(time_range: PerformanceRange, end_date: date) -> date | None:
    if time_range == "ALL":
        return None

    days_map = {
        "1M": 30,
        "3M": 90,
        "6M": 180,
        "1Y": 365,
    }
    return end_date - timedelta(days=days_map[time_range])


def get_snapshots(db: Session, time_range: PerformanceRange) -> list[PortfolioSnapshot]:
    end_date = _today()
    start_date = _range_start(time_range, end_date)

    query = select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date.asc())
    if start_date is not None:
        query = query.where(PortfolioSnapshot.snapshot_date >= start_date)

    return list(db.scalars(query).all())


def _linear_regression(points: list[PortfolioSnapshot]) -> tuple[float, float]:
    x_values = [float((snapshot.snapshot_date - points[0].snapshot_date).days) for snapshot in points]
    y_values = [float(snapshot.current_value) for snapshot in points]
    count = len(points)

    if count < 2:
        return 0.0, y_values[0] if y_values else 0.0

    sum_x = fsum(x_values)
    sum_y = fsum(y_values)
    sum_xy = fsum(x * y for x, y in zip(x_values, y_values, strict=False))
    sum_x2 = fsum(x * x for x in x_values)

    denominator = count * sum_x2 - sum_x * sum_x
    if denominator == 0:
        return 0.0, sum_y / count

    slope = (count * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / count
    return slope, intercept


def _build_prediction(points: list[PortfolioSnapshot], end_date: date) -> list[PortfolioPredictedPoint]:
    if len(points) < 3:
        return []

    slope, intercept = _linear_regression(points)
    last_actual_date = points[-1].snapshot_date
    if end_date <= last_actual_date:
        return []

    predicted_points: list[PortfolioPredictedPoint] = []

    cursor = last_actual_date + timedelta(days=7)
    while cursor < end_date:
        days_from_start = (cursor - points[0].snapshot_date).days
        predicted_points.append(
            PortfolioPredictedPoint(
                date=cursor,
                current_value=Decimal(str(max(intercept + slope * days_from_start, 0))),
                is_predicted=True,
            )
        )
        cursor += timedelta(days=7)

    if not predicted_points or predicted_points[-1].date != end_date:
        days_from_start = (end_date - points[0].snapshot_date).days
        predicted_points.append(
            PortfolioPredictedPoint(
                date=end_date,
                current_value=Decimal(str(max(intercept + slope * days_from_start, 0))),
                is_predicted=True,
            )
        )

    return predicted_points


def get_portfolio_performance(db: Session, time_range: PerformanceRange) -> PortfolioPerformanceResponse:
    try:
        if not inspect(db.get_bind()).has_table(PortfolioSnapshot.__tablename__):
            return PortfolioPerformanceResponse(
                range=time_range,
                actual=[],
                predicted=[],
                message="No portfolio snapshots yet",
            )

        snapshots = get_snapshots(db, time_range)
        actual = [
            PortfolioPerformancePoint(
                date=snapshot.snapshot_date,
                current_value=snapshot.current_value,
                total_invested=snapshot.total_invested,
                total_pnl=snapshot.total_pnl,
                total_return_pct=snapshot.total_return_pct,
            )
            for snapshot in snapshots
        ]

        if len(snapshots) == 0:
            return PortfolioPerformanceResponse(
                range=time_range,
                actual=[],
                predicted=[],
                message="No portfolio snapshots yet",
            )

        predicted = _build_prediction(snapshots, _today())
        message = None
        if len(snapshots) < 3:
            message = "More snapshot history needed for prediction"

        return PortfolioPerformanceResponse(
            range=time_range,
            actual=actual,
            predicted=predicted,
            message=message,
        )
    except SQLAlchemyError:
        logger.exception("Failed to build portfolio performance")
        raise
    except Exception:
        logger.exception("Unexpected error while building portfolio performance")
        raise
