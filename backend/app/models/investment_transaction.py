from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    investment_id: Mapped[int] = mapped_column(
        ForeignKey("holdings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(4), nullable=False)
    transaction_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="One Time")
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False)
    fees: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    taxes: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 4), nullable=False, default=1)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    investment = relationship("Holding", back_populates="investment_transactions")
