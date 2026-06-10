from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    total_invested: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    current_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    pnl: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    net_worth: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
