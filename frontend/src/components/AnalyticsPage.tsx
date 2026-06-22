import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  ApiError,
  apiFetch,
  getAnalyticsSummary,
  getPortfolioIntelligence,
  type AnalyticsCategoryAverageItem,
  type AnalyticsFocusItem,
  type AnalyticsMonthlyTrendItem,
  type AnalyticsSummary,
  type PortfolioIntelligence,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import WealthBucketModal from './ui/WealthBucketModal'

type PortfolioRange = '1M' | '3M' | '6M' | '1Y' | 'ALL'

type ApiPortfolioPerformance = {
  range: PortfolioRange
  actual: Array<{
    date: string
    current_value: string | number
    total_invested: string | number
    total_pnl: string | number
    total_return_pct: string | number
  }>
  predicted: Array<{
    date: string
    current_value: string | number
    is_predicted: boolean
  }>
  message: string | null
}

type ApiDashboardSummary = {
  total_credit_card_dues: string | number
  total_card_limit: string | number
  total_card_used: string | number
  overall_card_utilization: string | number
  due_soon_count: number
  overdue_count: number
}

type ChartPoint = {
  label: string
  date: string
  actual_value: number | null
  predicted_value: number | null
}

type TrendPoint = {
  label: string
  month: string
  income: number
  expense: number
  net_savings: number
  savings_rate: number | null
}

type SeverityTone = 'healthy' | 'watch' | 'risk' | 'action' | 'neutral'

type ScanRow = {
  key: string
  label: string
  value: number
  percentage: number
  icon: 'stocks' | 'pfepf' | 'banks' | 'cards'
  subtitle: string
}

const sectionLabel = 't-micro text-slate-500 dark:text-slate-500'
const rangeFilters: Array<{ label: string; value: PortfolioRange }> = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'All', value: 'ALL' },
]

