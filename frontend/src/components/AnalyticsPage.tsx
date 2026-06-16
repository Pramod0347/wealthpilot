import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ApiError, apiFetch, getPortfolioIntelligence, type PortfolioIntelligence } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'

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

type ChartPoint = {
  label: string
  date: string
  actual_value: number | null
  predicted_value: number | null
}

type SeverityTone = 'healthy' | 'watch' | 'risk' | 'action' | 'neutral'

type InsightCard = {
  title: string
  explanation: string
  severity: SeverityTone
  value?: string
  nextStep?: string
}

type RiskItem = {
  title: string
  level: 'Low' | 'Medium' | 'High'
  reason: string
  action: string
}

type ActionItem = {
  title: string
  why: string
  nextStep: string
  severity: SeverityTone
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
  stock_in: '#14b8a6',
  stock_us: '#38bdf8',
  etf: '#0ea5e9',
  gold: '#f59e0b',
  mutual_fund: '#a78bfa',
  banks: '#f97316',
  pfepf: '#22c55e',
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

function allocationStatus(key: string, percentage: number) {
  if (key === 'liabilities') return { label: 'Liability', tone: 'text-rose-300' }
  if (percentage >= 40) return { label: 'High concentration', tone: 'text-amber-300' }
  if (percentage <= 5) return { label: 'Underallocated', tone: 'text-sky-300' }
  return { label: 'Balanced', tone: 'text-emerald-300' }
}

function SectionCard({ title, children, className = '', action }: { title?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div className={['rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80', className].join(' ')}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pr-5 py-4 pl-0 dark:border-slate-700/50">
          <div className="text-base font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{title}</div>
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
  const [activeRange, setActiveRange] = useState<PortfolioRange>('6M')
  const [loading, setLoading] = useState(true)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [creditHealthLoading, setCreditHealthLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [performanceError, setPerformanceError] = useState<string | null>(null)
  const [creditHealthError, setCreditHealthError] = useState<string | null>(null)

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

  const executiveCards = useMemo<InsightCard[]>(() => {
    if (!intelligence) return []
    const totalAssets = toNumber(intelligence.net_worth.total_assets)
    const cashPct = totalAssets > 0 ? (toNumber(intelligence.net_worth.liquid_assets) / totalAssets) * 100 : 0
    const liabilityPct = totalAssets > 0 ? (toNumber(intelligence.net_worth.total_liabilities) / totalAssets) * 100 : 0
    const largest = intelligence.top_movers.largest_allocation
    const usExposure = intelligence.asset_allocation.find((item) => item.key === 'stock_us')
    const diversificationPct = largest ? toNumber(largest.percentage) : 0

    const cards: InsightCard[] = []

    cards.push({
      title: diversificationPct >= 40 ? 'Diversification needs review' : 'Diversification looks reasonable',
      explanation: privacyMode
        ? diversificationPct >= 40
          ? 'One allocation bucket is dominating the portfolio.'
          : 'No single allocation bucket is dominating the portfolio.'
        : largest
          ? `${largest.label} currently has the largest allocation.`
          : 'Portfolio mix is spread across multiple tracked asset buckets.',
      severity: diversificationPct >= 40 ? 'watch' : 'healthy',
      value: privacyMode || !largest ? undefined : formatPct(diversificationPct),
      nextStep: diversificationPct >= 40 ? 'Review whether concentration is intentional or should be trimmed over time.' : 'Current allocation mix does not need urgent rebalance.',
    })

    cards.push({
      title: liabilityPct >= 10 ? 'Credit dues need monitoring' : 'Credit card dues are low risk',
      explanation: privacyMode
        ? liabilityPct >= 10
          ? 'Credit dues are becoming meaningful relative to assets.'
          : 'Credit card dues are under control.'
        : liabilityPct >= 10
          ? 'Liabilities are a meaningful share of assets right now.'
          : 'Card dues are a small share of your current asset base.',
      severity: liabilityPct >= 10 ? 'risk' : 'healthy',
      value: privacyMode ? undefined : formatPct(liabilityPct),
      nextStep: liabilityPct >= 10 ? 'Pay down upcoming bills before adding new leverage.' : 'Keep utilization and due dates under control.',
    })

    cards.push({
      title: cashPct < 10 ? 'Cash allocation is thin' : 'Cash buffer looks reasonable',
      explanation: privacyMode
        ? cashPct < 10
          ? 'Immediate cash is limited relative to the rest of the portfolio.'
          : 'Current cash buffer looks adequate.'
        : cashPct < 10
          ? 'Immediate cash is limited versus the rest of the portfolio.'
          : 'You have enough immediate liquidity relative to assets.',
      severity: cashPct < 10 ? 'watch' : 'healthy',
      value: privacyMode ? undefined : formatPct(cashPct),
      nextStep: cashPct < 10 ? 'Consider building a bigger emergency / operating cash buffer.' : 'Maintain this buffer unless near-term obligations rise.',
    })

    cards.push({
      title: usExposure && toNumber(usExposure.percentage) > 0 ? 'US exposure is present' : 'US exposure is minimal',
      explanation: privacyMode
        ? usExposure && toNumber(usExposure.percentage) > 0
          ? 'Foreign market exposure adds diversification and FX sensitivity.'
          : 'Portfolio remains largely INR-linked today.'
        : usExposure && toNumber(usExposure.percentage) > 0
          ? 'Foreign market exposure adds diversification and FX sensitivity.'
          : 'Portfolio remains largely INR-linked today.',
      severity: usExposure && toNumber(usExposure.percentage) >= 15 ? 'watch' : 'neutral',
      value: privacyMode || !usExposure ? undefined : formatPct(toNumber(usExposure.percentage)),
      nextStep: usExposure && toNumber(usExposure.percentage) >= 15 ? 'Track USD/INR and keep FX assumptions current.' : 'Add only if you want more geographic diversification.',
    })

    return cards.slice(0, 4)
  }, [intelligence, privacyMode])

  const riskItems = useMemo<RiskItem[]>(() => {
    if (!intelligence || !dashboardSummary) return []
    const totalAssets = toNumber(intelligence.net_worth.total_assets)
    const immediateCash = toNumber(intelligence.net_worth.liquid_assets)
    const largest = intelligence.top_movers.largest_allocation
    const equityExposure = intelligence.risk_allocation
      .filter((item) => item.key === 'equity' || item.key === 'funds')
      .reduce((sum, item) => sum + toNumber(item.percentage), 0)
    const usExposure = intelligence.asset_allocation.find((item) => item.key === 'stock_us')
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

  const actionPlan = useMemo<ActionItem[]>(() => {
    if (!intelligence || !dashboardSummary) return []
    const items: ActionItem[] = []
    const totalAssets = toNumber(intelligence.net_worth.total_assets)
    const cashPct = totalAssets > 0 ? (toNumber(intelligence.net_worth.liquid_assets) / totalAssets) * 100 : 0
    const largest = intelligence.top_movers.largest_allocation
    const utilization = toNumber(dashboardSummary.overall_card_utilization)

    if (!intelligence.cashflow_context.has_data) {
      items.push({
        title: 'Add monthly cashflow data',
        why: 'Savings rate and spending health remain incomplete without monthly inflow/outflow data.',
        nextStep: 'Add this month’s income and expense summary from your Money Manager app.',
        severity: 'action',
      })
    }

    if (largest && toNumber(largest.percentage) >= 40) {
      items.push({
        title: `Review ${largest.label} concentration`,
        why: 'One allocation bucket is dominating portfolio mix.',
        nextStep: 'Check if this concentration is intentional or needs gradual rebalancing.',
        severity: 'watch',
      })
    }

    if (cashPct < 10) {
      items.push({
        title: 'Build a stronger cash buffer',
        why: 'Immediate cash is low relative to total assets.',
        nextStep: 'Increase bank cash or reduce near-term discretionary deployment.',
        severity: 'watch',
      })
    }

    if (utilization >= 50 || dashboardSummary.overdue_count > 0 || dashboardSummary.due_soon_count > 0) {
      items.push({
        title: 'Review credit card due schedule',
        why: 'Utilization or payment timing could become a short-term drag.',
        nextStep: 'Pay the nearest due card first and reduce utilization where possible.',
        severity: dashboardSummary.overdue_count > 0 ? 'risk' : 'action',
      })
    }

    if (intelligence.top_movers.attention.length > 0) {
      items.push({
        title: 'Resolve flagged holding issues',
        why: `${intelligence.top_movers.attention.length} portfolio items need attention.`,
        nextStep: intelligence.top_movers.attention[0]?.detail ?? 'Review stale, manual, or concentrated holdings.',
        severity: 'action',
      })
    }

    items.push({
      title: 'Keep manual prices current',
      why: 'Intelligence quality depends on up-to-date manual and stale holdings.',
      nextStep: 'Refresh auto-supported prices and update manual holdings on review day.',
      severity: 'neutral',
    })

    return items.slice(0, 6)
  }, [dashboardSummary, intelligence])

  const performanceHeaderValue = intelligence?.performance.has_snapshots ? formatMoney(toNumber(intelligence.performance.latest_snapshot_value)) : '—'
  const performanceHeaderTone = privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence?.performance.latest_snapshot_return_pct))
  const utilization = toNumber(dashboardSummary?.overall_card_utilization)
  const snapshotCount = performance?.actual.length ?? 0
  const firstSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[0]?.current_value) : 0
  const latestSnapshotValue = snapshotCount > 0 ? toNumber(performance?.actual[snapshotCount - 1]?.current_value) : 0
  const changeSinceFirst = latestSnapshotValue - firstSnapshotValue
  const predictionReady = snapshotCount >= 3 && (performance?.predicted.length ?? 0) > 0
  const creditStatus =
    dashboardSummary?.overdue_count
      ? { label: 'Overdue', tone: 'text-rose-300 bg-rose-500/15 border border-rose-500/20' }
      : dashboardSummary?.due_soon_count
        ? { label: 'Due soon', tone: 'text-amber-300 bg-amber-500/15 border border-amber-500/20' }
        : { label: 'Clear', tone: 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/20' }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      <SectionCard className="p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="t-title text-slate-900 dark:text-white">Financial Analytics</div>
            <div className="mt-1 t-body text-slate-500 dark:text-slate-400">Net worth, risk, allocation, cashflow, and portfolio intelligence</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
              <Icon name="calendar" className="h-3.5 w-3.5" />
              Last updated {statusMeta.lastUpdated}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
              <Icon name="analytics" className="h-3.5 w-3.5" />
              Data quality {statusMeta.completeness}%
            </div>
            <div className={['inline-flex items-center gap-2 rounded-full px-3 py-2 t-badge', statusMeta.stale ? 'border border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300'].join(' ')}>
              <span className={['h-1.5 w-1.5 rounded-full', statusMeta.stale ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')} />
              {statusMeta.stale ? 'Stale' : 'Live'}
            </div>
            {statusMeta.valuesHidden ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-badge text-slate-300">
                <Icon name="viewOff" className="h-3.5 w-3.5" />
                Values hidden
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Executive Intelligence Summary" className="p-5">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-6 w-36 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {executiveCards.map((card, index) => {
              const tone = severityClasses(card.severity)
              return (
                <div key={`${card.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className={['t-section', tone.title].join(' ')}>{card.title}</div>
                    <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>
                      <Icon name={tone.icon} className="h-3.5 w-3.5" />
                      {card.severity === 'healthy' ? 'Healthy' : card.severity === 'watch' ? 'Watch' : card.severity === 'risk' ? 'Risk' : card.severity === 'action' ? 'Action' : 'Neutral'}
                    </span>
                  </div>
                  {card.value ? (
                    <div className="mt-3 t-metric text-slate-900 dark:text-white">
                      <PrivateValue value={card.value} mask="••••" hideColor />
                    </div>
                  ) : null}
                  <div className="mt-3 t-body text-slate-500 dark:text-slate-400">{card.explanation}</div>
                  {card.nextStep ? <div className="mt-3 t-meta text-slate-300 dark:text-slate-300">Next: {card.nextStep}</div> : null}
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Net Worth Snapshot" className="p-5">
        {privacyMode ? <div className="mb-4 rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 t-meta text-slate-300">Values hidden. Labels and health status remain visible.</div> : null}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          {loading || !intelligence ? (
            Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-7 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            ))
          ) : (
            <>
              <MetricCard label="Total Assets" value={formatMoney(toNumber(intelligence.net_worth.total_assets))} context="All tracked assets" />
              <MetricCard label="Total Liabilities" value={formatMoney(toNumber(intelligence.net_worth.total_liabilities))} context="Credit dues only" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
              <MetricCard label="Net Worth" value={formatMoney(toNumber(intelligence.net_worth.net_worth))} context="Assets minus liabilities" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.net_worth.net_worth))} hideColor />
              <MetricCard label="Liquid Assets" value={formatMoney(toNumber(intelligence.net_worth.liquid_assets))} context="Immediate bank cash" />
              <MetricCard label="Long-term Assets" value={formatMoney(toNumber(intelligence.net_worth.long_term_assets))} context="Investments and retirement assets" />
            </>
          )}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title="Allocation & Diversification" className="p-5">
          {!intelligence || intelligence.asset_allocation.length === 0 ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Not added</div>
          ) : (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {intelligence.asset_allocation.map((item) => (
                  <div key={item.key} className="h-full" style={{ width: `${Math.max(toNumber(item.percentage), 0)}%`, backgroundColor: allocationColors[item.key] ?? '#64748b' }} />
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {intelligence.asset_allocation.map((item) => {
                  const pct = toNumber(item.percentage)
                  const status = allocationStatus(item.key, pct)
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 dark:border-slate-700/50 dark:bg-slate-900/40">
                      <div className="inline-flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: allocationColors[item.key] ?? '#64748b' }} />
                        <div>
                          <div className="t-nav text-slate-900 dark:text-white">{item.label}</div>
                          <div className={['t-meta', status.tone].join(' ')}>{status.label}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="t-amount text-slate-900 dark:text-white">
                          <PrivateValue value={formatMoney(toNumber(item.amount))} mask="••••" hideColor />
                        </div>
                        <div className="t-meta text-slate-500 dark:text-slate-400">
                          <PrivateValue value={formatPct(pct)} mask="••••" hideColor />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Risk Diagnostics" className="p-5">
          {riskItems.length === 0 ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Not enough risk data yet.</div>
          ) : (
            <div className="space-y-3">
              {riskItems.map((item) => {
                const severity: SeverityTone = item.level === 'High' ? 'risk' : item.level === 'Medium' ? 'watch' : 'healthy'
                const tone = severityClasses(severity)
                return (
                  <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="t-section text-slate-900 dark:text-white">{item.title}</div>
                      <span className={['inline-flex items-center rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>{item.level}</span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{item.reason}</div>
                    <div className="mt-2 t-meta text-slate-300 dark:text-slate-300">Action: {item.action}</div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Action Plan" className="p-5">
          {actionPlan.length === 0 ? (
            <div className="t-body text-slate-500 dark:text-slate-400">No prioritized actions yet.</div>
          ) : (
            <div className="space-y-3">
              {actionPlan.map((item, index) => {
                const tone = severityClasses(item.severity)
                return (
                  <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="t-section text-slate-900 dark:text-white">{item.title}</div>
                      <span className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 t-badge', tone.chip].join(' ')}>
                        <Icon name={tone.icon} className="h-3.5 w-3.5" />
                        {item.severity === 'healthy' ? 'Healthy' : item.severity === 'watch' ? 'Watch' : item.severity === 'risk' ? 'Risk' : item.severity === 'action' ? 'Action' : 'Neutral'}
                      </span>
                    </div>
                    <div className="mt-2 t-body text-slate-500 dark:text-slate-400">{item.why}</div>
                    <div className="mt-2 t-meta text-slate-300 dark:text-slate-300">Next step: {item.nextStep}</div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <SectionCard title="Liquidity & Cashflow Health" className="p-5">
          {!intelligence ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading liquidity...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Immediate Cash" value={formatMoney(toNumber(intelligence.liquidity.immediate_cash))} context="Available in bank accounts" />
                <MetricCard label="Market-linked" value={formatMoney(toNumber(intelligence.liquidity.market_linked))} context="Stocks, funds, ETFs, gold" />
                <MetricCard label="Locked / Long-term" value={formatMoney(toNumber(intelligence.liquidity.locked_long_term))} context="PF / EPF and long-term savings" />
                <MetricCard label="Liabilities Due" value={formatMoney(toNumber(intelligence.liquidity.liabilities))} context="Credit card obligations" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className={sectionLabel}>Cashflow Summary</div>
                {!intelligence.cashflow_context.has_data ? (
                  <>
                    <div className="mt-2 t-section text-slate-900 dark:text-white">Monthly cashflow not added for this month</div>
                    <div className="mt-1 t-body text-slate-500 dark:text-slate-400">Add monthly income and expense summary to improve spending and buffer insights.</div>
                  </>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <MetricCard label="Income" value={formatMoney(toNumber(intelligence.cashflow_context.income))} context={`Month ${intelligence.cashflow_context.month ?? 'current'}`} tone="text-emerald-400" hideColor />
                    <MetricCard label="Spend" value={formatMoney(toNumber(intelligence.cashflow_context.spend))} context="Monthly outflow" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
                    <MetricCard label="Savings" value={formatMoney(toNumber(intelligence.cashflow_context.savings))} context="Income minus spend" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings))} hideColor />
                    <MetricCard label="Savings Rate" value={formatPct(toNumber(intelligence.cashflow_context.savings_rate))} context="Based on monthly income" tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings_rate))} hideColor />
                  </div>
                )}
                <div className="mt-3 t-meta text-slate-500 dark:text-slate-500">Cashflow is monthly summary only. Bank balances are manually managed.</div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Credit Card Health" className="p-5">
          {creditHealthError ? (
            <div className="text-sm text-rose-300">{creditHealthError}</div>
          ) : creditHealthLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 w-28 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-700" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="h-20 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-20 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ) : !dashboardSummary ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Not added</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={sectionLabel}>Due Status</div>
                  <div className="mt-2 t-section text-slate-900 dark:text-white">Credit card exposure overview</div>
                  <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">
                    {dashboardSummary.overdue_count} overdue · {dashboardSummary.due_soon_count} due soon · {creditCards.length} cards
                  </div>
                </div>
                <span className={['inline-flex items-center rounded-full px-2.5 py-1 t-badge', creditStatus.tone].join(' ')}>{creditStatus.label}</span>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="t-meta text-slate-500 dark:text-slate-400">Utilization</span>
                  <span className={['t-badge', privacyMode ? 'text-slate-300 dark:text-slate-300' : utilization >= 80 ? 'text-rose-300' : utilization >= 50 ? 'text-amber-300' : 'text-emerald-300'].join(' ')}>
                    <PrivateValue value={formatPct(utilization)} mask="••••" hideColor />
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={utilization >= 80 ? 'h-full bg-rose-400' : utilization >= 50 ? 'h-full bg-amber-400' : 'h-full bg-emerald-400'}
                    style={{ width: `${Math.min(Math.max(utilization, 0), 100)}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Total Dues" value={formatMoney(toNumber(dashboardSummary.total_credit_card_dues))} context={`${dashboardSummary.overdue_count} overdue · ${dashboardSummary.due_soon_count} due soon`} tone={privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'} hideColor />
                <MetricCard label="Total Limit" value={formatMoney(toNumber(dashboardSummary.total_card_limit))} context={privacyMode ? `${creditCards.length} cards tracked` : `Used ${formatMoney(toNumber(dashboardSummary.total_card_used))}`} />
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
            <div className={['t-nav', performanceHeaderTone].join(' ')}>
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

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Movers & Attention" className="p-5">
          {!intelligence ? (
            <div className="t-body text-slate-500 dark:text-slate-400">Loading analysis...</div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <div className="mb-2 t-micro text-slate-500 dark:text-slate-500">Biggest Gainers</div>
                <div className="space-y-2">
                  {intelligence.top_movers.biggest_gainers.length === 0 ? (
                    <div className="t-body text-slate-500 dark:text-slate-400">No gainers yet</div>
                  ) : (
                    intelligence.top_movers.biggest_gainers.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="t-section text-slate-900 dark:text-white">{item.symbol}</div>
                            <div className="truncate t-meta text-slate-500 dark:text-slate-400">{item.company_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="t-amount text-emerald-400"><PrivateValue value={formatINR(toNumber(item.pnl))} mask="••••" hideColor /></div>
                            <div className="t-meta text-emerald-300"><PrivateValue value={formatPct(toNumber(item.return_pct))} mask="••••" hideColor /></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 t-micro text-slate-500 dark:text-slate-500">Biggest Losers</div>
                <div className="space-y-2">
                  {intelligence.top_movers.biggest_losers.length === 0 ? (
                    <div className="t-body text-slate-500 dark:text-slate-400">No losers yet</div>
                  ) : (
                    intelligence.top_movers.biggest_losers.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="t-section text-slate-900 dark:text-white">{item.symbol}</div>
                            <div className="truncate t-meta text-slate-500 dark:text-slate-400">{item.company_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="t-amount text-rose-400"><PrivateValue value={formatINR(toNumber(item.pnl))} mask="••••" hideColor /></div>
                            <div className="t-meta text-rose-300"><PrivateValue value={formatPct(toNumber(item.return_pct))} mask="••••" hideColor /></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 t-micro text-slate-500 dark:text-slate-500">Needs Attention</div>
                <div className="space-y-2">
                  {intelligence.top_movers.attention.length === 0 ? (
                    <div className="t-body text-slate-500 dark:text-slate-400">All clear</div>
                  ) : (
                    intelligence.top_movers.attention.slice(0, 4).map((item, index) => (
                      <div key={`${item.label}-${index}`} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3">
                        <div className="t-section text-amber-200">{item.label}</div>
                        <div className="mt-1 t-meta text-amber-100/80">{item.detail}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
