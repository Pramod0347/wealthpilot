from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class FinancialGoal(Base):
    __tablename__ = "financial_goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    goal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    target_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    linked_source_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    linked_source_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    linked_source_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    linked_source_map: Mapped[dict[str, list[int]] | None] = mapped_column(JSON, nullable=True)
    priority: Mapped[str | None] = mapped_column(String(16), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active", server_default="active")
    achieved_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    achieved_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    achievement_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    payment_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_big_purchase: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    purchase_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
