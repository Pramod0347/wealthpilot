from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaxDeduction(Base):
    __tablename__ = "tax_deductions"
    __table_args__ = (
        Index("ix_tax_deductions_tax_year_id", "tax_year_id"),
        Index("ix_tax_deductions_section", "section"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tax_year_id: Mapped[int] = mapped_column(ForeignKey("tax_years.id", ondelete="CASCADE"), nullable=False)
    section: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    eligible_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    proof_status: Mapped[str] = mapped_column(String(16), nullable=False, default="missing", server_default="missing")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tax_year: Mapped["TaxYear"] = relationship("TaxYear", back_populates="deductions")
