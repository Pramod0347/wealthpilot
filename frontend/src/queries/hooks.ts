import { useQuery } from '@tanstack/react-query'
import {
  checkAuth,
  getAnalyticsSummary,
  getBankAccounts,
  getBankAccountsSummary,
  getCashflowEntries,
  getCashflowMonths,
  getCashflowSummary,
  getCreditCardBillHistory,
  getCreditCardBills,
  getCreditCards,
  getDashboardSummary,
  getFinancialGoals,
  getFinancialGoalsSummary,
  getFixedSavingsAccounts,
  getFixedSavingsSummary,
  getHoldings,
  getHoldingsAnalytics,
  getInvestmentHoldingsReport,
  getMarketOverview,
  getMonthlyCashflowReport,
  getNetWorthSnapshotsReport,
  getPortfolioIntelligence,
  getPortfolioPerformance,
  getTaxDeductions,
  getTaxDocuments,
  getTaxIncomeItems,
  getTaxPayments,
  getTaxYearSummary,
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

export function useTaxSummaryQuery(taxYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: taxYearId ? queryKeys.taxSummary(taxYearId) : ['taxSummary', 'none'],
    queryFn: ({ signal }) => getTaxYearSummary(taxYearId as number, signal),
    enabled: enabled && taxYearId !== null,
  })
}

export function useTaxIncomeQuery(taxYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: taxYearId ? queryKeys.taxIncome(taxYearId) : ['taxIncome', 'none'],
    queryFn: ({ signal }) => getTaxIncomeItems(taxYearId as number, signal),
    enabled: enabled && taxYearId !== null,
  })
}

export function useTaxDeductionsQuery(taxYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: taxYearId ? queryKeys.taxDeductions(taxYearId) : ['taxDeductions', 'none'],
    queryFn: ({ signal }) => getTaxDeductions(taxYearId as number, signal),
    enabled: enabled && taxYearId !== null,
  })
}

export function useTaxDocumentsQuery(taxYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: taxYearId ? queryKeys.taxDocuments(taxYearId) : ['taxDocuments', 'none'],
    queryFn: ({ signal }) => getTaxDocuments(taxYearId as number, signal),
    enabled: enabled && taxYearId !== null,
  })
}

export function useTaxPaymentsQuery(taxYearId: number | null, enabled = true) {
  return useQuery({
    queryKey: taxYearId ? queryKeys.taxPayments(taxYearId) : ['taxPayments', 'none'],
    queryFn: ({ signal }) => getTaxPayments(taxYearId as number, signal),
    enabled: enabled && taxYearId !== null,
  })
}
