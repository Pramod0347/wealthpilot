from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from statistics import median

from sqlalchemy import inspect, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.schemas.portfolio_snapshot import (
    PerformanceRange,
    PortfolioPerformanceResponse,
    PortfolioPerformanceSummary,
    PortfolioPredictionPoint,
    PortfolioPredictionSummary,
    PortfolioSnapshotPerformancePoint,
    PortfolioSnapshotRead,
)
from app.services.calculations import calculate_pnl, calculate_return_pct
from app.services.holdings_service import serialize_holding

logger = logging.getLogger(__name__)

_DAILY_PROJECTION_CAP = Decimal("0.01")
_MIN_DAILY_RETURN = Decimal("-0.05")
_MAX_DAILY_RETURN = Decimal("0.05")


def _today() -> date:
    return datetime.now(timezone.utc).astimezone().date()


def _to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _subtract_months(value: date, months: int) -> date:
    year = value.year
    month = value.month - months
    while month <= 0:
        month += 12
        year -= 1
    month_lengths = [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(value.day, month_lengths[month - 1])
    return date(year, month, day)


def _range_start(time_range: PerformanceRange, end_date: date) -> date | None:
    if time_range == "ALL":
        return None
    months_map = {"1M": 1, "3M": 3, "6M": 6, "1Y": 12}
    return _subtract_months(end_date, months_map[time_range])


def _prediction_horizon_days(time_range: PerformanceRange) -> int:
    return {
        "1M": 7,
        "3M": 30,
        "6M": 60,
        "1Y": 90,
        "ALL": 90,
    }[time_range]


def calculate_current_snapshot_from_holdings(db: Session) -> PortfolioSnapshotRead:
    holdings = db.scalars(select(Holding)).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]

    total_invested = sum((holding.invested_amount for holding in serialized_holdings), Decimal("0"))
    current_value = sum((holding.current_value for holding in serialized_holdings), Decimal("0"))
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


def _list_all_snapshots(db: Session) -> list[PortfolioSnapshot]:
    query = select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date.asc(), PortfolioSnapshot.updated_at.asc(), PortfolioSnapshot.id.asc())
    return list(db.scalars(query).all())


def _latest_snapshot_by_day(snapshots: list[PortfolioSnapshot]) -> list[PortfolioSnapshot]:
    by_day: dict[date, PortfolioSnapshot] = {}
    for snapshot in snapshots:
        current = by_day.get(snapshot.snapshot_date)
        if current is None or snapshot.updated_at >= current.updated_at:
            by_day[snapshot.snapshot_date] = snapshot
    return sorted(by_day.values(), key=lambda item: item.snapshot_date)


def _serialize_snapshot(snapshot: PortfolioSnapshot) -> PortfolioSnapshotPerformancePoint:
    return PortfolioSnapshotPerformancePoint(
        date=snapshot.snapshot_date,
        timestamp=snapshot.updated_at,
        total_value=snapshot.current_value,
        net_worth=None,
        invested_value=snapshot.total_invested,
    )


def _build_linear_projection(daily_snapshots: list[PortfolioSnapshot], horizon_days: int) -> list[PortfolioPredictionPoint]:
    if len(daily_snapshots) < 3:
        return []
    first_day = daily_snapshots[0].snapshot_date
    xs = [Decimal((snapshot.snapshot_date - first_day).days) for snapshot in daily_snapshots]
    ys = [snapshot.current_value for snapshot in daily_snapshots]
    count = Decimal(len(daily_snapshots))
    sum_x = sum(xs, Decimal("0"))
    sum_y = sum(ys, Decimal("0"))
    sum_xy = sum((x * y for x, y in zip(xs, ys, strict=False)), Decimal("0"))
    sum_x2 = sum((x * x for x in xs), Decimal("0"))
    denominator = count * sum_x2 - sum_x * sum_x
    if denominator == 0:
        return []
    slope = (count * sum_xy - sum_x * sum_y) / denominator
    intercept = (sum_y - slope * sum_x) / count

    last_snapshot = daily_snapshots[-1]
    points: list[PortfolioPredictionPoint] = []
    for day_offset in range(1, horizon_days + 1):
        target_date = last_snapshot.snapshot_date + timedelta(days=day_offset)
        x_value = Decimal((target_date - first_day).days)
        estimated_value = intercept + slope * x_value
        if estimated_value < 0:
            estimated_value = Decimal("0")
        points.append(PortfolioPredictionPoint(date=target_date, estimated_value=estimated_value.quantize(Decimal("0.01"))))
    return points


