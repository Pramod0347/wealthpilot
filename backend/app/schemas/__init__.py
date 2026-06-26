from app.schemas.dashboard import AssetAllocationItem, DashboardSummary, WealthBucketItem
from app.schemas.analytics import (
    AnalyticsCategoryAverageItem,
    AnalyticsFocusItem,
    AnalyticsMetricWindow,
    AnalyticsMonthlyTrendItem,
    AnalyticsSummaryResponse,
    AnalyticsTopCategoryItem,
    CashflowAnalyticsSummary,
    InvestmentAnalyticsSummary,
    InvestmentBucketSummaryItem,
    InvestmentTopHoldingItem,
)
from app.schemas.bank_account import BankAccountCreate, BankAccountRead, BankAccountsSummary, BankAccountUpdate
from app.schemas.cashflow import (
    CashflowCategoryBreakdownItem,
    CashflowEntryCreate,
    CashflowEntryRead,
    CashflowEntryUpdate,
    CashflowSummary,
)
from app.schemas.credit_card import CreditCardCreate, CreditCardRead, CreditCardUpdate
from app.schemas.credit_card import CardStatus
from app.schemas.credit_card_bill import (
    BillStatus,
    CreditCardBillCreate,
    CreditCardBillRead,
    CreditCardBillUpdate,
    MarkCreditCardPaidRequest,
    MarkCreditCardPaidResponse,
)
from app.schemas.fixed_savings_account import (
    FixedSavingsAccountCreate,
    FixedSavingsAccountRead,
    FixedSavingsAccountUpdate,
    FixedSavingsByTypeSummary,
    FixedSavingsSummary,
)
from app.schemas.financial_goal import (
    FinancialGoalCreate,
    FinancialGoalRead,
    FinancialGoalSummary,
    FinancialGoalUpdate,
)
from app.schemas.holding import HoldingCreate, HoldingRead, HoldingUpdate
from app.schemas.holding import AllocationItem, HoldingAnalyticsItem, HoldingsAnalyticsResponse
from app.schemas.portfolio_snapshot import (
    PerformanceRange,
    PortfolioPerformanceResponse,
    PortfolioPerformanceSummary,
    PortfolioPredictionPoint,
    PortfolioPredictionSummary,
    PortfolioSnapshotPerformancePoint,
    PortfolioSnapshotRead,
)
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
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate
