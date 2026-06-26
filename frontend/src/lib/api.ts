const DEFAULT_API_BASE_URL = 'http://localhost:8000'
const AUTH_TOKEN_STORAGE_KEY = 'wealthpilot_auth_token'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL

export type WealthBucketItem = {
  id: number
  type: 'holding' | 'fixed_savings' | 'bank_account' | 'credit_card' | string
  name: string
  symbol: string | null
  value: string | number
  pnl: string | number | null
  return_pct: string | number | null
  meta: string | null
  native_value: string | number | null
  native_currency: string | null
  badge: string | null
}

export type BankAccount = {
  id: number
  bank_name: string
  account_name: string | null
  account_type: 'savings' | 'current' | 'salary' | 'fd' | 'other'
  account_number_last4: string | null
  balance: string | number
  currency: string
  notes: string | null
  as_of_date: string | null
  created_at: string
  updated_at: string
}

export type BankAccountsSummary = {
  total_cash: string | number
  accounts_count: number
  currency: string
}

export type CreditCardBill = {
  id: number
  credit_card_id: number
  billing_cycle_start: string | null
  billing_cycle_end: string | null
  bill_generated_date: string | null
  due_date: string | null
  bill_amount: string | number
  paid_amount: string | number | null
  paid_date: string | null
  status: 'generated' | 'paid' | 'partial' | 'waived' | 'missed'
  notes: string | null
  created_at: string
  updated_at: string
}

export type CreditCard = {
  id: number
  card_name: string
  bank_name: string
  last4: string
  total_limit: string | number
  used_amount: string | number
  current_bill_amount: string | number
  billing_cycle_start: string
  billing_cycle_end: string
  due_date: string
  status: 'paid' | 'due_soon' | 'overdue'
  notes: string | null
  created_at: string
  updated_at: string
  available_limit: string | number
  utilization_pct: string | number
  days_until_due: number
}

export type MarkCreditCardPaidPayload = {
  paid_amount: string | null
  paid_date: string | null
  notes: string | null
}

export type MarkCreditCardPaidResponse = {
  credit_card: {
    id: number
    card_name: string
    bank_name: string
    last4: string
    total_limit: string | number
    used_amount: string | number
    current_bill_amount: string | number
    billing_cycle_start: string
    billing_cycle_end: string
    due_date: string
    status: 'paid' | 'due_soon' | 'overdue'
    notes: string | null
    created_at: string
    updated_at: string
    available_limit: string | number
    utilization_pct: string | number
    days_until_due: number
  }
  bill_record: CreditCardBill
}

export type BankAccountPayload = {
  bank_name: string
  account_name: string | null
  account_type: 'savings' | 'current' | 'salary' | 'fd' | 'other'
  account_number_last4: string | null
  balance: string
  currency: string
  notes: string | null
  as_of_date: string | null
}

export type FixedSavingsAccount = {
  id: number
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  account_name: string
  provider_name: string | null
  account_number_last4: string | null
  employee_contribution: string | number
  employer_contribution: string | number
  self_contribution: string | number
  interest_earned: string | number
  current_value: string | number
  interest_rate: string | number | null
  start_date: string | null
  maturity_date: string | null
  as_of_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  total_contribution: string | number
  gain_or_interest: string | number
  return_pct: string | number
}

export type FixedSavingsByTypeSummary = {
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  current_value: string | number
  total_contribution: string | number
  interest_earned: string | number
  count: number
}

export type FixedSavingsSummary = {
  total_value: string | number
  total_contribution: string | number
  total_interest: string | number
  accounts_count: number
  by_type: FixedSavingsByTypeSummary[]
}

export type FixedSavingsAccountPayload = {
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  account_name: string
  provider_name: string | null
  account_number_last4: string | null
  employee_contribution: string
  employer_contribution: string
  self_contribution: string
  interest_earned: string
  current_value: string
  interest_rate: string | null
  start_date: string | null
  maturity_date: string | null
  as_of_date: string | null
  notes: string | null
}

export type FinancialGoal = {
  id: number
  name: string
  goal_type: 'emergency_fund' | 'travel' | 'retirement' | 'house' | 'vehicle' | 'education' | 'custom'
  target_amount: string | number
  current_amount: string | number
  target_date: string | null
  linked_source_type: 'manual' | 'bank_accounts' | 'holdings' | 'fixed_savings' | 'total_networth' | null
  linked_source_ids: number[] | null
  linked_source_types: Array<'manual' | 'bank_accounts' | 'holdings' | 'fixed_savings' | 'total_networth'> | null
  linked_source_map: Partial<Record<'manual' | 'bank_accounts' | 'holdings' | 'fixed_savings' | 'total_networth', number[]>> | null
  priority: 'low' | 'medium' | 'high' | null
  notes: string | null
  is_active: boolean
  resolved_current_amount: string | number
  progress_pct: string | number
  shortfall_amount: string | number
  months_remaining: number | null
  required_monthly_saving: string | number | null
  status: 'completed' | 'on_track' | 'watch' | 'behind' | 'unknown'
  created_at: string
  updated_at: string
}

