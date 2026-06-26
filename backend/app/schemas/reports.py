from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.credit_card_bill import BillStatus


class MonthlyCashflowReportRow(BaseModel):
    month: str
    total_income: Decimal = Decimal("0")
    total_expense: Decimal = Decimal("0")
    net_savings: Decimal = Decimal("0")
    savings_rate: Decimal | None = None
    top_expense_category: str | None = None
    top_income_source: str | None = None


class MonthlyCashflowReportResponse(BaseModel):
    rows: list[MonthlyCashflowReportRow] = Field(default_factory=list)


class CreditCardBillPaymentsReportRow(BaseModel):
    bill_id: int
    credit_card_id: int
    card_name: str
    billing_cycle_start: date | None = None
    billing_cycle_end: date | None = None
    bill_generated_date: date | None = None
    due_date: date | None = None
    bill_amount: Decimal = Decimal("0")
    paid_amount: Decimal | None = None
    paid_date: date | None = None
    status: BillStatus
    notes: str | None = None


class CreditCardBillPaymentsReportResponse(BaseModel):
    rows: list[CreditCardBillPaymentsReportRow] = Field(default_factory=list)


class NetWorthSnapshotReportRow(BaseModel):
    date: date
    portfolio_value: Decimal = Decimal("0")
    change_amount: Decimal | None = None
    change_pct: Decimal | None = None
    created_at: datetime
    updated_at: datetime


class NetWorthSnapshotReportResponse(BaseModel):
    rows: list[NetWorthSnapshotReportRow] = Field(default_factory=list)


class InvestmentHoldingsReportRow(BaseModel):
    holding_id: int
    symbol: str
    company_name: str
    asset_type: str
    country: str
    invested_value: Decimal = Decimal("0")
    current_value: Decimal = Decimal("0")
    pnl: Decimal = Decimal("0")
    return_pct: Decimal = Decimal("0")
    quantity: Decimal = Decimal("0")
    avg_buy_price: Decimal = Decimal("0")
    current_price: Decimal = Decimal("0")
    last_updated: datetime


class InvestmentHoldingsReportResponse(BaseModel):
    rows: list[InvestmentHoldingsReportRow] = Field(default_factory=list)
