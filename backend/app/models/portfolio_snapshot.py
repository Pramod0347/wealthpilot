from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    __table_args__ = (UniqueConstraint("snapshot_date", name="uq_portfolio_snapshots_snapshot_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_invested: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    current_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    total_return_pct: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual", server_default="manual")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
