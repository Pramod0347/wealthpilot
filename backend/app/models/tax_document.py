from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TaxDocument(Base):
    __tablename__ = "tax_documents"
    __table_args__ = (
        Index("ix_tax_documents_tax_year_id", "tax_year_id"),
        Index("ix_tax_documents_document_type", "document_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tax_year_id: Mapped[int] = mapped_column(ForeignKey("tax_years.id", ondelete="CASCADE"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="missing", server_default="missing")
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tax_year: Mapped["TaxYear"] = relationship("TaxYear", back_populates="documents")
