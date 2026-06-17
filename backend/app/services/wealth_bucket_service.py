from decimal import Decimal

from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.schemas.dashboard import AssetAllocationItem, WealthBucketItem
from app.services.holdings_service import serialize_holding

EPF_ACCOUNT_TYPES = {"epf", "ppf", "vpf"}


def _safe_pct(amount: Decimal, total: Decimal) -> Decimal:
    if total == 0:
        return Decimal("0")
    return (amount / total) * Decimal("100")


def _is_gold_holding(holding: Holding) -> bool:
    text_blob = " ".join(
        filter(
            None,
            [
                holding.symbol,
                holding.company_name,
                holding.sector,
                holding.notes,
                holding.exchange_symbol,
            ],
        )
    ).lower()
    return holding.asset_type == "gold" or (holding.asset_type in {"etf", "other", "gold"} and "gold" in text_blob)


def _holding_bucket_key(holding: Holding) -> str | None:
    if holding.country == "US":
        return "us_stocks"
    if holding.asset_type == "mutual_fund":
        return "mutual_funds"
    if holding.country == "IN" and (holding.asset_type in {"stock", "etf", "gold"} or _is_gold_holding(holding)):
        return "ind_stocks"
    return None


def _bucket_label(key: str) -> str:
    return {
        "ind_stocks": "IND Stocks",
        "mutual_funds": "Mutual Funds",
        "epf": "EPF",
        "us_stocks": "US Stocks",
        "banks": "Banks",
        "liabilities": "Liabilities",
    }[key]


def _holding_meta(holding: Holding) -> str:
    if holding.country == "US":
        return f"{holding.asset_type.replace('_', ' ').title()} · US"
    if holding.asset_type == "mutual_fund":
        return holding.sector or "Mutual Fund"
    if _is_gold_holding(holding):
        return "Gold"
    return holding.asset_type.replace("_", " ").title()


def build_wealth_buckets(
    holdings: list[Holding],
    bank_accounts: list[BankAccount],
    fixed_savings_accounts: list[FixedSavingsAccount],
    credit_cards: list[CreditCard],
    total_assets: Decimal,
) -> tuple[list[AssetAllocationItem], AssetAllocationItem | None]:
    bucket_items: dict[str, list[WealthBucketItem]] = {
        "ind_stocks": [],
        "mutual_funds": [],
        "epf": [],
        "us_stocks": [],
        "banks": [],
    }
    bucket_values: dict[str, Decimal] = {key: Decimal("0") for key in bucket_items}

    serialized_holdings = [serialize_holding(holding) for holding in holdings]
    for holding, serialized in zip(holdings, serialized_holdings, strict=False):
        key = _holding_bucket_key(holding)
        if key is None:
            continue

        item = WealthBucketItem(
            id=serialized.id,
            type="holding",
            name=serialized.company_name,
            symbol=serialized.symbol,
            value=serialized.current_value,
            pnl=serialized.pnl,
            return_pct=serialized.return_pct,
            meta=_holding_meta(holding),
            native_value=serialized.native_current_value if holding.country == "US" else None,
            native_currency=serialized.native_currency if holding.country == "US" else None,
            badge="Auto" if serialized.price_source == "yfinance" else "Manual",
        )
        bucket_items[key].append(item)
        bucket_values[key] += serialized.current_value

    for account in fixed_savings_accounts:
        if account.account_type.lower() not in EPF_ACCOUNT_TYPES:
            continue
        item = WealthBucketItem(
            id=account.id,
            type="fixed_savings",
            name=account.account_name,
            symbol=None,
            value=Decimal(account.current_value),
            pnl=None,
            return_pct=None,
            meta=account.provider_name or account.account_type.upper(),
            native_value=None,
            native_currency="INR",
            badge=account.account_type.upper(),
        )
        bucket_items["epf"].append(item)
        bucket_values["epf"] += Decimal(account.current_value)

    for account in bank_accounts:
        meta = account.account_name or account.account_type.title()
        if account.account_number_last4:
            meta = f"{meta} ••{account.account_number_last4}"
        item = WealthBucketItem(
            id=account.id,
            type="bank_account",
            name=account.bank_name,
            symbol=None,
            value=Decimal(account.balance),
            pnl=None,
            return_pct=None,
            meta=meta,
            native_value=None,
            native_currency=account.currency,
            badge=account.account_type.title(),
        )
        bucket_items["banks"].append(item)
        bucket_values["banks"] += Decimal(account.balance)

    asset_buckets: list[AssetAllocationItem] = []
    for key in ["ind_stocks", "mutual_funds", "epf", "us_stocks", "banks"]:
        amount = bucket_values[key]
        if amount <= 0:
            continue
        items = sorted(bucket_items[key], key=lambda item: item.value, reverse=True)
        asset_buckets.append(
            AssetAllocationItem(
                asset_type=key,
                label=_bucket_label(key),
                amount=amount,
                percentage=_safe_pct(amount, total_assets),
                items=items,
            )
        )

    liability_amount = sum((Decimal(card.current_bill_amount) for card in credit_cards), Decimal("0"))
    liability_bucket: AssetAllocationItem | None = None
    if liability_amount > 0:
        liability_items = [
            WealthBucketItem(
                id=card.id,
                type="credit_card",
                name=card.card_name,
                symbol=None,
                value=Decimal(card.current_bill_amount),
                pnl=None,
                return_pct=None,
                meta=f"{card.bank_name} ••{card.last4}",
                native_value=None,
                native_currency="INR",
                badge=card.status.replace("_", " ").title(),
            )
            for card in sorted(credit_cards, key=lambda item: Decimal(item.current_bill_amount), reverse=True)
            if Decimal(card.current_bill_amount) > 0
        ]
        liability_bucket = AssetAllocationItem(
            asset_type="liabilities",
            label=_bucket_label("liabilities"),
            amount=liability_amount,
            percentage=_safe_pct(liability_amount, total_assets),
            items=liability_items,
        )

    return asset_buckets, liability_bucket
