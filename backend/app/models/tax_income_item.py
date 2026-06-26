from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaxIncomeItem(Base):
    __tablename__ = "tax_income_items"
    __table_args__ = (
        Index("ix_tax_income_items_tax_year_id", "tax_year_id"),
        Index("ix_tax_income_items_income_type", "income_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tax_year_id: Mapped[int] = mapped_column(ForeignKey("tax_years.id", ondelete="CASCADE"), nullable=False)
    income_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source: Mapped[str | None] = mapped_column(String(160), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    gross_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    exempt_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    taxable_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    tds_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    received_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tax_year: Mapped["TaxYear"] = relationship("TaxYear", back_populates="income_items")
