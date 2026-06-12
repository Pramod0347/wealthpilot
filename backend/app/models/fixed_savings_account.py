from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FixedSavingsAccount(Base):
    __tablename__ = "fixed_savings_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_type: Mapped[str] = mapped_column(String(32), nullable=False)
    account_name: Mapped[str] = mapped_column(String(128), nullable=False)
    provider_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    account_number_last4: Mapped[str | None] = mapped_column(String(4), nullable=True)
    employee_contribution: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=0, server_default="0"
    )
    employer_contribution: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=0, server_default="0"
    )
    self_contribution: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=0, server_default="0"
    )
    interest_earned: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), nullable=False, default=0, server_default="0"
    )
    current_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    interest_rate: Mapped[Decimal | None] = mapped_column(Numeric(8, 4), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    as_of_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