export type FinancialGoalPayload = {
  name: string
  goal_type: FinancialGoal['goal_type']
  target_amount: string
  current_amount: string
  target_date: string | null
  linked_source_type: FinancialGoal['linked_source_type']
  linked_source_ids: number[] | null
  linked_source_types: Array<'manual' | 'bank_accounts' | 'holdings' | 'fixed_savings' | 'total_networth'> | null
  linked_source_map: Partial<Record<'manual' | 'bank_accounts' | 'holdings' | 'fixed_savings' | 'total_networth', number[]>> | null
  priority: FinancialGoal['priority']
  notes: string | null
  is_active: boolean
}

export type FinancialGoalSummary = {
  active_goals_count: number
  completed_goals_count: number
  total_target_amount: string | number
  total_current_amount: string | number
  total_shortfall_amount: string | number
  average_progress_pct: string | number
  monthly_saving_needed_total: string | number
  largest_shortfall_goal_name: string | null
  largest_shortfall_amount: string | number
  status_counts: Record<string, number>
  top_goals: FinancialGoal[]
}

export type CashflowEntry = {
  id: number
  month: string
  entry_type: 'income' | 'expense'
  category: string
  source: string | null
  amount: string | number
  notes: string | null
  created_at: string
  updated_at: string
}

export type CashflowCategoryBreakdownItem = {
  category: string
  amount: string | number
  percentage: string | number
}

export type CashflowSummary = {
  month: string
  total_income: string | number
  total_expense: string | number
  net_savings: string | number
  savings_rate: string | number
  income_count: number
  expense_count: number
  expenses_by_category: CashflowCategoryBreakdownItem[]
  income_by_category: CashflowCategoryBreakdownItem[]
}

export type CashflowEntryPayload = {
  month: string
  entry_type: 'income' | 'expense'
  category: string
  source: string | null
  amount: string
  notes: string | null
}

export type PortfolioIntelligenceAllocationItem = {
  key: string
  label: string
  amount: string | number
  percentage: string | number
  kind: string
  items: WealthBucketItem[]
}

export type PortfolioIntelligenceHoldingMover = {
  id: number
  symbol: string
  company_name: string
  asset_type: string
  country: string
  current_value: string | number
  pnl: string | number
  return_pct: string | number
}

export type PortfolioIntelligence = {
  net_worth: {
    total_assets: string | number
    total_liabilities: string | number
    net_worth: string | number
    liquid_assets: string | number
    long_term_assets: string | number
    credit_exposure: string | number
  }
  asset_allocation: PortfolioIntelligenceAllocationItem[]
  risk_allocation: PortfolioIntelligenceAllocationItem[]
  liquidity: {
    immediate_cash: string | number
    market_linked: string | number
    locked_long_term: string | number
    liabilities: string | number
  }
  performance: {
    has_snapshots: boolean
    latest_snapshot_date: string | null
    latest_snapshot_value: string | number
    latest_snapshot_return_pct: string | number
    message: string | null
  }
  top_movers: {
    biggest_gainers: PortfolioIntelligenceHoldingMover[]
    biggest_losers: PortfolioIntelligenceHoldingMover[]
    largest_allocation: PortfolioIntelligenceAllocationItem | null
    attention: Array<{
      label: string
      detail: string
      tone: string
    }>
  }
  insights: string[]
  cashflow_context: {
    month: string | null
    income: string | number
    spend: string | number
    savings: string | number
    savings_rate: string | number
    has_data: boolean
    note: string
  }
}

export type PortfolioRange = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export type PortfolioPerformanceSnapshot = {
  date: string
  timestamp: string
  total_value: string | number
  net_worth: string | number | null
  invested_value: string | number | null
}

export type PortfolioPerformancePredictionPoint = {
  date: string
  estimated_value: string | number
}

export type PortfolioPerformancePrediction = {
  available: boolean
  method: 'median_daily_return' | 'linear_regression' | 'insufficient_data'
  confidence: 'low' | 'medium' | 'high' | null
  reason: string
  points: PortfolioPerformancePredictionPoint[]
  estimated_change_amount: string | number | null
  estimated_change_pct: string | number | null
}

