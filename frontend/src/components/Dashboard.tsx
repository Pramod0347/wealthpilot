import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Icon } from './Icon'
import { ApiError, apiFetch, getBankAccounts, type BankAccount } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'

type ApiDashboardSummary = {
  total_invested: string | number
  current_value: string | number
  total_bank_cash: string | number
  bank_accounts_count: number
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
  allocations?: Array<{
    asset_type: string
    label: string
    amount: string | number
    percentage: string | number
  }>
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

type ApiPortfolioPerformance = {
  range: '1M' | '3M' | '6M' | '1Y' | 'ALL'
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

type PortfolioRange = '1M' | '3M' | '6M' | '1Y' | 'ALL'

type ChartPoint = {
  date: string
  label: string
  actual_value: number | null
  predicted_value: number | null
}

type MetricCard = {
  label: string
  value: string
  meta: string
  icon: 'netWorth' | 'portfolio' | 'analytics' | 'cards' | 'up'
  iconBg: string
  valueClass?: string
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

const timeFilters: Array<{ label: string; value: PortfolioRange }> = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'All', value: 'ALL' },
]

const assetTypePalette: Record<string, { label: string; color: string }> = {
  stock_in: { label: 'Indian Stocks', color: '#0d9488' },
  stock_us: { label: 'US Stocks', color: '#38bdf8' },
  stock: { label: 'Indian Stocks', color: '#0d9488' },
  etf: { label: 'ETFs', color: '#0ea5e9' },
  mutual_fund: { label: 'Mutual Funds', color: '#a78bfa' },
  cash: { label: 'Cash', color: '#f59e0b' },
  other: { label: 'Other Assets', color: '#64748b' },
  banks: { label: 'Banks', color: '#f97316' },
}

const nonInvestmentPlaceholders: Array<{ label: string; value: string; meta: string; icon: 'cards' | 'portfolio' | 'analytics' }> = [
  { label: 'PF / EPF', value: 'Not added', meta: 'Provident fund not connected yet', icon: 'analytics' },
  { label: 'Monthly Spend', value: 'Transactions not added', meta: 'Spends module not connected yet', icon: 'cards' },
]

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatMoney(value: number) {
  if (Math.abs(value) >= 100000) {
    return formatINRShort(value)
  }

  return formatINR(value)
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors
        .map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`)
        .join('\n')
    }

    return error.message || 'Request failed'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function getAssetTypeMeta(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  return assetTypePalette[normalized] ?? assetTypePalette.other
}

function getAssetTypeBadgeClass(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  if (normalized === 'stock' || normalized === 'stock_in') return 'bg-accent-500/15 text-accent-400'
  if (normalized === 'stock_us') return 'bg-sky-500/15 text-sky-400'
  if (normalized === 'etf') return 'bg-sky-500/15 text-sky-400'
  if (normalized === 'mutual_fund') return 'bg-violet-500/15 text-violet-400'
  if (normalized === 'cash') return 'bg-amber-500/15 text-amber-400'
  return 'bg-slate-700 text-slate-300'
}

function getCardTone(status: ApiCreditCard['status']) {
  if (status === 'paid') return 'emerald'
  if (status === 'due_soon') return 'amber'
  return 'rose'
}

function buildPortfolioChartData(performance: ApiPortfolioPerformance | null): ChartPoint[] {
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
    const current = rows.get(point.date)
    rows.set(point.date, {
      date: point.date,
      label: formatChartDate(point.date),
      actual_value: current?.actual_value ?? null,
      predicted_value: toNumber(point.current_value),
    })
  })

  return Array.from(rows.values()).sort((left, right) => {
    return new Date(left.date).getTime() - new Date(right.date).getTime()
  })
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
      }
    })
  }

  const totals = holdings.reduce<Record<string, { label: string; value: number; color: string }>>((accumulator, holding) => {
    const key =
      holding.country === 'US'
        ? 'stock_us'
        : holding.asset_type === 'stock'
          ? 'stock_in'
          : (holding.asset_type || 'other').toLowerCase()
    const meta = getAssetTypeMeta(key)
    accumulator[key] = {
      label: meta.label,
      value: (accumulator[key]?.value ?? 0) + toNumber(holding.current_value),
      color: meta.color,
    }
    return accumulator
  }, {})

  const totalValue = Object.values(totals).reduce((accumulator, item) => accumulator + item.value, 0)

  return Object.entries(totals).map(([key, item]) => ({
    key,
    label: item.label,
    value: item.value,
    percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
    color: item.color,
  }))
}

function buildMetricCards(summary: ApiDashboardSummary | null, loading: boolean, error: string | null): MetricCard[] {
  if (loading) {
    return [
      { label: 'Portfolio Value', value: 'Loading...', meta: 'Fetching holdings', icon: 'portfolio', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total Invested', value: 'Loading...', meta: 'Fetching holdings', icon: 'analytics', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Card Dues', value: 'Loading...', meta: 'Fetching credit cards', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Card Limit', value: 'Loading...', meta: 'Fetching credit cards', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Used Amount', value: 'Loading...', meta: 'Fetching credit cards', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Utilization', value: 'Loading...', meta: 'Fetching credit cards', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
    ]
  }

  if (error || !summary) {
    return [
      { label: 'Portfolio Value', value: '—', meta: error ?? 'No data available', icon: 'portfolio', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total Invested', value: '—', meta: error ?? 'No data available', icon: 'analytics', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Card Dues', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Card Limit', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Used Amount', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Utilization', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
    ]
  }

  const currentValue = toNumber(summary.current_value)
  const totalInvested = toNumber(summary.total_invested)
  const totalDues = toNumber(summary.total_credit_card_dues)
  const totalCardLimit = toNumber(summary.total_card_limit)
  const totalCardUsed = toNumber(summary.total_card_used)
  const utilization = toNumber(summary.overall_card_utilization)

  return [
    {
      label: 'Portfolio Value',
      value: formatMoney(currentValue),
      meta: `${summary.holdings_count} holdings`,
      icon: 'portfolio',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Total Invested',
      value: formatMoney(totalInvested),
      meta: 'From holdings',
      icon: 'analytics',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Card Dues',
      value: formatMoney(totalDues),
      meta: `${summary.overdue_count} overdue · ${summary.due_soon_count} due soon`,
      icon: 'cards',
      iconBg: 'bg-amber-500/20 text-amber-400',
      valueClass: totalDues > 0 ? 'text-amber-300' : 'text-slate-300',
    },
    {
      label: 'Card Limit',
      value: formatMoney(totalCardLimit),
      meta: 'Across all cards',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Used Amount',
      value: formatMoney(totalCardUsed),
      meta: 'Swipes + billed amounts',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Utilization',
      value: `${utilization.toFixed(2)}%`,
      meta: 'Overall card utilization',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
      valueClass:
        utilization === 0 ? 'text-slate-300' : utilization >= 80 ? 'text-rose-400' : utilization >= 50 ? 'text-amber-400' : 'text-emerald-400',
    },
  ]
}

function buildActionItems(cards: ApiCreditCard[], summary: ApiDashboardSummary | null, performance: ApiPortfolioPerformance | null): ActionItem[] {
  const urgentCards = [...cards]
    .filter((card) => card.status !== 'paid')
    .sort((left, right) => {
      const priority = { overdue: 0, due_soon: 1, paid: 2 } as const
      return priority[left.status] - priority[right.status]
    })
    .slice(0, 3)

  const items: ActionItem[] = urgentCards.map((card) => ({
    title: `${card.card_name}`,
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
      subtitle:
        performance?.actual?.length && summary
          ? `Portfolio value ${formatMoney(toNumber(summary.current_value))} with no overdue or due-soon cards.`
          : 'No overdue cards and no urgent portfolio alerts.',
    })
  }

  return items
}

function buildUpcomingPayments(cards: ApiCreditCard[]) {
  return [...cards]
    .filter((card) => card.status !== 'paid')
    .sort((left, right) => {
      const priority = { overdue: 0, due_soon: 1, paid: 2 } as const
      return priority[left.status] - priority[right.status]
    })
    .slice(0, 5)
}

function buildInsights(summary: ApiDashboardSummary | null, holdings: ApiHolding[], cards: ApiCreditCard[], performance: ApiPortfolioPerformance | null): InsightItem[] {
  const insights: InsightItem[] = []
  const allocation = buildAllocationData(summary, holdings)
  const topAllocation = allocation
    .filter((entry) => entry.key === 'stock_in' || entry.key === 'stock_us' || entry.key === 'etf' || entry.key === 'mutual_fund')
    .sort((left, right) => right.percentage - left.percentage)[0]

  if (topAllocation && topAllocation.percentage >= 35) {
    insights.push({
      tone: 'amber',
      text: `${topAllocation.label} are concentrated at ${topAllocation.percentage.toFixed(1)}% of holdings. Consider diversifying when you add new positions.`,
    })
  }

  const urgentCards = cards.filter((card) => card.status !== 'paid')
  if (urgentCards.length > 0) {
    const topUrgent = urgentCards.sort((left, right) => toNumber(right.current_bill_amount) - toNumber(left.current_bill_amount))[0]
    insights.push({
      tone: topUrgent.status === 'overdue' ? 'rose' : 'amber',
      text: `${topUrgent.card_name} bill of ${formatMoney(toNumber(topUrgent.current_bill_amount))} is ${topUrgent.status === 'overdue' ? 'overdue' : 'due soon'}.`,
    })
  }

  const latestReturn = performance?.actual.at(-1)?.total_return_pct
  if (latestReturn !== undefined && latestReturn !== null) {
    const numericReturn = toNumber(latestReturn)
    if (numericReturn !== 0) {
      insights.push({
        tone: numericReturn > 0 ? 'emerald' : 'rose',
        text: `Portfolio return is ${formatSignedPct(numericReturn)} on the latest snapshot.`,
      })
    }
  }

  return insights.slice(0, 3)
}

function SectionCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors duration-200 ease-out hover:border-slate-600/60 motion-reduce:transition-none',
        className,
      ].join(' ')}
    >
      {title ? <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5 t-section text-white">{title}</div> : null}
      {children}
    </section>
  )
}

function MetricCardView({ card }: { card: MetricCard }) {
  return (
    <SectionCard className="px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="t-label text-slate-400">{card.label}</div>
          <div className={['t-metric mt-6 text-white', card.valueClass].filter(Boolean).join(' ')}>{card.value}</div>
          <div className="t-meta mt-4 text-slate-400">{card.meta}</div>
        </div>
        <div className={['grid h-12 w-12 shrink-0 place-items-center rounded-[6px]', card.iconBg].join(' ')}>
          <Icon name={card.icon} className="h-5 w-5" />
        </div>
      </div>
    </SectionCard>
  )
}

function PlaceholderCardView({
  label,
  value,
  meta,
  icon,
}: {
  label: string
  value: string
  meta: string
  icon: 'cards' | 'portfolio' | 'analytics'
}) {
  return (
    <SectionCard className="px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="t-label text-slate-400">{label}</div>
          <div className="t-metric mt-6 text-slate-100">{value}</div>
          <div className="t-meta mt-4 text-slate-400">{meta}</div>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-slate-800 text-slate-300">
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </SectionCard>
  )
}

export default function Dashboard({
  onOpenStocks,
  onOpenCards,
}: {
  onOpenStocks?: () => void
  onOpenCards?: () => void
} = {}) {
  const [activeFilter, setActiveFilter] = useState<PortfolioRange>('6M')
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null)
  const [holdings, setHoldings] = useState<ApiHolding[]>([])
  const [creditCards, setCreditCards] = useState<ApiCreditCard[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [portfolioPerformance, setPortfolioPerformance] = useState<ApiPortfolioPerformance | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [holdingsLoading, setHoldingsLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(true)
  const [bankAccountsLoading, setBankAccountsLoading] = useState(true)
  const [portfolioLoading, setPortfolioLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [cardsError, setCardsError] = useState<string | null>(null)
  const [bankAccountsError, setBankAccountsError] = useState<string | null>(null)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [savingSnapshot, setSavingSnapshot] = useState(false)

  const loadDashboardData = async (signal?: AbortSignal) => {
    setSummaryLoading(true)
    setHoldingsLoading(true)
    setCardsLoading(true)
    setBankAccountsLoading(true)
    setBankAccountsError(null)
    setSummaryError(null)
    setHoldingsError(null)
    setCardsError(null)

    const [summaryResult, holdingsResult, cardsResult, bankAccountsResult] = await Promise.allSettled([
      apiFetch<ApiDashboardSummary>('/api/dashboard/summary', { signal }),
      apiFetch<ApiHolding[]>('/api/holdings', { signal }),
      apiFetch<ApiCreditCard[]>('/api/credit-cards', { signal }),
      getBankAccounts(signal),
    ])

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value)
    } else if (summaryResult.reason?.name !== 'AbortError') {
      setSummaryError(formatApiError(summaryResult.reason))
      setSummary(null)
    }
    setSummaryLoading(false)

    if (holdingsResult.status === 'fulfilled') {
      setHoldings(holdingsResult.value)
    } else if (holdingsResult.reason?.name !== 'AbortError') {
      setHoldingsError(formatApiError(holdingsResult.reason))
      setHoldings([])
    }
    setHoldingsLoading(false)

    if (cardsResult.status === 'fulfilled') {
      setCreditCards(cardsResult.value)
    } else if (cardsResult.reason?.name !== 'AbortError') {
      setCardsError(formatApiError(cardsResult.reason))
      setCreditCards([])
    }
    setCardsLoading(false)

    if (bankAccountsResult.status === 'fulfilled') {
      setBankAccounts(bankAccountsResult.value)
    } else if (bankAccountsResult.reason?.name !== 'AbortError') {
      setBankAccountsError(formatApiError(bankAccountsResult.reason))
      setBankAccounts([])
    }
    setBankAccountsLoading(false)
  }

  const loadPortfolioPerformance = async (signal?: AbortSignal) => {
    setPortfolioLoading(true)
    setPortfolioError(null)

    try {
      const response = await apiFetch<ApiPortfolioPerformance>(`/api/portfolio/performance?range=${activeFilter}`, { signal })
      setPortfolioPerformance(response)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      setPortfolioError(formatApiError(error))
    } finally {
      setPortfolioLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadDashboardData(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = formatApiError(error)
      setSummaryError(message)
      setHoldingsError(message)
      setCardsError(message)
      setBankAccountsError(message)
      setSummaryLoading(false)
      setHoldingsLoading(false)
      setCardsLoading(false)
      setBankAccountsLoading(false)
    })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadPortfolioPerformance(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPortfolioError(formatApiError(error))
      setPortfolioLoading(false)
    })
    return () => controller.abort()
  }, [activeFilter])

  const allocationData = useMemo(() => buildAllocationData(summary, holdings), [holdings, summary])
  const equityExposurePct = useMemo(() => {
    if (allocationData.length === 0) return 0
    return allocationData.reduce((accumulator, entry) => {
      return entry.key === 'stock_in' || entry.key === 'stock' || entry.key === 'etf' ? accumulator + entry.percentage : accumulator
    }, 0)
  }, [allocationData])

  const portfolioChartData = useMemo(() => buildPortfolioChartData(portfolioPerformance), [portfolioPerformance])
  const metricCards = useMemo(() => buildMetricCards(summary, summaryLoading, summaryError), [summary, summaryLoading, summaryError])
  const usStocksValue = useMemo(
    () =>
      holdings.reduce((accumulator, holding) => {
        return holding.country === 'US' ? accumulator + toNumber(holding.current_value) : accumulator
      }, 0),
    [holdings],
  )
  const actionItems = useMemo(() => buildActionItems(creditCards, summary, portfolioPerformance), [creditCards, portfolioPerformance, summary])
  const upcomingPayments = useMemo(() => buildUpcomingPayments(creditCards), [creditCards])
  const insights = useMemo(() => buildInsights(summary, holdings, creditCards, portfolioPerformance), [creditCards, holdings, portfolioPerformance, summary])

  const latestHoldingUpdate = useMemo(() => {
    const timestamps = holdings
      .map((holding) => holding.updated_at)
      .concat(holdings.map((holding) => holding.last_price_refreshed_at).filter(Boolean) as string[])
      .concat(creditCards.map((card) => card.updated_at))
      .concat(bankAccounts.map((account) => account.updated_at))
      .filter(Boolean)

    if (timestamps.length === 0) {
      return null
    }

    return timestamps
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  }, [bankAccounts, creditCards, holdings])

  const latestSnapshotValue = portfolioPerformance?.actual.at(-1)?.current_value
  const latestSnapshotReturn = portfolioPerformance?.actual.at(-1)?.total_return_pct
  const netWorth = toNumber(summary?.net_worth)
  const portfolioHasSnapshots = (portfolioPerformance?.actual.length ?? 0) > 0

  const latestStatus = useMemo(() => {
    if (summaryLoading || holdingsLoading || cardsLoading) {
      return 'Loading live backend data...'
    }

    const parts: string[] = []
    if (summary) {
      parts.push(`${summary.holdings_count} holdings`)
      parts.push(`${creditCards.length} cards`)
      parts.push(`${summary.bank_accounts_count ?? bankAccounts.length} banks`)
    }

    const updated = latestHoldingUpdate ? formatDateTime(latestHoldingUpdate.toISOString()) : 'Awaiting backend updates'
    if (parts.length > 0) {
      parts.push(updated)
      return parts.join(' • ')
    }

    return updated
  }, [bankAccounts.length, bankAccountsLoading, cardsLoading, creditCards.length, holdingsLoading, latestHoldingUpdate, summary, summaryLoading])

  async function handleSaveTodaySnapshot() {
    setSavingSnapshot(true)
    setStatusMessage(null)

    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage("Saved today's snapshot.")
      await loadPortfolioPerformance()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setSavingSnapshot(false)
    }
  }

  const chartMessage = portfolioPerformance?.message
  const portfolioEmptyState = !portfolioLoading && !portfolioHasSnapshots && chartMessage?.includes('No portfolio snapshots yet')

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        {statusMessage ? (
          <div
            className={[
              'rounded-[6px] border px-4 py-3 t-body',
              statusTone === 'emerald'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : statusTone === 'amber'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                  : statusTone === 'rose'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200',
            ].join(' ')}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="t-section text-white">Dashboard Overview</div>
            <div className="mt-1 t-meta text-slate-400">{latestStatus}</div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onOpenStocks}
              className="flex h-12 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body font-semibold text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
            >
              <Icon name="stocks" className="h-4 w-4" />
              Open Stocks
            </button>

            <button
              type="button"
              onClick={onOpenCards}
              className="flex h-12 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body font-semibold text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
            >
              <Icon name="cards" className="h-4 w-4" />
              Open Credit Cards
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <SectionCard className="px-6 py-6">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="t-section text-white">Net Worth</div>
                <div className={['mt-4 t-metric-hero', getTrendClass(netWorth)].join(' ')}>
                  {summaryLoading ? 'Loading...' : formatMoney(netWorth)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3">
                    <div className="t-micro uppercase text-slate-400">Assets</div>
                    <div className="mt-1 t-nav text-white">
                      {summaryLoading ? 'Loading...' : formatMoney(toNumber(summary?.total_assets))}
                    </div>
                    <div className="mt-1 t-meta text-slate-400">
                      {summaryLoading
                        ? 'Fetching holdings and banks'
                        : `${summary?.holdings_count ?? 0} holdings · ${summary?.bank_accounts_count ?? 0} bank accounts`}
                    </div>
                  </div>

                  <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3">
                    <div className="t-micro uppercase text-slate-400">Liabilities</div>
                    <div className={['mt-1 t-nav', toNumber(summary?.total_liabilities) > 0 ? 'text-rose-400' : 'text-slate-300'].join(' ')}>
                      {summaryLoading ? 'Loading...' : formatMoney(toNumber(summary?.total_liabilities))}
                    </div>
                    <div className="mt-1 t-meta text-slate-400">{summaryLoading ? 'Fetching credit cards' : `${summary?.overdue_count ?? 0} overdue · ${summary?.due_soon_count ?? 0} due soon`}</div>
                  </div>

                  <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3">
                    <div className="t-micro uppercase text-slate-400">Last updated</div>
                    <div className="mt-1 t-nav text-white">{latestHoldingUpdate ? formatDateTime(latestHoldingUpdate.toISOString()) : 'Awaiting backend data'}</div>
                    <div className="mt-1 t-meta text-slate-400">Holdings and credit card sync</div>
                  </div>
                </div>
              </div>

              <div className="min-w-[240px] rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                <div className="t-micro uppercase text-slate-400">Composition</div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                  {allocationData.length > 0 ? (
                    <div className="flex h-full w-full">
                      {allocationData.map((entry) => (
                        <div
                          key={entry.key}
                          className="h-full"
                          style={{ width: `${Math.max(entry.percentage, 0)}%`, backgroundColor: entry.color }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full w-full bg-slate-800" />
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {allocationData.length > 0 ? (
                    allocationData.map((entry) => (
                      <div key={entry.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                          <span className="t-body text-slate-200">{entry.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="t-nav text-white">{entry.percentage.toFixed(1)}%</div>
                          <div className="t-meta text-slate-400">{formatMoney(entry.value)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.55)] bg-[#11192d] px-4 py-5 text-center">
                      <div className="t-section text-white">No allocation yet</div>
                      <div className="mt-2 t-body text-slate-400">Add holdings to populate asset allocation.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Action Center</div>
            <div className="mt-1 t-body text-slate-400">Urgent items from credit cards and portfolio status.</div>

            <div className="mt-5 space-y-3">
              {actionItems.map((item) => (
                <div key={`${item.title}-${item.amount}`} className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="t-nav truncate text-white">{item.title}</div>
                      <div className="mt-1 t-meta text-slate-400">{item.subtitle}</div>
                    </div>
                    <div className="text-right">
                      <div
                        className={[
                          't-nav',
                          item.statusTone === 'emerald'
                            ? 'text-emerald-400'
                            : item.statusTone === 'amber'
                              ? 'text-amber-400'
                              : item.statusTone === 'rose'
                                ? 'text-rose-400'
                                : 'text-slate-300',
                        ].join(' ')}
                      >
                        {item.amount}
                      </div>
                      <div
                        className={[
                          'mt-2 inline-flex rounded-[999px] px-3 py-1 t-badge',
                          item.statusTone === 'emerald'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : item.statusTone === 'amber'
                              ? 'bg-amber-500/15 text-amber-400'
                              : item.statusTone === 'rose'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-slate-700 text-slate-300',
                        ].join(' ')}
                      >
                        {item.statusLabel}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-4">
              <div className="t-micro uppercase text-slate-400">Portfolio status</div>
              <div className="mt-2 t-body text-slate-200">
                {portfolioHasSnapshots
                  ? `Latest snapshot value ${formatMoney(toNumber(latestSnapshotValue))} with return ${formatSignedPct(toNumber(latestSnapshotReturn ?? 0))}.`
                  : 'Save today’s snapshot to start tracking performance.'}
              </div>
            </div>
          </SectionCard>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((card) => (
            <MetricCardView key={card.label} card={card} />
          ))}
          <SectionCard className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="t-label text-slate-400">Banks</div>
                <div className={['t-metric mt-6', toNumber(summary?.total_bank_cash) > 0 ? 'text-white' : 'text-slate-300'].join(' ')}>
                  {toNumber(summary?.total_bank_cash) > 0 ? formatMoney(toNumber(summary?.total_bank_cash)) : 'Not added'}
                </div>
                <div className="t-meta mt-4 text-slate-400">
                  {toNumber(summary?.total_bank_cash) > 0
                    ? `${summary?.bank_accounts_count ?? bankAccounts.length} bank accounts`
                    : 'Bank balances not added yet'}
                </div>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-orange-500/15 text-orange-400">
                <Icon name="banks" className="h-5 w-5" />
              </div>
            </div>
          </SectionCard>
          <SectionCard className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="t-label text-slate-400">US Stocks</div>
                <div className={['t-metric mt-6', usStocksValue > 0 ? 'text-white' : 'text-slate-300'].join(' ')}>
                  {usStocksValue > 0 ? formatMoney(usStocksValue) : 'Not added'}
                </div>
                <div className="t-meta mt-4 text-slate-400">
                  {usStocksValue > 0 ? 'From US holdings in the same table' : 'US portfolio not connected yet'}
                </div>
              </div>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-sky-500/15 text-sky-400">
                <Icon name="portfolio" className="h-5 w-5" />
              </div>
            </div>
          </SectionCard>
          {nonInvestmentPlaceholders.map((card) => (
            <PlaceholderCardView key={card.label} {...card} />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)]">
          <SectionCard className="px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="t-section text-white">Portfolio Performance</div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="t-metric-hero text-white">
                    {portfolioLoading ? 'Loading...' : portfolioHasSnapshots ? formatMoney(toNumber(latestSnapshotValue)) : 'No portfolio history yet'}
                  </div>
                  {portfolioHasSnapshots ? (
                    <div className={['rounded-[6px] px-3 py-1 t-badge', getTrendClass(toNumber(latestSnapshotReturn ?? 0))].join(' ')}>
                      {formatSignedPct(toNumber(latestSnapshotReturn ?? 0))}
                    </div>
                  ) : null}
                  <div className="t-body text-slate-400">{portfolioHasSnapshots ? 'from snapshots' : 'waiting for snapshots'}</div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveTodaySnapshot}
                  disabled={savingSnapshot}
                  className="flex h-10 items-center gap-2 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-badge font-semibold text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
                >
                  <Icon name="download" className={['h-4 w-4', savingSnapshot ? 'animate-pulse' : ''].join(' ')} />
                  {savingSnapshot ? 'Saving...' : "Save Today's Snapshot"}
                </button>

                <div className="flex items-center rounded-[6px] bg-[#2b364e] p-1">
                  {timeFilters.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setActiveFilter(filter.value)}
                      className={[
                        'h-9 rounded-[6px] px-4 t-nav transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                        activeFilter === filter.value ? 'bg-[#404d68] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                      ].join(' ')}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6">
              {portfolioLoading ? (
                <div className="flex h-[380px] items-center justify-center rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a]">
                  <div className="text-center">
                    <div className="t-section text-white">Loading portfolio snapshots...</div>
                    <div className="mt-2 t-body text-slate-400">Fetching actual and predicted data from the backend.</div>
                  </div>
                </div>
              ) : portfolioEmptyState ? (
                <div className="flex h-[380px] items-center justify-center rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] px-8 text-center">
                  <div>
                    <div className="t-section text-white">No portfolio history yet</div>
                    <div className="mt-2 t-body text-slate-400">Save today&apos;s snapshot to start tracking performance.</div>
                    <button
                      type="button"
                      onClick={handleSaveTodaySnapshot}
                      className="mt-5 inline-flex h-11 items-center gap-2 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] active:scale-[0.98] motion-reduce:transition-none"
                    >
                      <Icon name="download" className="h-4 w-4" />
                      Save Today&apos;s Snapshot
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {portfolioError ? (
                    <div className="mb-4 rounded-[6px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 t-meta text-rose-200">
                      Unable to load portfolio performance: {portfolioError}
                    </div>
                  ) : null}

                  <div className="mb-3 flex flex-wrap items-center gap-4 t-meta text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-accent-600" />
                      Actual
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full border border-amber-400 bg-transparent" />
                      Predicted
                    </span>
                  </div>

                  <div className="h-[380px] min-w-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={portfolioChartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(51,65,85,0.55)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={52}
                          tickFormatter={(value) => formatINRShort(Number(value))}
                        />
                        <Tooltip
                          contentStyle={{
                            background: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            color: '#e2e8f0',
                          }}
                          labelFormatter={(label) => label}
                          formatter={(value, name) => {
                            if (value === null || value === undefined) {
                              return ['-', name === 'actual_value' ? 'Actual' : 'Predicted']
                            }

                            return [formatINRShort(Number(value)), name === 'actual_value' ? 'Actual' : 'Predicted']
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual_value"
                          stroke="#0d9488"
                          strokeWidth={3}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="predicted_value"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          strokeDasharray="8 6"
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {chartMessage && chartMessage !== 'No portfolio snapshots yet' ? (
                    <div className="mt-4 rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3 t-body text-slate-300">
                      {chartMessage}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Asset Allocation</div>
            <div className="mt-1 t-body text-slate-400">By current market value</div>
            <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
              {allocationData.length > 0 ? (
                <>
                  <div className="relative mx-auto h-[180px] w-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={allocationData}
                          dataKey="value"
                          innerRadius={58}
                          outerRadius={84}
                          paddingAngle={3}
                          stroke="transparent"
                        >
                          {allocationData.map((entry) => (
                            <Cell key={entry.key} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <div className="t-meta uppercase text-slate-400">Total assets</div>
                      <div className="mt-1 font-mono text-[18px] font-bold tabular-nums text-white">{formatMoney(toNumber(summary?.current_value))}</div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    {allocationData.map((entry) => (
                      <div key={entry.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                          <span className="t-body text-slate-200">{entry.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="t-nav text-white">{entry.percentage.toFixed(1)}%</div>
                          <div className="t-meta">{formatMoney(entry.value)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="md:col-span-2">
                  <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                    <div className="t-section text-white">No allocation data</div>
                    <div className="mt-2 t-body text-slate-400">Add holdings to populate the allocation chart.</div>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[rgba(51,65,85,0.45)] pt-4">
              <div>
                <div className="t-meta uppercase text-slate-400">Equity exposure</div>
                <div className="mt-1 t-nav text-white">{formatPct(equityExposurePct)}</div>
              </div>
              <div>
                <div className="t-meta uppercase text-slate-400">Diversification</div>
                <div className="mt-1 t-nav text-emerald-400">• Balanced</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Accounts</div>
            <div className="mt-1 t-body text-slate-400">Real holdings and card summaries, plus placeholders for modules not added yet.</div>
            <div className="mt-5 space-y-4">
              <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="t-nav text-white">Holdings</div>
                    <div className="mt-1 t-meta text-slate-400">{summary?.holdings_count ?? 0} positions</div>
                  </div>
                  <div className="text-right">
                    <div className="t-nav text-white">{summaryLoading ? 'Loading...' : formatMoney(toNumber(summary?.current_value))}</div>
                    <div className="mt-1 t-meta text-slate-400">Current value</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="t-nav text-white">Credit Cards</div>
                    <div className="mt-1 t-meta text-slate-400">{creditCards.length} cards</div>
                  </div>
                  <div className="text-right">
                    <div className="t-nav text-white">{summaryLoading ? 'Loading...' : formatMoney(toNumber(summary?.total_credit_card_dues))}</div>
                    <div className="mt-1 t-meta text-slate-400">Total dues</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="t-nav text-white">Banks</div>
                    <div className="mt-1 t-meta text-slate-400">
                      {bankAccountsLoading
                        ? 'Loading accounts...'
                        : bankAccountsError
                        ? bankAccountsError
                        : bankAccounts.length > 0
                          ? `${bankAccounts.length} accounts`
                          : 'Not added yet'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="t-nav text-white">
                      {summaryLoading ? 'Loading...' : toNumber(summary?.total_bank_cash) > 0 ? formatMoney(toNumber(summary?.total_bank_cash)) : 'Not added'}
                    </div>
                    <div className="mt-1 t-meta text-slate-400">Total cash</div>
                  </div>
                </div>
                {bankAccountsLoading ? (
                  <div className="mt-4 rounded-[6px] border border-[rgba(51,65,85,0.35)] bg-[#11192d] px-3 py-3 t-meta text-slate-400">
                    Loading bank accounts...
                  </div>
                ) : bankAccounts.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {bankAccounts.map((account) => (
                      <div key={account.id} className="flex items-start justify-between gap-3 rounded-[6px] border border-[rgba(51,65,85,0.35)] bg-[#11192d] px-3 py-3">
                        <div className="min-w-0">
                          <div className="t-body text-white">{account.bank_name}</div>
                          <div className="mt-1 t-meta text-slate-400">
                            {account.account_name ? `${account.account_name} · ` : ''}
                            {account.account_number_last4 ? `••${account.account_number_last4} · ` : ''}
                            {account.account_type}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="t-nav text-white">{formatMoney(toNumber(account.balance))}</div>
                          <div className="mt-1 t-meta text-slate-400">{account.as_of_date ? formatDisplayDate(account.as_of_date) : 'No date'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                <div className="t-nav text-white">PF / EPF</div>
                <div className="mt-1 t-body text-slate-400">Not added</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Upcoming Payments</div>
            <div className="mt-1 t-body text-slate-400">Due soon and overdue credit card bills.</div>
            <div className="mt-5 space-y-3">
              {cardsLoading ? (
                <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] px-4 py-8 text-center">
                  <div className="t-section text-white">Loading upcoming payments...</div>
                  <div className="mt-2 t-body text-slate-400">Fetching credit card statuses from the backend.</div>
                </div>
              ) : upcomingPayments.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] px-4 py-8 text-center">
                  <div className="t-section text-white">All clear</div>
                  <div className="mt-2 t-body text-slate-400">No overdue or due-soon credit card payments.</div>
                </div>
              ) : (
                upcomingPayments.map((card) => {
                  const tone = getCardTone(card.status)
                  const badgeClass =
                    tone === 'emerald'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : tone === 'amber'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-rose-500/15 text-rose-400'

                  return (
                    <div key={card.id} className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="t-nav truncate text-white">{card.card_name}</div>
                          <div className="mt-1 t-meta text-slate-400">
                            {card.bank_name} ••{card.last4} · Due {formatDisplayDate(card.due_date)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={['t-nav', tone === 'rose' ? 'text-rose-400' : tone === 'amber' ? 'text-amber-400' : 'text-emerald-400'].join(' ')}>
                            {formatMoney(toNumber(card.current_bill_amount))}
                          </div>
                          <div className={['mt-2 inline-flex rounded-[999px] px-3 py-1 t-badge', badgeClass].join(' ')}>
                            {card.status === 'overdue' ? 'Overdue' : 'Due Soon'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Insights</div>
            <div className="mt-1 t-body text-slate-400">Generated from holdings, cards, and snapshots.</div>
            <div className="mt-5 space-y-3">
              {insights.length === 0 ? (
                <div className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-8 text-center">
                  <div className="t-section text-white">No insights yet</div>
                  <div className="mt-2 t-body text-slate-400">Add holdings, card dues, or snapshots to generate insights.</div>
                </div>
              ) : (
                insights.map((insight) => (
                  <div
                    key={insight.text}
                    className={[
                      'rounded-[6px] border px-4 py-4',
                      insight.tone === 'emerald'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                        : insight.tone === 'amber'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                          : insight.tone === 'rose'
                            ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
                            : 'border-slate-700 bg-slate-900 text-slate-200',
                    ].join(' ')}
                  >
                    <div className="t-body leading-snug">{insight.text}</div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
