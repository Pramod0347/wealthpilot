const DEFAULT_API_BASE_URL = 'http://localhost:8000'
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

export type MarketOverviewItem = {
  name: string
  symbol: string
  price: number | null
  change: number | null
  change_pct: number | null
  currency: string
  source: 'yfinance'
  last_updated: string
  error?: string | null
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

export type DashboardSummary = {
  total_credit_card_dues: string | number
  total_card_limit: string | number
  total_card_used: string | number
  overall_card_utilization: string | number
  due_soon_count: number
  overdue_count: number
}

export type Holding = {
  id: number
  symbol: string
  company_name: string
  asset_type: string
  country: string
  currency: string
  exchange: string | null
  exchange_symbol: string | null
  fx_rate_to_inr: string | number
  effective_fx_rate_to_inr: string | number
  quantity: string | number
  avg_buy_price: string | number
  current_price: string | number
  price_source: string
  last_price_refreshed_at: string | null
  sector: string | null
  notes: string | null
  as_of_date: string
  created_at: string
  updated_at: string
  native_invested_amount: string | number
  native_current_value: string | number
  native_pnl: string | number
  native_currency: string
  invested_amount: string | number
  current_value: string | number
  pnl: string | number
  return_pct: string | number
}

export type HoldingsAnalyticsResponse = {
  total_invested: string | number
  current_value: string | number
  total_pnl: string | number
  total_return_pct: string | number
  asset_type_allocation: Array<{
    key: string
    label: string
    amount: string | number
    percentage: string | number
  }>
  sector_allocation: Array<{
    key: string
    label: string
    amount: string | number
    percentage: string | number
  }>
  top_gainers: Array<{
    id: number
    symbol: string
    company_name: string
    asset_type: string
    country: string
    currency: string
    sector: string | null
    native_current_value: string | number
    native_pnl: string | number
    current_value: string | number
    pnl: string | number
    return_pct: string | number
  }>
  top_losers: Array<{
    id: number
    symbol: string
    company_name: string
    asset_type: string
    country: string
    currency: string
    sector: string | null
    native_current_value: string | number
    native_pnl: string | number
    current_value: string | number
    pnl: string | number
    return_pct: string | number
  }>
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
  status: 'active' | 'achieved' | 'paused' | 'cancelled'
  achieved_date: string | null
  achieved_amount: string | number | null
  achievement_type: 'planned_goal' | 'big_purchase' | 'gift' | 'travel' | 'asset_purchase' | 'other' | null
  payment_source: 'bank' | 'credit_card' | 'cash' | 'mixed' | 'other' | null
  is_big_purchase: boolean
  purchase_notes: string | null
  is_active: boolean
  resolved_current_amount: string | number
  progress_pct: string | number
  shortfall_amount: string | number
  months_remaining: number | null
  required_monthly_saving: string | number | null
  progress_status: 'completed' | 'on_track' | 'watch' | 'behind' | 'unknown'
  is_achieved: boolean
  final_amount: string | number
  variance_amount: string | number
  variance_pct: string | number | null
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
  status: FinancialGoal['status']
  achieved_date: string | null
  achieved_amount: string | null
  achievement_type: FinancialGoal['achievement_type']
  payment_source: FinancialGoal['payment_source']
  is_big_purchase: boolean
  purchase_notes: string | null
  is_active: boolean
}

export type GoalAchievementPayload = {
  achieved_date: string
  achieved_amount: string
  achievement_type: NonNullable<FinancialGoal['achievement_type']>
  payment_source: NonNullable<FinancialGoal['payment_source']>
  purchase_notes: string | null
}

export type QuickAchievementPayload = {
  name: string
  goal_type: FinancialGoal['goal_type']
  achieved_amount: string
  achieved_date: string
  achievement_type: NonNullable<FinancialGoal['achievement_type']>
  payment_source: NonNullable<FinancialGoal['payment_source']>
  purchase_notes: string | null
}

export type FinancialGoalSummary = {
  active_goals_count: number
  achieved_goals_count: number
  total_target_amount: string | number
  total_current_amount: string | number
  total_shortfall_amount: string | number
  average_progress_pct: string | number
  monthly_saving_needed_total: string | number
  largest_shortfall_goal_name: string | null
  largest_shortfall_amount: string | number
  total_achieved_amount: string | number
  big_purchases_count: number
  this_year_achieved_amount: string | number
  average_achieved_amount: string | number
  recent_achieved_goal: FinancialGoal | null
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

export type TaxYear = {
  id: number
  financial_year: string
  assessment_year: string | null
  regime: 'new'
  filing_status: 'planning' | 'ready' | 'filed'
  filing_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type TaxIncomeItem = {
  id: number
  tax_year_id: number
  income_type: 'salary' | 'interest' | 'dividend' | 'capital_gains' | 'freelance' | 'other'
  source: string | null
  description: string | null
  gross_amount: string | number
  exempt_amount: string | number
  taxable_amount: string | number | null
  tds_amount: string | number
  received_date: string | null
  created_at: string
  updated_at: string
}

export type TaxDeduction = {
  id: number
  tax_year_id: number
  section: 'STANDARD_DEDUCTION' | 'NPS_EMPLOYER' | 'OTHER_ALLOWED' | 'INFO_ONLY'
  description: string | null
  amount: string | number
  eligible_amount: string | number | null
  proof_status: 'missing' | 'available' | 'verified'
  created_at: string
  updated_at: string
}

export type TaxDocument = {
  id: number
  tax_year_id: number
  document_type: 'FORM_16' | 'AIS' | 'TIS' | 'FORM_26AS' | 'CAPITAL_GAINS_STATEMENT' | 'BANK_INTEREST_CERTIFICATE' | 'OTHER'
  name: string
  status: 'missing' | 'uploaded' | 'verified'
  file_name: string | null
  file_path: string | null
  notes: string | null
  uploaded_at: string | null
  created_at: string
  updated_at: string
}

export type TaxPayment = {
  id: number
  tax_year_id: number
  payment_type: 'tds' | 'advance_tax' | 'self_assessment_tax' | 'refund'
  amount: string | number
  payment_date: string | null
  challan_or_reference: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type TaxYearSummary = {
  tax_year: TaxYear
  income_summary: {
    gross_income: string | number
    exempt_income: string | number
    taxable_income_before_adjustments: string | number
    by_type: Array<{
      income_type: TaxIncomeItem['income_type']
      gross_amount: string | number
      taxable_amount: string | number
      tds_amount: string | number
    }>
  }
  new_regime_estimate: {
    taxable_income: string | number
    standard_deduction: string | number
    allowed_adjustments: string | number
    tax_before_rebate: string | number
    rebate: string | number
    tax_before_cess: string | number
    cess: string | number
    total_tax: string | number
    effective_tax_rate: string | number | null
  }
  tds_summary: {
    total_tds: string | number
    total_advance_tax: string | number
    total_self_assessment_tax: string | number
    total_refunds_received: string | number
    total_tax_paid_or_credited: string | number
  }
  payable_summary: {
    net_tax_balance: string | number
    estimated_refund: string | number
    estimated_payable: string | number
    balance_label: 'refund' | 'payable' | 'settled' | string
  }
  documents_summary: {
    total_required: number
    available_count: number
    verified_count: number
    missing_count: number
    readiness_score: string | number
    missing_documents: string[]
  }
  filing_readiness: {
    status: 'not_ready' | 'in_progress' | 'ready'
    message: string
    checklist: Array<{ label: string; done: boolean }>
    disclaimer: string
  }
}

export type TaxYearPayload = {
  financial_year: string
  assessment_year: string | null
  regime?: 'new'
  filing_status: TaxYear['filing_status']
  filing_date: string | null
  notes: string | null
}

export type TaxIncomeItemPayload = {
  income_type: TaxIncomeItem['income_type']
  source: string | null
  description: string | null
  gross_amount: string
  exempt_amount: string
  taxable_amount: string | null
  tds_amount: string
  received_date: string | null
}

export type TaxDeductionPayload = {
  section: TaxDeduction['section']
  description: string | null
  amount: string
  eligible_amount: string | null
  proof_status: TaxDeduction['proof_status']
}

export type TaxDocumentPayload = {
  document_type: TaxDocument['document_type']
  name: string
  status: TaxDocument['status']
  file_name: string | null
  file_path: string | null
  notes: string | null
  uploaded_at: string | null
}

export type TaxPaymentPayload = {
  payment_type: TaxPayment['payment_type']
  amount: string
  payment_date: string | null
  challan_or_reference: string | null
  notes: string | null
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
  return ''
}

export function setStoredAuthToken(token: string) {
  void token
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
    response = await fetch(url, {
      ...requestOptions,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
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

export function markFinancialGoalAchieved(goalId: number, payload: GoalAchievementPayload) {
  return apiFetch<FinancialGoal>(`/api/goals/${goalId}/mark-achieved`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createQuickAchievement(payload: QuickAchievementPayload) {
  return apiFetch<FinancialGoal>('/api/goals/quick-achievement', {
    method: 'POST',
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

export function getMarketOverview(signal?: AbortSignal) {
  return apiFetch<MarketOverviewItem[]>('/api/market/overview', { signal })
}

export function getDashboardSummary(signal?: AbortSignal) {
  return apiFetch<DashboardSummary>('/api/dashboard/summary', { signal })
}

export function getHoldings(signal?: AbortSignal) {
  return apiFetch<Holding[]>('/api/holdings', { signal })
}

export function getHoldingsAnalytics(signal?: AbortSignal) {
  return apiFetch<HoldingsAnalyticsResponse>('/api/holdings/analytics', { signal })
}

export function getPortfolioPerformance(range: PortfolioRange, signal?: AbortSignal) {
  return apiFetch<PortfolioPerformanceData>(`/api/portfolio/performance?range=${range}`, { signal })
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

export function getTaxYears(signal?: AbortSignal) {
  return apiFetch<TaxYear[]>('/api/tax/years', { signal })
}

export function createTaxYear(payload: TaxYearPayload) {
  return apiFetch<TaxYear>('/api/tax/years', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaxYear(taxYearId: number, payload: Partial<TaxYearPayload>) {
  return apiFetch<TaxYear>(`/api/tax/years/${taxYearId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTaxYear(taxYearId: number) {
  return apiFetch<void>(`/api/tax/years/${taxYearId}`, { method: 'DELETE' })
}

export function getTaxYearSummary(taxYearId: number, signal?: AbortSignal) {
  return apiFetch<TaxYearSummary>(`/api/tax/years/${taxYearId}/summary`, { signal })
}

export function getTaxIncomeItems(taxYearId: number, signal?: AbortSignal) {
  return apiFetch<TaxIncomeItem[]>(`/api/tax/years/${taxYearId}/income`, { signal })
}

export function createTaxIncomeItem(taxYearId: number, payload: TaxIncomeItemPayload) {
  return apiFetch<TaxIncomeItem>(`/api/tax/years/${taxYearId}/income`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaxIncomeItem(incomeId: number, payload: Partial<TaxIncomeItemPayload>) {
  return apiFetch<TaxIncomeItem>(`/api/tax/income/${incomeId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTaxIncomeItem(incomeId: number) {
  return apiFetch<void>(`/api/tax/income/${incomeId}`, { method: 'DELETE' })
}

export function getTaxDeductions(taxYearId: number, signal?: AbortSignal) {
  return apiFetch<TaxDeduction[]>(`/api/tax/years/${taxYearId}/deductions`, { signal })
}

export function createTaxDeduction(taxYearId: number, payload: TaxDeductionPayload) {
  return apiFetch<TaxDeduction>(`/api/tax/years/${taxYearId}/deductions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaxDeduction(deductionId: number, payload: Partial<TaxDeductionPayload>) {
  return apiFetch<TaxDeduction>(`/api/tax/deductions/${deductionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTaxDeduction(deductionId: number) {
  return apiFetch<void>(`/api/tax/deductions/${deductionId}`, { method: 'DELETE' })
}

export function getTaxDocuments(taxYearId: number, signal?: AbortSignal) {
  return apiFetch<TaxDocument[]>(`/api/tax/years/${taxYearId}/documents`, { signal })
}

export function createTaxDocument(taxYearId: number, payload: TaxDocumentPayload) {
  return apiFetch<TaxDocument>(`/api/tax/years/${taxYearId}/documents`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaxDocument(documentId: number, payload: Partial<TaxDocumentPayload>) {
  return apiFetch<TaxDocument>(`/api/tax/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTaxDocument(documentId: number) {
  return apiFetch<void>(`/api/tax/documents/${documentId}`, { method: 'DELETE' })
}

export function getTaxPayments(taxYearId: number, signal?: AbortSignal) {
  return apiFetch<TaxPayment[]>(`/api/tax/years/${taxYearId}/payments`, { signal })
}

export function createTaxPayment(taxYearId: number, payload: TaxPaymentPayload) {
  return apiFetch<TaxPayment>(`/api/tax/years/${taxYearId}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTaxPayment(paymentId: number, payload: Partial<TaxPaymentPayload>) {
  return apiFetch<TaxPayment>(`/api/tax/payments/${paymentId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteTaxPayment(paymentId: number) {
  return apiFetch<void>(`/api/tax/payments/${paymentId}`, { method: 'DELETE' })
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