export type PortfolioPerformanceSummary = {
  first_value: string | number | null
  latest_value: string | number | null
  change_amount: string | number | null
  change_pct: string | number | null
  snapshot_count: number
  projected_value: string | number | null
  projected_change_pct: string | number | null
}

export type PortfolioPerformanceData = {
  range: PortfolioRange
  start_date: string
  end_date: string
  snapshots: PortfolioPerformanceSnapshot[]
  prediction: PortfolioPerformancePrediction
  summary: PortfolioPerformanceSummary
}

export type AnalyticsMetricWindow = {
  income: string | number
  expense: string | number
  net_savings: string | number
  savings_rate: string | number | null
  has_data: boolean
}

export type AnalyticsCategoryAverageItem = {
  category: string
  average_amount: string | number
  total_amount: string | number
  percentage_of_avg_spend: string | number | null
  percentage_of_avg_income: string | number | null
  months_present: number
}

export type AnalyticsMonthlyTrendItem = {
  month: string
  income: string | number
  expense: string | number
  net_savings: string | number
  savings_rate: string | number | null
}

export type AnalyticsFocusItem = {
  type: string
  severity: 'healthy' | 'watch' | 'risk'
  title: string
  message: string
  action: string
}

export type AnalyticsSummary = {
  cashflow_analytics: {
    months_count: number
    tracked_months: string[]
    current_month: string | null
    current_month_summary: AnalyticsMetricWindow
    average_monthly_summary: AnalyticsMetricWindow
    cash_buffer_months: string | number | null
    average_expense_by_category: AnalyticsCategoryAverageItem[]
    average_income_by_category: AnalyticsCategoryAverageItem[]
    monthly_trend: AnalyticsMonthlyTrendItem[]
    top_spending_categories: Array<{
      category: string
      average_amount: string | number
      percentage_of_avg_spend: string | number
    }>
    focus_items: AnalyticsFocusItem[]
  }
  investment_analytics: {
    total_assets: string | number
    total_liabilities: string | number
    net_worth: string | number
    bucket_allocation: Array<{
      key: string
      label: string
      value: string | number
      percentage: string | number
      items_count: number
    }>
    top_holdings: Array<{
      name: string
      symbol: string
      value: string | number
      percentage_of_portfolio: string | number
      return_pct: string | number | null
    }>
    investment_focus_items: AnalyticsFocusItem[]
  }
  goals_analytics: {
    total_goals: number
    completed_count: number
    on_track_count: number
    watch_count: number
    behind_count: number
    largest_shortfall_goal_name: string | null
    largest_shortfall_amount: string | number
    monthly_saving_needed_total: string | number
    summary: FinancialGoalSummary
  }
}

export type MonthlyCashflowReportRow = {
  month: string
  total_income: string | number
  total_expense: string | number
  net_savings: string | number
  savings_rate: string | number | null
  top_expense_category: string | null
  top_income_source: string | null
}

export type MonthlyCashflowReport = {
  rows: MonthlyCashflowReportRow[]
}

export type CreditCardBillPaymentsReportRow = {
  bill_id: number
  credit_card_id: number
  card_name: string
  billing_cycle_start: string | null
  billing_cycle_end: string | null
  bill_generated_date: string | null
  due_date: string | null
  bill_amount: string | number
  paid_amount: string | number | null
  paid_date: string | null
  status: CreditCardBill['status']
  notes: string | null
}

export type CreditCardBillPaymentsReport = {
  rows: CreditCardBillPaymentsReportRow[]
}

export type NetWorthSnapshotReportRow = {
  date: string
  portfolio_value: string | number
  change_amount: string | number | null
  change_pct: string | number | null
  created_at: string
  updated_at: string
}

export type NetWorthSnapshotReport = {
  rows: NetWorthSnapshotReportRow[]
}

export type InvestmentHoldingsReportRow = {
  holding_id: number
  symbol: string
  company_name: string
  asset_type: string
  country: string
  invested_value: string | number
  current_value: string | number
  pnl: string | number
  return_pct: string | number
  quantity: string | number
  avg_buy_price: string | number
  current_price: string | number
  last_updated: string
}

export type InvestmentHoldingsReport = {
  rows: InvestmentHoldingsReportRow[]
}

export type ApiValidationError = {
  path: string
  message: string
}

export class ApiError extends Error {
  status: number
  validationErrors: ApiValidationError[]

