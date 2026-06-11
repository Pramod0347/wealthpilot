from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    card_name: Mapped[str] = mapped_column(String(128), nullable=False)
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last4: Mapped[str] = mapped_column(String(4), nullable=False)
    total_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    billing_cycle_start: Mapped[date] = mapped_column(Date, nullable=False)
    billing_cycle_end: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_bill_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    used_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="due_soon", server_default="due_soon")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
