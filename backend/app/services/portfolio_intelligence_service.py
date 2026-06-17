from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.bank_account import BankAccount
from app.models.credit_card import CreditCard
from app.models.fixed_savings_account import FixedSavingsAccount
from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.schemas.portfolio_intelligence import (
    PortfolioAllocationItem,
    PortfolioAttentionItem,
    PortfolioCashflowContext,
    PortfolioHoldingMover,
    PortfolioIntelligenceResponse,
    PortfolioLiquidityView,
    PortfolioNetWorthOverview,
    PortfolioPerformanceOverview,
    PortfolioTopMovers,
)
from app.services.cashflow_service import build_cashflow_summary, current_month_string
from app.services.holdings_service import serialize_holding
from app.services.wealth_bucket_service import build_wealth_buckets


def _to_decimal(value: object | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(value)


def _safe_pct(amount: Decimal, total: Decimal) -> Decimal:
    if total == 0:
        return Decimal("0")
    return (amount / total) * Decimal("100")


def _allocation_item(key: str, label: str, amount: Decimal, total: Decimal, kind: str = "asset") -> PortfolioAllocationItem:
    return PortfolioAllocationItem(
        key=key,
        label=label,
        amount=amount,
        percentage=_safe_pct(amount, total),
        kind=kind,
    )


def build_portfolio_intelligence(db: Session) -> PortfolioIntelligenceResponse:
    holdings = db.scalars(select(Holding).order_by(Holding.created_at.desc())).all()
    serialized_holdings = [serialize_holding(holding) for holding in holdings]

    total_bank_cash = _to_decimal(db.scalar(select(func.coalesce(func.sum(BankAccount.balance), 0))))
    total_fixed_savings_value = _to_decimal(db.scalar(select(func.coalesce(func.sum(FixedSavingsAccount.current_value), 0))))
    total_credit_card_dues = _to_decimal(db.scalar(select(func.coalesce(func.sum(CreditCard.current_bill_amount), 0))))

    indian_stocks = Decimal("0")
    us_stocks = Decimal("0")
    etfs = Decimal("0")
    gold = Decimal("0")
    mutual_funds = Decimal("0")
    holding_cash = Decimal("0")
    other_assets = Decimal("0")

    holding_movers: list[PortfolioHoldingMover] = []

    for holding, serialized in zip(holdings, serialized_holdings, strict=False):
        text_blob = " ".join(filter(None, [holding.symbol, holding.company_name, holding.sector, holding.notes, holding.exchange_symbol])).lower()
        is_gold = holding.asset_type == "gold" or "gold" in text_blob and holding.asset_type in {"etf", "other", "gold"}

        if holding.country == "US" and holding.asset_type == "stock":
            us_stocks += serialized.current_value
        elif holding.asset_type == "stock":
            indian_stocks += serialized.current_value
        elif holding.asset_type == "mutual_fund":
            mutual_funds += serialized.current_value
        elif is_gold:
            gold += serialized.current_value
        elif holding.asset_type == "etf":
            etfs += serialized.current_value
        elif holding.asset_type == "cash":
            holding_cash += serialized.current_value
        else:
            other_assets += serialized.current_value

        holding_movers.append(
            PortfolioHoldingMover(
                id=serialized.id,
                symbol=serialized.symbol,
                company_name=serialized.company_name,
                asset_type=serialized.asset_type,
                country=serialized.country,
                current_value=serialized.current_value,
                pnl=serialized.pnl,
                return_pct=serialized.return_pct,
            )
        )

    holdings_total_value = sum((item.current_value for item in serialized_holdings), Decimal("0"))
    total_assets = holdings_total_value + total_bank_cash + total_fixed_savings_value
    total_liabilities = total_credit_card_dues
    net_worth = total_assets - total_liabilities
    liquid_assets = total_bank_cash
    long_term_assets = indian_stocks + us_stocks + etfs + gold + mutual_funds + total_fixed_savings_value
    credit_exposure = total_credit_card_dues

    net_worth_overview = PortfolioNetWorthOverview(
        total_assets=total_assets,
        total_liabilities=total_liabilities,
        net_worth=net_worth,
        liquid_assets=liquid_assets,
        long_term_assets=long_term_assets,
        credit_exposure=credit_exposure,
    )

    bank_accounts = db.scalars(select(BankAccount).order_by(BankAccount.updated_at.desc())).all()
    fixed_savings_accounts = db.scalars(select(FixedSavingsAccount).order_by(FixedSavingsAccount.updated_at.desc())).all()
    credit_cards = db.scalars(select(CreditCard).order_by(CreditCard.updated_at.desc())).all()
    dashboard_buckets, liability_bucket = build_wealth_buckets(
        holdings=holdings,
        bank_accounts=bank_accounts,
        fixed_savings_accounts=fixed_savings_accounts,
        credit_cards=credit_cards,
        total_assets=total_assets,
    )
    asset_allocation_items: list[PortfolioAllocationItem] = [
        PortfolioAllocationItem(
            key=item.asset_type,
            label=item.label,
            amount=item.amount,
            percentage=item.percentage,
            kind="asset",
            items=item.items,
        )
        for item in dashboard_buckets
    ]

    risk_total = total_assets + total_liabilities
    risk_allocation = [
        _allocation_item("equity", "Equity", indian_stocks + us_stocks + etfs, risk_total),
        _allocation_item("funds", "Funds", mutual_funds, risk_total),
        _allocation_item("gold", "Gold", gold, risk_total),
        _allocation_item("cash", "Cash", total_bank_cash + holding_cash, risk_total),
        _allocation_item("fixed_retirement", "Fixed / Retirement", total_fixed_savings_value, risk_total),
        PortfolioAllocationItem(
            key="liabilities",
            label="Liabilities",
            amount=total_credit_card_dues,
            percentage=_safe_pct(total_credit_card_dues, risk_total),
            kind="liability",
            items=liability_bucket.items if liability_bucket else [],
        ),
    ]
    risk_allocation = [item for item in risk_allocation if item.amount > 0]

    liquidity = PortfolioLiquidityView(
        immediate_cash=total_bank_cash,
        market_linked=indian_stocks + us_stocks + etfs + gold + mutual_funds,
        locked_long_term=total_fixed_savings_value,
        liabilities=total_credit_card_dues,
    )

    latest_snapshot = db.scalar(select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date.desc()))
    performance = PortfolioPerformanceOverview(
        has_snapshots=latest_snapshot is not None,
        latest_snapshot_date=latest_snapshot.snapshot_date if latest_snapshot else None,
        latest_snapshot_value=_to_decimal(latest_snapshot.current_value) if latest_snapshot else Decimal("0"),
        latest_snapshot_return_pct=_to_decimal(latest_snapshot.total_return_pct) if latest_snapshot else Decimal("0"),
        message=None if latest_snapshot else "No portfolio snapshots yet",
    )

    biggest_gainers = sorted(holding_movers, key=lambda item: item.pnl, reverse=True)[:3]
    biggest_losers = sorted(holding_movers, key=lambda item: item.pnl)[:3]
    largest_allocation = max(asset_allocation_items, key=lambda item: item.amount, default=None)

    cashflow_summary = build_cashflow_summary(db, current_month_string())
    cashflow_has_data = (cashflow_summary.income_count + cashflow_summary.expense_count) > 0
    cashflow_context = PortfolioCashflowContext(
        month=cashflow_summary.month,
        income=cashflow_summary.total_income,
        spend=cashflow_summary.total_expense,
        savings=cashflow_summary.net_savings,
        savings_rate=cashflow_summary.savings_rate,
        has_data=cashflow_has_data,
    )

    attention: list[PortfolioAttentionItem] = []
    if total_credit_card_dues > 0:
        due_pct = _safe_pct(total_credit_card_dues, total_assets)
        tone = "rose" if due_pct >= Decimal("10") else "amber"
        attention.append(
            PortfolioAttentionItem(
                label="Credit card dues",
                detail=f"Card dues are {due_pct.quantize(Decimal('0.01'))}% of total assets.",
                tone=tone,
            )
        )
    if cashflow_has_data and total_bank_cash < cashflow_summary.total_expense:
        attention.append(
            PortfolioAttentionItem(
                label="Low cash buffer",
                detail="Current bank cash is below this month's recorded spending.",
                tone="amber",
            )
        )
    if largest_allocation is not None and largest_allocation.percentage >= Decimal("35"):
        attention.append(
            PortfolioAttentionItem(
                label="Concentration risk",
                detail=f"{largest_allocation.label} is {largest_allocation.percentage.quantize(Decimal('0.1'))}% of assets.",
                tone="amber",
            )
        )
    if not attention:
        attention.append(PortfolioAttentionItem(label="All clear", detail="No immediate portfolio risks detected.", tone="emerald"))

    insights: list[str] = []
    if total_assets > 0:
        insights.append(f"Bank cash is {_safe_pct(total_bank_cash, total_assets).quantize(Decimal('0.1'))}% of your assets.")
        insights.append(f"PF / EPF is {_safe_pct(total_fixed_savings_value, total_assets).quantize(Decimal('0.1'))}% of your assets.")
        insights.append(f"Credit card dues are {_safe_pct(total_credit_card_dues, total_assets).quantize(Decimal('0.1'))}% of total assets.")
        insights.append(f"US exposure is {_safe_pct(us_stocks, total_assets).quantize(Decimal('0.1'))}% of the portfolio.")
    if largest_allocation is not None:
        insights.append(
            f"Your largest allocation is {largest_allocation.label} at {largest_allocation.percentage.quantize(Decimal('0.1'))}%."
        )
    if cashflow_has_data:
        insights.append(
            f"This month's savings rate is {cashflow_summary.savings_rate.quantize(Decimal('0.1'))}% based on monthly cashflow summary."
        )

    top_movers = PortfolioTopMovers(
        biggest_gainers=biggest_gainers,
        biggest_losers=biggest_losers,
        largest_allocation=largest_allocation,
        attention=attention,
    )

    return PortfolioIntelligenceResponse(
        net_worth=net_worth_overview,
        asset_allocation=asset_allocation_items,
        risk_allocation=risk_allocation,
        liquidity=liquidity,
        performance=performance,
        top_movers=top_movers,
        insights=insights,
        cashflow_context=cashflow_context,
    )