def _build_prediction(daily_snapshots: list[PortfolioSnapshot], time_range: PerformanceRange) -> PortfolioPredictionSummary:
    if len(daily_snapshots) < 3:
        return PortfolioPredictionSummary(
            available=False,
            method="insufficient_data",
            confidence=None,
            reason="At least 3 snapshots are needed to estimate growth.",
            points=[],
            estimated_change_amount=None,
            estimated_change_pct=None,
        )

    horizon_days = _prediction_horizon_days(time_range)
    confidence = "high" if len(daily_snapshots) >= 30 else "medium" if len(daily_snapshots) >= 10 else "low"

    returns: list[Decimal] = []
    for previous, current in zip(daily_snapshots, daily_snapshots[1:], strict=False):
        days_gap = (current.snapshot_date - previous.snapshot_date).days
        if days_gap <= 0 or previous.current_value <= 0:
            continue
        total_return = (current.current_value - previous.current_value) / previous.current_value
        daily_return = total_return / Decimal(days_gap)
        if daily_return < _MIN_DAILY_RETURN:
            daily_return = _MIN_DAILY_RETURN
        elif daily_return > _MAX_DAILY_RETURN:
            daily_return = _MAX_DAILY_RETURN
        returns.append(daily_return)

    last_value = daily_snapshots[-1].current_value
    if returns:
        median_daily_return = Decimal(str(median([float(item) for item in returns])))
        if median_daily_return < -_DAILY_PROJECTION_CAP:
            median_daily_return = -_DAILY_PROJECTION_CAP
        elif median_daily_return > _DAILY_PROJECTION_CAP:
            median_daily_return = _DAILY_PROJECTION_CAP

        predicted_points: list[PortfolioPredictionPoint] = []
        projected_value = last_value
        for day_offset in range(1, horizon_days + 1):
            projected_value = projected_value * (Decimal("1") + median_daily_return)
            if projected_value < 0:
                projected_value = Decimal("0")
            predicted_points.append(
                PortfolioPredictionPoint(
                    date=daily_snapshots[-1].snapshot_date + timedelta(days=day_offset),
                    estimated_value=projected_value.quantize(Decimal("0.01")),
                )
            )

        final_value = predicted_points[-1].estimated_value if predicted_points else None
        change_amount = final_value - last_value if final_value is not None else None
        change_pct = ((change_amount / last_value) * Decimal("100")) if change_amount is not None and last_value > 0 else None
        return PortfolioPredictionSummary(
            available=True,
            method="median_daily_return",
            confidence=confidence,
            reason="Projection is based on median normalized daily snapshot returns with conservative daily caps.",
            points=predicted_points,
            estimated_change_amount=change_amount.quantize(Decimal("0.01")) if change_amount is not None else None,
            estimated_change_pct=change_pct.quantize(Decimal("0.01")) if change_pct is not None else None,
        )

    regression_points = _build_linear_projection(daily_snapshots, horizon_days)
    if not regression_points:
        return PortfolioPredictionSummary(
            available=False,
            method="insufficient_data",
            confidence=None,
            reason="At least 3 snapshots are needed to estimate growth.",
            points=[],
            estimated_change_amount=None,
            estimated_change_pct=None,
        )

    final_value = regression_points[-1].estimated_value
    change_amount = final_value - last_value
    change_pct = (change_amount / last_value) * Decimal("100") if last_value > 0 else None
    return PortfolioPredictionSummary(
        available=True,
        method="linear_regression",
        confidence=confidence,
        reason="Projection is based on a conservative regression over snapshot values.",
        points=regression_points,
        estimated_change_amount=change_amount.quantize(Decimal("0.01")),
        estimated_change_pct=change_pct.quantize(Decimal("0.01")) if change_pct is not None else None,
    )


