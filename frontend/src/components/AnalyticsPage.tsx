import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type {
  AnalyticsCategoryAverageItem,
  AnalyticsSummary,
  PortfolioIntelligence,
  PortfolioPerformanceData,
  PortfolioRange,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import {
  useAnalyticsSummaryQuery,
  useDashboardSummaryQuery,
  usePortfolioIntelligenceQuery,
  usePortfolioPerformanceQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { secondaryButtonClass } from '../styles/buttonStyles'
import { Icon, type IconName } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { computeSnapshotComparison, formatSnapshotDate } from '../utils/snapshotDelta'

// ─── Design Tokens ───────────────────────────────────────────────────────────
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'
const CARD_CONTAINER =
  'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6'
const INNER_TILE =
  'rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition-colors dark:border-slate-800/80 dark:bg-slate-800/40'

const CHART_PALETTE = ['#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#fb7185', '#fbbf24', '#34d399', '#94a3b8']
const RANGES: PortfolioRange[] = ['1M', '3M', '6M', '1Y', 'ALL']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isNaN(n) ? 0 : n
}

function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`
  return formatINR(amount)
}

function formatMonthLabel(val: string): string {
  if (!val) return ''
  const date = new Date(`${val}-01T00:00:00`)
  return Number.isNaN(date.getTime())
    ? val
    : new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
}

function formatDateLabel(val: string): string {
  if (!val) return ''
  const clean = String(val).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d)
  }
  return val
}

// ─── Custom Dark Tooltip ──────────────────────────────────────────────────────
function CustomGlassTooltip({
  active,
  payload,
  label,
  privacyMode,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; fill?: string }>
  label?: string
  privacyMode: boolean
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="min-w-40 rounded-2xl border border-slate-700/80 bg-slate-950/95 p-3.5 shadow-2xl backdrop-blur-md">
      {label && <p className="mb-2 text-xs font-semibold text-slate-300">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item, idx) => {
          const itemColor = item.color || item.fill || '#2dd4bf'
          const val = toNumber(item.value)
          return (
            <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: itemColor }} />
                <span>{item.name || 'Value'}</span>
              </div>
              <span className="font-mono font-semibold text-white">
                {privacyMode ? '••••' : formatMoney(val)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyPlaceholder({ message, icon = 'analytics' }: { message: string; icon?: IconName }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<PortfolioRange>('6M')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Queries
  const intelligenceQuery = usePortfolioIntelligenceQuery()
  const analyticsQuery = useAnalyticsSummaryQuery()
  const dashboardQuery = useDashboardSummaryQuery()
  const performanceQuery = usePortfolioPerformanceQuery(range)
  const allPerformanceQuery = usePortfolioPerformanceQuery('ALL')

  const intelligence = intelligenceQuery.data as PortfolioIntelligence | undefined
  const analytics = analyticsQuery.data as AnalyticsSummary | undefined
  const performance = performanceQuery.data as PortfolioPerformanceData | undefined
  const dashboard = dashboardQuery.data

  const flow = analytics?.cashflow_analytics
  const investments = analytics?.investment_analytics
  const goals = analytics?.goals_analytics

  // Portfolio valuation and snapshot diff
  const latestValuation = toNumber(performance?.summary.latest_value ?? dashboard?.current_value ?? 0)
  const snapshotComparison = useMemo(() => {
    const snapshots = allPerformanceQuery.data?.snapshots ?? performance?.snapshots
    return computeSnapshotComparison(snapshots, latestValuation)
  }, [allPerformanceQuery.data?.snapshots, performance?.snapshots, latestValuation])

  // Portfolio growth snapshots
  const snapshotsChartData = useMemo(() => {
    return (performance?.snapshots ?? []).map((item) => ({
      date: formatDateLabel(item.date),
      rawDate: item.date,
      value: toNumber(item.total_value),
      netWorth: item.net_worth != null ? toNumber(item.net_worth) : undefined,
    }))
  }, [performance?.snapshots])

  // Cashflow timeline data
  const cashflowChartData = useMemo(() => {
    return (flow?.monthly_trend ?? []).map((item) => ({
      month: formatMonthLabel(item.month),
      rawMonth: item.month,
      income: toNumber(item.income),
      spend: toNumber(item.expense),
      savings: toNumber(item.net_savings),
      savingsRate: item.savings_rate != null ? toNumber(item.savings_rate) : null,
    }))
  }, [flow?.monthly_trend])

  // Average monthly metrics (User explicitly requested: average spends instead of month-to-month picking)
  const avgMonthlySpend = toNumber(flow?.average_monthly_summary?.expense)
  const avgMonthlyIncome = toNumber(flow?.average_monthly_summary?.income)
  const avgMonthlySavings = toNumber(flow?.average_monthly_summary?.net_savings)
  const avgSavingsRate = flow?.average_monthly_summary?.savings_rate != null ? toNumber(flow.average_monthly_summary.savings_rate) : null
  const cashBufferMonths = flow?.cash_buffer_months != null ? toNumber(flow.cash_buffer_months) : null

  // Average Expense Breakdown
  const avgExpenseCategories = useMemo(() => {
    return (flow?.average_expense_by_category ?? [])
      .filter((c) => toNumber(c.average_amount) > 0)
      .sort((a, b) => toNumber(b.average_amount) - toNumber(a.average_amount))
  }, [flow?.average_expense_by_category])

  const avgExpensePieData = useMemo(() => {
    return avgExpenseCategories.map((c) => ({
      name: c.category,
      value: toNumber(c.average_amount),
      percentage: c.percentage_of_avg_spend != null ? toNumber(c.percentage_of_avg_spend) : 0,
      monthsPresent: c.months_present,
    }))
  }, [avgExpenseCategories])

  // Average Income Breakdown
  const avgIncomeCategories = useMemo(() => {
    return (flow?.average_income_by_category ?? [])
      .filter((c) => toNumber(c.average_amount) > 0)
      .sort((a, b) => toNumber(b.average_amount) - toNumber(a.average_amount))
  }, [flow?.average_income_by_category])

  const avgIncomePieData = useMemo(() => {
    return avgIncomeCategories.map((c) => ({
      name: c.category,
      value: toNumber(c.average_amount),
      percentage: c.percentage_of_avg_income != null ? toNumber(c.percentage_of_avg_income) : 0,
      monthsPresent: c.months_present,
    }))
  }, [avgIncomeCategories])

  // Asset Allocation Pie
  const assetAllocationData = useMemo(() => {
    return (investments?.bucket_allocation ?? [])
      .filter((b) => toNumber(b.value) > 0)
      .map((b) => ({
        key: b.key,
        name: b.label,
        value: toNumber(b.value),
        percentage: toNumber(b.percentage),
        count: b.items_count,
      }))
  }, [investments?.bucket_allocation])

  // Goals status data
  const goalsPieData = useMemo(() => {
    const list = [
      { name: 'On Track', value: goals?.on_track_count ?? 0, color: '#34d399' },
      { name: 'Watch', value: goals?.watch_count ?? 0, color: '#fbbf24' },
      { name: 'Behind', value: goals?.behind_count ?? 0, color: '#fb7185' },
      { name: 'Completed', value: goals?.completed_count ?? 0, color: '#60a5fa' },
    ]
    return list.filter((item) => item.value > 0)
  }, [goals])

  // Credit Card Utilization
  const cardUtilization = Math.min(100, Math.max(0, toNumber(dashboard?.overall_card_utilization)))

  const rangeChangePct = performance?.summary.change_pct != null ? toNumber(performance.summary.change_pct) : null
  const rangeChangeAmt = performance?.summary.change_amount != null ? toNumber(performance.summary.change_amount) : null

  // Performance Strategic Narrative
  const performanceNarrative = useMemo(() => {
    if (rangeChangePct === null) {
      return 'Record portfolio snapshots regularly to track valuation growth and broker-style performance over time.'
    }
    if (rangeChangePct < 0) {
      const losers = intelligence?.top_movers?.biggest_losers?.slice(0, 2).map((m) => m.symbol).join(' & ')
      return `Portfolio is down ${formatPct(Math.abs(rangeChangePct))} over this ${range} timeframe.${losers ? ` Notable detractors: ${losers}.` : ''} Review underlying theses and cash buffers before adjusting allocations.`
    }
    const gainers = intelligence?.top_movers?.biggest_gainers?.slice(0, 2).map((m) => m.symbol).join(' & ')
    return `Portfolio gained ${formatPct(rangeChangePct)} over this ${range} timeframe.${gainers ? ` Key drivers: ${gainers}.` : ''} Maintain disciplined dollar-cost averaging into high-conviction assets.`
  }, [intelligence, range, rangeChangePct])

  // Manual refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolioIntelligence }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const hasAnyErrors = [
    intelligenceQuery.error,
    analyticsQuery.error,
    dashboardQuery.error,
    performanceQuery.error,
  ].some(Boolean)

  return (
    <div className="min-w-0 w-full space-y-5 pb-12 sm:space-y-6">
      {/* ── TOP COMMAND & PULSE BAR ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center lg:justify-between lg:px-5 lg:py-2.5">
        {/* Left: Intelligence Status & Coverage */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Analytics Engine
            </span>
          </div>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {performance?.summary.snapshot_count ?? 0} snapshots recorded · {flow?.months_count ?? 0} months tracked
          </span>
          {cashBufferMonths !== null && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
              Buffer: {cashBufferMonths.toFixed(1)} mo runway
            </span>
          )}
        </div>

        {/* Right: Refresh Action */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={[
              'inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
            title="Refresh analytics data"
          >
            <Icon
              name="refresh"
              className={['h-3.5 w-3.5', isRefreshing ? 'animate-spin' : ''].join(' ')}
            />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {hasAnyErrors && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-xs text-amber-300 dark:border-amber-500/20 dark:bg-amber-500/5">
          Some analytics queries encountered an issue refreshing. Visual charts display current cached local data.
        </div>
      )}

      {/* ── ROW 1: YOUR FINANCIAL STORY HERO PILLAR DECK ── */}
      <div className={CARD_CONTAINER}>
        <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Icon name="analytics" className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">Financial Analytics & Insights</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Holistic performance, average run-rates, capital allocation, and long-term liquidity.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
              Coverage: {flow?.months_count ?? 0} Months
            </span>
          </div>
        </div>

        {/* 4 Pillars Summary Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {/* Pillar 1: Total Portfolio / Net Worth */}
          <div className={INNER_TILE}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Portfolio Value</span>
              <Icon name="netWorth" className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              <PrivateValue value={formatMoney(latestValuation)} mask="••••••" hideColor />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
              {rangeChangePct !== null ? (
                <span className={['font-mono font-bold', getTrendClass(rangeChangePct)].join(' ')}>
                  {rangeChangePct >= 0 ? '↑ +' : '↓ '}
                  {formatSignedPct(rangeChangePct)} ({range})
                </span>
              ) : (
                <span>Baseline tracked</span>
              )}
            </div>
          </div>

          {/* Pillar 2: Average Monthly Spends (Focus on Avg Spends) */}
          <div className={INNER_TILE}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Average Monthly Spend</span>
              <Icon name="cards" className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 sm:text-2xl">
              <PrivateValue value={formatMoney(avgMonthlySpend)} mask="•••••" hideColor />
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {cashBufferMonths !== null ? (
                <span className="font-medium text-teal-600 dark:text-teal-400">
                  {cashBufferMonths.toFixed(1)} months cash buffer
                </span>
              ) : (
                'Across tracked period'
              )}
            </div>
          </div>

          {/* Pillar 3: Average Monthly Net Savings */}
          <div className={INNER_TILE}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Average Monthly Saved</span>
              <Icon name="stocks" className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 font-mono text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 sm:text-2xl">
              <PrivateValue
                value={`${avgMonthlySavings >= 0 ? '+' : ''}${formatMoney(avgMonthlySavings)}`}
                mask="•••••"
                hideColor
              />
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {avgSavingsRate !== null ? (
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatPct(avgSavingsRate)} average savings rate
                </span>
              ) : (
                'Retention rate'
              )}
            </div>
          </div>

          {/* Pillar 4: Vs Last Snapshot Comparison */}
          <div className={INNER_TILE}>
            <div className="flex items-center justify-between">
              <span className={LABEL}>Vs Last Snapshot</span>
              {snapshotComparison ? (
                <span
                  className={[
                    'font-mono text-xs font-bold tabular-nums',
                    getTrendClass(snapshotComparison.diffAmount),
                  ].join(' ')}
                >
                  {snapshotComparison.diffAmount >= 0 ? '+' : ''}
                  {snapshotComparison.diffPct.toFixed(2)}%
                </span>
              ) : null}
            </div>
            <div
              className={[
                'mt-2 font-mono text-xl font-bold tracking-tight sm:text-2xl',
                snapshotComparison ? getTrendClass(snapshotComparison.diffAmount) : 'text-slate-900 dark:text-white',
              ].join(' ')}
            >
              {snapshotComparison ? (
                <PrivateValue
                  value={`${snapshotComparison.diffAmount >= 0 ? '+' : ''}${formatMoney(snapshotComparison.diffAmount)}`}
                  mask="•••••"
                  hideColor
                />
              ) : (
                '—'
              )}
            </div>
            <div className="mt-1 truncate text-xs text-slate-400">
              {snapshotComparison
                ? `vs ${formatSnapshotDate(snapshotComparison.lastDate)} (${formatMoney(snapshotComparison.lastValue)})`
                : 'Save snapshots to compare'}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: PORTFOLIO MOVEMENT & VALUATION TREND ── */}
      <div className={CARD_CONTAINER}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className={LABEL}>Portfolio Movement & Growth</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                <PrivateValue value={formatMoney(latestValuation)} mask="••••••" hideColor />
              </span>
              {rangeChangePct !== null && (
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tabular-nums',
                    privacyMode
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : getTrendClass(rangeChangePct),
                  ].join(' ')}
                >
                  {rangeChangePct >= 0 ? '↑ +' : '↓ '}
                  {formatPct(rangeChangePct)}
                  {rangeChangeAmt !== null && !privacyMode && (
                    <span className="opacity-75">
                      ({rangeChangeAmt >= 0 ? '+' : ''}
                      {formatMoney(rangeChangeAmt)})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-800/80">
            {RANGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                  range === item
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
                ].join(' ')}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Valuation Area Chart */}
        <div className="mt-6 h-72 w-full">
          {snapshotsChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshotsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsPortfolioGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={rangeChangePct !== null && rangeChangePct < 0 ? '#fb7185' : '#2dd4bf'}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={rangeChangePct !== null && rangeChangePct < 0 ? '#fb7185' : '#2dd4bf'}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis
                  width={68}
                  tickFormatter={(v: number) => (privacyMode ? '•••' : formatINRShort(v))}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<CustomGlassTooltip privacyMode={privacyMode} />}
                  cursor={{ stroke: 'rgba(148, 163, 184, 0.25)', strokeWidth: 1 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name="Valuation"
                  stroke={rangeChangePct !== null && rangeChangePct < 0 ? '#fb7185' : '#2dd4bf'}
                  strokeWidth={2.5}
                  fill="url(#analyticsPortfolioGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyPlaceholder message="Record portfolio snapshots to plot valuation trajectory." icon="stocks" />
          )}
        </div>

        {/* Narrative / Context Footer */}
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-600 dark:border-slate-800/60 dark:bg-slate-800/30 dark:text-slate-300">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-teal-500">
              <Icon name="ai" className="h-4 w-4" />
            </span>
            <p>{performanceNarrative}</p>
          </div>
        </div>
      </div>

      {/* ── ROW 3: CASHFLOW TIMELINE & ASSET ALLOCATION ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {/* Cashflow Timeline: Bar & Line Combo */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className={LABEL}>Cashflow Timeline</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Income, Spend & Retention
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
                <span className="h-2 w-2 rounded-full bg-teal-400" /> Income
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-500 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-400" /> Spend
              </span>
              <span className="inline-flex items-center gap-1.5 text-sky-500 dark:text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400" /> Net Saved
              </span>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            {cashflowChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashflowChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    width={68}
                    tickFormatter={(v: number) => (privacyMode ? '•••' : formatINRShort(v))}
                    tick={{ fill: '#64748b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomGlassTooltip privacyMode={privacyMode} />} />
                  <Bar dataKey="income" name="Income" fill="#2dd4bf" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="spend" name="Spend" fill="#fb7185" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    name="Net Saved"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#38bdf8' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyPlaceholder message="Log recurring income and spends to visualize cashflow momentum." icon="transactions" />
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Avg Inflow</span>
              <p className="mt-0.5 font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                <PrivateValue value={formatMoney(avgMonthlyIncome)} mask="••••" hideColor />
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Avg Outflow</span>
              <p className="mt-0.5 font-mono text-xs font-bold text-rose-500 dark:text-rose-400">
                <PrivateValue value={formatMoney(avgMonthlySpend)} mask="••••" hideColor />
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Avg Saved</span>
              <p className="mt-0.5 font-mono text-xs font-bold text-sky-500 dark:text-sky-400">
                <PrivateValue value={formatMoney(avgMonthlySavings)} mask="••••" hideColor />
              </p>
            </div>
          </div>
        </div>

        {/* Asset Allocation Donut */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className={LABEL}>Capital Deployment</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Asset Class Allocation
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {assetAllocationData.length} Buckets
            </span>
          </div>

          {assetAllocationData.length > 0 ? (
            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[190px_1fr]">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assetAllocationData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={86}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {assetAllocationData.map((item, idx) => (
                        <Cell key={item.key} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomGlassTooltip privacyMode={privacyMode} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {assetAllocationData.map((bucket, idx) => (
                  <div
                    key={bucket.key}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
                      />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                        {bucket.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">
                        <PrivateValue value={formatMoney(bucket.value)} mask="••••" hideColor />
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {formatPct(bucket.percentage)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Connect holdings, banks or deposits to view allocation." icon="portfolio" />
          )}
        </div>
      </div>

      {/* ── ROW 4: AVERAGE SPENDS & CATEGORY MIX (NO MONTH-BY-MONTH PICKING) ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Average Expense Mix */}
        <div className={CARD_CONTAINER}>
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className={LABEL}>Average Monthly Spends</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Category Expense Mix
              </h2>
            </div>
            <div className="text-xs font-semibold text-rose-500">
              Avg: <PrivateValue value={formatMoney(avgMonthlySpend)} mask="•••••" hideColor /> / mo
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Calculated as the normalized monthly burn across all tracked history, removing one-off volatility.
          </p>

          {avgExpenseCategories.length > 0 ? (
            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[190px_1fr]">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={avgExpensePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {avgExpensePieData.map((item, idx) => (
                        <Cell key={item.name} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomGlassTooltip privacyMode={privacyMode} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {avgExpenseCategories.map((item, idx) => (
                  <div key={item.category} className="rounded-xl bg-slate-50/70 p-2 text-xs dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.category}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(item.average_amount))} mask="••••" hideColor />
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          ({item.percentage_of_avg_spend != null ? formatPct(toNumber(item.percentage_of_avg_spend)) : '—'})
                        </span>
                      </div>
                    </div>
                    {/* Micro bar */}
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, toNumber(item.percentage_of_avg_spend ?? 0))}%`,
                          backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Log expense transactions to calculate average burn rate." icon="transactions" />
          )}
        </div>

        {/* Average Income Mix */}
        <div className={CARD_CONTAINER}>
          <div className="flex flex-col gap-1 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className={LABEL}>Average Monthly Income</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Revenue & Inflow Streams
              </h2>
            </div>
            <div className="text-xs font-semibold text-teal-600 dark:text-teal-400">
              Avg: <PrivateValue value={formatMoney(avgMonthlyIncome)} mask="•••••" hideColor /> / mo
            </div>
          </div>

          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Monthly average salary, investment returns, and freelance deposits across tracked months.
          </p>

          {avgIncomeCategories.length > 0 ? (
            <div className="mt-4 grid items-center gap-4 sm:grid-cols-[190px_1fr]">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={avgIncomePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {avgIncomePieData.map((item, idx) => (
                        <Cell key={item.name} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomGlassTooltip privacyMode={privacyMode} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {avgIncomeCategories.map((item, idx) => (
                  <div key={item.category} className="rounded-xl bg-slate-50/70 p-2 text-xs dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length] }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.category}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(item.average_amount))} mask="••••" hideColor />
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          ({item.percentage_of_avg_income != null ? formatPct(toNumber(item.percentage_of_avg_income)) : '—'})
                        </span>
                      </div>
                    </div>
                    {/* Micro bar */}
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, toNumber(item.percentage_of_avg_income ?? 0))}%`,
                          backgroundColor: CHART_PALETTE[idx % CHART_PALETTE.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyPlaceholder message="Log recurring income transactions to analyze cash flow sources." icon="banks" />
          )}
        </div>
      </div>

      {/* ── ROW 5: EXECUTIVE 3-CARD INTELLIGENCE GRID ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Card 1: Largest Positions */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className={LABEL}>Holdings Concentration</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Largest Positions
              </h2>
            </div>
            <Icon name="stocks" className="h-4 w-4 text-slate-400" />
          </div>

          {(investments?.top_holdings ?? []).length > 0 ? (
            <div className="mt-4 space-y-3">
              {investments?.top_holdings.map((h) => {
                const ret = h.return_pct != null ? toNumber(h.return_pct) : null
                return (
                  <div key={h.symbol} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{h.symbol}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-44">{h.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                          <PrivateValue value={formatMoney(toNumber(h.value))} mask="••••" hideColor />
                        </div>
                        {ret !== null && (
                          <div className={['font-mono text-[11px] font-semibold', getTrendClass(ret)].join(' ')}>
                            {ret >= 0 ? '+' : ''}{formatPct(ret)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full bg-teal-500"
                          style={{ width: `${Math.min(100, toNumber(h.percentage_of_portfolio))}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatPct(toNumber(h.percentage_of_portfolio))}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyPlaceholder message="Add investment holdings to monitor capital concentration." icon="stocks" />
          )}
        </div>

        {/* Card 2: Financial Goals Tracker */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className={LABEL}>Milestones</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Goal Health & Pacing
              </h2>
            </div>
            <Icon name="portfolio" className="h-4 w-4 text-purple-400" />
          </div>

          {goalsPieData.length > 0 ? (
            <div className="mt-4">
              <div className="grid items-center gap-3 sm:grid-cols-[140px_1fr]">
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={goalsPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={66}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {goalsPieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomGlassTooltip privacyMode={privacyMode} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {goalsPieData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-600 dark:text-slate-300">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {item.value} {item.value === 1 ? 'goal' : 'goals'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {goals?.largest_shortfall_goal_name && (
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                  <span className="font-semibold">Shortfall Alert: </span>
                  {goals.largest_shortfall_goal_name} needs{' '}
                  <span className="font-mono font-bold">
                    <PrivateValue
                      value={formatMoney(toNumber(goals.largest_shortfall_amount))}
                      mask="••••"
                      hideColor
                    />
                  </span>{' '}
                  additional capital.
                </div>
              )}
            </div>
          ) : (
            <EmptyPlaceholder message="Set financial goals with target dates to monitor progress." icon="portfolio" />
          )}
        </div>

        {/* Card 3: Credit Card Utilization & Liability Health */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div>
              <div className={LABEL}>Liability Health</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Credit Card Utilization
              </h2>
            </div>
            <Icon name="cards" className="h-4 w-4 text-sky-400" />
          </div>

          <div className="mt-4 grid items-center gap-3 sm:grid-cols-[140px_1fr]">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="65%"
                  outerRadius="90%"
                  startAngle={90}
                  endAngle={-270}
                  data={[
                    {
                      value: cardUtilization,
                      fill: cardUtilization > 50 ? '#fb7185' : cardUtilization > 30 ? '#fbbf24' : '#2dd4bf',
                    },
                  ]}
                >
                  <RadialBar background={{ fill: 'rgba(148, 163, 184, 0.15)' }} dataKey="value" cornerRadius={8} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white">
                <PrivateValue value={formatPct(cardUtilization)} mask="••••" hideColor />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {cardUtilization <= 30
                  ? 'Healthy utilization (<30% ideal)'
                  : cardUtilization <= 50
                  ? 'Moderate utilization (watch limits)'
                  : 'High utilization (prioritize paydown)'}
              </p>
              <div className="mt-3 text-xs text-slate-400">
                {dashboard?.overdue_count ? (
                  <span className="font-semibold text-rose-500">
                    ⚠️ {dashboard.overdue_count} overdue payment{dashboard.overdue_count === 1 ? '' : 's'}
                  </span>
                ) : dashboard?.due_soon_count ? (
                  <span className="font-semibold text-amber-500">
                    ⏰ {dashboard.due_soon_count} payment{dashboard.due_soon_count === 1 ? '' : 's'} due soon
                  </span>
                ) : (
                  <span className="text-emerald-500">✓ No overdue payments</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 6: STRATEGIC INTELLIGENCE INSIGHTS ── */}
      {intelligence?.insights && intelligence.insights.length > 0 && (
        <div className={CARD_CONTAINER}>
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Icon name="ai" className="h-4 w-4" />
            </span>
            <div>
              <div className={LABEL}>Intelligence Engine</div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Actionable Financial Observations</h2>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {intelligence.insights.map((insight, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-xs text-slate-700 dark:border-slate-800/80 dark:bg-slate-800/40 dark:text-slate-300"
              >
                <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[10px] font-bold text-teal-600 dark:text-teal-400">
                  {idx + 1}
                </span>
                <p className="leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