const allocationColors: Record<string, string> = {
  ind_stocks: '#14b8a6',
  us_stocks: '#38bdf8',
  mutual_funds: '#a78bfa',
  banks: '#f97316',
  epf: '#22c55e',
  liabilities: '#fb7185',
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors.map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`).join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatMoney(value: number) {
  return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value)
}

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date)
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available'
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
    .format(date)
    .replace(' am', ' am')
    .replace(' pm', ' pm')
}

function buildPerformanceChartData(performance: ApiPortfolioPerformance | null): ChartPoint[] {
  if (!performance) return []
  const rows = new Map<string, ChartPoint>()
  performance.actual.forEach((point) => {
    rows.set(point.date, {
      date: point.date,
      label: formatChartDate(point.date),
      actual_value: toNumber(point.current_value),
      predicted_value: rows.get(point.date)?.predicted_value ?? null,
    })
  })
  performance.predicted.forEach((point) => {
    const existing = rows.get(point.date)
    rows.set(point.date, {
      date: point.date,
      label: formatChartDate(point.date),
      actual_value: existing?.actual_value ?? null,
      predicted_value: toNumber(point.current_value),
    })
  })
  return Array.from(rows.values()).sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}

function buildTrendChartData(items: AnalyticsMonthlyTrendItem[]): TrendPoint[] {
  return items.map((item) => ({
    label: formatMonthLabel(item.month),
    month: item.month,
    income: toNumber(item.income),
    expense: toNumber(item.expense),
    net_savings: toNumber(item.net_savings),
    savings_rate: item.savings_rate === null ? null : toNumber(item.savings_rate),
  }))
}

function severityClasses(severity: SeverityTone) {
  if (severity === 'healthy') {
    return {
      chip: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
      title: 'text-emerald-300',
      icon: 'paid' as const,
    }
  }
  if (severity === 'watch') {
    return {
      chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
      title: 'text-amber-300',
      icon: 'due' as const,
    }
  }
  if (severity === 'risk') {
    return {
      chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
      title: 'text-rose-300',
      icon: 'warning' as const,
    }
  }
  if (severity === 'action') {
    return {
      chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
      title: 'text-sky-300',
      icon: 'analytics' as const,
    }
  }
  return {
    chip: 'bg-slate-700/70 text-slate-300 border border-slate-600/70',
    title: 'text-slate-200',
    icon: 'ai' as const,
  }
}

function SectionCard({ title, children, className = '', action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={['rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80', className].join(' ')}>
      {title ? (
        <div className="flex gap-3 py-2 px-5">
          <div className="text-base font-bold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</div>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function MetricCard({
  label,
  value,
  context,
  tone = 'text-white',
  hideColor = false,
}: {
  label: string
  value: string
  context: string
  tone?: string
  hideColor?: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
      <div className={sectionLabel}>{label}</div>
      <div className={['mt-2.5 t-metric', tone].join(' ')}>
        <PrivateValue value={value} mask="••••" hideColor={hideColor} />
      </div>
      <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">{context}</div>
    </div>
  )
}

function CategoryBars({
  items,
  percentageKey,
  emptyTitle,
  emptyBody,
}: {
  items: AnalyticsCategoryAverageItem[]
  percentageKey: 'percentage_of_avg_spend' | 'percentage_of_avg_income'
  emptyTitle: string
  emptyBody: string
}) {
  const { privacyMode } = usePrivacyMode()

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
        <div className="t-section text-slate-900 dark:text-white">{emptyTitle}</div>
        <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">{emptyBody}</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = toNumber(item[percentageKey])
        return (
          <div key={item.category} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate t-nav text-slate-900 dark:text-white">{item.category}</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">{item.months_present} tracked month{item.months_present === 1 ? '' : 's'}</div>
              </div>
              <div className="text-right">
                <div className="t-amount text-slate-900 dark:text-white">
                  <PrivateValue value={`${formatMoney(toNumber(item.average_amount))}/month`} mask="••••" hideColor />
                </div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">
                  <PrivateValue value={formatPct(pct)} mask="••••" hideColor />
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
            </div>
            {privacyMode ? null : <div className="mt-2 t-meta text-slate-500 dark:text-slate-400">Total: {formatMoney(toNumber(item.total_amount))}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const { privacyMode } = usePrivacyMode()
  const [intelligence, setIntelligence] = useState<PortfolioIntelligence | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [performance, setPerformance] = useState<ApiPortfolioPerformance | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<ApiDashboardSummary | null>(null)
  const [activeRange, setActiveRange] = useState<PortfolioRange>('6M')
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [performanceError, setPerformanceError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    Promise.all([
      getPortfolioIntelligence(controller.signal),
      apiFetch<ApiDashboardSummary>('/api/dashboard/summary', { signal: controller.signal }),
    ])
      .then(([intel, summary]) => {
        setIntelligence(intel)
        setDashboardSummary(summary)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(formatApiError(err))
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    getAnalyticsSummary(controller.signal)
      .then(setAnalytics)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setAnalyticsError(formatApiError(err))
      })
      .finally(() => setAnalyticsLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setPerformanceLoading(true)
    setPerformanceError(null)
    apiFetch<ApiPortfolioPerformance>(`/api/portfolio/performance?range=${activeRange}`, { signal: controller.signal })
      .then(setPerformance)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setPerformanceError(formatApiError(err))
      })
      .finally(() => setPerformanceLoading(false))
    return () => controller.abort()
  }, [activeRange])

  const chartData = useMemo(() => buildPerformanceChartData(performance), [performance])
  const trendData = useMemo(() => buildTrendChartData(analytics?.cashflow_analytics.monthly_trend ?? []), [analytics])
  const hasPerformance = (performance?.actual.length ?? 0) > 0

  const statusMeta = useMemo(() => {
    const latestSnapshotDate = intelligence?.performance.latest_snapshot_date ?? performance?.actual.at(-1)?.date ?? null
    const modules = [
      !!intelligence?.asset_allocation.length,
      !!analytics?.cashflow_analytics.months_count,
      !!dashboardSummary,
      !!intelligence?.performance.has_snapshots,
      !error && !analyticsError && !performanceError,
    ]
    const availableModules = modules.filter(Boolean).length
    const completeness = Math.round((availableModules / modules.length) * 100)
    return {
      lastUpdated: latestSnapshotDate ? formatDateTime(latestSnapshotDate) : 'Live backend data',
      completeness,
      stale: Boolean(error || analyticsError || performanceError),
      valuesHidden: privacyMode,
    }
  }, [analytics, analyticsError, dashboardSummary, error, intelligence, performance, performanceError, privacyMode])

  const selectedBucket = useMemo(() => {
    if (!intelligence || !selectedBucketKey) return null
    return intelligence.asset_allocation.find((item) => item.key === selectedBucketKey) ?? intelligence.risk_allocation.find((item) => item.key === selectedBucketKey) ?? null
  }, [intelligence, selectedBucketKey])

  const performanceHeaderValue = intelligence?.performance.has_snapshots ? formatMoney(toNumber(intelligence.performance.latest_snapshot_value)) : '—'
  const snapshotCount = performance?.actual.length ?? 0
  const firstSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[0]?.current_value) : 0
  const latestSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[snapshotCount - 1]?.current_value) : 0
  const changeSinceFirst = latestSnapshotValue - firstSnapshotValue
  const predictionReady = snapshotCount >= 3 && (performance?.predicted.length ?? 0) > 0

  const networthCards = useMemo(() => {
    if (!intelligence) return []
    return [
      {
        label: 'Net Worth',
        value: formatMoney(toNumber(intelligence.net_worth.net_worth)),
        tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.net_worth.net_worth)),
        context: 'Assets minus liabilities',
      },
      {
        label: 'Assets',
        value: formatMoney(toNumber(intelligence.net_worth.total_assets)),
        tone: 'text-slate-900 dark:text-white',
        context: 'Tracked asset base',
      },
      {
        label: 'Liabilities',
        value: formatMoney(toNumber(intelligence.net_worth.total_liabilities)),
        tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400',
        context: 'Credit dues only',
      },
      {
        label: 'Liquid Assets',
        value: formatMoney(toNumber(intelligence.net_worth.liquid_assets)),
        tone: 'text-slate-900 dark:text-white',
        context: 'Immediate cash access',
      },
      {
        label: 'Long-Term Assets',
        value: formatMoney(toNumber(intelligence.net_worth.long_term_assets)),
        tone: 'text-slate-900 dark:text-white',
        context: 'Investments plus retirement',
      },
    ]
  }, [intelligence, privacyMode])

  const scanRows = useMemo<ScanRow[]>(() => {
    if (!intelligence) return []
    const iconByKey: Record<string, ScanRow['icon']> = {
      ind_stocks: 'stocks',
      mutual_funds: 'stocks',
      epf: 'pfepf',
      us_stocks: 'stocks',
      banks: 'banks',
      liabilities: 'cards',
    }

    const assetRows = intelligence.asset_allocation.map((item) => ({
      key: item.key,
      label: item.label,
      value: toNumber(item.amount),
      percentage: toNumber(item.percentage),
      icon: iconByKey[item.key] ?? 'stocks',
      subtitle: item.items.length === 1 ? '1 item' : `${item.items.length} items`,
    }))

    const liabilitiesValue = toNumber(intelligence.net_worth.total_liabilities)
    if (liabilitiesValue > 0) {
      assetRows.push({
        key: 'liabilities',
        label: 'Credit Cards / Liabilities',
        value: liabilitiesValue,
        percentage: toNumber(intelligence.net_worth.total_assets) > 0 ? (liabilitiesValue / toNumber(intelligence.net_worth.total_assets)) * 100 : 0,
        icon: 'cards',
        subtitle: `${dashboardSummary?.overdue_count ?? 0} overdue · ${dashboardSummary?.due_soon_count ?? 0} due soon`,
      })
    }
    return assetRows
  }, [dashboardSummary, intelligence])

  const cashflowMetrics = analytics?.cashflow_analytics
  const investmentAnalytics = analytics?.investment_analytics

  const monthsTrackedNote = useMemo(() => {
    if (!cashflowMetrics) return 'Loading tracked months'
    if (cashflowMetrics.months_count === 0) return 'No cashflow data'
    if (cashflowMetrics.months_count === 1) return 'Add more months to improve averages'
    return `${cashflowMetrics.months_count} months tracked`
  }, [cashflowMetrics])

  const savingsHealth = useMemo(() => {
    const avgRate = cashflowMetrics?.average_monthly_summary.savings_rate
    if (!cashflowMetrics || !cashflowMetrics.average_monthly_summary.has_data) {
      return {
        label: 'Unknown',
        tone: 'neutral' as SeverityTone,
        text: 'Monthly cashflow not added for this month',
      }
    }
    if (avgRate === null) {
      return {
        label: 'Unknown',
        tone: 'neutral' as SeverityTone,
        text: 'No income data yet',
      }
    }
    const rate = toNumber(avgRate)
    if (rate >= 40) return { label: 'Excellent', tone: 'healthy' as SeverityTone, text: privacyMode ? 'Your savings trend is healthy.' : 'You are saving strongly across tracked months.' }
    if (rate >= 25) return { label: 'Good', tone: 'healthy' as SeverityTone, text: privacyMode ? 'Your savings trend is healthy.' : 'Your average savings trend is healthy.' }
    if (rate >= 10) return { label: 'Watch', tone: 'watch' as SeverityTone, text: privacyMode ? 'Your savings trend needs attention.' : 'Your savings rate needs attention.' }
    return { label: 'Risk', tone: 'risk' as SeverityTone, text: privacyMode ? 'Your savings trend needs attention.' : 'Spending is taking too much of monthly income.' }
  }, [cashflowMetrics, privacyMode])

  const combinedFocusItems = useMemo(() => {
    const seen = new Set<string>()
    const items: AnalyticsFocusItem[] = []
    ;[...(cashflowMetrics?.focus_items ?? []), ...(investmentAnalytics?.investment_focus_items ?? [])].forEach((item) => {
      if (seen.has(item.title)) return
      seen.add(item.title)
      items.push(item)
    })
    return items.slice(0, 5)
  }, [cashflowMetrics, investmentAnalytics])

  const topHoldings = useMemo(() => investmentAnalytics?.top_holdings ?? [], [investmentAnalytics])

  const refreshAnalytics = async () => {
    setLoading(true)
    setAnalyticsLoading(true)
    setPerformanceLoading(true)
    try {
      const [intel, summary, analyticsSummary, perf] = await Promise.all([
        getPortfolioIntelligence(),
        apiFetch<ApiDashboardSummary>('/api/dashboard/summary'),
        getAnalyticsSummary(),
        apiFetch<ApiPortfolioPerformance>(`/api/portfolio/performance?range=${activeRange}`),
      ])
      setIntelligence(intel)
      setDashboardSummary(summary)
      setAnalytics(analyticsSummary)
      setPerformance(perf)
      setError(null)
      setAnalyticsError(null)
      setPerformanceError(null)
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
    } finally {
      setLoading(false)
      setAnalyticsLoading(false)
      setPerformanceLoading(false)
    }
  }

  const currentCashflow = cashflowMetrics?.current_month_summary
  const averageCashflow = cashflowMetrics?.average_monthly_summary
  const utilization = toNumber(dashboardSummary?.overall_card_utilization)
  const creditCardsTone = dashboardSummary?.overdue_count ? 'risk' : dashboardSummary?.due_soon_count ? 'watch' : 'healthy'
  const creditToneMeta = severityClasses(creditCardsTone)

  return (
    <div className="space-y-5">
      <WealthBucketModal
        bucket={
          selectedBucket
            ? {
                key: selectedBucket.key,
                label: selectedBucket.label,
                value: toNumber(selectedBucket.amount),
                percentage: toNumber(selectedBucket.percentage),
                items: selectedBucket.items,
              }
            : null
        }
        onClose={() => setSelectedBucketKey(null)}
      />

      {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}
      {analyticsError ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">{analyticsError}</div> : null}

      <SectionCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-700/50 sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80">
            <Icon name="analytics" className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Financial Analytics</span>
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">· Net worth, risk, allocation, cashflow, and credit health</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              Last updated {statusMeta.lastUpdated}
            </div>
            <div className={['inline-flex items-center gap-2 rounded-full px-3 py-2 t-badge', statusMeta.stale ? 'border border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'].join(' ')}>
              <span className={['h-1.5 w-1.5 rounded-full', statusMeta.stale ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')} />
              {statusMeta.stale ? 'Stale' : 'Live'}
            </div>
            <button
              type="button"
              onClick={refreshAnalytics}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            >
              <Icon name="refresh" className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        <div className="grid gap-5 px-4 py-4 sm:px-6 sm:py-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="space-y-4">
            <div className="text-base font-bold tracking-[-0.02em] text-slate-900 dark:text-white">Net Worth Intelligence</div>
            {privacyMode ? <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-meta text-slate-300">Privacy mode is on. Labels stay visible, values are masked.</div> : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {loading || !intelligence
                ? Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                      <div className="animate-pulse space-y-3">
                        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))
                : networthCards.map((card) => <MetricCard key={card.label} label={card.label} value={card.value} context={card.context} tone={card.tone} hideColor />)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className={sectionLabel}>Projected Net Worth</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Based on saved portfolio snapshots</div>
              </div>
              <span className="rounded-full bg-slate-800 px-2.5 py-1 t-badge text-slate-300">{snapshotCount} snapshots</span>
            </div>
            {hasPerformance ? (
              <div className="space-y-3">
                <div className="h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.7)', borderRadius: '12px', color: '#fff' }}
                        formatter={(value, name) => [
                          privacyMode ? '••••' : formatINR(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)),
                          name === 'actual_value' ? 'Actual' : 'Projected',
                        ]}
                      />
                      <Line type="monotone" dataKey="actual_value" stroke="#14b8a6" strokeWidth={2.25} dot={false} />
                      {performance?.predicted.length ? <Line type="monotone" dataKey="predicted_value" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 4" /> : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="t-meta text-slate-500 dark:text-slate-400">{predictionReady ? 'Projection shown from existing snapshot trend.' : 'Save more snapshots to see projection'}</div>
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-slate-200 px-6 text-center dark:border-slate-700">
                <div>
                  <div className="t-section text-slate-900 dark:text-white">Save more snapshots to see projection</div>
                  <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">No fake projection is shown without enough history.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
        <SectionCard title="Portfolio Scan" className="p-5 pl-0">
          {!intelligence ? (
            <div className="px-5 t-body text-slate-500 dark:text-slate-400">Loading portfolio buckets...</div>
          ) : (
            <div className="space-y-4 px-5">
              {scanRows.map((row) => {
                const hasLiability = row.key === 'liabilities'
                const bucketColor = allocationColors[row.key] ?? '#64748b'
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => setSelectedBucketKey(row.key)}
                    className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-left transition-colors duration-200 hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:border-slate-600/70"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${bucketColor}20`, color: bucketColor }}>
                      <Icon name={row.icon} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="t-section text-slate-900 dark:text-white">{row.label}</div>
                      <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">{row.subtitle}</div>
                    </div>
                    <div className="text-right">
                      <div className="t-amount text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(row.value)} mask="••••" hideColor />
                      </div>
                      <div className={['mt-1 t-meta', privacyMode ? 'text-slate-400' : hasLiability ? 'text-rose-300' : 'text-slate-500 dark:text-slate-400'].join(' ')}>
                        <PrivateValue value={formatPct(row.percentage)} mask="••••" hideColor />
                      </div>
                    </div>
                    <Icon name="chevronDown" className="-rotate-90 h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Credit Card Health" className="p-5 pl-0">
          <div className="space-y-4 px-5">
            {!dashboardSummary ? (
              <div className="t-body text-slate-500 dark:text-slate-400">Loading credit health...</div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricCard label="Total Dues" value={formatMoney(toNumber(dashboardSummary.total_credit_card_dues))} context="Current card bills" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
                  <MetricCard label="Utilization" value={formatPct(utilization)} context="Across all active cards" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : utilization >= 50 ? 'text-amber-300' : 'text-emerald-300'} hideColor />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="t-section text-slate-900 dark:text-white">Status</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-1 t-badge text-slate-300">{dashboardSummary.overdue_count} overdue</span>
                        <span className="rounded-full border border-slate-700/70 bg-slate-900/60 px-2.5 py-1 t-badge text-slate-300">{dashboardSummary.due_soon_count} due soon</span>
                      </div>
                    </div>
                    <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', creditToneMeta.chip].join(' ')}>
                      <Icon name={creditToneMeta.icon} className="h-3.5 w-3.5" />
                      {creditCardsTone === 'healthy' ? 'Healthy' : creditCardsTone === 'watch' ? 'Watch' : 'Risk'}
                    </span>
                  </div>
                  <div className="mt-3 t-body text-slate-500 dark:text-slate-400">
                    {dashboardSummary.overdue_count > 0
                      ? 'Overdue card bills need immediate attention.'
                      : dashboardSummary.due_soon_count > 0
                        ? 'Upcoming card dues should be planned this cycle.'
                        : 'Credit dues are currently under control.'}
                  </div>
                </div>
              </>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Money Flow Intelligence" className="p-5 pl-0">
        <div className="space-y-4 px-5">
          {analyticsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="animate-pulse space-y-3">
                    <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                </div>
              ))}
            </div>
          ) : !cashflowMetrics || cashflowMetrics.months_count === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
              <div className="t-section text-slate-900 dark:text-white">Monthly cashflow is not added yet.</div>
              <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add income and expense entries from Transactions to unlock money flow analytics.</div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Average Income" value={formatMoney(toNumber(averageCashflow?.income))} context={monthsTrackedNote} tone="text-emerald-400" hideColor />
                <MetricCard label="Average Spend" value={formatMoney(toNumber(averageCashflow?.expense))} context="Across tracked months" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
                <MetricCard label="Average Net Savings" value={formatMoney(toNumber(averageCashflow?.net_savings))} context="Income minus spend" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(averageCashflow?.net_savings))} hideColor />
                <MetricCard
                  label="Avg Savings Rate"
                  value={averageCashflow?.savings_rate === null ? 'Not available' : formatPct(toNumber(averageCashflow?.savings_rate))}
                  context={cashflowMetrics.months_count === 1 ? 'Single month only' : `${cashflowMetrics.months_count} months averaged`}
                  tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(averageCashflow?.savings_rate))}
                  hideColor
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="t-section text-slate-900 dark:text-white">Current Month</div>
                    <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">{cashflowMetrics.current_month}</div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div>
                      <div className={sectionLabel}>Income</div>
                      <div className="mt-1 t-nav text-slate-900 dark:text-white">
                        <PrivateValue value={currentCashflow?.has_data ? formatMoney(toNumber(currentCashflow.income)) : 'Not added'} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className={sectionLabel}>Spend</div>
                      <div className="mt-1 t-nav text-slate-900 dark:text-white">
                        <PrivateValue value={currentCashflow?.has_data ? formatMoney(toNumber(currentCashflow.expense)) : 'Not added'} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className={sectionLabel}>Savings</div>
                      <div className="mt-1 t-nav text-slate-900 dark:text-white">
                        <PrivateValue value={currentCashflow?.has_data ? formatMoney(toNumber(currentCashflow.net_savings)) : 'Not added'} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className={sectionLabel}>Savings Rate</div>
                      <div className="mt-1 t-nav text-slate-900 dark:text-white">
                        <PrivateValue value={currentCashflow?.savings_rate === null ? 'Not available' : formatPct(toNumber(currentCashflow?.savings_rate))} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Where Your Money Goes" className="p-5 pl-0">
          <div className="px-5">
            <CategoryBars
              items={cashflowMetrics?.average_expense_by_category ?? []}
              percentageKey="percentage_of_avg_spend"
              emptyTitle="No expenses added for tracked months."
              emptyBody="Add expense summaries in Transactions to see category averages."
            />
          </div>
        </SectionCard>

        <SectionCard title="Income Sources" className="p-5 pl-0">
          <div className="px-5">
            <CategoryBars
              items={cashflowMetrics?.average_income_by_category ?? []}
              percentageKey="percentage_of_avg_income"
              emptyTitle="No income entries added yet."
              emptyBody="Add income entries in Transactions to see source mix."
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <SectionCard title="Savings Health" className="p-5 pl-0">
          <div className="space-y-4 px-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard
                label="Current Savings Rate"
                value={currentCashflow?.savings_rate === null ? 'Not available' : formatPct(toNumber(currentCashflow?.savings_rate))}
                context={currentCashflow?.has_data ? 'Current month summary' : 'No current month data'}
                tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(currentCashflow?.savings_rate))}
                hideColor
              />
              <MetricCard
                label="Average Savings Rate"
                value={averageCashflow?.savings_rate === null ? 'Not available' : formatPct(toNumber(averageCashflow?.savings_rate))}
                context={monthsTrackedNote}
                tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(averageCashflow?.savings_rate))}
                hideColor
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="t-section text-slate-900 dark:text-white">{savingsHealth.label}</div>
                  <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{savingsHealth.text}</div>
                </div>
                <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', severityClasses(savingsHealth.tone).chip].join(' ')}>
                  <Icon name={severityClasses(savingsHealth.tone).icon} className="h-3.5 w-3.5" />
                  {savingsHealth.label}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="What to Focus On" className="p-5 pl-0">
          <div className="space-y-3 px-5">
            {combinedFocusItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
                <div className="t-section text-slate-900 dark:text-white">No immediate focus items.</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add more tracked data to deepen analytics.</div>
              </div>
            ) : (
              combinedFocusItems.map((item) => {
                const tone = severityClasses(item.severity as SeverityTone)
                return (
                  <div key={`${item.type}-${item.title}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className={['t-section', tone.title].join(' ')}>{item.title}</div>
                      <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>
                        <Icon name={tone.icon} className="h-3.5 w-3.5" />
                        {item.severity === 'healthy' ? 'Healthy' : item.severity === 'watch' ? 'Watch' : 'Risk'}
                      </span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{item.message}</div>
                    <div className="mt-2 t-meta text-slate-300 dark:text-slate-300">Action: {item.action}</div>
                  </div>
                )
              })
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Income vs Spend Trend" className="p-5 pl-0">
        <div className="space-y-4 px-5">
          {!cashflowMetrics || cashflowMetrics.months_count === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
              <div className="t-section text-slate-900 dark:text-white">Monthly cashflow is not added yet.</div>
              <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add income and expense entries from Transactions to unlock monthly trend analytics.</div>
            </div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={76} tickFormatter={(value: number) => (privacyMode ? '••••' : formatINRShort(value))} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.7)', borderRadius: '12px', color: '#fff' }}
                      formatter={(value, name) => [
                        privacyMode ? '••••' : formatINR(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)),
                        name === 'income' ? 'Income' : name === 'expense' ? 'Spend' : 'Net Savings',
                      ]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.25} dot={{ r: 0 }} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2.25} dot={{ r: 0 }} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="net_savings" stroke="#14b8a6" strokeWidth={2.25} dot={{ r: 0 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {trendData.slice(-6).map((point) => (
                  <div key={point.month} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="t-section text-slate-900 dark:text-white">{point.label}</div>
                      <div className="t-meta text-slate-500 dark:text-slate-400">
                        <PrivateValue value={point.savings_rate === null ? 'Not available' : formatPct(point.savings_rate)} mask="••••" hideColor />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="t-meta text-slate-500 dark:text-slate-400">Income</span>
                        <span className="t-nav text-emerald-300">
                          <PrivateValue value={formatMoney(point.income)} mask="••••" hideColor />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="t-meta text-slate-500 dark:text-slate-400">Spend</span>
                        <span className={privacyMode ? 't-nav text-slate-300' : 't-nav text-rose-300'}>
                          <PrivateValue value={formatMoney(point.expense)} mask="••••" hideColor />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="t-meta text-slate-500 dark:text-slate-400">Savings</span>
                        <span className={privacyMode ? 't-nav text-slate-300' : ['t-nav', getTrendClass(point.net_savings)].join(' ')}>
                          <PrivateValue value={formatMoney(point.net_savings)} mask="••••" hideColor />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Investment Focus" className="p-5 pl-0">
          <div className="space-y-3 px-5">
            {investmentAnalytics?.investment_focus_items.length ? (
              investmentAnalytics.investment_focus_items.map((item) => {
                const tone = severityClasses(item.severity as SeverityTone)
                return (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className={['t-section', tone.title].join(' ')}>{item.title}</div>
                      <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>
                        <Icon name={tone.icon} className="h-3.5 w-3.5" />
                        {item.severity === 'healthy' ? 'Healthy' : item.severity === 'watch' ? 'Watch' : 'Risk'}
                      </span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{item.message}</div>
                    <div className="mt-2 t-meta text-slate-300 dark:text-slate-300">Action: {item.action}</div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
                <div className="t-section text-slate-900 dark:text-white">No investment focus items yet.</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add more holdings and snapshots to deepen investment diagnostics.</div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Top Holdings" className="p-5 pl-0">
          <div className="space-y-3 px-5">
            {topHoldings.length ? (
              topHoldings.map((item) => (
                <div key={item.symbol} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate t-section text-slate-900 dark:text-white">{item.symbol}</div>
                      <div className="mt-1 truncate t-meta text-slate-500 dark:text-slate-400">{item.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="t-amount text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(item.value))} mask="••••" hideColor />
                      </div>
                      <div className={['mt-1 t-meta', privacyMode ? 'text-slate-400' : getTrendClass(toNumber(item.return_pct))].join(' ')}>
                        <PrivateValue value={item.return_pct === null ? '—' : formatSignedPct(toNumber(item.return_pct))} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(4, Math.min(100, toNumber(item.percentage_of_portfolio)))}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
                <div className="t-section text-slate-900 dark:text-white">No holdings added yet.</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add investments in Stocks to populate top holdings analytics.</div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Portfolio Performance"
        className="p-5 pl-0"
        action={
          <div className="flex items-center gap-0.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            {rangeFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setActiveRange(filter.value)}
                className={[
                  'rounded-lg px-3 py-1.5 t-badge transition-all duration-150',
                  activeRange === filter.value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
                ].join(' ')}
              >
                {filter.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-5 flex flex-wrap items-center gap-3 px-5">
          <div className="t-metric text-slate-900 dark:text-white">
            <PrivateValue value={performanceHeaderValue} mask="••••" hideColor />
          </div>
          {intelligence?.performance.has_snapshots ? (
            <div className={['t-nav', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.performance.latest_snapshot_return_pct))].join(' ')}>
              <PrivateValue value={formatSignedPct(toNumber(intelligence.performance.latest_snapshot_return_pct))} mask="••••" hideColor />
            </div>
          ) : (
            <div className="t-body text-slate-500 dark:text-slate-400">Not enough history yet</div>
          )}
        </div>
        <div className="mb-5 grid gap-3 px-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Latest Value" value={performanceHeaderValue} context="Most recent snapshot" />
          <MetricCard label="Snapshot Count" value={String(snapshotCount)} context="Saved portfolio history points" />
          <MetricCard
            label="Change Since First"
            value={snapshotCount > 1 ? formatMoney(changeSinceFirst) : '—'}
            context={snapshotCount > 1 ? 'Latest versus first snapshot' : 'Need at least 2 snapshots'}
            tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(changeSinceFirst)}
            hideColor
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className={sectionLabel}>Prediction Status</div>
            <div className={['mt-2.5 t-section', predictionReady ? 'text-amber-300' : 'text-slate-300'].join(' ')}>
              {predictionReady ? 'Projection available' : 'More snapshots needed for prediction'}
            </div>
            <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">
              {snapshotCount < 3 ? 'Save more snapshots over time to unlock projected trend lines.' : 'Prediction is shown only because enough history exists.'}
            </div>
          </div>
        </div>
        <div className="px-5">
          {performanceLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
              <span className="t-body text-slate-400">Loading chart…</span>
            </div>
          ) : performanceError ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{performanceError}</div>
          ) : !hasPerformance ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
              <div className="t-section text-slate-900 dark:text-white">Not enough history yet</div>
              <div className="t-body text-slate-500 dark:text-slate-400">{performance?.message ?? 'More snapshot history needed for prediction.'}</div>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-4 t-badge text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" />Actual</span>
                {performance?.predicted.length ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Projected</span> : null}
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={76} tickFormatter={(value: number) => (privacyMode ? '••••' : formatINRShort(value))} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.7)', borderRadius: '12px', color: '#fff' }}
                      formatter={(value, name) => [
                        privacyMode ? '••••' : formatINR(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)),
                        name === 'actual_value' ? 'Actual' : 'Projected',
                      ]}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line type="monotone" dataKey="actual_value" stroke="#14b8a6" strokeWidth={2.25} dot={{ r: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
                    {performance?.predicted.length ? <Line type="monotone" dataKey="predicted_value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 0 }} strokeDasharray="6 4" activeDot={{ r: 4 }} connectNulls={false} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {performance?.message ? <div className="mt-3 t-meta text-slate-500 dark:text-slate-400">{performance.message}</div> : null}
            </>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
