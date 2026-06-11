from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    company_name: Mapped[str] = mapped_column(String(128), nullable=False)
    asset_type: Mapped[str] = mapped_column(String(32), nullable=False, default="stock", server_default="stock")
    country: Mapped[str] = mapped_column(String(4), nullable=False, default="IN", server_default="IN")
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR", server_default="INR")
    exchange: Mapped[str | None] = mapped_column(String(32), nullable=True)
    exchange_symbol: Mapped[str | None] = mapped_column(String(32), nullable=True)
    fx_rate_to_inr: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1, server_default="1")
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=0)
    avg_buy_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    current_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    price_source: Mapped[str] = mapped_column(String(16), nullable=False, default="manual")
    last_price_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    as_of_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
