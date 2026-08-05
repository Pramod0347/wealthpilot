from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TaxYear(Base):
    """A filed-return index. Detailed tax data lives in frontend FY configuration."""

    __tablename__ = "tax_years"
    __table_args__ = (UniqueConstraint("user_id", "financial_year", name="uq_tax_years_user_financial_year"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="owner", server_default="owner")
    financial_year: Mapped[str] = mapped_column(String(16), nullable=False)
    assessment_year: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="Draft", server_default="Draft")
    filed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
