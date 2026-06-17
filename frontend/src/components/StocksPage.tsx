import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import { ApiError, apiFetch } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'

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

type ApiHoldingsAnalytics = {
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

type BulkRefreshResponse = {
  updated_count: number
  failed_count: number
  failures: Array<{
    holding_id: number
    symbol: string
    reason: string
  }>
}

type HoldingFormState = {
  symbol: string
  company_name: string
  asset_type: string
  country: string
  currency: string
  exchange: string
  exchange_symbol: string
  fx_rate_to_inr: string
  quantity: string
  avg_buy_price: string
  current_price: string
  sector: string
  notes: string
  as_of_date: string
}

type FormErrors = Partial<Record<keyof HoldingFormState, string>>

const defaultHoldingForm: HoldingFormState = {
  symbol: '',
  company_name: '',
  asset_type: 'stock',
  country: 'IN',
  currency: 'INR',
  exchange: 'NSE',
  exchange_symbol: '',
  fx_rate_to_inr: '1',
  quantity: '',
  avg_buy_price: '',
  current_price: '',
  sector: '',
  notes: '',
  as_of_date: '',
}

const assetTypeOptions = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'gold', label: 'Gold' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const assetTypePalette: Record<string, { label: string; color: string }> = {
  stock_in: { label: 'Indian Stocks', color: '#0d9488' },
  stock_us: { label: 'US Stocks', color: '#38bdf8' },
  stock: { label: 'Indian Stocks', color: '#0d9488' },
  etf: { label: 'ETFs', color: '#0ea5e9' },
  mutual_fund: { label: 'Mutual Funds', color: '#a78bfa' },
  cash: { label: 'Cash', color: '#f59e0b' },
  other: { label: 'Other Assets', color: '#64748b' },
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
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

function getAssetTypeMeta(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  if (normalized === 'gold') return { label: 'Gold', color: '#f59e0b' }
  return assetTypePalette[normalized] ?? assetTypePalette.other
}

function getAssetTypeBadgeClass(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  if (normalized === 'stock' || normalized === 'stock_in')
    return 'inline-flex rounded-full bg-teal-50 dark:bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 ring-1 ring-inset ring-teal-500/20'
  if (normalized === 'stock_us')
    return 'inline-flex rounded-full bg-sky-50 dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20'
  if (normalized === 'etf')
    return 'inline-flex rounded-full bg-sky-50 dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20'
  if (normalized === 'gold')
    return 'inline-flex rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20'
  if (normalized === 'mutual_fund')
    return 'inline-flex rounded-full bg-violet-50 dark:bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20'
  if (normalized === 'cash')
    return 'inline-flex rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20'
  return 'inline-flex rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400'
}

function isGoldHolding(holding: ApiHolding) {
  const text = [holding.symbol, holding.company_name, holding.sector, holding.notes, holding.exchange_symbol]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return holding.asset_type === 'gold' || (holding.asset_type === 'other' && text.includes('gold')) || (holding.asset_type === 'etf' && text.includes('gold'))
}

function getInvestmentClass(holding: ApiHolding) {
  if (holding.asset_type === 'mutual_fund') return 'mutual_fund'
  if (isGoldHolding(holding)) return 'gold'
  if (holding.country === 'US' && holding.asset_type === 'stock') return 'us_stock'
  if (holding.asset_type === 'stock') return 'indian_stock'
  if (holding.asset_type === 'etf') return 'etf'
  return 'other'
}

function getInvestmentClassLabel(holding: ApiHolding) {
  const className = getInvestmentClass(holding)
  if (className === 'indian_stock') return 'Indian Stock'
  if (className === 'us_stock') return 'US Stock'
  if (className === 'etf') return 'ETF'
  if (className === 'gold') return 'Gold'
  if (className === 'mutual_fund') return 'Mutual Fund'
  return 'Other'
}

function getInvestmentFilterLabel(value: string) {
  if (value === 'indian_stock') return 'Indian Stocks'
  if (value === 'us_stock') return 'US Stocks'
  if (value === 'etf') return 'ETFs'
  if (value === 'gold') return 'Gold'
  if (value === 'mutual_fund') return 'Mutual Funds'
  return 'All'
}

function getInvestmentClassBadgeClass(value: string) {
  if (value === 'indian_stock')
    return 'inline-flex rounded-full bg-teal-50 dark:bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold text-teal-700 dark:text-teal-400 ring-1 ring-inset ring-teal-500/20'
  if (value === 'us_stock')
    return 'inline-flex rounded-full bg-sky-50 dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20'
  if (value === 'etf')
    return 'inline-flex rounded-full bg-sky-50 dark:bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20'
  if (value === 'gold')
    return 'inline-flex rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20'
  if (value === 'mutual_fund')
    return 'inline-flex rounded-full bg-violet-50 dark:bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-400 ring-1 ring-inset ring-violet-500/20'
  return 'inline-flex rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400'
}

function getHoldingMarketSymbol(holding: ApiHolding) {
  if (holding.country === 'US') return (holding.exchange_symbol || holding.symbol).toUpperCase()
  return (holding.exchange_symbol || `${holding.symbol}.NS`).toUpperCase()
}

function getRefreshSupported(holding: ApiHolding) {
  return holding.price_source === 'yfinance' && holding.asset_type !== 'mutual_fund' && !isGoldHolding(holding)
}

function getHoldingGroup(holding: ApiHolding) {
  return getInvestmentClass(holding)
}

function buildHoldingGroups(holdings: ApiHolding[]) {
  return holdings.reduce(
    (accumulator, holding) => {
      const group = getHoldingGroup(holding)
      const invested = toNumber(holding.invested_amount)
      const current = toNumber(holding.current_value)
      accumulator.totalInvested += invested
      accumulator.currentValue += current
      accumulator.totalPnl += toNumber(holding.pnl)

      if (holding.country === 'US') {
        accumulator.usEquity += current
      } else if (group === 'indian_stock' || group === 'gold') {
        accumulator.indianEquity += current
      } else if (group === 'etf') {
        accumulator.etfsGold += current
      } else if (group === 'mutual_fund') {
        accumulator.mutualFunds += current
      }

      return accumulator
    },
    {
      totalInvested: 0,
      currentValue: 0,
      totalPnl: 0,
      indianEquity: 0,
      usEquity: 0,
      etfsGold: 0,
      mutualFunds: 0,
      buckets: {} as Record<string, number>,
    },
  )
}

type ChartPoint = {
  date: string
  label: string
  actual_value: number | null
  predicted_value: number | null
}

function buildPortfolioChartData(performance: ApiPortfolioPerformance | null): ChartPoint[] {
  if (!performance) return []

  const rows = new Map<string, ChartPoint>()

  performance.actual.forEach((point) => {
    rows.set(point.date, {
      date: point.date,
      label: formatDisplayDate(point.date),
      actual_value: toNumber(point.current_value),
      predicted_value: rows.get(point.date)?.predicted_value ?? null,
    })
  })

  performance.predicted.forEach((point) => {
    const current = rows.get(point.date)
    rows.set(point.date, {
      date: point.date,
      label: formatDisplayDate(point.date),
      actual_value: current?.actual_value ?? null,
      predicted_value: toNumber(point.current_value),
    })
  })

  return Array.from(rows.values()).sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
}

function formatNativeMoney(value: number, currency: string) {
  const sign = value < 0 ? '-' : ''
  const absolute = Math.abs(value)

  if (currency === 'USD') {
    return `${sign}$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(absolute)}`
  }

  return `${sign}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(absolute)}`
}

function renderNativeAndInr(nativeValue: number, inrValue: number, currency: string) {
  if (currency === 'USD') {
    return (
      <div className="flex flex-col">
        <span><PrivateValue value={formatNativeMoney(nativeValue, currency)} mask="••••" hideColor /></span>
        <span className="t-meta text-slate-500 dark:text-slate-400"><PrivateValue value={formatINR(inrValue)} mask="••••" hideColor /></span>
      </div>
    )
  }

  return <span><PrivateValue value={formatINR(inrValue)} mask="••••" hideColor /></span>
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(parsed)
}

function formatCompactTimestamp(value: string | null | undefined) {
  if (!value) return 'Not updated'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not updated'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
    .format(parsed)
    .replace(' am', ' am')
    .replace(' pm', ' pm')
}

function getSourceBadgeMeta(holding: ApiHolding) {
  if (holding.price_source === 'yfinance') {
    return {
      label: 'Auto',
      title: 'Price auto-refreshed',
      className:
        'inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300',
      icon: 'refresh' as const,
    }
  }

  return {
    label: 'Manual',
    title: 'Price entered manually',
    className:
      'inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300',
    icon: 'edit' as const,
  }
}

function getFreshnessMeta(holding: ApiHolding) {
  if (holding.price_source !== 'yfinance') {
    return {
      label: 'Manual',
      title: 'Manual price entry',
      className:
        'inline-flex items-center rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300',
    }
  }

  if (!holding.last_price_refreshed_at) {
    return {
      label: 'Stale',
      title: 'Auto price has not been refreshed yet',
      className:
        'inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300',
    }
  }

  const lastRefresh = new Date(holding.last_price_refreshed_at)
  const ageMs = Date.now() - lastRefresh.getTime()
  if (Number.isNaN(lastRefresh.getTime())) {
    return {
      label: 'Updated',
      title: 'Price was auto-refreshed',
      className:
        'inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300',
    }
  }

  if (ageMs <= 1000 * 60 * 60 * 24) {
    return {
      label: 'Fresh',
      title: `Updated ${formatCompactTimestamp(holding.last_price_refreshed_at)}`,
      className:
        'inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300',
    }
  }

  return {
    label: 'Stale',
    title: `Last updated ${formatCompactTimestamp(holding.last_price_refreshed_at)}`,
    className:
      'inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-300',
  }
}

function getRowToneMeta(holding: ApiHolding) {
  const pnl = toNumber(holding.pnl)
  if (pnl > 0) {
    return {
      accent: 'bg-emerald-400',
      border: 'border-emerald-500/25 hover:border-emerald-400/35',
      glow: 'shadow-[inset_0_1px_0_rgba(16,185,129,0.05)]',
      panel: 'bg-slate-950/70',
      text: 'text-emerald-300',
      arrow: 'up' as const,
    }
  }
  if (pnl < 0) {
    return {
      accent: 'bg-rose-400',
      border: 'border-rose-500/25 hover:border-rose-400/35',
      glow: 'shadow-[inset_0_1px_0_rgba(244,63,94,0.05)]',
      panel: 'bg-slate-950/70',
      text: 'text-rose-300',
      arrow: 'down' as const,
    }
  }
  return {
    accent: 'bg-slate-500',
    border: 'border-slate-700/70 hover:border-slate-600/80',
    glow: '',
    panel: 'bg-slate-950/70',
    text: 'text-slate-300',
    arrow: null,
  }
}

function getCountryDefaults(country: string) {
  if (country === 'US') {
    return { currency: 'USD', exchange: 'NASDAQ', fx_rate_to_inr: '83.50' }
  }

  return { currency: 'INR', exchange: 'NSE', fx_rate_to_inr: '1' }
}

const timeFilters: Array<{ label: string; value: '1M' | '3M' | '6M' | '1Y' | 'ALL' }> = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'All', value: 'ALL' },
]

