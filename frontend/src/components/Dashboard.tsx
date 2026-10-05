import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Icon, type IconName } from './Icon'
import PortfolioPerformanceChart from './ui/PortfolioPerformanceChart'
import PrivateValue from './ui/PrivateValue'
import WealthBucketModal from './ui/WealthBucketModal'
import {
  ApiError,
  apiFetch,
  type BankAccount,
  type FinancialGoal,
  type FinancialGoalSummary,
  type PortfolioPerformanceData,
  type PortfolioRange,
  type WealthBucketItem,
  type AnalyticsSummary,
  type PortfolioIntelligence,
} from '../lib/api'
import {
  formatINR,
  formatINRShort,
  formatPct,
  formatSignedPct,
  getTrendClass,
} from '../lib/format'
import { maskSensitiveText } from '../utils/privacy'
import { usePrivacyMode } from '../context/PrivacyContext'
import {
  useAnalyticsSummaryQuery,
  useBankAccountsQuery,
  useCreditCardsQuery,
  useDashboardSummaryQuery,
  useFinancialGoalsQuery,
  useHoldingsQuery,
  usePortfolioIntelligenceQuery,
  usePortfolioPerformanceQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { secondaryButtonClass } from '../styles/buttonStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiDashboardSummary = {
  total_invested: string | number
  current_value: string | number
  total_bank_cash: string | number
  bank_accounts_count: number
  total_fixed_savings_value: string | number
  fixed_savings_accounts_count: number
  total_assets: string | number
  total_liabilities: string | number
  net_worth: string | number
  total_pnl: string | number
  total_return_pct: string | number
  holdings_count: number
  total_credit_card_dues: string | number
  total_card_limit: string | number
  total_card_used: string | number
  overall_card_utilization: string | number
  due_soon_count: number
  overdue_count: number
  cashflow_metrics?: {
    current_month: string | null
    current: {
      income: string | number
      expense: string | number
      net_savings: string | number
      savings_rate: string | number | null
      has_data: boolean
    }
    average: {
      months_count: number
      income: string | number
      expense: string | number
      net_savings: string | number
      savings_rate: string | number | null
      has_data: boolean
    }
  }
  allocations?: Array<{
    asset_type: string
    label: string
    amount: string | number
    percentage: string | number
    items: WealthBucketItem[]
  }>
  goals_summary?: FinancialGoalSummary
  top_goals?: FinancialGoal[]
}