def get_portfolio_performance(db: Session, time_range: PerformanceRange) -> PortfolioPerformanceResponse:
    try:
        end_date = _today()
        default_start = _range_start(time_range, end_date) or end_date
        if not inspect(db.get_bind()).has_table(PortfolioSnapshot.__tablename__):
            return PortfolioPerformanceResponse(
                range=time_range,
                start_date=default_start,
                end_date=end_date,
                snapshots=[],
                prediction=PortfolioPredictionSummary(
                    available=False,
                    method="insufficient_data",
                    confidence=None,
                    reason="No portfolio snapshots yet. Save your first snapshot to start tracking performance.",
                    points=[],
                    estimated_change_amount=None,
                    estimated_change_pct=None,
                ),
                summary=PortfolioPerformanceSummary(snapshot_count=0),
            )

        all_snapshots = _latest_snapshot_by_day(_list_all_snapshots(db))
        if not all_snapshots:
            return PortfolioPerformanceResponse(
                range=time_range,
                start_date=default_start,
                end_date=end_date,
                snapshots=[],
                prediction=PortfolioPredictionSummary(
                    available=False,
                    method="insufficient_data",
                    confidence=None,
                    reason="No portfolio snapshots yet. Save your first snapshot to start tracking performance.",
                    points=[],
                    estimated_change_amount=None,
                    estimated_change_pct=None,
                ),
                summary=PortfolioPerformanceSummary(snapshot_count=0),
            )

        start_date = _range_start(time_range, end_date)
        if time_range == "ALL":
            effective_start = all_snapshots[0].snapshot_date
        else:
            effective_start = start_date or end_date

        ranged_snapshots = [snapshot for snapshot in all_snapshots if snapshot.snapshot_date >= effective_start and snapshot.snapshot_date <= end_date]
        snapshots = [_serialize_snapshot(snapshot) for snapshot in ranged_snapshots]

        if not ranged_snapshots:
            prediction = PortfolioPredictionSummary(
                available=False,
                method="insufficient_data",
                confidence=None,
                reason="No snapshots available in this range.",
                points=[],
                estimated_change_amount=None,
                estimated_change_pct=None,
            )
        else:
            prediction = _build_prediction(ranged_snapshots, time_range)

        first_value = ranged_snapshots[0].current_value if ranged_snapshots else None
        latest_value = ranged_snapshots[-1].current_value if ranged_snapshots else None
        change_amount = (latest_value - first_value) if first_value is not None and latest_value is not None else None
        change_pct = ((change_amount / first_value) * Decimal("100")) if change_amount is not None and first_value and first_value > 0 else None
        projected_value = prediction.points[-1].estimated_value if prediction.available and prediction.points else None
        projected_change_pct = ((projected_value - latest_value) / latest_value) * Decimal("100") if projected_value is not None and latest_value and latest_value > 0 else None

        return PortfolioPerformanceResponse(
            range=time_range,
            start_date=effective_start,
            end_date=end_date,
            snapshots=snapshots,
            prediction=prediction,
            summary=PortfolioPerformanceSummary(
                first_value=first_value,
                latest_value=latest_value,
                change_amount=change_amount.quantize(Decimal("0.01")) if change_amount is not None else None,
                change_pct=change_pct.quantize(Decimal("0.01")) if change_pct is not None else None,
                snapshot_count=len(ranged_snapshots),
                projected_value=projected_value,
                projected_change_pct=projected_change_pct.quantize(Decimal("0.01")) if projected_change_pct is not None else None,
            ),
        )
    except SQLAlchemyError:
        logger.exception("Failed to build portfolio performance")
        raise
    except Exception:
        logger.exception("Unexpected error while building portfolio performance")
        raise
