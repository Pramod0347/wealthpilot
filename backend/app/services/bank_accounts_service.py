from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.schemas.bank_account import BankAccountRead, BankAccountsSummary


def serialize_bank_account(account: BankAccount) -> BankAccountRead:
    return BankAccountRead.model_validate(account)


def build_bank_accounts_summary(db: Session) -> BankAccountsSummary:
    total_cash, accounts_count = db.execute(
        select(
            func.coalesce(func.sum(BankAccount.balance), 0),
            func.count(BankAccount.id),
        )
    ).one()

    return BankAccountsSummary(
        total_cash=Decimal(total_cash),
        accounts_count=int(accounts_count),
        currency="INR",
    )