type ApiHolding = {
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

type ApiCreditCard = {
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

type ActionItem = {
  title: string
  amount: string
  statusLabel: string
  statusTone: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky'
  subtitle: string
  icon?: IconName
  onClick?: () => void
}

type InsightItem = {
  tone: 'emerald' | 'amber' | 'rose' | 'sky' | 'slate'
  title: string
  text: string
  category: 'debt' | 'liquidity' | 'investments' | 'goals' | 'cashflow'
}

type DashboardProps = {
  onOpenStocks?: () => void
  onOpenCards?: () => void
  onOpenGoals?: () => void
  onOpenBanks?: () => void
  onOpenCashflow?: () => void
  onOpenAnalytics?: () => void
  onOpenDeposits?: () => void
  onOpenPFEPF?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const assetTypePalette: Record<string, { label: string; color: string; bg: string }> = {
  ind_stocks: { label: 'IND Stocks', color: '#14b8a6', bg: 'bg-teal-500/15' },
  us_stocks: { label: 'US Stocks', color: '#38bdf8', bg: 'bg-sky-500/15' },
  mutual_funds: { label: 'Mutual Funds', color: '#a78bfa', bg: 'bg-purple-500/15' },
  banks: { label: 'Banks', color: '#f97316', bg: 'bg-orange-500/15' },
  epf: { label: 'EPF', color: '#22c55e', bg: 'bg-emerald-500/15' },
  deposits: { label: 'Deposits', color: '#eab308', bg: 'bg-yellow-500/15' },
  liabilities: { label: 'Liabilities', color: '#fb7185', bg: 'bg-rose-500/15' },
  other: { label: 'Other Assets', color: '#64748b', bg: 'bg-slate-500/15' },
}

const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 100000) return formatINRShort(value)
  return formatINR(value)
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors.map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`).join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatCompactDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function formatMonthLabel(monthStr: string): string {
  const parts = monthStr.split('-')
  if (parts.length < 2) return monthStr
  const year = parts[0]
  const monthNum = parseInt(parts[1], 10) - 1
  const d = new Date(parseInt(year, 10), monthNum, 1)
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d)
}

function getDaysUntil(dateStr: string | null | undefined): { label: string; days: number; isOverdue: boolean } {
  if (!dateStr) return { label: '—', days: 0, isOverdue: false }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(target.getTime())) return { label: dateStr, days: 0, isOverdue: false }
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return { label: 'Due today', days: 0, isOverdue: false }
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, days: diffDays, isOverdue: true }
  if (diffDays === 1) return { label: 'Due tomorrow', days: 1, isOverdue: false }
  return { label: `Due in ${diffDays}d`, days: diffDays, isOverdue: false }
}

function getAssetTypeMeta(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  return assetTypePalette[normalized] ?? assetTypePalette.other
}

function isGoldHolding(holding: ApiHolding) {
  const text = `${holding.symbol} ${holding.company_name} ${holding.sector ?? ''} ${holding.notes ?? ''} ${holding.exchange_symbol ?? ''}`.toLowerCase()
  return holding.asset_type === 'gold' || (holding.asset_type === 'other' && text.includes('gold')) || (holding.asset_type === 'etf' && text.includes('gold'))
}

function buildAllocationData(summary: ApiDashboardSummary | null, holdings: ApiHolding[]) {
  if (summary?.allocations && summary.allocations.length > 0) {
    return summary.allocations.map((entry) => {
      const meta = getAssetTypeMeta(entry.asset_type)
      return {
        key: entry.asset_type,
        label: entry.label || meta.label,
        value: toNumber(entry.amount),
        percentage: toNumber(entry.percentage),
        color: meta.color,
        items: entry.items ?? [],
      }
    })
  }
  const totals = holdings.reduce<Record<string, { label: string; value: number; color: string }>>((acc, h) => {
    const key =
      h.country === 'US'
        ? 'us_stocks'
        : h.asset_type === 'mutual_fund'
          ? 'mutual_funds'
          : h.country === 'IN' && (['stock', 'etf', 'gold'].includes(h.asset_type) || isGoldHolding(h))
            ? 'ind_stocks'
            : 'other'
    const meta = getAssetTypeMeta(key)
    acc[key] = { label: meta.label, value: (acc[key]?.value ?? 0) + toNumber(h.current_value), color: meta.color }
    return acc
  }, {})
  const totalValue = Object.values(totals).reduce((acc, item) => acc + item.value, 0)
  return Object.entries(totals).map(([key, item]) => ({
    key,
    label: item.label,
    value: item.value,
    percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
    color: item.color,
    items: [] as WealthBucketItem[],
  }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({
  tone,
  label,
}: {
  tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'sky'
  label: string
}) {
  const cls =
    tone === 'rose'
      ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400'
      : tone === 'amber'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
        : tone === 'emerald'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
          : tone === 'sky'
            ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  const dotCls =
    tone === 'rose'
      ? 'bg-rose-500'
      : tone === 'amber'
        ? 'bg-amber-500'
        : tone === 'emerald'
          ? 'bg-emerald-500'
          : tone === 'sky'
            ? 'bg-sky-500'
            : 'bg-slate-400'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-[-0.01em] ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  )
}

function CashflowChartTooltip({
  active,
  payload,
  label,
  privacyMode,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  privacyMode: boolean
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-900/95">
      <div className="font-semibold text-slate-900 dark:text-white">{label}</div>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span>{entry.name}:</span>
            </div>
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
              {privacyMode ? '••••' : formatINRShort(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard({
  onOpenStocks,
  onOpenCards,
  onOpenGoals,
  onOpenBanks,
  onOpenCashflow,
  onOpenAnalytics,
  onOpenDeposits,
  onOpenPFEPF,
}: DashboardProps = {}) {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()
  const [activeFilter, setActiveFilter] = useState<PortfolioRange>('6M')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null)
  const [compositionTab, setCompositionTab] = useState<'buckets' | 'holdings'>('buckets')

  // Queries
  const summaryQuery = useDashboardSummaryQuery()
  const holdingsQuery = useHoldingsQuery()
  const cardsQuery = useCreditCardsQuery()
  const bankAccountsQuery = useBankAccountsQuery()
  const portfolioPerformanceQuery = usePortfolioPerformanceQuery(activeFilter)
  const analyticsQuery = useAnalyticsSummaryQuery()
  const intelligenceQuery = usePortfolioIntelligenceQuery()
  const goalsQuery = useFinancialGoalsQuery()

  const summary = (summaryQuery.data ?? null) as ApiDashboardSummary | null
  const holdings = (holdingsQuery.data ?? []) as ApiHolding[]
  const creditCards = (cardsQuery.data ?? []) as ApiCreditCard[]
  const bankAccounts = (bankAccountsQuery.data ?? []) as BankAccount[]
  const portfolioPerformance = (portfolioPerformanceQuery.data ?? null) as PortfolioPerformanceData | null
  const analytics = analyticsQuery.data as AnalyticsSummary | undefined
  const allGoals = (goalsQuery.data ?? []) as FinancialGoal[]

  // Suppress unused variables warning
  void intelligenceQuery

  const summaryLoading = summaryQuery.isLoading
  const portfolioLoading = portfolioPerformanceQuery.isLoading
  const portfolioError = portfolioPerformanceQuery.error ? formatApiError(portfolioPerformanceQuery.error) : null

  // Allocations
  const allocationData = useMemo(() => buildAllocationData(summary, holdings), [holdings, summary])
  const selectedBucket = useMemo(
    () => allocationData.find((entry) => entry.key === selectedBucketKey) ?? null,
    [allocationData, selectedBucketKey],
  )

  // Net Worth & Core Metrics
  const netWorth = toNumber(summary?.net_worth)
  const totalAssets = toNumber(summary?.total_assets)
  const totalLiabilities = toNumber(summary?.total_liabilities)
  const totalInvested = toNumber(summary?.total_invested)
  const currentInvestedValue = toNumber(summary?.current_value)
  const totalPnl = toNumber(summary?.total_pnl)
  const totalReturnPct = toNumber(summary?.total_return_pct)
  const totalBankCash = toNumber(summary?.total_bank_cash)
  const totalFixedSavings = toNumber(summary?.total_fixed_savings_value)

  // Capital Structure Breakdown
  const marketLinkedValue = useMemo(() => {
    return allocationData
      .filter((e) => ['ind_stocks', 'us_stocks', 'mutual_funds'].includes(e.key))
      .reduce((acc, e) => acc + e.value, 0)
  }, [allocationData])

  const lockedLongTermValue = useMemo(() => {
    return allocationData
      .filter((e) => ['epf', 'deposits'].includes(e.key))
      .reduce((acc, e) => acc + e.value, 0)
  }, [allocationData])

  const liquidCashValue = totalBankCash

  const equityExposurePct = useMemo(() => {
    return allocationData
      .filter((e) => ['ind_stocks', 'us_stocks', 'mutual_funds'].includes(e.key))
      .reduce((acc, e) => acc + e.percentage, 0)
  }, [allocationData])

  const usStocksValue = useMemo(() => {
    return holdings.reduce((acc, h) => (h.country === 'US' ? acc + toNumber(h.current_value) : acc), 0)
  }, [holdings])

  const liveUsdInrRate = useMemo(() => {
    const firstUs = holdings.find((h) => h.country === 'US')
    return firstUs ? toNumber(firstUs.effective_fx_rate_to_inr) : 0
  }, [holdings])

  const usStocksInUSD = liveUsdInrRate > 0 ? usStocksValue / liveUsdInrRate : 0

  const depositsValue = useMemo(() => {
    const dep = allocationData.find((e) => e.key === 'deposits')
    return dep ? dep.value : 0
  }, [allocationData])

  // Credit Card Metrics
  const totalCardLimit = toNumber(summary?.total_card_limit)
  const totalCardUsed = toNumber(summary?.total_card_used)
  const cardUtilizationPct = toNumber(summary?.overall_card_utilization)
  const urgentCards = useMemo(() => {
    return [...creditCards]
      .filter((c) => c.status !== 'paid')
      .sort((a, b) => {
        const order = { overdue: 0, due_soon: 1, paid: 2 }
        return order[a.status] - order[b.status]
      })
  }, [creditCards])

  // Cashflow Metrics
  const cashflowMetrics = summary?.cashflow_metrics
  const currentCashflow = cashflowMetrics?.current
  const averageCashflow = cashflowMetrics?.average
  const monthlyHasData = Boolean(currentCashflow?.has_data)
  const averageCashflowHasData = Boolean(averageCashflow?.has_data)
  const trackedMonthsCount = averageCashflow?.months_count ?? analytics?.cashflow_analytics?.months_count ?? 0

  const averageSpend = averageCashflowHasData ? toNumber(averageCashflow?.expense) : 0
  const cashBufferMonths = useMemo(() => {
    if (analytics?.cashflow_analytics?.cash_buffer_months != null) {
      return toNumber(analytics.cashflow_analytics.cash_buffer_months)
    }
    if (averageSpend > 0) {
      return totalBankCash / averageSpend
    }
    return 0
  }, [analytics, averageSpend, totalBankCash])

  // Cashflow Trend for Mini Chart
  const cashflowTrendData = useMemo(() => {
    const trend = analytics?.cashflow_analytics?.monthly_trend ?? []
    if (trend.length === 0) return []
    return trend.slice(-6).map((item) => ({
      month: item.month,
      label: formatMonthLabel(item.month),
      Income: toNumber(item.income),
      Spend: toNumber(item.expense),
      Saved: toNumber(item.net_savings),
    }))
  }, [analytics])

  const topSpendingCategories = useMemo(() => {
    return analytics?.cashflow_analytics?.top_spending_categories ?? []
  }, [analytics])

  // Goals
  const goalsSummary = summary?.goals_summary ?? analytics?.goals_analytics?.summary
  const topGoals = useMemo(() => {
    if (allGoals.length > 0) return allGoals.slice(0, 3)
    return summary?.top_goals ?? []
  }, [allGoals, summary])

  // Latest timestamps
  const latestHoldingUpdate = useMemo(() => {
    const timestamps = holdings
      .map((h) => h.updated_at)
      .concat(holdings.map((h) => h.last_price_refreshed_at).filter(Boolean) as string[])
      .concat(creditCards.map((c) => c.updated_at))
      .concat(bankAccounts.map((a) => a.updated_at))
      .filter(Boolean)
    if (timestamps.length === 0) return null
    return (
      timestamps
        .map((v) => new Date(v))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    )
  }, [bankAccounts, creditCards, holdings])

  // Top Holdings / Movers
  const topHoldings = useMemo(() => {
    if (analytics?.investment_analytics?.top_holdings?.length) {
      return analytics.investment_analytics.top_holdings
    }
    return [...holdings]
      .sort((a, b) => toNumber(b.current_value) - toNumber(a.current_value))
      .slice(0, 5)
      .map((h) => ({
        name: h.company_name,
        symbol: h.symbol,
        value: toNumber(h.current_value),
        percentage_of_portfolio: currentInvestedValue > 0 ? (toNumber(h.current_value) / currentInvestedValue) * 100 : 0,
        return_pct: toNumber(h.return_pct),
      }))
  }, [analytics, currentInvestedValue, holdings])

  // Action Center Items
  const actionItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = []

    // 1. Credit Cards Due / Overdue
    urgentCards.slice(0, 2).forEach((card) => {
      const daysInfo = getDaysUntil(card.due_date)
      items.push({
        title: card.card_name,
        amount: formatMoney(toNumber(card.current_bill_amount)),
        statusLabel: card.status === 'overdue' ? 'Overdue' : daysInfo.label,
        statusTone: card.status === 'overdue' ? 'rose' : 'amber',
        subtitle: `${card.bank_name} ••${card.last4} · Due ${formatDisplayDate(card.due_date)}`,
        icon: 'cards',
        onClick: onOpenCards,
      })
    })

    // 2. Emergency Cash Buffer Status
    if (cashBufferMonths > 0) {
      const isLow = cashBufferMonths < 2
      const isModerate = cashBufferMonths < 4
      items.push({
        title: 'Emergency Fund Runway',
        amount: `${cashBufferMonths.toFixed(1)} mo`,
        statusLabel: isLow ? 'Low Buffer' : isModerate ? 'Moderate' : 'Healthy',
        statusTone: isLow ? 'rose' : isModerate ? 'amber' : 'emerald',
        subtitle: `₹${formatINRShort(totalBankCash)} cash covers ~${cashBufferMonths.toFixed(1)} months of spending`,
        icon: 'banks',
        onClick: onOpenBanks,
      })
    }

    // 3. Goal behind pace
    const behindGoal = topGoals.find((g) => g.progress_status === 'behind')
    if (behindGoal) {
      items.push({
        title: `${behindGoal.name} Goal`,
        amount: formatMoney(toNumber(behindGoal.shortfall_amount)),
        statusLabel: 'Behind Pace',
        statusTone: 'rose',
        subtitle: `Shortfall of ${formatMoney(toNumber(behindGoal.shortfall_amount))} by ${formatDisplayDate(behindGoal.target_date)}`,
        icon: 'portfolio',
        onClick: onOpenGoals,
      })
    }

    // 4. Portfolio return snapshot info
    const latestSnapshotReturn = portfolioPerformance?.summary.change_pct
    if (portfolioPerformance && (portfolioPerformance.summary.snapshot_count ?? 0) > 0) {
      const ret = toNumber(latestSnapshotReturn ?? 0)
      items.push({
        title: 'Portfolio Snapshot Trend',
        amount: formatSignedPct(ret),
        statusLabel: ret >= 0 ? 'Profitable' : 'Drawdown',
        statusTone: ret >= 0 ? 'emerald' : 'rose',
        subtitle: `Calculated across ${portfolioPerformance.summary.snapshot_count} recorded snapshots`,
        icon: 'stocks',
        onClick: onOpenAnalytics,
      })
    }

    return items.slice(0, 4)
  }, [
    cashBufferMonths,
    onOpenAnalytics,
    onOpenBanks,
    onOpenCards,
    onOpenGoals,
    portfolioPerformance,
    topGoals,
    totalBankCash,
    urgentCards,
  ])

  // Smart Insights
  const smartInsights = useMemo<InsightItem[]>(() => {
    const list: InsightItem[] = []

    // 1. Credit card alerts
    if (urgentCards.length > 0) {
      const topUrgent = urgentCards[0]
      const daysInfo = getDaysUntil(topUrgent.due_date)
      list.push({
        category: 'debt',
        tone: topUrgent.status === 'overdue' ? 'rose' : 'amber',
        title: topUrgent.status === 'overdue' ? 'Immediate Payment Required' : 'Upcoming Card Payment',
        text: `${topUrgent.card_name} statement balance of ${formatMoney(toNumber(topUrgent.current_bill_amount))} is ${daysInfo.label}. Clear before due date to preserve credit score.`,
      })
    }

    // 2. Liquid Emergency Buffer
    if (cashBufferMonths > 0) {
      list.push({
        category: 'liquidity',
        tone: cashBufferMonths >= 3 ? 'emerald' : 'amber',
        title: cashBufferMonths >= 3 ? 'Emergency Runway Healthy' : 'Cash Buffer Below Target',
        text: `Liquid reserves (${formatMoney(totalBankCash)}) cover ${cashBufferMonths.toFixed(1)} months of average monthly expenses (${formatMoney(averageSpend)}/mo).`,
      })
    }

    // 3. Asset Allocation & Domestic Equity Concentration
    const indEquityPct = allocationData.find((a) => a.key === 'ind_stocks')?.percentage ?? 0
    const mfPct = allocationData.find((a) => a.key === 'mutual_funds')?.percentage ?? 0
    if (indEquityPct + mfPct > 50) {
      list.push({
        category: 'investments',
        tone: 'sky',
        title: 'High Domestic Equity Exposure',
        text: `Indian stocks & Mutual funds represent ${(indEquityPct + mfPct).toFixed(1)}% of your wealth. Maintain systematic diversification as you add fresh capital.`,
      })
    }

    // 4. Savings Momentum
    if (currentCashflow?.savings_rate != null && toNumber(currentCashflow.savings_rate) > 0) {
      const sr = toNumber(currentCashflow.savings_rate)
      list.push({
        category: 'cashflow',
        tone: sr >= 50 ? 'emerald' : 'sky',
        title: 'Strong Savings Rate',
        text: `You saved ${formatPct(sr)} (${formatMoney(toNumber(currentCashflow.net_savings))}) of income this month, outperforming typical wealth accumulation guidelines.`,
      })
    }

    // 5. Goal Shortfall Guidance
    if (goalsSummary && toNumber(goalsSummary.monthly_saving_needed_total) > 0) {
      list.push({
        category: 'goals',
        tone: 'amber',
        title: 'Goal Funding Target',
        text: `To achieve all ${goalsSummary.active_goals_count} targets on schedule, allocate ~${formatMoney(toNumber(goalsSummary.monthly_saving_needed_total))}/month toward goal funding.`,
      })
    }

    return list.slice(0, 4)
  }, [
    allocationData,
    averageSpend,
    cashBufferMonths,
    currentCashflow,
    goalsSummary,
    totalBankCash,
    urgentCards,
  ])

  // Snapshot trigger
  async function handleSaveTodaySnapshot() {
    setSavingSnapshot(true)
    setStatusMessage(null)
    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage("Today's portfolio snapshot saved successfully.")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolioIntelligence }),
      ])
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setSavingSnapshot(false)
    }
  }

  const latestSnapshotReturn = portfolioPerformance?.summary.change_pct
  const portfolioHasSnapshots = (portfolioPerformance?.summary.snapshot_count ?? 0) > 0

  return (
    <div className="min-w-0 w-full space-y-4 sm:space-y-6">
      <WealthBucketModal bucket={selectedBucket} onClose={() => setSelectedBucketKey(null)} />

      {/* Toast Alert Banner */}
      {statusMessage ? (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm transition-all',
            statusTone === 'emerald'
              ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : statusTone === 'rose'
                ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
                : statusTone === 'amber'
                  ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <Icon
              name={statusTone === 'emerald' ? 'paid' : statusTone === 'rose' ? 'warning' : 'alert'}
              className="h-4 w-4"
            />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="shrink-0 p-1 opacity-70 hover:opacity-100"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── TOP COMMAND & PULSE BAR ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-2.5">
        {/* Left: Sync Pulse */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Live Pulse</span>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Synced {latestHoldingUpdate ? formatCompactDateTime(latestHoldingUpdate) : 'recently'}
          </span>
        </div>

        {/* Center: Financial Health Quick Indicators */}
        <div className="flex flex-wrap items-center gap-2 lg:gap-3">
          {/* Emergency Buffer */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <Icon name="banks" className="h-3.5 w-3.5 text-orange-500" />
            <span>Buffer:</span>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {cashBufferMonths > 0 ? `${cashBufferMonths.toFixed(1)} mo` : '—'}
            </span>
          </div>

          {/* Credit Health */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <Icon name="cards" className="h-3.5 w-3.5 text-rose-500" />
            <span>Credit Used:</span>
            <span className={['font-semibold', cardUtilizationPct > 30 ? 'text-rose-500' : 'text-emerald-500'].join(' ')}>
              {privacyMode ? '•••' : `${cardUtilizationPct.toFixed(1)}%`}
            </span>
          </div>

          {/* Leverage */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <Icon name="shield" className="h-3.5 w-3.5 text-sky-500" />
            <span>Debt-to-Asset:</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">
              {totalAssets > 0 ? `${((totalLiabilities / totalAssets) * 100).toFixed(1)}%` : '0%'}
            </span>
          </div>

          {/* Goals count */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200">
            <Icon name="portfolio" className="h-3.5 w-3.5 text-purple-500" />
            <span>Goals:</span>
            <span className="font-semibold text-purple-600 dark:text-purple-400">
              {goalsSummary?.active_goals_count ?? 0} active
            </span>
          </div>
        </div>

        {/* Right: Snapshot trigger button */}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveTodaySnapshot}
            disabled={savingSnapshot}
            className={[
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
            title="Record today's net worth and holdings valuation snapshot"
          >
            <Icon name={savingSnapshot ? 'refresh' : 'add'} className={['h-3.5 w-3.5', savingSnapshot ? 'animate-spin' : ''].join(' ')} />
            <span>{savingSnapshot ? 'Recording...' : 'Record Snapshot'}</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: BALANCE SHEET HERO & ACTION CENTER ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Net Worth Balance Sheet Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <div className={LABEL}>Total Net Worth</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
                  {summaryLoading ? '—' : <PrivateValue value={formatMoney(netWorth)} mask="••••••" hideColor />}
                </span>
                {portfolioHasSnapshots && (
                  <span
                    className={[
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums',
                      privacyMode
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        : toNumber(latestSnapshotReturn ?? 0) >= 0
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                    ].join(' ')}
                  >
                    {privacyMode ? '•••' : `${toNumber(latestSnapshotReturn ?? 0) >= 0 ? '↑' : '↓'} ${formatPct(Math.abs(toNumber(latestSnapshotReturn ?? 0)))}`}
                  </span>
                )}
              </div>
            </div>

            {/* Capital Structure Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
              <span className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-2 py-1 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                Liquid: {totalAssets > 0 ? `${((liquidCashValue / totalAssets) * 100).toFixed(0)}%` : '0%'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2 py-1 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                Invested: {totalAssets > 0 ? `${((marketLinkedValue / totalAssets) * 100).toFixed(0)}%` : '0%'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Locked: {totalAssets > 0 ? `${((lockedLongTermValue / totalAssets) * 100).toFixed(0)}%` : '0%'}
              </span>
            </div>
          </div>

          {/* 4 Core Balance Sheet Pillars */}
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Total Assets */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Total Assets</span>
                <Icon name="netWorth" className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalAssets)} mask="••••" hideColor />}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {summary ? `${summary.holdings_count + summary.bank_accounts_count + summary.fixed_savings_accounts_count} items across 6 buckets` : '—'}
              </div>
            </div>

            {/* Total Liabilities */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Liabilities</span>
                <Icon name="cards" className="h-3.5 w-3.5 text-rose-400" />
              </div>
              <div className={['mt-2 font-mono text-lg font-bold tabular-nums', totalLiabilities > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'].join(' ')}>
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalLiabilities)} mask="••••" hideColor />}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {creditCards.length} cards · {cardUtilizationPct.toFixed(1)}% limit used
              </div>
            </div>

            {/* Invested Capital & P&L */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Invested Capital</span>
                <Icon name="stocks" className="h-3.5 w-3.5 text-teal-400" />
              </div>
              <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalInvested)} mask="••••" hideColor />}
              </div>
              <div className={['mt-1 font-mono text-xs font-medium tabular-nums', getTrendClass(totalPnl)].join(' ')}>
                {privacyMode ? '•••' : `${totalPnl >= 0 ? '+' : ''}${formatMoney(totalPnl)} (${formatSignedPct(totalReturnPct)})`}
              </div>
            </div>

            {/* Liquid Cash */}
            <div className="rounded-2xl bg-slate-50/80 p-3.5 dark:bg-slate-800/40">
              <div className="flex items-center justify-between">
                <span className={LABEL}>Liquid Reserves</span>
                <Icon name="banks" className="h-3.5 w-3.5 text-orange-400" />
              </div>
              <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalBankCash)} mask="••••" hideColor />}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {bankAccounts.length} banks · {cashBufferMonths.toFixed(1)} mo runway
              </div>
            </div>
          </div>

          {/* Interactive Wealth Buckets Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Wealth Allocation Breakdown</span>
              <span className="text-[11px] text-slate-400">Click any bucket to inspect underlying holdings</span>
            </div>

            <div className="mt-2.5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
              {allocationData.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setSelectedBucketKey(entry.key)}
                  style={{ width: `${Math.max(entry.percentage, 0)}%`, backgroundColor: entry.color }}
                  className="h-full transition-transform hover:scale-y-125 hover:opacity-90"
                  aria-label={`View ${entry.label} details`}
                  title={`${entry.label}: ${formatMoney(entry.value)} (${entry.percentage.toFixed(1)}%)`}
                />
              ))}
            </div>

            {/* Legend Chips with values */}
            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {allocationData.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setSelectedBucketKey(entry.key)}
                  className="flex flex-col rounded-xl border border-slate-100 bg-slate-50/50 p-2 text-left transition-all hover:border-slate-300 hover:bg-slate-100/70 dark:border-slate-800/80 dark:bg-slate-800/30 dark:hover:border-slate-700 dark:hover:bg-slate-800/60"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">{entry.label}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-1 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                    <span className="font-bold">{privacyMode ? '•••' : `${entry.percentage.toFixed(1)}%`}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      <PrivateValue value={formatINRShort(entry.value)} mask="•••" hideColor />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Action & Priority Center */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-rose-500/15 text-rose-500">
                  <Icon name="alert" className="h-3.5 w-3.5" />
                </span>
                <span className={LABEL}>Action & Priority Center</span>
              </div>
              <span className="text-[11px] font-medium text-slate-400">
                {actionItems.length} active item{actionItems.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60">
              {actionItems.map((item, i) => (
                <div
                  key={`${item.title}-${i}`}
                  onClick={item.onClick}
                  className={[
                    'group flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 transition-colors',
                    item.onClick ? 'cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/30 -mx-2 px-2 rounded-xl' : '',
                  ].join(' ')}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        {item.title}
                      </span>
                      {item.onClick && (
                        <Icon name="collapse" className="h-3 w-3 rotate-180 opacity-0 transition-opacity group-hover:opacity-100 text-slate-400" />
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                      <PrivateValue value={item.amount} mask="••••" hideColor />
                    </div>
                    <div className="mt-1">
                      <StatusPill tone={item.statusTone} label={item.statusLabel} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Card Summary Pill */}
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-800/30">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Total Credit Exposure</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                <PrivateValue value={formatMoney(totalLiabilities)} mask="••••" hideColor />
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                style={{ width: `${Math.min(cardUtilizationPct, 100)}%` }}
                className={['h-full rounded-full transition-all', cardUtilizationPct > 50 ? 'bg-rose-500' : 'bg-teal-500'].join(' ')}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
              <span>{cardUtilizationPct.toFixed(1)}% of limit</span>
              <span>Available: {formatINRShort(Math.max(totalCardLimit - totalCardUsed, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: SIX BALANCED STAT METRIC CARDS ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {/* 1. Total Portfolio */}
        <div
          onClick={onOpenStocks}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-teal-500/40"
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>Investments</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/15 text-teal-500 group-hover:scale-110 transition-transform">
              <Icon name="stocks" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(currentInvestedValue)} mask="••••" hideColor />}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {totalInvested > 0 ? (
              <span className={['font-mono font-medium', getTrendClass(totalPnl)].join(' ')}>
                {privacyMode ? '•••' : `${totalPnl >= 0 ? '+' : ''}${formatSignedPct(totalReturnPct)}`}
              </span>
            ) : (
              'No holdings'
            )}
            <span className="text-slate-400"> · {summary?.holdings_count ?? 0} assets</span>
          </div>
        </div>

        {/* 2. Bank Cash */}
        <div
          onClick={onOpenBanks}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-orange-500/40"
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>Bank Cash</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-orange-500/15 text-orange-500 group-hover:scale-110 transition-transform">
              <Icon name="banks" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalBankCash)} mask="••••" hideColor />}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{bankAccounts.length} accounts</span>
            <span className="text-orange-600 dark:text-orange-400 font-semibold"> · {cashBufferMonths.toFixed(1)} mo runway</span>
          </div>
        </div>

        {/* 3. PF / EPF */}
        <div
          onClick={onOpenPFEPF}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>PF / EPF</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500 group-hover:scale-110 transition-transform">
              <Icon name="pfepf" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalFixedSavings)} mask="••••" hideColor />}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>{summary?.fixed_savings_accounts_count ?? 0} accounts</span>
            <span className="text-emerald-600 dark:text-emerald-400"> · Compounding</span>
          </div>
        </div>

        {/* 4. Deposits */}
        <div
          onClick={onOpenDeposits}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-yellow-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-yellow-500/40"
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>Deposits</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-yellow-500/15 text-yellow-600 group-hover:scale-110 transition-transform">
              <Icon name="netWorth" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(depositsValue)} mask="••••" hideColor />}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Security & rent</span>
            <span className="text-yellow-600 dark:text-yellow-400"> · Refundable</span>
          </div>
        </div>

        {/* 5. US Stocks */}
        <div
          onClick={onOpenStocks}
          className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-sky-500/40"
        >
          <div className="flex items-center justify-between">
            <div className={LABEL}>US Stocks</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15 text-sky-500 group-hover:scale-110 transition-transform">
              <Icon name="portfolio" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {usStocksValue > 0 ? <PrivateValue value={formatMoney(usStocksValue)} mask="••••" hideColor /> : '₹0'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {usStocksInUSD > 0 ? (
              <span>${usStocksInUSD.toFixed(1)} USD · ₹{liveUsdInrRate.toFixed(1)}/$</span>
            ) : (
              'No US holdings'
            )}
          </div>
        </div>

        {/* 6. Card Dues */}
        <div
          onClick={onOpenCards}
          className="group cursor-pointer rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm transition-all hover:border-rose-400 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:border-rose-500/50"
        >
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-500 dark:text-rose-400">Card Dues</div>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-rose-500/20 text-rose-500 group-hover:scale-110 transition-transform">
              <Icon name="cards" className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 font-mono text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(totalLiabilities)} mask="••••" hideColor />}
          </div>
          <div className="mt-1 text-xs text-rose-600 dark:text-rose-300">
            <span>{urgentCards.length > 0 ? `${urgentCards.length} due soon` : 'All clear'}</span>
            <span> · {cardUtilizationPct.toFixed(1)}% limit</span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: MONTHLY CASHFLOW & SPEND INTELLIGENCE ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-500/15 text-cyan-500">
                <Icon name="transactions" className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Monthly Cashflow & Spend Intelligence</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {trackedMonthsCount > 0 ? `Analysis based on ${trackedMonthsCount} tracked months` : 'Add monthly cashflow entries to track velocity'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenCashflow}
            className={['inline-flex items-center gap-1.5 px-3 py-1.5 text-xs', secondaryButtonClass].join(' ')}
          >
            <Icon name="transactions" className="h-3.5 w-3.5" />
            <span>View Cashflow</span>
          </button>
        </div>

        {/* 4 Cashflow Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Income */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className={LABEL}>Monthly Income</span>
            <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {monthlyHasData ? <PrivateValue value={formatMoney(toNumber(currentCashflow?.income))} mask="••••" hideColor /> : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {averageCashflowHasData ? `Avg: ${privacyMode ? '•••' : formatMoney(toNumber(averageCashflow?.income))}/mo` : 'No average yet'}
            </div>
          </div>

          {/* Spend */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className={LABEL}>Monthly Spend</span>
            <div className="mt-1.5 font-mono text-xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {monthlyHasData ? <PrivateValue value={formatMoney(toNumber(currentCashflow?.expense))} mask="••••" hideColor /> : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {averageCashflowHasData ? `Avg: ${privacyMode ? '•••' : formatMoney(toNumber(averageCashflow?.expense))}/mo` : 'No average yet'}
            </div>
          </div>

          {/* Net Savings */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className={LABEL}>Net Savings</span>
            <div className={['mt-1.5 font-mono text-xl font-bold tabular-nums', getTrendClass(toNumber(currentCashflow?.net_savings))].join(' ')}>
              {monthlyHasData ? <PrivateValue value={formatMoney(toNumber(currentCashflow?.net_savings))} mask="••••" hideColor /> : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {averageCashflowHasData ? `Avg: ${privacyMode ? '•••' : formatMoney(toNumber(averageCashflow?.net_savings))}/mo` : 'No average yet'}
            </div>
          </div>

          {/* Savings Rate */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <span className={LABEL}>Savings Rate</span>
            <div className={['mt-1.5 font-mono text-xl font-bold tabular-nums', getTrendClass(toNumber(currentCashflow?.savings_rate))].join(' ')}>
              {monthlyHasData && currentCashflow?.savings_rate != null ? (
                <PrivateValue value={formatPct(toNumber(currentCashflow.savings_rate))} mask="••••" hideColor />
              ) : (
                '—'
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {averageCashflowHasData && averageCashflow?.savings_rate != null ? (
                <span>Avg: {privacyMode ? '•••' : formatPct(toNumber(averageCashflow.savings_rate))}</span>
              ) : (
                'Target: >30%'
              )}
            </div>
          </div>
        </div>

        {/* Visual Split: 6-Month Trend Chart + Top Spending Categories */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Trend Chart */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Income vs Spend Trend</span>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-teal-400" /> Income
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Spend
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Saved
                </span>
              </div>
            </div>

            <div className="mt-4 h-48 w-full">
              {cashflowTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflowTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                    <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      width={55}
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => (privacyMode ? '•••' : formatINRShort(v))}
                    />
                    <Tooltip content={<CashflowChartTooltip privacyMode={privacyMode} />} />
                    <Bar dataKey="Income" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="Spend" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Line type="monotone" dataKey="Saved" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Track multiple months in Transactions to view trends.
                </div>
              )}
            </div>
          </div>

          {/* Top Spending Categories */}
          <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-slate-800 dark:bg-slate-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Top Spend Categories</span>
              <span className="text-[11px] text-slate-400">Monthly averages</span>
            </div>

            <div className="mt-4 space-y-3.5">
              {topSpendingCategories.length > 0 ? (
                topSpendingCategories.slice(0, 4).map((cat, idx) => {
                  const pct = toNumber(cat.percentage_of_avg_spend)
                  const colors = ['#f43f5e', '#f97316', '#a855f7', '#06b6d4']
                  const col = colors[idx % colors.length]
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-slate-700 dark:text-slate-200">{cat.category}</span>
                        <div className="font-mono tabular-nums text-slate-900 dark:text-white">
                          <PrivateValue value={formatMoney(toNumber(cat.average_amount))} mask="••••" hideColor />
                          <span className="ml-1.5 text-slate-400">({pct.toFixed(0)}%)</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: col }}
                          className="h-full rounded-full transition-all"
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex h-36 items-center justify-center text-xs text-slate-400">
                  No categorized expenses recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: FINANCIAL GOALS PROGRESS HUB ── */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-purple-500/15 text-purple-500">
                <Icon name="portfolio" className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Financial Goals & Target Tracker</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {goalsSummary
                ? `${goalsSummary.active_goals_count} active target${goalsSummary.active_goals_count === 1 ? '' : 's'} · ${goalsSummary.achieved_goals_count} achieved`
                : 'Plan and fund high-priority financial goals'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenGoals}
            className={['inline-flex items-center gap-1.5 px-3 py-1.5 text-xs', secondaryButtonClass].join(' ')}
          >
            <Icon name="portfolio" className="h-3.5 w-3.5" />
            <span>Manage Goals</span>
          </button>
        </div>

        {/* Goals Summary Bar */}
        {goalsSummary && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50/70 p-3 dark:bg-slate-800/40">
              <div className={LABEL}>Total Goal Targets</div>
              <div className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-white">
                <PrivateValue value={formatMoney(toNumber(goalsSummary.total_target_amount))} mask="••••" hideColor />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3 dark:bg-slate-800/40">
              <div className={LABEL}>Accumulated Funding</div>
              <div className="mt-1 font-mono text-base font-bold text-teal-600 dark:text-teal-400">
                <PrivateValue value={formatMoney(toNumber(goalsSummary.total_current_amount))} mask="••••" hideColor />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3 dark:bg-slate-800/40">
              <div className={LABEL}>Remaining Shortfall</div>
              <div className="mt-1 font-mono text-base font-bold text-rose-600 dark:text-rose-400">
                <PrivateValue value={formatMoney(toNumber(goalsSummary.total_shortfall_amount))} mask="••••" hideColor />
              </div>
            </div>
            <div className="rounded-xl bg-slate-50/70 p-3 dark:bg-slate-800/40">
              <div className={LABEL}>Monthly Saving Needed</div>
              <div className="mt-1 font-mono text-base font-bold text-purple-600 dark:text-purple-400">
                <PrivateValue value={formatMoney(toNumber(goalsSummary.monthly_saving_needed_total))} mask="••••" hideColor />
              </div>
            </div>
          </div>
        )}

        {/* Goals Cards Grid */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topGoals.map((goal) => {
            const progress = Math.min(Math.max(toNumber(goal.progress_pct), 0), 100)
            const isCompleted = goal.status === 'achieved' || progress >= 100
            const tone: 'emerald' | 'amber' | 'rose' | 'sky' = isCompleted
              ? 'emerald'
              : goal.progress_status === 'behind'
                ? 'rose'
                : goal.progress_status === 'watch'
                  ? 'amber'
                  : 'sky'

            const barColor =
              isCompleted
                ? 'bg-emerald-500'
                : tone === 'rose'
                  ? 'bg-rose-500'
                  : tone === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-teal-500'

            return (
              <div
                key={goal.id}
                onClick={onOpenGoals}
                className="group cursor-pointer rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="truncate text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400">
                      {goal.name}
                    </span>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {goal.target_date ? `Target: ${formatDisplayDate(goal.target_date)}` : 'No target date'}
                    </div>
                  </div>
                  <StatusPill
                    tone={tone}
                    label={isCompleted ? 'Completed' : goal.progress_status.replace('_', ' ')}
                  />
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">Progress</span>
                    <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {privacyMode ? '•••' : `${progress.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      style={{ width: `${progress}%` }}
                      className={['h-full rounded-full transition-all duration-500', barColor].join(' ')}
                    />
                  </div>
                </div>

                {/* Amount figures */}
                <div className="mt-3.5 flex items-center justify-between border-t border-slate-200/60 pt-3 text-xs dark:border-slate-700/50">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Saved</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(goal.current_amount))} mask="••••" hideColor />
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-slate-400">Target</div>
                    <div className="font-mono font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(goal.target_amount))} mask="••••" hideColor />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ROW 5: PERFORMANCE CHART & ASSET COMPOSITION / TOP MOVERS ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Performance Chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
          {portfolioError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {portfolioError}
            </div>
          ) : (
            <PortfolioPerformanceChart
              data={portfolioPerformance}
              range={activeFilter}
              onRangeChange={setActiveFilter}
              privacyMode={privacyMode}
              loading={portfolioLoading}
              onSaveSnapshot={handleSaveTodaySnapshot}
              savingSnapshot={savingSnapshot}
              title="Portfolio Performance"
              description={portfolioHasSnapshots ? 'Broker-style valuation trend from saved snapshots.' : null}
              variant="compact"
            />
          )}
        </div>

        {/* Composition & Top Movers Tabbed Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
          {/* Segmented Control */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80">
              <button
                type="button"
                onClick={() => setCompositionTab('buckets')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  compositionTab === 'buckets'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                ].join(' ')}
              >
                Asset Breakdown
              </button>
              <button
                type="button"
                onClick={() => setCompositionTab('holdings')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  compositionTab === 'holdings'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                ].join(' ')}
              >
                Top Holdings
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {compositionTab === 'buckets' ? `${allocationData.length} buckets` : `${topHoldings.length} positions`}
            </span>
          </div>

          {/* TAB 1: Asset Breakdown */}
          {compositionTab === 'buckets' && (
            <div className="mt-5 space-y-4">
              {allocationData.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => setSelectedBucketKey(entry.key)}
                  className="flex w-full items-center gap-3 text-left transition-opacity hover:opacity-85"
                >
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-sm font-medium tracking-[-0.01em] text-slate-700 dark:text-slate-300">
                      {entry.label}
                    </span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      style={{ width: `${Math.max(entry.percentage, 0)}%`, backgroundColor: entry.color }}
                      className="h-full rounded-full transition-all duration-500"
                    />
                  </div>
                  <div className="w-16 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-200">
                    {privacyMode ? '•••' : `${entry.percentage.toFixed(0)}%`}
                  </div>
                </button>
              ))}

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                <div>
                  <div className={LABEL}>Total Equity Share</div>
                  <div className="mt-0.5 font-mono text-base font-bold text-slate-900 dark:text-white">
                    <PrivateValue value={formatPct(equityExposurePct)} mask="••••" hideColor />
                  </div>
                </div>
                <div className="text-right">
                  <div className={LABEL}>Diversification Score</div>
                  <div className="mt-0.5 text-sm font-bold text-emerald-500">Balanced (Healthy)</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Top Holdings */}
          {compositionTab === 'holdings' && (
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              {topHoldings.length > 0 ? (
                topHoldings.map((holding) => (
                  <div key={holding.symbol} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900 dark:text-white text-sm">
                          {holding.symbol}
                        </span>
                        {holding.return_pct != null && (
                          <span
                            className={[
                              'font-mono text-xs font-bold tabular-nums',
                              getTrendClass(toNumber(holding.return_pct)),
                            ].join(' ')}
                          >
                            {privacyMode ? '•••' : formatSignedPct(toNumber(holding.return_pct))}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-slate-400">{holding.name}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(holding.value))} mask="••••" hideColor />
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {privacyMode ? '•••' : `${toNumber(holding.percentage_of_portfolio).toFixed(1)}% of assets`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-slate-400">No holdings found.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 6: ACCOUNTS + UPCOMING PAYMENTS + SMART ADVISORY ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {/* Accounts & Cash Reserves */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className={LABEL}>Bank Accounts</span>
                <div className="mt-0.5 text-xs text-slate-400">Liquid cash balances</div>
              </div>
              <button
                type="button"
                onClick={onOpenBanks}
                className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
              >
                View Banks
              </button>
            </div>

            <div className="mt-3.5 divide-y divide-slate-100 dark:divide-slate-800">
              {bankAccounts.length > 0 ? (
                bankAccounts.map((account) => {
                  const balance = toNumber(account.balance)
                  const shareOfCash = totalBankCash > 0 ? (balance / totalBankCash) * 100 : 0
                  return (
                    <div key={account.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {account.bank_name}
                          </div>
                          <div className="text-xs text-slate-400">{account.account_type}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            <PrivateValue value={formatMoney(balance)} mask="••••" hideColor />
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {privacyMode ? '•••' : `${shareOfCash.toFixed(1)}% of cash`}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div style={{ width: `${shareOfCash}%` }} className="h-full rounded-full bg-orange-400" />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No bank accounts added.</div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">Total Liquid Reserves</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">
              <PrivateValue value={formatMoney(totalBankCash)} mask="••••" hideColor />
            </span>
          </div>
        </div>

        {/* Credit Cards & Upcoming Dues */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className={LABEL}>Credit Cards</span>
                <div className="mt-0.5 text-xs text-slate-400">Bills & limit utilization</div>
              </div>
              <button
                type="button"
                onClick={onOpenCards}
                className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
              >
                View Cards
              </button>
            </div>

            <div className="mt-3.5 divide-y divide-slate-100 dark:divide-slate-800">
              {creditCards.length > 0 ? (
                creditCards.map((card) => {
                  const bill = toNumber(card.current_bill_amount)
                  const limit = toNumber(card.total_limit)
                  const util = limit > 0 ? (toNumber(card.used_amount) / limit) * 100 : 0
                  const daysInfo = getDaysUntil(card.due_date)

                  return (
                    <div key={card.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {card.card_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {card.bank_name} ••{card.last4} · {card.status === 'paid' ? 'Paid' : daysInfo.label}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            <PrivateValue value={formatMoney(bill)} mask="••••" hideColor />
                          </div>
                          <StatusPill
                            tone={card.status === 'paid' ? 'emerald' : card.status === 'overdue' ? 'rose' : 'amber'}
                            label={card.status === 'paid' ? 'Paid' : card.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                          />
                        </div>
                      </div>
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          style={{ width: `${Math.min(util, 100)}%` }}
                          className={['h-full rounded-full', util > 50 ? 'bg-rose-500' : 'bg-teal-500'].join(' ')}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">No credit cards added.</div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">Total Dues Payable</span>
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
              <PrivateValue value={formatMoney(totalLiabilities)} mask="••••" hideColor />
            </span>
          </div>
        </div>

        {/* Smart Financial Intelligence & Advisory */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <span className={LABEL}>Financial Intelligence</span>
                <div className="mt-0.5 text-xs text-slate-400">Automated wealth signals</div>
              </div>
              <button
                type="button"
                onClick={onOpenAnalytics}
                className="text-xs font-semibold text-purple-600 hover:underline dark:text-purple-400"
              >
                Full Analytics
              </button>
            </div>

            <div className="mt-3.5 space-y-3">
              {smartInsights.length > 0 ? (
                smartInsights.map((insight, idx) => {
                  const borderTone =
                    insight.tone === 'rose'
                      ? 'border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/10'
                      : insight.tone === 'amber'
                        ? 'border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/10'
                        : insight.tone === 'emerald'
                          ? 'border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/10'
                          : 'border-sky-500/20 bg-sky-50/50 dark:bg-sky-500/10'

                  const iconCol =
                    insight.tone === 'rose'
                      ? 'text-rose-500'
                      : insight.tone === 'amber'
                        ? 'text-amber-500'
                        : insight.tone === 'emerald'
                          ? 'text-emerald-500'
                          : 'text-sky-500'

                  return (
                    <div key={idx} className={['rounded-2xl border p-3', borderTone].join(' ')}>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={insight.tone === 'rose' ? 'warning' : insight.tone === 'amber' ? 'alert' : 'stocks'}
                          className={['h-3.5 w-3.5 shrink-0', iconCol].join(' ')}
                        />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{insight.title}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {maskSensitiveText(insight.text, privacyMode, '••••')}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">Signals updating...</div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
            <span className="text-slate-500">Overall Financial Posture</span>
            <span className="font-semibold text-emerald-500">Prime & Balanced</span>
          </div>
        </div>
      </div>
    </div>
  )
}
