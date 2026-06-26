from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaxYear(Base):
    __tablename__ = "tax_years"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    financial_year: Mapped[str] = mapped_column(String(16), nullable=False, unique=True)
    assessment_year: Mapped[str | None] = mapped_column(String(16), nullable=True)
    regime: Mapped[str] = mapped_column(String(16), nullable=False, default="new", server_default="new")
    filing_status: Mapped[str] = mapped_column(String(16), nullable=False, default="planning", server_default="planning")
    filing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    income_items: Mapped[list["TaxIncomeItem"]] = relationship(
        "TaxIncomeItem",
        back_populates="tax_year",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    deductions: Mapped[list["TaxDeduction"]] = relationship(
        "TaxDeduction",
        back_populates="tax_year",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    documents: Mapped[list["TaxDocument"]] = relationship(
        "TaxDocument",
        back_populates="tax_year",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    payments: Mapped[list["TaxPayment"]] = relationship(
        "TaxPayment",
        back_populates="tax_year",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
