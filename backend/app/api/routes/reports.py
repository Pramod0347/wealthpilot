from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.reports import (
    CreditCardBillPaymentsReportResponse,
    InvestmentHoldingsReportResponse,
    MonthlyCashflowReportResponse,
    NetWorthSnapshotReportResponse,
)
from app.services.reports_service import (
    build_credit_card_bill_payments_report,
    build_investment_holdings_report,
    build_monthly_cashflow_report,
    build_networth_snapshots_report,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/monthly-cashflow", response_model=MonthlyCashflowReportResponse)
def monthly_cashflow_report(
    from_month: str | None = Query(default=None),
    to_month: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> MonthlyCashflowReportResponse:
    return build_monthly_cashflow_report(db, from_month=from_month, to_month=to_month)


@router.get("/credit-card-bills", response_model=CreditCardBillPaymentsReportResponse)
def credit_card_bills_report(
    card_id: int | None = Query(default=None),
    status_value: str | None = Query(default=None, alias="status"),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> CreditCardBillPaymentsReportResponse:
    return build_credit_card_bill_payments_report(
        db,
        card_id=card_id,
        status_value=status_value,
        from_date=from_date,
        to_date=to_date,
    )


@router.get("/networth-snapshots", response_model=NetWorthSnapshotReportResponse)
def networth_snapshots_report(db: Session = Depends(get_db)) -> NetWorthSnapshotReportResponse:
    return build_networth_snapshots_report(db)


@router.get("/investment-holdings", response_model=InvestmentHoldingsReportResponse)
def investment_holdings_report(db: Session = Depends(get_db)) -> InvestmentHoldingsReportResponse:
    return build_investment_holdings_report(db)
