from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    bank_name: Mapped[str] = mapped_column(String(128), nullable=False)
    account_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    account_type: Mapped[str] = mapped_column(String(32), nullable=False, default="savings", server_default="savings")
    account_number_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR", server_default="INR")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    as_of_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
