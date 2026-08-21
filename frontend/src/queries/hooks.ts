import { useQuery } from '@tanstack/react-query'
import {
  checkAuth,
  getAnalyticsSummary,
  getBankAccounts,
  getBankAccountsSummary,
  getCashflowEntries,
  getCashflowMonths,
  getCashflowSummary,
  getGoalEMIPayments,
  getCreditCardBillHistory,
  getCreditCardBills,
  getCreditCards,
  getDashboardSummary,
  getDeposits,
  getDepositsSummary,
  getFinancialGoals,
  getFinancialGoalsSummary,
  getFixedSavingsAccounts,
  getFixedSavingsSummary,
  getHoldings,
  getHoldingsAnalytics,
  getInvestmentHoldingsReport,
  getInvestmentTransactions,
  getMarketOverview,
  getMonthlyCashflowReport,
  getNetWorthSnapshotsReport,
  getPortfolioIntelligence,
  getPortfolioPerformance,
  getTaxYears,
  getCreditCardBillPaymentsReport,
} from '../lib/api'
import { queryKeys } from './queryKeys'
import type { CreditCardBill, PortfolioRange } from '../lib/api'

export function useAuthMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.authMe,
    queryFn: () => checkAuth(),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled,
  })
}

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: ({ signal }) => getDashboardSummary(signal),
    refetchOnMount: 'always',
  })
}

export function useMarketOverviewQuery() {
  return useQuery({
    queryKey: queryKeys.marketOverview,
    queryFn: ({ signal }) => getMarketOverview(signal),
    refetchInterval: 60 * 1000,
  })
}

export function useHoldingsQuery() {
  return useQuery({
    queryKey: queryKeys.holdings,
    queryFn: ({ signal }) => getHoldings(signal),
  })
}

export function useHoldingsAnalyticsQuery() {
  return useQuery({
    queryKey: queryKeys.holdingsAnalytics,
    queryFn: ({ signal }) => getHoldingsAnalytics(signal),
  })
}

export function useInvestmentTransactionsQuery(investmentId?: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.investmentTransactions(investmentId),
    queryFn: ({ signal }) => getInvestmentTransactions(investmentId, signal),
    enabled,
  })
}

export function usePortfolioPerformanceQuery(range: PortfolioRange) {
  return useQuery({
    queryKey: queryKeys.portfolioPerformance(range),
    queryFn: ({ signal }) => getPortfolioPerformance(range, signal),
  })
}

export function usePortfolioIntelligenceQuery() {
  return useQuery({
    queryKey: queryKeys.portfolioIntelligence,
    queryFn: ({ signal }) => getPortfolioIntelligence(signal),
  })
}

export function useBankAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.bankAccounts,
    queryFn: ({ signal }) => getBankAccounts(signal),
  })
}

export function useBankAccountsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.bankAccountsSummary,
    queryFn: ({ signal }) => getBankAccountsSummary(signal),
  })
}

export function useFixedSavingsAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.fixedSavings,
    queryFn: ({ signal }) => getFixedSavingsAccounts(signal),
  })
}

export function useFixedSavingsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.fixedSavingsSummary,
    queryFn: ({ signal }) => getFixedSavingsSummary(signal),
  })
}

export function useDepositsQuery() {
  return useQuery({
    queryKey: queryKeys.deposits,
    queryFn: ({ signal }) => getDeposits(signal),
  })
}

export function useDepositsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.depositsSummary,
    queryFn: ({ signal }) => getDepositsSummary(signal),
  })
}

export function useCreditCardsQuery() {
  return useQuery({
    queryKey: queryKeys.creditCards,
    queryFn: ({ signal }) => getCreditCards(signal),
  })
}

export function useCreditCardBillsQuery(filters?: { cardId?: number; status?: CreditCardBill['status']; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: queryKeys.creditCardBills(filters),
    queryFn: ({ signal }) => getCreditCardBills(filters, signal),
  })
}

export function useCreditCardBillHistoryQuery(cardId: number | null, enabled = true) {
  return useQuery({
    queryKey: cardId ? queryKeys.creditCardBillHistory(cardId) : ['creditCardBills', 'none'],
    queryFn: ({ signal }) => getCreditCardBillHistory(cardId as number, signal),
    enabled: enabled && cardId !== null,
  })
}

export function useCashflowMonthsQuery() {
  return useQuery({
    queryKey: queryKeys.cashflowMonths,
    queryFn: ({ signal }) => getCashflowMonths(signal),
  })
}

export function useCashflowEntriesQuery(month?: string) {
  return useQuery({
    queryKey: queryKeys.cashflowEntries(month),
    queryFn: ({ signal }) => getCashflowEntries(month, signal),
  })
}

export function useCashflowSummaryQuery(month?: string) {
  return useQuery({
    queryKey: queryKeys.cashflowSummary(month),
    queryFn: ({ signal }) => getCashflowSummary(month, signal),
  })
}

export function useAnalyticsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.analyticsSummary,
    queryFn: ({ signal }) => getAnalyticsSummary(signal),
  })
}

export function useFinancialGoalsQuery(activeOnly?: boolean) {
  return useQuery({
    queryKey: queryKeys.financialGoals(activeOnly),
    queryFn: ({ signal }) => getFinancialGoals(activeOnly, signal),
  })
}

export function useFinancialGoalsSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.financialGoalsSummary,
    queryFn: ({ signal }) => getFinancialGoalsSummary(signal),
  })
}

export function useGoalEMIPaymentsQuery(goalId: number | null) {
  return useQuery({
    queryKey: goalId ? ['goalEMIPayments', goalId] : ['goalEMIPayments', 'none'],
    queryFn: ({ signal }) => (goalId === null ? Promise.resolve([]) : getGoalEMIPayments(goalId, signal)),
    enabled: goalId !== null,
  })
}

export function useMonthlyCashflowReportQuery(filters?: { fromMonth?: string; toMonth?: string }) {
  return useQuery({
    queryKey: queryKeys.reports('monthly-cashflow', filters),
    queryFn: ({ signal }) => getMonthlyCashflowReport(filters, signal),
  })
}

export function useCreditCardBillPaymentsReportQuery(filters?: { cardId?: number; status?: CreditCardBill['status']; fromDate?: string; toDate?: string }) {
  return useQuery({
    queryKey: queryKeys.reports('credit-card-bills', filters),
    queryFn: ({ signal }) => getCreditCardBillPaymentsReport(filters, signal),
  })
}

export function useNetWorthSnapshotsReportQuery() {
  return useQuery({
    queryKey: queryKeys.reports('networth-snapshots'),
    queryFn: ({ signal }) => getNetWorthSnapshotsReport(signal),
  })
}

export function useInvestmentHoldingsReportQuery() {
  return useQuery({
    queryKey: queryKeys.reports('investment-holdings'),
    queryFn: ({ signal }) => getInvestmentHoldingsReport(signal),
  })
}

export function useTaxYearsQuery() {
  return useQuery({
    queryKey: queryKeys.taxYears,
    queryFn: ({ signal }) => getTaxYears(signal),
  })
}

