from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CreditCardBill(Base):
    __tablename__ = "credit_card_bills"
    __table_args__ = (
        Index("ix_credit_card_bills_credit_card_id", "credit_card_id"),
        Index("ix_credit_card_bills_due_date", "due_date"),
        Index("ix_credit_card_bills_paid_date", "paid_date"),
        Index("ix_credit_card_bills_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    credit_card_id: Mapped[int] = mapped_column(ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False)
    billing_cycle_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    billing_cycle_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    bill_generated_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bill_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    paid_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    credit_card: Mapped["CreditCard"] = relationship("CreditCard", back_populates="bills")
