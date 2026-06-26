from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.cashflow_entry import CashflowEntry
from app.models.credit_card import CreditCard
from app.models.credit_card_bill import CreditCardBill
from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.schemas.reports import (
    CreditCardBillPaymentsReportResponse,
    CreditCardBillPaymentsReportRow,
    InvestmentHoldingsReportResponse,
    InvestmentHoldingsReportRow,
    MonthlyCashflowReportResponse,
    MonthlyCashflowReportRow,
    NetWorthSnapshotReportResponse,
    NetWorthSnapshotReportRow,
)
from app.services.holdings_service import serialize_holding


def _to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def build_monthly_cashflow_report(
    db: Session,
    *,
    from_month: str | None = None,
    to_month: str | None = None,
) -> MonthlyCashflowReportResponse:
    query = (
        select(
            CashflowEntry.month,
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "income", CashflowEntry.amount), else_=0)), 0),
            func.coalesce(func.sum(case((CashflowEntry.entry_type == "expense", CashflowEntry.amount), else_=0)), 0),
        )
        .group_by(CashflowEntry.month)
        .order_by(CashflowEntry.month.desc())
    )
    if from_month:
        query = query.where(CashflowEntry.month >= from_month)
    if to_month:
        query = query.where(CashflowEntry.month <= to_month)

    summary_rows = db.execute(query).all()
    rows: list[MonthlyCashflowReportRow] = []

    for month, income_raw, expense_raw in summary_rows:
        total_income = _to_decimal(income_raw)
        total_expense = _to_decimal(expense_raw)
        net_savings = total_income - total_expense
        savings_rate = ((net_savings / total_income) * Decimal("100")) if total_income != 0 else None
        income_source_expr = func.coalesce(func.nullif(CashflowEntry.source, ""), CashflowEntry.category).label("income_source")

        top_expense_category = db.execute(
            select(CashflowEntry.category)
            .where(CashflowEntry.month == month, CashflowEntry.entry_type == "expense")
            .group_by(CashflowEntry.category)
            .order_by(func.sum(CashflowEntry.amount).desc(), CashflowEntry.category.asc())
            .limit(1)
        ).scalar_one_or_none()

        top_income_source = db.execute(
            select(income_source_expr)
            .where(CashflowEntry.month == month, CashflowEntry.entry_type == "income")
            .group_by(income_source_expr)
            .order_by(func.sum(CashflowEntry.amount).desc(), income_source_expr.asc())
            .limit(1)
        ).scalar_one_or_none()

        rows.append(
            MonthlyCashflowReportRow(
                month=month,
                total_income=total_income,
                total_expense=total_expense,
                net_savings=net_savings,
                savings_rate=savings_rate.quantize(Decimal("0.01")) if savings_rate is not None else None,
                top_expense_category=top_expense_category,
                top_income_source=top_income_source,
            )
        )

    return MonthlyCashflowReportResponse(rows=rows)


def build_credit_card_bill_payments_report(
    db: Session,
    *,
    card_id: int | None = None,
    status_value: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
) -> CreditCardBillPaymentsReportResponse:
    query = (
        select(CreditCardBill, CreditCard.card_name)
        .join(CreditCard, CreditCard.id == CreditCardBill.credit_card_id)
        .order_by(CreditCardBill.paid_date.desc().nullslast(), CreditCardBill.created_at.desc())
    )
    if card_id is not None:
        query = query.where(CreditCardBill.credit_card_id == card_id)
    if status_value:
        query = query.where(CreditCardBill.status == status_value)
    if from_date is not None:
        query = query.where(CreditCardBill.due_date >= from_date)
    if to_date is not None:
        query = query.where(CreditCardBill.due_date <= to_date)

    rows = [
        CreditCardBillPaymentsReportRow(
            bill_id=bill.id,
            credit_card_id=bill.credit_card_id,
            card_name=card_name,
            billing_cycle_start=bill.billing_cycle_start,
            billing_cycle_end=bill.billing_cycle_end,
            bill_generated_date=bill.bill_generated_date,
            due_date=bill.due_date,
            bill_amount=bill.bill_amount,
            paid_amount=bill.paid_amount,
            paid_date=bill.paid_date,
            status=bill.status,
            notes=bill.notes,
        )
        for bill, card_name in db.execute(query).all()
    ]
    return CreditCardBillPaymentsReportResponse(rows=rows)


def build_networth_snapshots_report(db: Session) -> NetWorthSnapshotReportResponse:
    snapshots = db.scalars(
        select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date.desc(), PortfolioSnapshot.updated_at.desc())
    ).all()

    chronological = list(reversed(snapshots))
    previous_value: Decimal | None = None
    computed: list[NetWorthSnapshotReportRow] = []
    for snapshot in chronological:
        portfolio_value = snapshot.current_value
        change_amount = portfolio_value - previous_value if previous_value is not None else None
        change_pct = ((change_amount / previous_value) * Decimal("100")) if change_amount is not None and previous_value not in (None, Decimal("0")) else None
        computed.append(
            NetWorthSnapshotReportRow(
                date=snapshot.snapshot_date,
                portfolio_value=portfolio_value,
                change_amount=change_amount.quantize(Decimal("0.01")) if change_amount is not None else None,
                change_pct=change_pct.quantize(Decimal("0.01")) if change_pct is not None else None,
                created_at=snapshot.created_at,
                updated_at=snapshot.updated_at,
            )
        )
        previous_value = portfolio_value

    return NetWorthSnapshotReportResponse(rows=list(reversed(computed)))


def build_investment_holdings_report(db: Session) -> InvestmentHoldingsReportResponse:
    holdings = db.scalars(select(Holding).order_by(Holding.updated_at.desc(), Holding.created_at.desc())).all()
    rows = []
    for holding in holdings:
        serialized = serialize_holding(holding)
        rows.append(
            InvestmentHoldingsReportRow(
                holding_id=serialized.id,
                symbol=serialized.symbol,
                company_name=serialized.company_name,
                asset_type=serialized.asset_type,
                country=serialized.country,
                invested_value=serialized.invested_amount,
                current_value=serialized.current_value,
                pnl=serialized.pnl,
                return_pct=serialized.return_pct,
                quantity=serialized.quantity,
                avg_buy_price=serialized.avg_buy_price,
                current_price=serialized.current_price,
                last_updated=serialized.last_price_refreshed_at or serialized.updated_at,
            )
        )
    return InvestmentHoldingsReportResponse(rows=rows)
