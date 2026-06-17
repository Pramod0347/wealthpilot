import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApiError, apiFetch, getPortfolioIntelligence, type PortfolioIntelligence } from '../lib/api'
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

type ApiCreditCard = {
  id: number
  status: 'paid' | 'due_soon' | 'overdue'
}

type ApiHolding = {
  id: number
  symbol: string
  company_name: string
  asset_type: string
  country: string
  sector: string | null
  current_value: string | number
  pnl: string | number
  return_pct: string | number
}

type ChartPoint = {
  label: string
  date: string
  actual_value: number | null
  predicted_value: number | null
}

type SeverityTone = 'healthy' | 'watch' | 'risk' | 'action' | 'neutral'

type RiskItem = {
  title: string
  level: 'Low' | 'Medium' | 'High'
  reason: string
  action: string
}

type ScanRow = {
  key: string
  label: string
  value: number
  percentage: number
  icon: 'stocks' | 'pfepf' | 'banks' | 'cards'
  subtitle: string
}

type TipItem = {
  title: string
  body: string
  tone: SeverityTone
}

type AllocationRow = {
  label: string
  value: number
  percentage: number
  color: string
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
  equity: '#14b8a6',
  funds: '#a78bfa',
  gold: '#f59e0b',
  cash: '#f97316',
  fixed_retirement: '#22c55e',
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

function isGoldHolding(holding: ApiHolding) {
  const text = `${holding.symbol} ${holding.company_name} ${holding.sector ?? ''}`.toLowerCase()
  return holding.asset_type === 'gold' || (holding.asset_type === 'other' && text.includes('gold')) || (holding.asset_type === 'etf' && text.includes('gold'))
}

function buildChartData(performance: ApiPortfolioPerformance | null): ChartPoint[] {
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
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pr-5 py-4 pl-5 dark:border-slate-700/50">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{title}</div>
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

export default function AnalyticsPage() {
  const { privacyMode } = usePrivacyMode()
  const [intelligence, setIntelligence] = useState<PortfolioIntelligence | null>(null)
  const [performance, setPerformance] = useState<ApiPortfolioPerformance | null>(null)
  const [dashboardSummary, setDashboardSummary] = useState<ApiDashboardSummary | null>(null)
  const [creditCards, setCreditCards] = useState<ApiCreditCard[]>([])
  const [holdings, setHoldings] = useState<ApiHolding[]>([])
  const [activeRange, setActiveRange] = useState<PortfolioRange>('6M')
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [creditHealthLoading, setCreditHealthLoading] = useState(true)
  const [holdingsLoading, setHoldingsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [performanceError, setPerformanceError] = useState<string | null>(null)
  const [creditHealthError, setCreditHealthError] = useState<string | null>(null)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    getPortfolioIntelligence(controller.signal)
      .then(setIntelligence)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(formatApiError(err))
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setHoldingsLoading(true)
    setHoldingsError(null)
    apiFetch<ApiHolding[]>('/api/holdings', { signal: controller.signal })
      .then(setHoldings)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setHoldingsError(formatApiError(err))
      })
      .finally(() => setHoldingsLoading(false))
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

  useEffect(() => {
    const controller = new AbortController()
    setCreditHealthLoading(true)
    setCreditHealthError(null)
    Promise.all([
      apiFetch<ApiDashboardSummary>('/api/dashboard/summary', { signal: controller.signal }),
      apiFetch<ApiCreditCard[]>('/api/credit-cards', { signal: controller.signal }),
    ])
      .then(([summary, cards]) => {
        setDashboardSummary(summary)
        setCreditCards(cards)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setCreditHealthError(formatApiError(err))
      })
      .finally(() => setCreditHealthLoading(false))
    return () => controller.abort()
  }, [])

  const chartData = useMemo(() => buildChartData(performance), [performance])
  const hasPerformance = (performance?.actual.length ?? 0) > 0

  const statusMeta = useMemo(() => {
    const latestSnapshotDate = intelligence?.performance.latest_snapshot_date ?? performance?.actual.at(-1)?.date ?? null
    const modules = [
      !!intelligence?.asset_allocation.length,
      !!dashboardSummary,
      !!intelligence?.cashflow_context.has_data,
      !!intelligence?.performance.has_snapshots,
      !error && !performanceError && !creditHealthError,
    ]
    const availableModules = modules.filter(Boolean).length
    const completeness = Math.round((availableModules / modules.length) * 100)
    return {
      lastUpdated: latestSnapshotDate ? formatDateTime(latestSnapshotDate) : 'Live backend data',
      completeness,
      stale: Boolean(error || performanceError || creditHealthError),
      valuesHidden: privacyMode,
    }
  }, [creditHealthError, dashboardSummary, error, intelligence, performance, performanceError, privacyMode])

  const selectedBucket = useMemo(() => {
    if (!intelligence || !selectedBucketKey) return null
    return (
      intelligence.asset_allocation.find((item) => item.key === selectedBucketKey) ??
      intelligence.risk_allocation.find((item) => item.key === selectedBucketKey) ??
      null
    )
  }, [intelligence, selectedBucketKey])

  const riskItems = useMemo<RiskItem[]>(() => {
    if (!intelligence || !dashboardSummary) return []
    const totalAssets = toNumber(intelligence.net_worth.total_assets)
    const immediateCash = toNumber(intelligence.net_worth.liquid_assets)
    const largest = intelligence.top_movers.largest_allocation
    const equityExposure = intelligence.risk_allocation
      .filter((item) => item.key === 'equity' || item.key === 'funds')
      .reduce((sum, item) => sum + toNumber(item.percentage), 0)
    const usExposure = intelligence.asset_allocation.find((item) => item.key === 'us_stocks')
    const utilization = toNumber(dashboardSummary.overall_card_utilization)

    return [
      {
        title: 'Concentration risk',
        level: largest && toNumber(largest.percentage) >= 40 ? 'High' : largest && toNumber(largest.percentage) >= 25 ? 'Medium' : 'Low',
        reason: largest ? `${largest.label} is ${formatPct(toNumber(largest.percentage))} of current allocation.` : 'No single bucket dominates current allocation.',
        action: largest && toNumber(largest.percentage) >= 40 ? 'Consider trimming concentration over time.' : 'No rebalance urgency right now.',
      },
      {
        title: 'Liquidity risk',
        level: totalAssets > 0 && immediateCash / totalAssets < 0.1 ? 'High' : totalAssets > 0 && immediateCash / totalAssets < 0.2 ? 'Medium' : 'Low',
        reason: `Immediate cash is ${formatPct(totalAssets > 0 ? (immediateCash / totalAssets) * 100 : 0)} of assets.`,
        action: totalAssets > 0 && immediateCash / totalAssets < 0.1 ? 'Strengthen your cash buffer for near-term flexibility.' : 'Liquidity position looks manageable.',
      },
      {
        title: 'Credit / liability risk',
        level: utilization >= 80 ? 'High' : utilization >= 50 ? 'Medium' : 'Low',
        reason: `Overall card utilization is ${formatPct(utilization)} with dues of ${formatMoney(toNumber(dashboardSummary.total_credit_card_dues))}.`,
        action: utilization >= 50 ? 'Reduce revolving usage and watch upcoming due dates.' : 'Credit exposure is currently under control.',
      },
      {
        title: 'Market exposure risk',
        level: equityExposure >= 70 ? 'High' : equityExposure >= 45 ? 'Medium' : 'Low',
        reason: `Equity and fund-linked assets account for ${formatPct(equityExposure)} of risk exposure.`,
        action: equityExposure >= 70 ? 'Make sure this matches your drawdown tolerance.' : 'Exposure mix is within a moderate range.',
      },
      {
        title: 'Currency exposure risk',
        level: usExposure && toNumber(usExposure.percentage) >= 15 ? 'Medium' : 'Low',
        reason: usExposure ? `US holdings contribute ${formatPct(toNumber(usExposure.percentage))} of allocation.` : 'No meaningful foreign-currency exposure right now.',
        action: usExposure ? 'Keep FX rates updated for a realistic INR view.' : 'No FX-specific action needed.',
      },
    ]
  }, [dashboardSummary, intelligence])

  const performanceHeaderValue = intelligence?.performance.has_snapshots ? formatMoney(toNumber(intelligence.performance.latest_snapshot_value)) : '—'
  const utilization = toNumber(dashboardSummary?.overall_card_utilization)
  const snapshotCount = performance?.actual.length ?? 0
  const firstSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[0]?.current_value) : 0
  const latestSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[snapshotCount - 1]?.current_value) : 0
  const changeSinceFirst = latestSnapshotValue - firstSnapshotValue
  const predictionReady = snapshotCount >= 3 && (performance?.predicted.length ?? 0) > 0
  const networthCards = useMemo(() => {
    if (!intelligence) return []
    return [
      { label: 'Net Worth', value: formatMoney(toNumber(intelligence.net_worth.net_worth)), tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.net_worth.net_worth)), context: 'Assets minus liabilities' },
      { label: 'Assets', value: formatMoney(toNumber(intelligence.net_worth.total_assets)), tone: 'text-slate-900 dark:text-white', context: 'Tracked asset base' },
      { label: 'Liabilities', value: formatMoney(toNumber(intelligence.net_worth.total_liabilities)), tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400', context: 'Credit dues only' },
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

  const smartTips = useMemo<TipItem[]>(() => {
    if (!intelligence) return []
    const totalAssets = toNumber(intelligence.net_worth.total_assets)
    const cashPct = totalAssets > 0 ? (toNumber(intelligence.net_worth.liquid_assets) / totalAssets) * 100 : 0
    const largest = intelligence.top_movers.largest_allocation
    const tips: TipItem[] = []

    if (intelligence.top_movers.biggest_gainers.length > 0) {
      const names = intelligence.top_movers.biggest_gainers.slice(0, 3).map((item) => item.symbol).join(', ')
      tips.push({
        title: 'Performance driver',
        body: `${names} are contributing most to portfolio gains right now.`,
        tone: 'healthy',
      })
    }

    if (largest) {
      tips.push({
        title: 'Largest allocation',
        body: `${largest.label} are your largest allocation.`,
        tone: toNumber(largest.percentage) >= 40 ? 'watch' : 'neutral',
      })
    }

    if (cashPct < 10) {
      tips.push({
        title: 'Cash buffer',
        body: 'Cash buffer is low compared to total assets.',
        tone: 'watch',
      })
    }

    tips.push({
      title: 'Credit health',
      body: dashboardSummary && (dashboardSummary.overdue_count > 0 || dashboardSummary.due_soon_count > 0)
        ? 'Upcoming credit card dues need attention.'
        : 'Credit card dues are under control.',
      tone: dashboardSummary && dashboardSummary.overdue_count > 0 ? 'risk' : dashboardSummary && dashboardSummary.due_soon_count > 0 ? 'watch' : 'healthy',
    })

    return tips.slice(0, 4)
  }, [dashboardSummary, intelligence])

  const sectorAllocation = useMemo<AllocationRow[]>(() => {
    const eligible = holdings.filter((holding) => (['stock', 'etf', 'gold', 'mutual_fund'].includes(holding.asset_type) || isGoldHolding(holding)) && holding.sector)
    const totals = eligible.reduce<Record<string, number>>((acc, holding) => {
      const key = (holding.sector || '').trim()
      if (!key) return acc
      acc[key] = (acc[key] ?? 0) + toNumber(holding.current_value)
      return acc
    }, {})
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, percentage: total > 0 ? (value / total) * 100 : 0, color: '#14b8a6' }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 6)
  }, [holdings])

  const marketCapAllocation = useMemo<AllocationRow[]>(() => {
    const totals = holdings.reduce<Record<string, number>>((acc, holding) => {
      if (holding.country !== 'IN' || !(['stock', 'etf', 'gold'].includes(holding.asset_type) || isGoldHolding(holding))) return acc
      const sectorText = (holding.sector || '').toLowerCase()
      let label: string | null = null
      if (sectorText.includes('mega cap')) label = 'Mega Cap'
      else if (sectorText.includes('large cap')) label = 'Large Cap'
      else if (sectorText.includes('mid cap')) label = 'Mid Cap'
      else if (sectorText.includes('small cap')) label = 'Small Cap'
      if (!label) return acc
      acc[label] = (acc[label] ?? 0) + toNumber(holding.current_value)
      return acc
    }, {})
    const colors: Record<string, string> = {
      'Mega Cap': '#0ea5e9',
      'Large Cap': '#14b8a6',
      'Mid Cap': '#f59e0b',
      'Small Cap': '#fb7185',
    }
    const total = Object.values(totals).reduce((sum, value) => sum + value, 0)
    return Object.entries(totals)
      .map(([label, value]) => ({ label, value, percentage: total > 0 ? (value / total) * 100 : 0, color: colors[label] ?? '#64748b' }))
      .sort((left, right) => right.value - left.value)
  }, [holdings])

  const latestChange = intelligence?.performance.has_snapshots ? toNumber(intelligence.performance.latest_snapshot_return_pct) : null

  const refreshAnalytics = async () => {
    setLoading(true)
    setPerformanceLoading(true)
    setCreditHealthLoading(true)
    setHoldingsLoading(true)
    try {
      const [intel, perf, summary, cards, nextHoldings] = await Promise.all([
        getPortfolioIntelligence(),
        apiFetch<ApiPortfolioPerformance>(`/api/portfolio/performance?range=${activeRange}`),
        apiFetch<ApiDashboardSummary>('/api/dashboard/summary'),
        apiFetch<ApiCreditCard[]>('/api/credit-cards'),
        apiFetch<ApiHolding[]>('/api/holdings'),
      ])
      setIntelligence(intel)
      setPerformance(perf)
      setDashboardSummary(summary)
      setCreditCards(cards)
      setHoldings(nextHoldings)
      setError(null)
      setPerformanceError(null)
      setCreditHealthError(null)
      setHoldingsError(null)
    } catch (err) {
      const message = formatApiError(err)
      setError(message)
    } finally {
      setLoading(false)
      setPerformanceLoading(false)
      setCreditHealthLoading(false)
      setHoldingsLoading(false)
    }
  }

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

      <SectionCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-700/50 sm:px-6 sm:py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
            <Icon name="analytics" className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">Financial Analytics</span>
            <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">· Net worth, allocation, risk, and portfolio scan</span>
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
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Networth Intelligence</div>
            {privacyMode ? <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-meta text-slate-300">Privacy mode is on. Labels stay visible, values are masked.</div> : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {loading || !intelligence
                ? Array.from({ length: 3 }, (_, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                      <div className="animate-pulse space-y-3">
                        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-7 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    </div>
                  ))
                : networthCards.map((card) => (
                    <MetricCard key={card.label} label={card.label} value={card.value} context={card.context} tone={card.tone} hideColor />
                  ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
                <Icon name="analytics" className="h-3.5 w-3.5" />
                Latest change{' '}
                <span className={privacyMode ? 'text-slate-300' : latestChange !== null && latestChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  <PrivateValue value={latestChange !== null ? formatSignedPct(latestChange) : 'Not available'} mask="••••" hideColor />
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
                <Icon name="calendar" className="h-3.5 w-3.5" />
                {statusMeta.lastUpdated}
              </div>
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
                <div className="t-meta text-slate-500 dark:text-slate-400">
                  {predictionReady ? 'Projection shown from existing snapshot trend.' : 'Save more snapshots to see projection'}
                </div>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <SectionCard title="Portfolio Scan" className="p-5">
          {!intelligence ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading portfolio buckets...</div>
          ) : (
            <div className="space-y-4">
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
                    <div
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: `${bucketColor}20`, color: bucketColor }}
                    >
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

        <SectionCard title="Smart Tips" className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {smartTips.map((tip, index) => {
                const tone = severityClasses(tip.tone)
                return (
                  <div key={`${tip.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className={['t-section', tone.title].join(' ')}>{tip.title}</div>
                      <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>
                        <Icon name={tone.icon} className="h-3.5 w-3.5" />
                        {tip.tone === 'healthy' ? 'Healthy' : tip.tone === 'watch' ? 'Watch' : tip.tone === 'risk' ? 'Risk' : tip.tone === 'action' ? 'Action' : 'Neutral'}
                      </span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{tip.body}</div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Sector Allocation" className="p-5">
          {holdingsLoading ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading sectors...</div>
          ) : holdingsError ? (
            <div className="text-sm text-rose-300">{holdingsError}</div>
          ) : sectorAllocation.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
              <div className="t-section text-slate-900 dark:text-white">Add sectors to holdings to see sector allocation.</div>
              <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Only investments with sector data are included here.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {sectorAllocation.map((row) => (
                  <div key={row.label} className="h-full" style={{ width: `${row.percentage}%`, backgroundColor: row.color }} />
                ))}
              </div>
              <div className="space-y-3">
                {sectorAllocation.map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                      <div className="t-nav text-slate-900 dark:text-white">{row.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="t-amount text-slate-900 dark:text-white"><PrivateValue value={formatMoney(row.value)} mask="••••" hideColor /></div>
                      <div className="t-meta text-slate-500 dark:text-slate-400"><PrivateValue value={formatPct(row.percentage)} mask="••••" hideColor /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="MarketCap Allocation" className="p-5">
          {holdingsLoading ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading market-cap view...</div>
          ) : marketCapAllocation.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
              <div className="t-section text-slate-900 dark:text-white">Market cap classification not added yet</div>
              <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Add market cap category to holdings to enable this view.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {marketCapAllocation.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                    <div className="t-nav text-slate-900 dark:text-white">{row.label}</div>
                  </div>
                  <div className="text-right">
                    <div className="t-amount text-slate-900 dark:text-white"><PrivateValue value={formatMoney(row.value)} mask="••••" hideColor /></div>
                    <div className="t-meta text-slate-500 dark:text-slate-400"><PrivateValue value={formatPct(row.percentage)} mask="••••" hideColor /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <SectionCard title="Risk Diagnostics" className="p-5">
          {riskItems.length === 0 ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Not enough risk data yet.</div>
          ) : (
            <div className="space-y-3">
              {riskItems.slice(0, 4).map((item) => {
                const severity: SeverityTone = item.level === 'High' ? 'risk' : item.level === 'Medium' ? 'watch' : 'healthy'
                const tone = severityClasses(severity)
                return (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="t-section text-slate-900 dark:text-white">{item.title}</div>
                      <span className={['inline-flex items-center rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>{item.level === 'Low' ? 'Healthy' : item.level === 'Medium' ? 'Watch' : 'High'}</span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{privacyMode ? item.reason.replace(/[\d.,%₹$]+/g, 'this level') : item.reason}</div>
                    <div className="mt-2 t-meta text-slate-300 dark:text-slate-300">Suggested action: {item.action}</div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Cashflow Snapshot" className="p-5">
          {!intelligence ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading cashflow...</div>
          ) : !intelligence.cashflow_context.has_data ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
              <div className="t-section text-slate-900 dark:text-white">Monthly cashflow not added for this month.</div>
              <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Bank balances remain manually managed and are not affected by cashflow summaries.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Income" value={formatMoney(toNumber(intelligence.cashflow_context.income))} context={`Month ${intelligence.cashflow_context.month ?? 'current'}`} tone="text-emerald-400" hideColor />
                <MetricCard label="Spend" value={formatMoney(toNumber(intelligence.cashflow_context.spend))} context="Monthly outflow" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
                <MetricCard label="Savings" value={formatMoney(toNumber(intelligence.cashflow_context.savings))} context="Income minus spend" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings))} hideColor />
                <MetricCard label="Savings Rate" value={formatPct(toNumber(intelligence.cashflow_context.savings_rate))} context="Current month summary" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings_rate))} hideColor />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="t-meta text-slate-500 dark:text-slate-400">Cashflow is monthly summary only. It does not auto-update bank balances.</div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Portfolio Performance"
        className="p-5"
        action={
          <div className="flex items-center rounded-xl bg-slate-100 p-1 gap-0.5 dark:bg-slate-800">
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
        <div className="mb-5 flex flex-wrap items-center gap-3 px-0">
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
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
      </SectionCard>
    </div>
  )
}
