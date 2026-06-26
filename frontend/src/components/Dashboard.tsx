import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon } from './Icon'
import PortfolioPerformanceChart from './ui/PortfolioPerformanceChart'
import PrivateValue from './ui/PrivateValue'
import WealthBucketModal from './ui/WealthBucketModal'
import { ApiError, apiFetch, type BankAccount, type FinancialGoal, type FinancialGoalSummary, type PortfolioPerformanceData, type PortfolioRange, type WealthBucketItem } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { maskSensitiveText } from '../utils/privacy'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useBankAccountsQuery, useCreditCardsQuery, useDashboardSummaryQuery, useHoldingsQuery, usePortfolioPerformanceQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'

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
  statusTone: 'emerald' | 'amber' | 'rose' | 'slate'
  subtitle: string
}

type InsightItem = {
  tone: 'emerald' | 'amber' | 'rose' | 'slate'
  text: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const assetTypePalette: Record<string, { label: string; color: string }> = {
  ind_stocks: { label: 'IND Stocks', color: '#14b8a6' },
  us_stocks: { label: 'US Stocks', color: '#38bdf8' },
  mutual_funds: { label: 'Mutual Funds', color: '#a78bfa' },
  banks: { label: 'Banks', color: '#f97316' },
  epf: { label: 'EPF', color: '#22c55e' },
  liabilities: { label: 'Liabilities', color: '#fb7185' },
  other: { label: 'Other Assets', color: '#64748b' },
}

const LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatMoney(value: number) {
  if (Math.abs(value) >= 100000) return formatINRShort(value)
  return formatINR(value)
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors.map(item => `${item.path ? `${item.path}: ` : ''}${item.message}`).join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatShortDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function formatCompactDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function isGoldHolding(holding: ApiHolding) {
  const text = `${holding.symbol} ${holding.company_name} ${holding.sector ?? ''} ${holding.notes ?? ''} ${holding.exchange_symbol ?? ''}`.toLowerCase()
  return holding.asset_type === 'gold' || (holding.asset_type === 'other' && text.includes('gold')) || (holding.asset_type === 'etf' && text.includes('gold'))
}

function getAssetTypeMeta(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  return assetTypePalette[normalized] ?? assetTypePalette.other
}

function getCardTone(status: ApiCreditCard['status']): 'emerald' | 'amber' | 'rose' {
  if (status === 'paid') return 'emerald'
  if (status === 'due_soon') return 'amber'
  return 'rose'
}

function buildAllocationData(summary: ApiDashboardSummary | null, holdings: ApiHolding[]) {
  if (summary?.allocations && summary.allocations.length > 0) {
    return summary.allocations.map(entry => {
      const meta = getAssetTypeMeta(entry.asset_type)
      return { key: entry.asset_type, label: entry.label || meta.label, value: toNumber(entry.amount), percentage: toNumber(entry.percentage), color: meta.color, items: entry.items ?? [] }
    })
  }
  const totals = holdings.reduce<Record<string, { label: string; value: number; color: string }>>((acc, h) => {
    const key = h.country === 'US' ? 'us_stocks' : h.asset_type === 'mutual_fund' ? 'mutual_funds' : h.country === 'IN' && (['stock', 'etf', 'gold'].includes(h.asset_type) || isGoldHolding(h)) ? 'ind_stocks' : 'other'
    const meta = getAssetTypeMeta(key)
    acc[key] = { label: meta.label, value: (acc[key]?.value ?? 0) + toNumber(h.current_value), color: meta.color }
    return acc
  }, {})
  const totalValue = Object.values(totals).reduce((acc, item) => acc + item.value, 0)
  return Object.entries(totals).map(([key, item]) => ({ key, label: item.label, value: item.value, percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0, color: item.color, items: [] as WealthBucketItem[] }))
}

function buildActionItems(cards: ApiCreditCard[], summary: ApiDashboardSummary | null, performance: PortfolioPerformanceData | null): ActionItem[] {
  const urgentCards = [...cards]
    .filter(c => c.status !== 'paid')
    .sort((a, b) => ({ overdue: 0, due_soon: 1, paid: 2 } as const)[a.status] - ({ overdue: 0, due_soon: 1, paid: 2 } as const)[b.status])
    .slice(0, 3)
  const items: ActionItem[] = urgentCards.map(card => ({
    title: card.card_name,
    amount: formatMoney(toNumber(card.current_bill_amount)),
    statusLabel: card.status === 'overdue' ? 'Overdue' : 'Due Soon',
    statusTone: card.status === 'overdue' ? 'rose' : 'amber',
    subtitle: `${card.bank_name} ••${card.last4} · Due ${formatDisplayDate(card.due_date)}`,
  }))
  if (items.length === 0) {
    items.push({
      title: 'All clear',
      amount: 'No urgent dues',
      statusLabel: 'All good',
      statusTone: 'emerald',
      subtitle: (performance?.summary.snapshot_count ?? 0) > 0 && summary ? `Portfolio value ${formatMoney(toNumber(summary.current_value))} with no overdue cards.` : 'No overdue cards and no urgent portfolio alerts.',
    })
  }
  return items
}

function buildUpcomingPayments(cards: ApiCreditCard[]) {
  return [...cards]
    .filter(c => c.status !== 'paid')
    .sort((a, b) => ({ overdue: 0, due_soon: 1, paid: 2 } as const)[a.status] - ({ overdue: 0, due_soon: 1, paid: 2 } as const)[b.status])
    .slice(0, 5)
}

function buildInsights(summary: ApiDashboardSummary | null, holdings: ApiHolding[], cards: ApiCreditCard[], performance: PortfolioPerformanceData | null): InsightItem[] {
  const insights: InsightItem[] = []
  const allocation = buildAllocationData(summary, holdings)
  const topAllocation = allocation
    .filter(e => e.key === 'ind_stocks' || e.key === 'us_stocks' || e.key === 'mutual_funds')
    .sort((a, b) => b.percentage - a.percentage)[0]
  if (topAllocation && topAllocation.percentage >= 35) {
    insights.push({ tone: 'amber', text: `${topAllocation.label} are concentrated at ${topAllocation.percentage.toFixed(1)}% of holdings. Consider diversifying when you add new positions.` })
  }
  const urgentCards = cards.filter(c => c.status !== 'paid')
  if (urgentCards.length > 0) {
    const topUrgent = urgentCards.sort((a, b) => toNumber(b.current_bill_amount) - toNumber(a.current_bill_amount))[0]
    insights.push({ tone: topUrgent.status === 'overdue' ? 'rose' : 'amber', text: `${topUrgent.card_name} bill of ${formatMoney(toNumber(topUrgent.current_bill_amount))} is ${topUrgent.status === 'overdue' ? 'overdue' : 'due soon'}.` })
  }
  const latestReturn = performance?.summary.change_pct
  if (latestReturn !== undefined && latestReturn !== null) {
    const n = toNumber(latestReturn)
    if (n !== 0) insights.push({ tone: n > 0 ? 'emerald' : 'rose', text: `Portfolio return is ${formatSignedPct(n)} on the latest snapshot.` })
  }
  return insights.slice(0, 3)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ tone, label }: { tone: 'emerald' | 'amber' | 'rose' | 'slate'; label: string }) {
  const cls = tone === 'rose' ? 'bg-rose-500/15 text-rose-400' : tone === 'amber' ? 'bg-amber-500/15 text-amber-400' : tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
  const dotCls = tone === 'rose' ? 'bg-rose-400' : tone === 'amber' ? 'bg-amber-400' : tone === 'emerald' ? 'bg-emerald-400' : 'bg-slate-400'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
      {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard({
  onOpenStocks,
  onOpenCards,
  onOpenGoals,
}: {
  onOpenStocks?: () => void
  onOpenCards?: () => void
  onOpenGoals?: () => void
} = {}) {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()
  const [activeFilter, setActiveFilter] = useState<PortfolioRange>('6M')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null)
  const summaryQuery = useDashboardSummaryQuery()
  const holdingsQuery = useHoldingsQuery()
  const cardsQuery = useCreditCardsQuery()
  const bankAccountsQuery = useBankAccountsQuery()
  const portfolioPerformanceQuery = usePortfolioPerformanceQuery(activeFilter)
  const summary = (summaryQuery.data ?? null) as ApiDashboardSummary | null
  const holdings = (holdingsQuery.data ?? []) as ApiHolding[]
  const creditCards = (cardsQuery.data ?? []) as ApiCreditCard[]
  const bankAccounts = (bankAccountsQuery.data ?? []) as BankAccount[]
  const portfolioPerformance = (portfolioPerformanceQuery.data ?? null) as PortfolioPerformanceData | null
  const summaryLoading = summaryQuery.isLoading
  const holdingsLoading = holdingsQuery.isLoading
  const cardsLoading = cardsQuery.isLoading
  const bankAccountsLoading = bankAccountsQuery.isLoading
  const portfolioLoading = portfolioPerformanceQuery.isLoading
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null
  const holdingsError = holdingsQuery.error ? formatApiError(holdingsQuery.error) : null
  const cardsError = cardsQuery.error ? formatApiError(cardsQuery.error) : null
  const bankAccountsError = bankAccountsQuery.error ? formatApiError(bankAccountsQuery.error) : null
  const portfolioError = portfolioPerformanceQuery.error ? formatApiError(portfolioPerformanceQuery.error) : null

  const allocationData = useMemo(() => buildAllocationData(summary, holdings), [holdings, summary])
  const equityExposurePct = useMemo(() => allocationData.reduce((acc, e) => e.key === 'ind_stocks' || e.key === 'us_stocks' ? acc + e.percentage : acc, 0), [allocationData])
  const usStocksValue = useMemo(() => holdings.reduce((acc, h) => h.country === 'US' ? acc + toNumber(h.current_value) : acc, 0), [holdings])
  const liveUsdInrRate = useMemo(() => {
    const firstUsHolding = holdings.find((holding) => holding.country === 'US')
    return firstUsHolding ? toNumber(firstUsHolding.effective_fx_rate_to_inr) : 0
  }, [holdings])
  const actionItems = useMemo(() => buildActionItems(creditCards, summary, portfolioPerformance), [creditCards, portfolioPerformance, summary])
  const upcomingPayments = useMemo(() => buildUpcomingPayments(creditCards), [creditCards])
  const insights = useMemo(() => buildInsights(summary, holdings, creditCards, portfolioPerformance), [creditCards, holdings, portfolioPerformance, summary])
  const selectedBucket = useMemo(() => allocationData.find((entry) => entry.key === selectedBucketKey) ?? null, [allocationData, selectedBucketKey])

  const latestHoldingUpdate = useMemo(() => {
    const timestamps = holdings.map(h => h.updated_at)
      .concat(holdings.map(h => h.last_price_refreshed_at).filter(Boolean) as string[])
      .concat(creditCards.map(c => c.updated_at))
      .concat(bankAccounts.map(a => a.updated_at))
      .filter(Boolean)
    if (timestamps.length === 0) return null
    return timestamps.map(v => new Date(v)).filter(d => !Number.isNaN(d.getTime())).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  }, [bankAccounts, creditCards, holdings])

  const latestSnapshotReturn = portfolioPerformance?.summary.change_pct
  const netWorth = toNumber(summary?.net_worth)
  const cashflowMetrics = summary?.cashflow_metrics
  const currentCashflow = cashflowMetrics?.current
  const averageCashflow = cashflowMetrics?.average
  const monthlyHasData = Boolean(currentCashflow?.has_data)
  const averageCashflowHasData = Boolean(averageCashflow?.has_data)
  const trackedMonthsCount = averageCashflow?.months_count ?? 0
  const goalsSummary = summary?.goals_summary
  const topGoals = summary?.top_goals ?? []
  const formatCashflowCurrentValue = (value: number | null, kind: 'money' | 'pct') => {
    if (!monthlyHasData || value === null) return 'Not added'
    const displayValue = kind === 'money' ? formatMoney(value) : formatPct(value)
    return <PrivateValue value={displayValue} mask="••••" hideColor />
  }
  const formatCashflowAverageMeta = (value: number | null, kind: 'money' | 'pct') => {
    if (!averageCashflowHasData || value === null) return 'Avg not available'
    const displayValue = kind === 'money' ? `${formatMoney(value)}/mo` : formatPct(value)
    return privacyMode ? `Avg ${maskSensitiveText(displayValue, true)}` : `Avg ${displayValue}`
  }
  const portfolioHasSnapshots = (portfolioPerformance?.summary.snapshot_count ?? 0) > 0

  // Suppress unused variable warnings for errors not displayed in new layout
  void holdingsError
  void holdingsLoading
  void cardsError
  void bankAccountsError
  void summaryError
  void onOpenStocks
  void onOpenCards

  async function handleSaveTodaySnapshot() {
    setSavingSnapshot(true)
    setStatusMessage(null)
    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage("Saved today's snapshot.")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setSavingSnapshot(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 w-full space-y-4 sm:space-y-5">
      <WealthBucketModal bucket={selectedBucket} onClose={() => setSelectedBucketKey(null)} />

      {/* Toast banner */}
      {statusMessage ? (
        <div className={[
          'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
          statusTone === 'emerald' ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' :
          statusTone === 'rose' ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200' :
          statusTone === 'amber' ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100' :
          'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
        ].join(' ')}>
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── Prices bar ── */}
      <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 md:flex">
        <Icon name="refresh" className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="text-sm text-slate-500 dark:text-slate-400">Prices last updated</span>
        {latestHoldingUpdate ? (
          <span className="truncate max-w-35 sm:max-w-none text-sm font-semibold text-slate-900 dark:text-white">
            {formatShortDateTime(latestHoldingUpdate)}
          </span>
        ) : (
          <span className="text-sm text-slate-400">Not available</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
        </div>
      </div>

      {/* ── Row 1: Net Worth + Action Center ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">

        {/* Net Worth card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-6">
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">

            {/* NET WORTH */}
            <div>
              <div className={LABEL}>Net Worth</div>
              <div className="mt-2.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(netWorth)} mask="••••" hideColor />}
              </div>
              {portfolioHasSnapshots ? (
                <div className={['mt-1.5 text-xs font-semibold', privacyMode ? 'text-slate-400 dark:text-slate-400' : getTrendClass(toNumber(latestSnapshotReturn ?? 0))].join(' ')}>
                  {privacyMode ? 'Portfolio hidden' : `${toNumber(latestSnapshotReturn ?? 0) >= 0 ? '↑' : '↓'} ${formatPct(Math.abs(toNumber(latestSnapshotReturn ?? 0)))}`}
                </div>
              ) : (
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">No snapshot</div>
              )}
            </div>

            {/* ASSETS */}
            <div>
              <div className={LABEL}>Assets</div>
              <div className="mt-2.5 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_assets))} mask="••••" hideColor />}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-500">
                {summary ? `${summary.holdings_count + summary.bank_accounts_count + summary.fixed_savings_accounts_count} accounts` : '—'}
              </div>
            </div>

            {/* LIABILITIES */}
            <div>
              <div className={LABEL}>Liabilities</div>
              <div className={['mt-2.5 font-mono text-xl font-bold tabular-nums', privacyMode ? 'text-slate-400 dark:text-slate-400' : toNumber(summary?.total_liabilities) > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-white'].join(' ')}>
                {summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_liabilities))} mask="••••" hideColor />}
              </div>
              <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-500">
                {summary ? `${creditCards.length} cards` : '—'}
              </div>
            </div>

            {/* LAST UPDATED */}
            <div>
              <div className={LABEL}>Last Updated</div>
              <div className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">
                {latestHoldingUpdate ? formatCompactDateTime(latestHoldingUpdate) : '—'}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-xs text-emerald-500 dark:text-emerald-400">Live</span>
              </div>
            </div>
          </div>

          {/* Composition bar */}
          <div className="mt-6">
            {allocationData.length > 0 ? (
              <>
                <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  {allocationData.map(entry => (
                    <button key={entry.key} type="button" onClick={() => setSelectedBucketKey(entry.key)} style={{ width: `${Math.max(entry.percentage, 0)}%`, backgroundColor: entry.color }} className="h-full transition-opacity hover:opacity-85" aria-label={`View ${entry.label} details`} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {allocationData.map(entry => (
                    <button key={entry.key} type="button" onClick={() => setSelectedBucketKey(entry.key)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-opacity hover:opacity-80 dark:text-slate-400">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      {entry.label} {privacyMode ? '•••' : `${entry.percentage.toFixed(1)}%`}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
            )}
          </div>
        </div>

        {/* Action Center */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-6">
          <div className={LABEL}>Action Center</div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {actionItems.map((item, i) => (
              <div key={`${item.title}-${i}`} className="flex items-start justify-between gap-3 py-3.5 first:pt-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate">{item.title}</div>
                  <div className={[
                    'mt-0.5 text-xs font-medium',
                    item.statusTone === 'rose' ? 'text-rose-500 dark:text-rose-400' :
                    item.statusTone === 'amber' ? 'text-amber-500 dark:text-amber-400' :
                    item.statusTone === 'emerald' ? 'text-emerald-500 dark:text-emerald-400' :
                    'text-slate-500 dark:text-slate-400',
                  ].join(' ')}>
                    {item.statusLabel}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    <PrivateValue value={item.amount} mask="••••" hideColor />
                  </div>
                  <div className="mt-1.5">
                    <StatusPill tone={item.statusTone} label={item.statusLabel} />
                  </div>
                </div>
              </div>
            ))}

            {/* Portfolio insight row */}
            {portfolioHasSnapshots ? (
              <div className="flex items-start justify-between gap-3 pt-3.5 pb-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-200">
                    {privacyMode ? 'Portfolio snapshot hidden' : `Portfolio ${toNumber(latestSnapshotReturn ?? 0) >= 0 ? 'up' : 'down'} ${formatPct(Math.abs(toNumber(latestSnapshotReturn ?? 0)))}`}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">From latest snapshot</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    <PrivateValue value={formatSignedPct(toNumber(latestSnapshotReturn ?? 0))} mask="••••" hideColor />
                  </div>
                  <div className="mt-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      Info
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Row 2: 6 stat mini-cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">

        {/* Portfolio Value */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
          <div className={LABEL}>Portfolio Value</div>
          <div className="mt-2.5 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.current_value))} mask="••••" hideColor />}
          </div>
          <div className="mt-3 grid h-7 w-7 place-items-center rounded-lg bg-teal-500/15">
            <Icon name="stocks" className="h-3.5 w-3.5 text-teal-400" />
          </div>
        </div>

        {/* Bank Balance */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
          <div className={LABEL}>Bank Balance</div>
          <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', toNumber(summary?.total_bank_cash) > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'].join(' ')}>
            {summaryLoading ? '—' : toNumber(summary?.total_bank_cash) > 0 ? <PrivateValue value={formatMoney(toNumber(summary?.total_bank_cash))} mask="••••" hideColor /> : 'Not added'}
          </div>
          <div className="mt-3 grid h-7 w-7 place-items-center rounded-lg bg-orange-500/15">
            <Icon name="banks" className="h-3.5 w-3.5 text-orange-400" />
          </div>
        </div>

        {/* PF / EPF */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
          <div className={LABEL}>PF / EPF</div>
          <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', toNumber(summary?.total_fixed_savings_value) > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'].join(' ')}>
            {summaryLoading ? '—' : toNumber(summary?.total_fixed_savings_value) > 0 ? <PrivateValue value={formatMoney(toNumber(summary?.total_fixed_savings_value))} mask="••••" hideColor /> : 'Not added'}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {summaryLoading ? 'Loading...' : toNumber(summary?.total_fixed_savings_value) > 0 ? `${summary?.fixed_savings_accounts_count ?? 0} accounts` : 'No PF / PPF accounts'}
          </div>
          <div className="mt-3 grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/15">
            <Icon name="pfepf" className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        </div>

        {/* US Stocks */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
          <div className={LABEL}>US Stocks</div>
          <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', usStocksValue > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'].join(' ')}>
            {usStocksValue > 0 ? <PrivateValue value={formatMoney(usStocksValue)} mask="••••" hideColor /> : 'Not added'}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {usStocksValue > 0 && liveUsdInrRate > 0 ? (privacyMode ? 'Live USD/INR ••••' : `Live USD/INR ${liveUsdInrRate.toFixed(2)}`) : 'No US holdings'}
          </div>
          <div className="mt-3 grid h-7 w-7 place-items-center rounded-lg bg-sky-500/15">
            <Icon name="portfolio" className="h-3.5 w-3.5 text-sky-400" />
          </div>
        </div>

        {/* Card Dues — rose tinted */}
        <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-rose-500/80 dark:text-rose-400/70">Card Dues</div>
          <div className="mt-2.5 font-mono text-lg font-bold tabular-nums text-rose-700 dark:text-rose-400">
            {summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_credit_card_dues))} mask="••••" hideColor />}
          </div>
          <div className="mt-3 grid h-7 w-7 place-items-center rounded-lg bg-rose-500/20">
            <Icon name="cards" className="h-3.5 w-3.5 text-rose-400" />
          </div>
        </div>

      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={LABEL}>Monthly Cashflow</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {summaryLoading
                ? 'Loading cashflow...'
                : trackedMonthsCount > 0
                  ? `Based on ${trackedMonthsCount} tracked month${trackedMonthsCount === 1 ? '' : 's'}`
                  : 'Add monthly cashflow to unlock this card'}
            </div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500 dark:text-cyan-400">
            <Icon name="transactions" className="h-4 w-4" />
          </div>
        </div>

        {summaryLoading ? (
          <div className="mt-4 text-sm text-slate-400">Loading cashflow...</div>
        ) : !monthlyHasData && !averageCashflowHasData ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="text-sm text-slate-500 dark:text-slate-400">No monthly cashflow added yet</div>
            <button
              type="button"
              className="text-sm font-medium text-accent-600 transition-colors hover:text-accent-500 dark:text-accent-400 dark:hover:text-accent-300"
            >
              Add from Transactions
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-700/70 dark:bg-slate-800/40">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <div className="px-4 py-3 sm:px-4 sm:py-3">
                <div className={LABEL}>Income</div>
                <div className={['mt-1.5 font-mono text-base font-bold tabular-nums sm:text-lg', monthlyHasData ? (privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-emerald-500 dark:text-emerald-400') : 'text-slate-400 dark:text-slate-500'].join(' ')}>
                  {formatCashflowCurrentValue(toNumber(currentCashflow?.income), 'money')}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {formatCashflowAverageMeta(averageCashflowHasData ? toNumber(averageCashflow?.income) : null, 'money')}
                </div>
              </div>

              <div className="border-l border-slate-200 dark:border-slate-700 px-4 py-3">
                <div className={LABEL}>Spend</div>
                <div className={['mt-1.5 font-mono text-base font-bold tabular-nums sm:text-lg', monthlyHasData ? (privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-500 dark:text-rose-400') : 'text-slate-400 dark:text-slate-500'].join(' ')}>
                  {formatCashflowCurrentValue(toNumber(currentCashflow?.expense), 'money')}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {formatCashflowAverageMeta(averageCashflowHasData ? toNumber(averageCashflow?.expense) : null, 'money')}
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 sm:border-t-0 sm:border-l px-4 py-3">
                <div className={LABEL}>Net Savings</div>
                <div className={['mt-1.5 font-mono text-base font-bold tabular-nums sm:text-lg', !monthlyHasData ? 'text-slate-400 dark:text-slate-500' : privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(currentCashflow?.net_savings))].join(' ')}>
                  {formatCashflowCurrentValue(toNumber(currentCashflow?.net_savings), 'money')}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {formatCashflowAverageMeta(averageCashflowHasData ? toNumber(averageCashflow?.net_savings) : null, 'money')}
                </div>
              </div>

              <div className="border-l border-t border-slate-200 dark:border-slate-700 sm:border-t-0 px-4 py-3">
                <div className={LABEL}>Savings Rate</div>
                <div className={['mt-1.5 font-mono text-base font-bold tabular-nums sm:text-lg', !monthlyHasData || currentCashflow?.savings_rate == null ? 'text-slate-400 dark:text-slate-500' : privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(currentCashflow?.savings_rate))].join(' ')}>
                  {formatCashflowCurrentValue(currentCashflow?.savings_rate == null ? null : toNumber(currentCashflow.savings_rate), 'pct')}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {formatCashflowAverageMeta(averageCashflowHasData && averageCashflow?.savings_rate != null ? toNumber(averageCashflow.savings_rate) : null, 'pct')}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={LABEL}>Goals</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {summaryLoading
                ? 'Loading goals...'
                : (goalsSummary?.active_goals_count ?? 0) > 0
                  ? `${goalsSummary?.active_goals_count ?? 0} active goal${goalsSummary?.active_goals_count === 1 ? '' : 's'}`
                  : 'Add personal goals to track funding progress'}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenGoals}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
          >
            <Icon name="portfolio" className="h-4 w-4" />
            View Goals
          </button>
        </div>

        {summaryLoading ? (
          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">Loading goals...</div>
        ) : !topGoals.length ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-400">
            No financial goals added yet.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {topGoals.map((goal) => (
              <div key={goal.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{goal.name}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{goal.status.replace('_', ' ')} · {goal.target_date ? formatDisplayDate(goal.target_date) : 'No target date'}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    <PrivateValue value={formatPct(toNumber(goal.progress_pct))} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <PrivateValue value={formatMoney(toNumber(goal.shortfall_amount))} mask="••••" hideColor />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 3: Performance chart + Composition ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">

        {/* Performance chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-6">
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
              title="Performance"
              description={portfolioHasSnapshots ? 'Broker-style trend from saved portfolio snapshots.' : null}
              variant="compact"
            />
          )}
        </div>

        {/* Composition */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-6">
          <div className={LABEL}>Composition</div>

          {allocationData.length > 0 ? (
            <div className="mt-5 space-y-4">
              {allocationData.map(entry => (
                <button key={entry.key} type="button" onClick={() => setSelectedBucketKey(entry.key)} className="flex w-full items-center gap-3 text-left transition-opacity hover:opacity-85">
                  <div className="flex w-28 shrink-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-sm text-slate-600 dark:text-slate-300">{entry.label}</span>
                  </div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      style={{ width: `${Math.max(entry.percentage, 0)}%`, backgroundColor: entry.color }}
                      className="h-full rounded-full transition-all duration-500"
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-200">
                    {entry.percentage.toFixed(0)}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 py-8 text-center text-sm text-slate-400">Add holdings to see allocation.</div>
          )}

          {allocationData.length > 0 ? (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <div>
                <div className={LABEL}>Equity</div>
                <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                  <PrivateValue value={formatPct(equityExposurePct)} mask="••••" hideColor />
                </div>
              </div>
              <div className="text-right">
                <div className={LABEL}>Diversification</div>
                <div className="mt-0.5 text-sm font-semibold text-emerald-500">Balanced</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Row 4: Accounts + Upcoming Payments + Insights ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">

        {/* Accounts */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-5">
          <div className={LABEL}>Accounts</div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {bankAccountsLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading accounts…</div>
            ) : bankAccounts.length > 0 ? (
              bankAccounts.map(account => (
                <div key={account.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{account.bank_name}</div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{account.account_type}</div>
                </div>
                <div className="shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                    <PrivateValue value={formatMoney(toNumber(account.balance))} mask="••••" hideColor />
                </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">No bank accounts added yet.</div>
            )}
          </div>
        </div>

        {/* Upcoming Payments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-5">
          <div className={LABEL}>Upcoming Payments</div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {cardsLoading ? (
              <div className="py-8 text-center text-sm text-slate-400">Loading payments…</div>
            ) : upcomingPayments.length > 0 ? (
              upcomingPayments.map(card => {
                const tone = getCardTone(card.status)
                return (
                  <div key={card.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-200">{card.card_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-500">{formatDisplayDate(card.due_date)}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(card.current_bill_amount))} mask="••••" hideColor />
                      </span>
                      <StatusPill tone={tone} label={card.status === 'overdue' ? 'Overdue' : 'Due Soon'} />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">No upcoming payments.</div>
            )}
          </div>
        </div>

        {/* Insights */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 sm:p-5">
          <div className={LABEL}>Insights</div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {insights.length > 0 ? (
              insights.map((insight, i) => (
                <div key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={[
                    'mt-0.5 shrink-0',
                    insight.tone === 'amber' ? 'text-amber-400' :
                    insight.tone === 'rose' ? 'text-rose-400' :
                    'text-emerald-400',
                  ].join(' ')}>
                    <Icon name={insight.tone === 'amber' || insight.tone === 'rose' ? 'warning' : 'stocks'} className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{maskSensitiveText(insight.text, privacyMode, '••••')}</p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-sm text-slate-400">Add holdings and cards to see insights.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
