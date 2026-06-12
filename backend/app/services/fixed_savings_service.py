from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.fixed_savings_account import FixedSavingsAccount
from app.schemas.fixed_savings_account import (
    FixedSavingsAccountRead,
    FixedSavingsByTypeSummary,
    FixedSavingsSummary,
)


def _to_decimal(value: Decimal | int | float | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def _compute_total_contribution(account: FixedSavingsAccount) -> Decimal:
    return (
        _to_decimal(account.employee_contribution)
        + _to_decimal(account.employer_contribution)
        + _to_decimal(account.self_contribution)
    )


def serialize_fixed_savings_account(account: FixedSavingsAccount) -> FixedSavingsAccountRead:
    total_contribution = _compute_total_contribution(account)
    current_value = _to_decimal(account.current_value)
    gain_or_interest = current_value - total_contribution
    return_pct = Decimal("0")
    if total_contribution != 0:
        return_pct = (gain_or_interest / total_contribution) * Decimal("100")

    return FixedSavingsAccountRead(
        id=account.id,
        account_type=account.account_type,
        account_name=account.account_name,
        provider_name=account.provider_name,
        account_number_last4=account.account_number_last4,
        employee_contribution=_to_decimal(account.employee_contribution),
        employer_contribution=_to_decimal(account.employer_contribution),
        self_contribution=_to_decimal(account.self_contribution),
        interest_earned=_to_decimal(account.interest_earned),
        current_value=current_value,
        interest_rate=_to_decimal(account.interest_rate) if account.interest_rate is not None else None,
        start_date=account.start_date,
        maturity_date=account.maturity_date,
        as_of_date=account.as_of_date,
        notes=account.notes,
        created_at=account.created_at,
        updated_at=account.updated_at,
        total_contribution=total_contribution,
        gain_or_interest=gain_or_interest,
        return_pct=return_pct,
    )


def build_fixed_savings_summary(db: Session) -> FixedSavingsSummary:
    total_value, accounts_count = db.execute(
        select(
            func.coalesce(func.sum(FixedSavingsAccount.current_value), 0),
            func.count(FixedSavingsAccount.id),
        )
    ).one()

    rows = db.execute(
        select(
            FixedSavingsAccount.account_type,
            func.coalesce(func.sum(FixedSavingsAccount.current_value), 0),
            func.coalesce(
                func.sum(
                    FixedSavingsAccount.employee_contribution
                    + FixedSavingsAccount.employer_contribution
                    + FixedSavingsAccount.self_contribution
                ),
                0,
            ),
            func.coalesce(func.sum(FixedSavingsAccount.interest_earned), 0),
            func.count(FixedSavingsAccount.id),
        )
        .group_by(FixedSavingsAccount.account_type)
        .order_by(func.sum(FixedSavingsAccount.current_value).desc(), FixedSavingsAccount.account_type.asc())
    ).all()

    by_type = [
        FixedSavingsByTypeSummary(
            account_type=row[0],
            current_value=_to_decimal(row[1]),
            total_contribution=_to_decimal(row[2]),
            interest_earned=_to_decimal(row[3]),
            count=int(row[4]),
        )
        for row in rows
    ]

    total_value_decimal = _to_decimal(total_value)
    total_contribution = sum((item.total_contribution for item in by_type), Decimal("0"))
    total_interest = sum((item.interest_earned for item in by_type), Decimal("0"))

    return FixedSavingsSummary(
        total_value=total_value_decimal,
        total_contribution=total_contribution,
        total_interest=total_interest,
        accounts_count=int(accounts_count),
        by_type=by_type,
    )