  constructor(message: string, status: number, validationErrors: ApiValidationError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.validationErrors = validationErrors
  }
}

export function getStoredAuthToken() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? ''
}

export function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    return
  }
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

type FetchOptions = RequestInit & {
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { headers: optionHeaders, ...requestOptions } = options
  const url = `${API_BASE_URL}${path}`
  const method = (requestOptions.method ?? 'GET').toUpperCase()
  const hasBody = requestOptions.body !== undefined && requestOptions.body !== null

  let response: Response
  try {
    const authToken = getStoredAuthToken()
    response = await fetch(url, {
      ...requestOptions,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(optionHeaders ?? {}),
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Network request failed'
    if (message.includes('Failed to fetch')) {
      throw new ApiError('Network/preflight failed. Check backend terminal for OPTIONS/PATCH logs.', 0)
    }
    throw new ApiError(`${method} ${url} failed: ${message}`, 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()

    if (contentType.includes('application/json') && text) {
      try {
        const payload = JSON.parse(text) as unknown
        if (payload && typeof payload === 'object' && 'detail' in payload) {
          const detail = (payload as { detail: unknown }).detail
          if (Array.isArray(detail)) {
            const validationErrors = detail
              .map((item) => {
                if (!item || typeof item !== 'object') {
                  return null
                }
                const path = Array.isArray((item as { loc?: unknown }).loc)
                  ? (item as { loc?: Array<string | number> }).loc?.slice(1).join('.')
                  : ''
                const message = typeof (item as { msg?: unknown }).msg === 'string' ? (item as { msg: string }).msg : 'Invalid value'
                return {
                  path,
                  message,
                }
              })
              .filter((item): item is ApiValidationError => item !== null)

            throw new ApiError('Validation failed', response.status, validationErrors)
          }

          if (typeof detail === 'string') {
            throw new ApiError(detail, response.status)
          }
        }
        throw new ApiError(JSON.stringify(payload, null, 2), response.status)
      } catch (parseError) {
        if (parseError instanceof ApiError) {
          throw parseError
        }
        throw new ApiError(text, response.status)
      }
    }

    throw new ApiError(text || `Request failed with status ${response.status}`, response.status)
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T
  }

  return text as T
}

export function getBankAccounts(signal?: AbortSignal) {
  return apiFetch<BankAccount[]>('/api/bank-accounts', { signal })
}

export function getBankAccountsSummary(signal?: AbortSignal) {
  return apiFetch<BankAccountsSummary>('/api/bank-accounts/summary', { signal })
}

export function createBankAccount(payload: BankAccountPayload) {
  return apiFetch<BankAccount>('/api/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function getCreditCardBills(filters?: {
  cardId?: number
  status?: CreditCardBill['status']
  fromDate?: string
  toDate?: string
}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filters?.cardId !== undefined) params.set('card_id', String(filters.cardId))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.fromDate) params.set('from_date', filters.fromDate)
  if (filters?.toDate) params.set('to_date', filters.toDate)
  const query = params.toString()
  return apiFetch<CreditCardBill[]>(`/api/credit-card-bills${query ? `?${query}` : ''}`, { signal })
}

export function getCreditCards(signal?: AbortSignal) {
  return apiFetch<CreditCard[]>('/api/credit-cards', { signal })
}

export function getCreditCardBillHistory(cardId: number, signal?: AbortSignal) {
  return apiFetch<CreditCardBill[]>(`/api/credit-cards/${cardId}/bills`, { signal })
}

export function markCreditCardPaid(cardId: number, payload: MarkCreditCardPaidPayload) {
  return apiFetch<MarkCreditCardPaidResponse>(`/api/credit-cards/${cardId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCreditCardBill(billId: number, payload: Partial<CreditCardBill>) {
  return apiFetch<CreditCardBill>(`/api/credit-card-bills/${billId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCreditCardBill(billId: number) {
  return apiFetch<void>(`/api/credit-card-bills/${billId}`, {
    method: 'DELETE',
  })
}

export function updateBankAccount(accountId: number, payload: BankAccountPayload) {
  return apiFetch<BankAccount>(`/api/bank-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteBankAccount(accountId: number) {
  return apiFetch<void>(`/api/bank-accounts/${accountId}`, {
    method: 'DELETE',
  })
}

export function getFixedSavingsAccounts(signal?: AbortSignal) {
  return apiFetch<FixedSavingsAccount[]>('/api/fixed-savings', { signal })
}

export function getFixedSavingsSummary(signal?: AbortSignal) {
  return apiFetch<FixedSavingsSummary>('/api/fixed-savings/summary', { signal })
}

export function createFixedSavingsAccount(payload: FixedSavingsAccountPayload) {
  return apiFetch<FixedSavingsAccount>('/api/fixed-savings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFixedSavingsAccount(accountId: number, payload: FixedSavingsAccountPayload) {
  return apiFetch<FixedSavingsAccount>(`/api/fixed-savings/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFixedSavingsAccount(accountId: number) {
  return apiFetch<void>(`/api/fixed-savings/${accountId}`, {
    method: 'DELETE',
  })
}

export function getFinancialGoals(activeOnly?: boolean, signal?: AbortSignal) {
  const query = typeof activeOnly === 'boolean' ? `?active_only=${activeOnly}` : ''
  return apiFetch<FinancialGoal[]>(`/api/goals${query}`, { signal })
}

export function getFinancialGoalsSummary(signal?: AbortSignal) {
  return apiFetch<FinancialGoalSummary>('/api/goals/summary', { signal })
}

export function createFinancialGoal(payload: FinancialGoalPayload) {
  return apiFetch<FinancialGoal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFinancialGoal(goalId: number, payload: Partial<FinancialGoalPayload>) {
  return apiFetch<FinancialGoal>(`/api/goals/${goalId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFinancialGoal(goalId: number) {
  return apiFetch<void>(`/api/goals/${goalId}`, {
    method: 'DELETE',
  })
}

export function getCashflowEntries(month?: string, signal?: AbortSignal) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch<CashflowEntry[]>(`/api/cashflow${query}`, { signal })
}

export function getCashflowSummary(month?: string, signal?: AbortSignal) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch<CashflowSummary>(`/api/cashflow/summary${query}`, { signal })
}

export function getCashflowMonths(signal?: AbortSignal) {
  return apiFetch<string[]>('/api/cashflow/months', { signal })
}

export function createCashflowEntry(payload: CashflowEntryPayload) {
  return apiFetch<CashflowEntry>('/api/cashflow', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCashflowEntry(entryId: number, payload: CashflowEntryPayload) {
  return apiFetch<CashflowEntry>(`/api/cashflow/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCashflowEntry(entryId: number) {
  return apiFetch<void>(`/api/cashflow/${entryId}`, {
    method: 'DELETE',
  })
}

export function getPortfolioIntelligence(signal?: AbortSignal) {
  return apiFetch<PortfolioIntelligence>('/api/portfolio/intelligence', { signal })
}

export function getAnalyticsSummary(signal?: AbortSignal) {
  return apiFetch<AnalyticsSummary>('/api/analytics/summary', { signal })
}

export function getMonthlyCashflowReport(filters?: {
  fromMonth?: string
  toMonth?: string
}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filters?.fromMonth) params.set('from_month', filters.fromMonth)
  if (filters?.toMonth) params.set('to_month', filters.toMonth)
  const query = params.toString()
  return apiFetch<MonthlyCashflowReport>(`/api/reports/monthly-cashflow${query ? `?${query}` : ''}`, { signal })
}

export function getCreditCardBillPaymentsReport(filters?: {
  cardId?: number
  status?: CreditCardBill['status']
  fromDate?: string
  toDate?: string
}, signal?: AbortSignal) {
  const params = new URLSearchParams()
  if (filters?.cardId !== undefined) params.set('card_id', String(filters.cardId))
  if (filters?.status) params.set('status', filters.status)
  if (filters?.fromDate) params.set('from_date', filters.fromDate)
  if (filters?.toDate) params.set('to_date', filters.toDate)
  const query = params.toString()
  return apiFetch<CreditCardBillPaymentsReport>(`/api/reports/credit-card-bills${query ? `?${query}` : ''}`, { signal })
}

export function getNetWorthSnapshotsReport(signal?: AbortSignal) {
  return apiFetch<NetWorthSnapshotReport>('/api/reports/networth-snapshots', { signal })
}

export function getInvestmentHoldingsReport(signal?: AbortSignal) {
  return apiFetch<InvestmentHoldingsReport>('/api/reports/investment-holdings', { signal })
}

export function loginUser(email: string, phone: string) {
  return apiFetch<{ authenticated: boolean; token?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, phone }),
  })
}

export function checkServerHealth() {
  return apiFetch<{ status: string }>('/health')
}

export function checkAuth() {
  return apiFetch<{ authenticated: boolean }>('/api/auth/me')
}

export function logoutUser() {
  return apiFetch<{ authenticated: boolean }>('/api/auth/logout', { method: 'POST' })
}