const sectionLabel = 't-micro text-slate-500 dark:text-slate-500'

function SectionCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={['bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm', className].join(' ')}>
      {title ? <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div> : null}
      {children}
    </div>
  )
}

function MetricCardView({
  label,
  value,
  meta,
  icon,
  valueClass = 'text-slate-900 dark:text-white',
  chipClass = 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
}: {
  label: string
  value: string
  meta: string
  icon: 'netWorth' | 'portfolio' | 'analytics' | 'cards' | 'up'
  valueClass?: string
  chipClass?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors duration-200 hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-900/80 dark:hover:border-slate-600/60 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="t-micro text-slate-500 dark:text-slate-500">{label}</div>
          <div className={['mt-2 text-[1.05rem] font-bold leading-tight sm:t-metric', valueClass].join(' ')}>{value}</div>
          <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-500 sm:t-meta">{meta}</div>
        </div>
        <div className={['grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10', chipClass].join(' ')}>
          <Icon name={icon} className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function StocksPage() {
  const { privacyMode } = usePrivacyMode()
  const [holdings, setHoldings] = useState<ApiHolding[]>([])
  const [analytics, setAnalytics] = useState<ApiHoldingsAnalytics | null>(null)
  const [holdingsLoading, setHoldingsLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false)
  const [isHoldingDrawerMounted, setIsHoldingDrawerMounted] = useState(false)
  const [isHoldingDrawerVisible, setIsHoldingDrawerVisible] = useState(false)
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(defaultHoldingForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null)
  const [isRefreshingAllPrices, setIsRefreshingAllPrices] = useState(false)
  const [refreshingHoldingId, setRefreshingHoldingId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [activeRange, setActiveRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M')
  const [portfolioPerformance, setPortfolioPerformance] = useState<ApiPortfolioPerformance | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(true)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [expandedHoldingId, setExpandedHoldingId] = useState<number | null>(null)
  const [selectedMobileHoldingId, setSelectedMobileHoldingId] = useState<number | null>(null)

  const loadData = async (signal?: AbortSignal) => {
    setHoldingsLoading(true)
    setAnalyticsLoading(true)
    setHoldingsError(null)
    setAnalyticsError(null)

    const [holdingsResult, analyticsResult] = await Promise.allSettled([
      apiFetch<ApiHolding[]>('/api/holdings', { signal }),
      apiFetch<ApiHoldingsAnalytics>('/api/holdings/analytics', { signal }),
    ])

    if (holdingsResult.status === 'fulfilled') {
      setHoldings(holdingsResult.value)
    } else if (holdingsResult.reason?.name !== 'AbortError') {
      setHoldingsError(formatApiError(holdingsResult.reason))
      setHoldings([])
    }
    setHoldingsLoading(false)

    if (analyticsResult.status === 'fulfilled') {
      setAnalytics(analyticsResult.value)
    } else if (analyticsResult.reason?.name !== 'AbortError') {
      setAnalyticsError(formatApiError(analyticsResult.reason))
      setAnalytics(null)
    }
    setAnalyticsLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = formatApiError(error)
      setHoldingsError(message)
      setAnalyticsError(message)
      setHoldingsLoading(false)
      setAnalyticsLoading(false)
    })
    return () => controller.abort()
  }, [])

  const loadPortfolioPerformance = async (signal?: AbortSignal) => {
    setPortfolioLoading(true)
    setPortfolioError(null)

    try {
      const response = await apiFetch<ApiPortfolioPerformance>(`/api/portfolio/performance?range=${activeRange}`, { signal })
      setPortfolioPerformance(response)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPortfolioError(formatApiError(error))
    } finally {
      setPortfolioLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadPortfolioPerformance(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setPortfolioError(formatApiError(error))
      setPortfolioLoading(false)
    })
    return () => controller.abort()
  }, [activeRange])

  useEffect(() => {
    if (isHoldingModalOpen) {
      setIsHoldingDrawerMounted(true)
      const frame = window.requestAnimationFrame(() => setIsHoldingDrawerVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }

    setIsHoldingDrawerVisible(false)
    const timeout = window.setTimeout(() => setIsHoldingDrawerMounted(false), 250)
    return () => window.clearTimeout(timeout)
  }, [isHoldingModalOpen])

  useEffect(() => {
    if (!isHoldingDrawerMounted) return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHoldingModalOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHoldingDrawerMounted])

  const holdingGroups = useMemo(() => buildHoldingGroups(holdings), [holdings])
  const liveUsdInrRate = useMemo(() => {
    const firstUsHolding = holdings.find((holding) => holding.country === 'US')
    return firstUsHolding ? toNumber(firstUsHolding.effective_fx_rate_to_inr) : 0
  }, [holdings])

  const summaryCards = useMemo(() => {
    if (analyticsLoading) {
      return [
        { label: 'Total Invested', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'Current Value', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'Total P&L', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'Return %', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'Indian Equity', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'US Market', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'ETFs / Gold', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
        { label: 'Mutual Funds', value: 'Loading...', meta: 'Fetching analytics', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-200 text-slate-500' },
      ]
    }

    if (analyticsError || !analytics) {
      return [
        { label: 'Total Invested', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'Current Value', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'Total P&L', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'Return %', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'Indian Equity', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'US Market', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'ETFs / Gold', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
        { label: 'Mutual Funds', value: '—', meta: analyticsError ?? 'No data available', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
      ]
    }

    const totalInvested = toNumber(analytics.total_invested)
    const currentValue = toNumber(analytics.current_value)
    const pnl = toNumber(analytics.total_pnl)
    const returnPct = toNumber(analytics.total_return_pct)

    return [
      { label: 'Total Invested', value: formatINRShort(totalInvested), meta: `${holdings.length} positions`, color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
      { label: 'Current Value', value: formatINRShort(currentValue), meta: 'From holdings', color: 'text-slate-900 dark:text-white', chipClass: 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500' },
      { label: 'Total P&L', value: `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}${formatINRShort(Math.abs(pnl)).replace('₹', '')}`, meta: 'Overall profit / loss', color: privacyMode ? 'text-slate-400 dark:text-slate-400' : getTrendClass(pnl), chipClass: 'bg-emerald-500/15 text-emerald-300' },
      { label: 'Return %', value: formatSignedPct(returnPct), meta: 'Based on invested amount', color: privacyMode ? 'text-slate-400 dark:text-slate-400' : getTrendClass(returnPct), chipClass: 'bg-emerald-500/15 text-emerald-300' },
      { label: 'Indian Equity', value: formatINRShort(holdingGroups.indianEquity), meta: 'Indian stocks and gold exposure', color: 'text-teal-300 dark:text-teal-300', chipClass: 'bg-teal-500/15 text-teal-300' },
      { label: 'US Market', value: formatINRShort(holdingGroups.usEquity), meta: liveUsdInrRate > 0 ? (privacyMode ? 'Live USD/INR ••••' : `Live USD/INR ${liveUsdInrRate.toFixed(2)}`) : 'US stocks and ETFs', color: 'text-sky-300 dark:text-sky-300', chipClass: 'bg-sky-500/15 text-sky-300' },
      { label: 'ETFs', value: formatINRShort(holdingGroups.etfsGold), meta: 'India ETF exposure', color: 'text-amber-300 dark:text-amber-300', chipClass: 'bg-amber-500/15 text-amber-300' },
      { label: 'Mutual Funds', value: formatINRShort(holdingGroups.mutualFunds), meta: 'Units valued in INR', color: 'text-violet-300 dark:text-violet-300', chipClass: 'bg-violet-500/15 text-violet-300' },
    ]
  }, [analytics, analyticsError, analyticsLoading, holdingGroups.indianEquity, holdingGroups.mutualFunds, holdingGroups.etfsGold, holdingGroups.usEquity, holdings.length, liveUsdInrRate, privacyMode])

  const filterChips = useMemo(() => {
    const counts = holdings.reduce<Record<string, number>>(
      (acc, holding) => {
        const key = getInvestmentClass(holding)
        acc.all += 1
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      },
      { all: 0 },
    )

    return [
      { value: 'all', label: 'All', count: counts.all ?? 0 },
      { value: 'indian_stock', label: 'Indian Stocks', count: counts.indian_stock ?? 0 },
      { value: 'us_stock', label: 'US Stocks', count: counts.us_stock ?? 0 },
      { value: 'etf', label: 'ETFs', count: counts.etf ?? 0 },
      { value: 'gold', label: 'Gold', count: counts.gold ?? 0 },
      { value: 'mutual_fund', label: 'Mutual Funds', count: counts.mutual_fund ?? 0 },
    ]
  }, [holdings])

  const sectorOptions = useMemo(() => {
    const sectors = Array.from(new Set(holdings.map((holding) => holding.sector).filter(Boolean) as string[]))
    return ['all', ...sectors]
  }, [holdings])

  const filteredHoldings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return holdings.filter((holding) => {
      const matchesSearch =
        !query ||
        holding.symbol.toLowerCase().includes(query) ||
        holding.company_name.toLowerCase().includes(query)
      const holdingClass = getInvestmentClass(holding)
      const matchesAssetType = assetTypeFilter === 'all' || holdingClass === assetTypeFilter
      const matchesCountry = countryFilter === 'all' || holding.country === countryFilter
      const matchesCurrency = currencyFilter === 'all' || holding.currency === currencyFilter
      const matchesSector = sectorFilter === 'all' || (holding.sector ?? 'Uncategorized') === sectorFilter
      return matchesSearch && matchesAssetType && matchesCountry && matchesCurrency && matchesSector
    })
  }, [assetTypeFilter, countryFilter, currencyFilter, holdings, searchTerm, sectorFilter])

  const allocationData = useMemo(() => {
    const investmentBuckets = [
      { key: 'indian_stock', name: 'Indian Stocks', value: holdingGroups.indianEquity, color: '#14b8a6' },
      { key: 'us_market', name: 'US Market', value: holdingGroups.usEquity, color: '#0ea5e9' },
      { key: 'etf', name: 'ETFs', value: holdingGroups.etfsGold, color: '#a78bfa' },
      { key: 'mutual_fund', name: 'Mutual Funds', value: holdingGroups.mutualFunds, color: '#f59e0b' },
    ]

    const totalValue = investmentBuckets.reduce((accumulator, item) => accumulator + item.value, 0)

    return investmentBuckets
      .filter((item) => item.value > 0)
      .map((item) => ({
        key: item.key,
        name: item.name,
        value: item.value,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        color: item.color,
      }))
  }, [holdingGroups.etfsGold, holdingGroups.indianEquity, holdingGroups.mutualFunds, holdingGroups.usEquity])

  const portfolioChartData = useMemo(() => buildPortfolioChartData(portfolioPerformance), [portfolioPerformance])
  const portfolioHasSnapshots = (portfolioPerformance?.actual.length ?? 0) > 0
  const latestSnapshot = portfolioPerformance?.actual.at(-1) ?? null
  const latestSnapshotValue = toNumber(latestSnapshot?.current_value)
  const latestSnapshotReturn = toNumber(latestSnapshot?.total_return_pct)
  const latestUpdate = useMemo(() => {
    const timestamps = holdings
      .flatMap((holding) => [holding.updated_at, holding.last_price_refreshed_at])
      .filter(Boolean) as string[]

    if (timestamps.length === 0) return null

    return timestamps
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null
  }, [holdings])

  const selectedMobileHolding = useMemo(
    () => holdings.find((holding) => holding.id === selectedMobileHoldingId) ?? null,
    [holdings, selectedMobileHoldingId],
  )

  async function refreshData() {
    await loadData()
  }

  async function refreshPortfolioPerformance() {
    await loadPortfolioPerformance()
  }

  async function handleSaveSnapshot() {
    setSavingSnapshot(true)
    setStatusMessage(null)

    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage("Saved today's snapshot.")
      await refreshPortfolioPerformance()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setSavingSnapshot(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const symbol = holdingForm.symbol.trim().toUpperCase()
    const companyName = holdingForm.company_name.trim()
    const assetType = holdingForm.asset_type.trim()
    const country = holdingForm.country.trim().toUpperCase() || 'IN'
    const currency = holdingForm.currency.trim().toUpperCase() || (country === 'US' ? 'USD' : 'INR')
    const exchange = holdingForm.exchange.trim().toUpperCase()
    const exchangeSymbol = holdingForm.exchange_symbol.trim().toUpperCase()
    const fxRateToInr = holdingForm.fx_rate_to_inr.trim()
    const quantity = holdingForm.quantity.trim()
    const avgBuyPrice = holdingForm.avg_buy_price.trim()
    const currentPrice = holdingForm.current_price.trim()
    const sector = holdingForm.sector.trim()
    const notes = holdingForm.notes.trim()
    const asOfDate = holdingForm.as_of_date.trim()
    const backendAssetType = assetType === 'gold' ? 'other' : assetType
    const backendSector = sector || (assetType === 'gold' ? 'Gold' : '')

    if (!symbol) nextErrors.symbol = 'Symbol is required.'
    if (!companyName) nextErrors.company_name = 'Company name is required.'
    if (!assetType) nextErrors.asset_type = 'Asset type is required.'
    if (!country) nextErrors.country = 'Country is required.'
    if (!currency) nextErrors.currency = 'Currency is required.'
    if (!exchange) nextErrors.exchange = 'Exchange is required.'
    if (!quantity) nextErrors.quantity = 'Quantity is required.'
    if (!avgBuyPrice) nextErrors.avg_buy_price = 'Average buy price is required.'
    if (!currentPrice) nextErrors.current_price = 'Current price is required.'
    if (!fxRateToInr) nextErrors.fx_rate_to_inr = 'FX rate is required.'

    ;[['quantity', quantity], ['avg_buy_price', avgBuyPrice], ['current_price', currentPrice], ['fx_rate_to_inr', fxRateToInr]].forEach(([field, value]) => {
      if (value && Number.isNaN(Number(value))) {
        nextErrors[field as keyof HoldingFormState] = 'Enter a valid decimal number.'
      }
    })

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setIsSavingHolding(true)

    try {
      const payload = {
        symbol,
        company_name: companyName,
        asset_type: backendAssetType,
        country,
        currency,
        exchange: exchange || null,
        exchange_symbol: exchangeSymbol || null,
        fx_rate_to_inr: fxRateToInr || null,
        quantity,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        sector: backendSector || null,
        notes: notes || null,
        as_of_date: asOfDate || null,
      }

      const method = editingHoldingId === null ? 'POST' : 'PATCH'
      const url =
        editingHoldingId === null
          ? '/api/holdings'
          : `/api/holdings/${editingHoldingId}`

      if (editingHoldingId === null) {
        await apiFetch('/api/holdings', {
          method,
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch(url, {
          method,
          body: JSON.stringify(payload),
        })
      }

      setIsHoldingModalOpen(false)
      setEditingHoldingId(null)
      setHoldingForm(defaultHoldingForm)
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors.length > 0) {
        const mappedErrors: FormErrors = {}
        error.validationErrors.forEach((item) => {
          if (item.path in defaultHoldingForm) {
            mappedErrors[item.path as keyof HoldingFormState] = item.message
          }
        })
        setFormErrors(mappedErrors)
        setFormErrorMessage('Please fix the highlighted fields.')
      } else {
        setFormErrorMessage(formatApiError(error))
      }
    } finally {
      setIsSavingHolding(false)
    }
  }

  function openCreateModal() {
    setEditingHoldingId(null)
    setHoldingForm(defaultHoldingForm)
    setFormErrors({})
    setFormErrorMessage(null)
    setIsHoldingModalOpen(true)
  }

  function updateCountry(country: string) {
    const defaults = getCountryDefaults(country)
    setHoldingForm((current) => ({
      ...current,
      country,
      currency: defaults.currency,
      exchange: defaults.exchange,
      fx_rate_to_inr: defaults.fx_rate_to_inr,
    }))
  }

  function openEditModal(holding: ApiHolding) {
    const holdingClass = getInvestmentClass(holding)
    setEditingHoldingId(holding.id)
    setHoldingForm({
      symbol: holding.symbol,
      company_name: holding.company_name,
      asset_type: holdingClass === 'gold' ? 'gold' : holding.asset_type,
      country: holding.country,
      currency: holding.currency,
      exchange: holding.exchange ?? (holding.country === 'US' ? 'NASDAQ' : 'NSE'),
      exchange_symbol: holding.exchange_symbol ?? '',
      fx_rate_to_inr: String(holding.fx_rate_to_inr ?? (holding.country === 'US' ? 83.5 : 1)),
      quantity: String(holding.quantity),
      avg_buy_price: String(holding.avg_buy_price),
      current_price: String(holding.current_price),
      sector: holding.sector ?? '',
      notes: holding.notes ?? '',
      as_of_date: holding.as_of_date,
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsHoldingModalOpen(true)
  }

  async function handleDeleteHolding(holding: ApiHolding) {
    const confirmed = window.confirm(`Delete ${holding.symbol}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await apiFetch(`/api/holdings/${holding.id}`, { method: 'DELETE' })
      if (selectedMobileHoldingId === holding.id) {
        setSelectedMobileHoldingId(null)
      }
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${holding.symbol}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  async function handleRefreshHolding(holding: ApiHolding) {
    if (!getRefreshSupported(holding)) return
    setRefreshingHoldingId(holding.id)
    setStatusMessage(null)

    try {
      await apiFetch<ApiHolding>(`/api/holdings/${holding.id}/refresh-price`, { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage(`Price refreshed for ${holding.symbol}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setRefreshingHoldingId(null)
    }
  }

  async function handleRefreshAllPrices() {
    setIsRefreshingAllPrices(true)
    setStatusMessage(null)

    try {
      const result = await apiFetch<BulkRefreshResponse>('/api/holdings/refresh-prices', { method: 'POST' })
      if (result.failed_count > 0) {
        setStatusTone('amber')
        setStatusMessage(`Refreshed ${result.updated_count} holdings. ${result.failed_count} failed.`)
      } else {
        setStatusTone('emerald')
        setStatusMessage(`Refreshed ${result.updated_count} holdings successfully.`)
      }
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setIsRefreshingAllPrices(false)
    }
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        {statusMessage ? (
          <div
            className={[
              'flex items-center justify-between gap-3',
              statusTone === 'emerald'
                ? 'rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200'
                : statusTone === 'amber'
                  ? 'rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100'
                  : statusTone === 'rose'
                    ? 'rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200'
                    : 'rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300',
            ].join(' ')}
          >
            {statusMessage}
            <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="space-y-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {latestUpdate ? `Updated ${formatCompactTimestamp(latestUpdate.toISOString())}` : 'No price update yet'}
            </div>
            <button
              type="button"
              onClick={handleRefreshAllPrices}
              disabled={isRefreshingAllPrices}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 text-[12px] font-medium text-slate-300 transition-colors hover:border-slate-600 disabled:opacity-60"
            >
              <Icon name="refresh" className={['h-3.5 w-3.5', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
              {isRefreshingAllPrices ? 'Refreshing' : 'Refresh'}
            </button>
          </div>

          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {summaryCards.slice(0, 4).map((card) => (
              <div
                key={`mobile-${card.label}`}
                className="min-w-[168px] rounded-[22px] border border-slate-800/90 bg-slate-900/80 px-4 py-4 shadow-[0_10px_30px_rgba(2,6,23,0.22)]"
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</div>
                <div className={['mt-3 text-[1.35rem] font-bold leading-none', privacyMode ? 'text-slate-300' : card.color].join(' ')}>
                  {privacyMode ? '••••' : card.value}
                </div>
                <div className="mt-2 text-[11px] leading-4 text-slate-500">{card.meta}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {summaryCards.slice(4).map((card) => (
              <div key={`mobile-bucket-${card.label}`} className="rounded-[20px] bg-slate-900/70 px-4 py-4 ring-1 ring-slate-800/80">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{card.label}</div>
                <div className={['mt-2 text-[1.05rem] font-bold leading-tight', privacyMode ? 'text-slate-300' : card.color].join(' ')}>
                  {privacyMode ? '••••' : card.value}
                </div>
                <div className="mt-1 text-[11px] leading-4 text-slate-500">{card.meta}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Investment Breakdown</div>
            {allocationData.length > 0 ? (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-800">
                  {allocationData.map((entry) => (
                    <div key={`mobile-allocation-${entry.key}`} className="h-full" style={{ width: `${Math.max(entry.percentage, 4)}%`, backgroundColor: entry.color }} />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
                  {allocationData.map((entry) => (
                    <div key={`mobile-allocation-row-${entry.key}`} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="truncate text-[12px] text-slate-300">{entry.name}</span>
                      </div>
                      <div className="mt-1 text-[12px] font-semibold text-slate-100">{privacyMode ? '••••' : formatINRShort(entry.value)}</div>
                      <div className="text-[10px] text-slate-500">{privacyMode ? '•••' : `${entry.percentage.toFixed(1)}%`}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Add investments to see allocation.</div>
            )}
          </div>

          <div className="rounded-[24px] bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Performance</div>
                <div className="mt-2 text-[1.2rem] font-bold text-slate-100">
                  {portfolioHasSnapshots ? (privacyMode ? '••••' : formatINRShort(latestSnapshotValue)) : '—'}
                </div>
                <div className={['mt-1 text-[12px] font-medium', privacyMode ? 'text-slate-400' : getTrendClass(latestSnapshotReturn)].join(' ')}>
                  {portfolioHasSnapshots ? (privacyMode ? '••••' : formatSignedPct(latestSnapshotReturn)) : 'Waiting for snapshots'}
                </div>
              </div>
              <div className="no-scrollbar flex max-w-[54%] items-center gap-1 overflow-x-auto rounded-full bg-slate-800/80 p-1">
                {timeFilters.map((filter) => (
                  <button
                    key={`mobile-range-${filter.value}`}
                    type="button"
                    onClick={() => setActiveRange(filter.value)}
                    className={[
                      'h-7 whitespace-nowrap rounded-full px-2.5 text-[11px] font-medium transition-colors',
                      activeRange === filter.value ? 'bg-slate-700 text-white' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {portfolioHasSnapshots ? (
              <>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={portfolioChartData} margin={{ top: 6, right: 0, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(51,65,85,0.35)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #334155', borderRadius: '10px', color: '#e2e8f0', fontSize: 12 }}
                        formatter={(value, name) => [privacyMode ? '••••' : formatINRShort(Number(value)), name === 'actual_value' ? 'Actual' : 'Predicted']}
                      />
                      <Line type="monotone" dataKey="actual_value" stroke="#2dd4bf" strokeWidth={2.25} dot={false} activeDot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="predicted_value" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={savingSnapshot}
                  className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-sm font-medium text-teal-400 transition-colors hover:border-slate-600 disabled:opacity-60"
                >
                  {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-950/50 px-4 py-5 text-center">
                <div className="text-sm font-medium text-slate-200">No portfolio history yet</div>
                <div className="mt-1 text-[12px] leading-5 text-slate-500">Save today&apos;s snapshot to start tracking performance.</div>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={savingSnapshot}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-accent-600 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-[24px] bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              {filterChips.map((filter) => (
                <button
                  key={`mobile-filter-${filter.value}`}
                  type="button"
                  onClick={() => setAssetTypeFilter(filter.value)}
                  className={[
                    'h-9 whitespace-nowrap rounded-full px-4 text-[12px] font-medium transition-colors',
                    assetTypeFilter === filter.value
                      ? 'bg-accent-600 text-white'
                      : 'bg-slate-800 text-slate-300',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <label className="mt-3 flex h-11 items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800/80 px-3 text-slate-500 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/15">
              <Icon name="search" className="h-4 w-4 shrink-0" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by symbol, company, or fund"
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleRefreshAllPrices}
                disabled={isRefreshingAllPrices}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 text-sm font-medium text-slate-300 disabled:opacity-60"
              >
                <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
                Refresh
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-accent-600 text-sm font-semibold text-white"
              >
                <Icon name="add" className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {holdingsLoading ? (
              <div className="rounded-[24px] bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
                <div className="text-sm text-slate-400">Loading investments…</div>
              </div>
            ) : holdingsError ? (
              <div className="rounded-[24px] border border-rose-500/30 bg-rose-500/10 px-4 py-5 text-sm text-rose-200">
                {holdingsError}
              </div>
            ) : filteredHoldings.length === 0 ? (
              <div className="rounded-[24px] bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
                <div className="text-sm font-medium text-slate-200">No investments match these filters</div>
                <div className="mt-1 text-[12px] text-slate-500">Try a different asset bucket or search term.</div>
              </div>
            ) : (
              filteredHoldings.map((row) => {
                const currentValue = toNumber(row.current_value)
                const pnl = toNumber(row.pnl)
                const pct = toNumber(row.return_pct)
                const nativeCurrent = toNumber(row.native_current_value)
                const nativePnl = toNumber(row.native_pnl ?? 0)
                const sourceMeta = getSourceBadgeMeta(row)
                const rowTone = getRowToneMeta(row)

                return (
                  <button
                    key={`mobile-row-${row.id}`}
                    type="button"
                    onClick={() => setSelectedMobileHoldingId(row.id)}
                    className="w-full rounded-[24px] bg-slate-900/75 px-4 py-4 text-left ring-1 ring-slate-800/80 transition-colors hover:ring-slate-700"
                  >
                    <div className="flex items-start gap-3">
                      <span className={['mt-0.5 h-14 w-1 shrink-0 rounded-full', rowTone.accent].join(' ')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-[1.05rem] font-semibold tracking-[-0.02em] text-white">{row.symbol}</span>
                              <span className="inline-flex rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                                {row.country === 'US' ? 'US' : 'IN'}
                              </span>
                              <span className={getInvestmentClassBadgeClass(getInvestmentClass(row))}>{getInvestmentClassLabel(row)}</span>
                            </div>
                            <div className="mt-1 truncate text-[13px] text-slate-400">{row.company_name}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[1rem] font-semibold text-slate-100">
                              {renderNativeAndInr(nativeCurrent, currentValue, row.currency)}
                            </div>
                            <div className={['mt-1 text-[12px] font-medium', privacyMode ? 'text-slate-400' : rowTone.text].join(' ')}>
                              <PrivateValue value={formatSignedPct(pct)} mask="••••" hideColor />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <span className={sourceMeta.className}>
                            <Icon name={sourceMeta.icon} className="h-3.5 w-3.5" />
                            {sourceMeta.label}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-3">
                          <div className="rounded-2xl bg-slate-800/70 px-3 py-3">
                            <div className={sectionLabel}>Price</div>
                            <div className="mt-1 text-[13px] font-semibold text-slate-100">
                              <PrivateValue value={formatNativeMoney(toNumber(row.current_price), row.currency)} mask="••••" hideColor />
                            </div>
                            <div className="mt-1 text-[10px] text-slate-500">
                              {privacyMode ? '••••' : formatCompactTimestamp(row.last_price_refreshed_at ?? row.updated_at)}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-800/70 px-3 py-3">
                            <div className={sectionLabel}>P&L</div>
                            <div className={['mt-1 text-[13px] font-semibold', privacyMode ? 'text-slate-300' : rowTone.text].join(' ')}>
                              {renderNativeAndInr(nativePnl, pnl, row.currency)}
                            </div>
                            <div className={['mt-1 text-[10px]', privacyMode ? 'text-slate-400' : rowTone.text].join(' ')}>
                              <PrivateValue value={formatPct(pct)} mask="••••" hideColor />
                            </div>
                          </div>
                          <div className="flex items-center justify-end">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-400">
                              <Icon name="chevronDown" className="h-5 w-5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="hidden md:block">
        {/* Prices bar */}
        <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80 md:flex">
          <Icon name="refresh" className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm text-slate-500 dark:text-slate-400">Prices last updated</span>
          {latestUpdate ? (
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatDisplayDate(latestUpdate.toISOString())}</span>
          ) : (
            <span className="text-sm text-slate-400">Not available</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="hidden sm:inline text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
          </div>
        </div>

        {/* Actions toolbar */}
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleRefreshAllPrices}
            disabled={isRefreshingAllPrices}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/50 sm:h-10"
          >
            <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
            <span className="hidden sm:inline">{isRefreshingAllPrices ? 'Refreshing...' : 'Refresh Prices'}</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-accent-700 active:bg-accent-800 sm:h-10"
          >
            <Icon name="add" className="h-4 w-4" />
            Add Investment
          </button>
        </div>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <MetricCardView
              key={card.label}
              label={card.label}
              value={privacyMode ? '••••' : card.value}
              meta={card.meta}
              chipClass={card.chipClass}
              icon={
                card.label === 'Total Invested'
                  ? 'netWorth'
                  : card.label === 'Current Value'
                    ? 'portfolio'
                    : card.label === 'Total P&L'
                      ? 'analytics'
                      : card.label === 'Return %'
                        ? 'up'
                        : card.label === 'ETFs / Gold'
                          ? 'cards'
                          : 'analytics'
              }
              valueClass={privacyMode ? 'text-slate-400 dark:text-slate-400' : card.color}
            />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="t-micro text-slate-500 dark:text-slate-500">Investment Breakdown</div>
            <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Asset mix by current value</div>
            {allocationData.length > 0 ? (
              <div className="mt-6">
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  {allocationData.map((entry) => (
                    <div key={entry.key} className="h-full" style={{ width: `${Math.max(entry.percentage, 3)}%`, backgroundColor: entry.color }} />
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {allocationData.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                        <span className="truncate text-sm text-slate-600 dark:text-slate-300 sm:t-body">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white sm:t-nav">{privacyMode ? '••••' : formatINRShort(entry.value)}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 sm:t-meta">{privacyMode ? '•••' : `${entry.percentage.toFixed(1)}%`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
                <div className="t-section text-slate-900 dark:text-slate-100">No allocation yet</div>
                <div className="mt-2 t-body text-slate-600 dark:text-slate-300">Add investments to populate the breakdown.</div>
              </div>
            )}
          </SectionCard>

          <SectionCard className="px-4 py-5 sm:px-6 sm:py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="t-micro text-slate-500 dark:text-slate-500">Performance</div>
                <div className="mt-1 t-meta text-slate-500 dark:text-slate-400">Portfolio snapshot trend</div>
              </div>
              <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-slate-700 t-badge">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveRange(filter.value)}
                    className={[
                      'h-8 rounded-full px-3 t-badge transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                      activeRange === filter.value
                        ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="t-metric text-slate-900 dark:text-white">{portfolioHasSnapshots ? (privacyMode ? '••••' : formatINRShort(latestSnapshotValue)) : '—'}</div>
              {portfolioHasSnapshots ? <div className={['t-nav', privacyMode ? 'text-slate-400 dark:text-slate-400' : getTrendClass(latestSnapshotReturn)].join(' ')}>{privacyMode ? '••••' : formatSignedPct(latestSnapshotReturn)}</div> : null}
              <div className="t-body text-slate-600 dark:text-slate-300">{portfolioHasSnapshots ? 'latest snapshot' : 'waiting for snapshots'}</div>
            </div>

            {portfolioLoading ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
                <div className="t-section text-slate-900 dark:text-slate-100">Loading portfolio snapshots...</div>
                <div className="mt-2 t-body text-slate-600 dark:text-slate-300">Fetching actual and predicted data from the backend.</div>
              </div>
            ) : portfolioError ? (
              <div className="mt-8 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                {portfolioError}
              </div>
            ) : !portfolioHasSnapshots ? (
              <div className="mt-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
                <div className="t-section text-slate-900 dark:text-slate-100">No portfolio history yet</div>
                <div className="mt-2 t-body text-slate-600 dark:text-slate-300">Save today&apos;s snapshot to start tracking performance.</div>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={savingSnapshot}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-accent-700 active:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSnapshot ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                  Save Snapshot
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex items-center gap-4 t-badge text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent-400" />
                    Actual
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Predicted
                  </span>
                </div>
                <div className="mt-4 h-56 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={portfolioChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(51,65,85,0.45)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => (privacyMode ? '••••' : formatINRShort(Number(value)))} width={70} />
                      <Tooltip
                        contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value, name) => [privacyMode ? '••••' : formatINRShort(Number(value)), name === 'actual_value' ? 'Actual' : 'Predicted']}
                      />
                      <Line
                        type="monotone"
                        dataKey="actual_value"
                        stroke="#2dd4bf"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="predicted_value"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 flex justify-center border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={handleSaveSnapshot}
                    disabled={savingSnapshot}
                    className="text-sm font-medium text-teal-500 dark:text-teal-400 transition-colors hover:text-teal-600 dark:hover:text-teal-300 disabled:opacity-50"
                  >
                    {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
                  </button>
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard className="overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                {filterChips.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setAssetTypeFilter(filter.value)}
                    className={[
                      'h-9 whitespace-nowrap rounded-full px-4 t-badge transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                      assetTypeFilter === filter.value
                        ? 'bg-accent-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white',
                    ].join(' ')}
                  >
                    {filter.label} <span className="opacity-80">({filter.count})</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 t-nav text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 xl:inline-flex">
                  <Icon name="due" className="h-4 w-4" />
                  <span>{latestUpdate ? `Updated ${formatCompactTimestamp(latestUpdate.toISOString())}` : 'No updates yet'}</span>
                </div>
                <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-500 shadow-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:min-w-[16rem]">
                  <Icon name="search" className="h-4 w-4 shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by symbol, company, or fund"
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleRefreshAllPrices}
                  disabled={isRefreshingAllPrices}
                  className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700/50 sm:inline-flex"
                >
                  <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
                  Refresh Prices
                </button>
              </div>
            </div>
          </div>

          {holdingsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Loading investments...</div>
                <div className="mt-2 t-body text-slate-600 dark:text-slate-300">Fetching positions from the backend.</div>
              </div>
            </div>
          ) : holdingsError ? (
            <div className="px-6 py-10">
              <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-8 text-center">
                <div className="text-sm font-semibold text-rose-800 dark:text-rose-200">Unable to load investments</div>
                <div className="mt-2 t-body text-rose-700 dark:text-rose-300">{holdingsError}</div>
              </div>
            </div>
          ) : filteredHoldings.length === 0 ? (
            <div className="px-6 py-10">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-slate-100 dark:bg-slate-700 text-accent-400">
                  <Icon name="empty" className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">No investments match the filters</div>
                <div className="mt-2 t-body text-slate-600 dark:text-slate-300">Try a different class, country, or search term.</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-3 py-3 sm:px-4 sm:py-4">
              {filteredHoldings.map((row) => {
                const invested = toNumber(row.invested_amount)
                const currentValue = toNumber(row.current_value)
                const pnl = toNumber(row.pnl)
                const pct = toNumber(row.return_pct)
                const nativeInvested = toNumber(row.native_invested_amount)
                const nativeCurrent = toNumber(row.native_current_value)
                const nativePnl = toNumber(row.native_pnl ?? nativeCurrent - nativeInvested)
                const refreshSupported = getRefreshSupported(row)
                const sourceMeta = getSourceBadgeMeta(row)
                const freshnessMeta = getFreshnessMeta(row)
                const rowTone = getRowToneMeta(row)
                const isExpanded = expandedHoldingId === row.id

                return (
                  <div
                    key={row.id}
                    className={[
                      'overflow-hidden rounded-2xl border bg-slate-950/65 transition-all duration-200',
                      rowTone.border,
                      rowTone.glow,
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedHoldingId((current) => (current === row.id ? null : row.id))}
                      className="flex w-full items-stretch gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-slate-900/40 sm:gap-4 sm:px-4 sm:py-4"
                    >
                      <span className={['mt-0.5 h-auto w-1 shrink-0 rounded-full sm:mt-1', rowTone.accent].join(' ')} />

                      <div className="min-w-0 flex-1">
                        <div className="sm:hidden">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-base font-semibold tracking-[-0.02em] text-white">{row.symbol}</span>
                                <span className="inline-flex rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-semibold text-teal-300">
                                  {row.country === 'US' ? 'US' : 'IN'}
                                </span>
                                <span className={getInvestmentClassBadgeClass(getInvestmentClass(row))}>{getInvestmentClassLabel(row)}</span>
                              </div>
                              <div className="mt-1 truncate text-[12px] text-slate-400">{row.company_name}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-base font-semibold text-white">
                                {renderNativeAndInr(nativeCurrent, currentValue, row.currency)}
                              </div>
                              <div className={['mt-1 text-xs font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : rowTone.text].join(' ')}>
                                <PrivateValue value={formatSignedPct(pct)} mask="••••" hideColor />
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className={sourceMeta.className} title={sourceMeta.title}>
                              <Icon name={sourceMeta.icon} className="h-3.5 w-3.5" />
                              {sourceMeta.label}
                            </span>
                            <span className={freshnessMeta.className} title={freshnessMeta.title}>
                              {freshnessMeta.label}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-2">
                              <div className={sectionLabel}>Price</div>
                              <div className="mt-1 text-[13px] font-semibold text-slate-100">
                                <PrivateValue value={formatNativeMoney(toNumber(row.current_price), row.currency)} mask="••••" hideColor />
                              </div>
                              <div className="mt-1 text-[10px] text-slate-500">
                                {privacyMode ? '••••' : formatCompactTimestamp(row.last_price_refreshed_at ?? row.updated_at)}
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-2.5 py-2">
                              <div className={sectionLabel}>P&L</div>
                              <div className={['mt-1 text-[13px] font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : rowTone.text].join(' ')}>
                                {renderNativeAndInr(nativePnl, pnl, row.currency)}
                              </div>
                              <div className={['mt-1 text-[10px]', privacyMode ? 'text-slate-400 dark:text-slate-400' : rowTone.text].join(' ')}>
                                <PrivateValue value={formatPct(pct)} mask="••••" hideColor />
                              </div>
                            </div>
                            <div className="flex items-center justify-end">
                              <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400">
                                <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="hidden flex-col gap-4 lg:flex-row lg:items-center lg:justify-between sm:flex">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="t-title text-white">{row.symbol}</span>
                              <span className="inline-flex rounded-full bg-teal-500/15 px-2.5 py-1 text-[11px] font-semibold text-teal-300">
                                {row.country === 'US' ? 'US' : 'IN'}
                              </span>
                              <span className={getInvestmentClassBadgeClass(getInvestmentClass(row))}>{getInvestmentClassLabel(row)}</span>
                              <span className={sourceMeta.className} title={sourceMeta.title}>
                                <Icon name={sourceMeta.icon} className="h-3.5 w-3.5" />
                                {sourceMeta.label}
                              </span>
                              <span className={freshnessMeta.className} title={freshnessMeta.title}>
                                {freshnessMeta.label}
                              </span>
                            </div>
                            <div className="mt-2 t-body text-slate-400">{row.company_name}</div>
                          </div>

                          <div className="flex shrink-0 items-center gap-5">
                            <div className="text-right">
                              <div className="t-metric text-white">
                                <PrivateValue value={formatNativeMoney(toNumber(row.current_price), row.currency)} mask="••••" hideColor />
                              </div>
                              <div className="mt-1 t-meta text-slate-400">
                                {privacyMode ? '••••' : formatCompactTimestamp(row.last_price_refreshed_at ?? row.updated_at)}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className={['inline-flex items-center gap-1 t-metric', privacyMode ? 'text-slate-300 dark:text-slate-300' : rowTone.text].join(' ')}>
                                {rowTone.arrow ? <Icon name={rowTone.arrow} className="h-4 w-4" /> : null}
                                <PrivateValue value={formatPct(pct)} mask="••••" hideColor />
                              </div>
                              <div className={['mt-1 t-nav', privacyMode ? 'text-slate-400 dark:text-slate-400' : rowTone.text].join(' ')}>
                                {renderNativeAndInr(nativePnl, pnl, row.currency)}
                              </div>
                            </div>

                            <div className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400">
                              <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} className="h-5 w-5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-slate-800 bg-slate-900/70 px-4 py-4 sm:px-5">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <div>
                              <div className={sectionLabel}>Qty / Units</div>
                              <div className="mt-1 t-num text-slate-200">{toNumber(row.quantity)}</div>
                            </div>
                            <div>
                              <div className={sectionLabel}>Avg Buy</div>
                              <div className="mt-1 t-num text-slate-200">
                                <PrivateValue value={formatNativeMoney(toNumber(row.avg_buy_price), row.currency)} mask="••••" hideColor />
                              </div>
                            </div>
                            <div>
                              <div className={sectionLabel}>Invested</div>
                              <div className="mt-1 t-num text-slate-200">{renderNativeAndInr(nativeInvested, invested, row.currency)}</div>
                            </div>
                            <div>
                              <div className={sectionLabel}>Current Value</div>
                              <div className="mt-1 t-num text-slate-200">{renderNativeAndInr(nativeCurrent, currentValue, row.currency)}</div>
                            </div>
                            <div>
                              <div className={sectionLabel}>Exchange / Market</div>
                              <div className="mt-1 t-nav text-slate-300">{getHoldingMarketSymbol(row)}</div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
                            {refreshSupported ? (
                              <button
                                type="button"
                                onClick={() => handleRefreshHolding(row)}
                                disabled={refreshingHoldingId === row.id || isRefreshingAllPrices}
                                title="Refresh market price"
                                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 text-sm font-semibold text-sky-200 shadow-sm transition-all duration-150 hover:border-sky-400/40 hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                              >
                                <Icon name="refresh" className={['h-4 w-4', refreshingHoldingId === row.id ? 'animate-spin' : ''].join(' ')} />
                                {refreshingHoldingId === row.id ? 'Refreshing...' : 'Refresh Price'}
                              </button>
                            ) : (
                              <span className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 text-sm font-semibold text-amber-200 sm:w-auto">
                                Manual price required
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm font-semibold text-slate-200 transition-all duration-150 hover:bg-slate-700 active:scale-95 sm:w-auto"
                            >
                              <Icon name="edit" className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteHolding(row)}
                              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 transition-all duration-150 hover:bg-rose-500/15 active:scale-95 sm:w-auto"
                            >
                              <Icon name="remove" className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
        </div>
      </div>

      <BottomSheet
        open={selectedMobileHolding !== null}
        onClose={() => setSelectedMobileHoldingId(null)}
        title={selectedMobileHolding ? `${selectedMobileHolding.symbol} · ${selectedMobileHolding.company_name}` : 'Investment'}
        subtitle={selectedMobileHolding ? getInvestmentClassLabel(selectedMobileHolding) : ''}
      >
        {selectedMobileHolding ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Current Value</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {renderNativeAndInr(toNumber(selectedMobileHolding.native_current_value), toNumber(selectedMobileHolding.current_value), selectedMobileHolding.currency)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>P&L</div>
                <div className={['mt-1 text-sm font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(selectedMobileHolding.pnl))].join(' ')}>
                  {renderNativeAndInr(toNumber(selectedMobileHolding.native_pnl), toNumber(selectedMobileHolding.pnl), selectedMobileHolding.currency)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Quantity / Units</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{toNumber(selectedMobileHolding.quantity)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Return %</div>
                <div className={['mt-1 text-sm font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(selectedMobileHolding.return_pct))].join(' ')}>
                  <PrivateValue value={formatSignedPct(toNumber(selectedMobileHolding.return_pct))} mask="••••" hideColor />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Avg Buy</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatNativeMoney(toNumber(selectedMobileHolding.avg_buy_price), selectedMobileHolding.currency)} mask="••••" hideColor />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Current Price</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatNativeMoney(toNumber(selectedMobileHolding.current_price), selectedMobileHolding.currency)} mask="••••" hideColor />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Invested</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {renderNativeAndInr(toNumber(selectedMobileHolding.native_invested_amount), toNumber(selectedMobileHolding.invested_amount), selectedMobileHolding.currency)}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className={sectionLabel}>Market</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{getHoldingMarketSymbol(selectedMobileHolding)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className={getInvestmentClassBadgeClass(getInvestmentClass(selectedMobileHolding))}>{getInvestmentClassLabel(selectedMobileHolding)}</span>
              <span className={getSourceBadgeMeta(selectedMobileHolding).className}>
                <Icon name={getSourceBadgeMeta(selectedMobileHolding).icon} className="h-3.5 w-3.5" />
                {getSourceBadgeMeta(selectedMobileHolding).label}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {getRefreshSupported(selectedMobileHolding) ? (
                <button
                  type="button"
                  onClick={() => void handleRefreshHolding(selectedMobileHolding)}
                  disabled={refreshingHoldingId === selectedMobileHolding.id || isRefreshingAllPrices}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 text-sm font-semibold text-sky-300 disabled:opacity-60"
                >
                  <Icon name="refresh" className={['h-4 w-4', refreshingHoldingId === selectedMobileHolding.id ? 'animate-spin' : ''].join(' ')} />
                  {refreshingHoldingId === selectedMobileHolding.id ? 'Refreshing…' : 'Refresh Price'}
                </button>
              ) : (
                <div className="inline-flex h-11 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-sm font-semibold text-amber-300">
                  Manual price required
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedMobileHoldingId(null)
                  openEditModal(selectedMobileHolding)
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Icon name="edit" className="h-4 w-4" />
                Edit Investment
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteHolding(selectedMobileHolding)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-sm font-semibold text-rose-300"
              >
                <Icon name="remove" className="h-4 w-4" />
                Delete Investment
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {isHoldingDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none',
            isHoldingDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsHoldingModalOpen(false)}
          aria-hidden={!isHoldingDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-140 flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none',
              isHoldingDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">{editingHoldingId === null ? 'Add Investment' : 'Edit Investment'}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Manual entry for one investment position</div>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldingModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                aria-label="Close"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {formErrorMessage ? (
                  <div className="mb-5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 whitespace-pre-wrap">
                    {formErrorMessage}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Asset Class" error={formErrors.asset_type}>
                    <select
                      value={holdingForm.asset_type}
                      onChange={(event) => {
                        const nextType = event.target.value
                        setHoldingForm((current) => ({
                          ...current,
                          asset_type: nextType,
                          exchange_symbol: nextType === 'mutual_fund' ? '' : current.exchange_symbol,
                          sector: nextType === 'gold' && !current.sector ? 'Gold' : current.sector,
                        }))
                      }}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    >
                      {assetTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Country" error={formErrors.country}>
                    <select
                      value={holdingForm.country}
                      onChange={(event) => updateCountry(event.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    >
                      <option value="IN">India</option>
                      <option value="US">US</option>
                    </select>
                  </FormField>

                  <FormField label="Symbol" error={formErrors.symbol}>
                    <input
                      value={holdingForm.symbol}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                      placeholder="RELIANCE / AAPL"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Name" error={formErrors.company_name}>
                    <input
                      value={holdingForm.company_name}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, company_name: event.target.value }))}
                      placeholder="Reliance Industries / Apple"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Exchange" error={formErrors.exchange}>
                    <select
                      value={holdingForm.exchange}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, exchange: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    >
                      {holdingForm.country === 'US' ? (
                        <>
                          <option value="NASDAQ">NASDAQ</option>
                          <option value="NYSE">NYSE</option>
                          <option value="OTHER">OTHER</option>
                        </>
                      ) : (
                        <>
                          <option value="NSE">NSE</option>
                          <option value="BSE">BSE</option>
                          <option value="MCX">MCX</option>
                          <option value="OTHER">OTHER</option>
                        </>
                      )}
                    </select>
                  </FormField>

                  <FormField label="Currency" error={formErrors.currency}>
                    <select
                      value={holdingForm.currency}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, currency: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                  </FormField>

                  <FormField label="FX Rate to INR" error={formErrors.fx_rate_to_inr}>
                    <input
                      value={holdingForm.fx_rate_to_inr}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, fx_rate_to_inr: event.target.value }))}
                      placeholder={holdingForm.country === 'US' ? '83.50' : '1'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'Units' : 'Quantity'} error={formErrors.quantity}>
                    <input
                      value={holdingForm.quantity}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'mutual_fund' ? '450' : '40'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Average Buy Price" error={formErrors.avg_buy_price}>
                    <input
                      value={holdingForm.avg_buy_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, avg_buy_price: event.target.value }))}
                      placeholder={holdingForm.country === 'US' ? '180.50' : '2380'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'NAV' : 'Current Price'} error={formErrors.current_price}>
                    <input
                      value={holdingForm.current_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, current_price: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'mutual_fund' ? '89.15' : '2910'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Sector / Category" error={formErrors.sector}>
                    <input
                      value={holdingForm.sector}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, sector: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'gold' ? 'Gold' : 'Technology / FMCG'}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                      autoComplete="off"
                    />
                  </FormField>

                  {holdingForm.asset_type !== 'mutual_fund' ? (
                    <FormField label="Exchange Symbol" error={formErrors.exchange_symbol}>
                      <input
                        value={holdingForm.exchange_symbol}
                        onChange={(event) => setHoldingForm((current) => ({ ...current, exchange_symbol: event.target.value.toUpperCase() }))}
                        placeholder={holdingForm.country === 'US' ? 'AAPL' : 'RELIANCE.NS'}
                        className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                        autoComplete="off"
                      />
                    </FormField>
                  ) : null}

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={holdingForm.as_of_date}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, as_of_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>
                </div>

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    value={holdingForm.notes}
                    onChange={(event) => setHoldingForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                    placeholder="Optional notes about the investment"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150 resize-none"
                  />
                </FormField>

                <div className="mt-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Price source</div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {holdingForm.asset_type === 'mutual_fund'
                      ? 'Mutual funds stay manual-only.'
                      : holdingForm.asset_type === 'gold'
                        ? 'Gold stays manual unless you explicitly refresh it later.'
                        : 'Auto refresh is available only after a market refresh is triggered.'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsHoldingModalOpen(false)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm transition-all duration-150 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
                  disabled={isSavingHolding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHolding}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-accent-700 active:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingHolding ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                  {isSavingHolding ? 'Saving...' : editingHoldingId === null ? 'Create Investment' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
