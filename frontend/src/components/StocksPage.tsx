import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Icon } from './Icon'
import { ApiError, apiFetch } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'

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
  if (normalized === 'stock' || normalized === 'stock_in') return 'bg-accent-500/15 text-accent-400'
  if (normalized === 'stock_us') return 'bg-sky-500/15 text-sky-400'
  if (normalized === 'etf') return 'bg-sky-500/15 text-sky-400'
  if (normalized === 'gold') return 'bg-amber-500/15 text-amber-400'
  if (normalized === 'mutual_fund') return 'bg-violet-500/15 text-violet-400'
  if (normalized === 'cash') return 'bg-amber-500/15 text-amber-400'
  return 'bg-slate-700 text-slate-300'
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
  if (value === 'indian_stock') return 'bg-accent-500/15 text-accent-400'
  if (value === 'us_stock') return 'bg-sky-500/15 text-sky-400'
  if (value === 'etf') return 'bg-sky-500/15 text-sky-400'
  if (value === 'gold') return 'bg-amber-500/15 text-amber-400'
  if (value === 'mutual_fund') return 'bg-violet-500/15 text-violet-400'
  return 'bg-slate-700 text-slate-300'
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
      } else if (group === 'indian_stock') {
        accumulator.indianEquity += current
      } else if (group === 'etf' || group === 'gold') {
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
        <span>{formatNativeMoney(nativeValue, currency)}</span>
        <span className="t-meta text-slate-400">{formatINR(inrValue)}</span>
      </div>
    )
  }

  return <span>{formatINR(inrValue)}</span>
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
    <div className={['rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors duration-200 ease-out hover:border-slate-600/60 motion-reduce:transition-none', className].join(' ')}>
      {title ? <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5 t-section text-white">{title}</div> : null}
      {children}
    </div>
  )
}

function MetricCardView({
  label,
  value,
  meta,
  icon,
  valueClass = 'text-white',
}: {
  label: string
  value: string
  meta: string
  icon: 'netWorth' | 'portfolio' | 'analytics' | 'cards' | 'up'
  valueClass?: string
}) {
  return (
    <SectionCard className="px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="t-label text-slate-400">{label}</div>
          <div className={['t-metric mt-5', valueClass].join(' ')}>{value}</div>
          <div className="mt-4 t-meta text-slate-400">{meta}</div>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[6px] bg-slate-800 text-slate-300">
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </SectionCard>
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
      <div className="mb-2 t-label text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-2 t-meta text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function StocksPage() {
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

  const summaryCards = useMemo(() => {
    if (analyticsLoading) {
      return [
        { label: 'Total Invested', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Current Value', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Total P&L', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Return %', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Indian Equity', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'US Market', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'ETFs / Gold', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Mutual Funds', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
      ]
    }

    if (analyticsError || !analytics) {
      return [
        { label: 'Total Invested', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Current Value', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Total P&L', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Return %', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Indian Equity', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'US Market', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'ETFs / Gold', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Mutual Funds', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
      ]
    }

    const totalInvested = toNumber(analytics.total_invested)
    const currentValue = toNumber(analytics.current_value)
    const pnl = toNumber(analytics.total_pnl)
    const returnPct = toNumber(analytics.total_return_pct)

    return [
      { label: 'Total Invested', value: formatINRShort(totalInvested), meta: `${holdings.length} positions`, color: 'text-white' },
      { label: 'Current Value', value: formatINRShort(currentValue), meta: 'From holdings', color: 'text-white' },
      { label: 'Total P&L', value: `${pnl > 0 ? '+' : pnl < 0 ? '-' : ''}${formatINRShort(Math.abs(pnl)).replace('₹', '')}`, meta: 'Overall profit / loss', color: getTrendClass(pnl) },
      { label: 'Return %', value: formatSignedPct(returnPct), meta: 'Based on invested amount', color: getTrendClass(returnPct) },
      { label: 'Indian Equity', value: formatINRShort(holdingGroups.indianEquity), meta: 'Indian stock positions', color: 'text-white' },
      { label: 'US Market', value: formatINRShort(holdingGroups.usEquity), meta: 'US stocks and ETFs', color: 'text-white' },
      { label: 'ETFs / Gold', value: formatINRShort(holdingGroups.etfsGold), meta: 'India ETFs and gold exposure', color: 'text-white' },
      { label: 'Mutual Funds', value: formatINRShort(holdingGroups.mutualFunds), meta: 'Units valued in INR', color: 'text-white' },
    ]
  }, [analytics, analyticsError, analyticsLoading, holdingGroups.indianEquity, holdingGroups.mutualFunds, holdingGroups.etfsGold, holdingGroups.usEquity, holdings.length])

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
      { key: 'etf_gold', name: 'ETFs / Gold', value: holdingGroups.etfsGold, color: '#a78bfa' },
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
  const performanceMessage = portfolioPerformance?.message
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

      if (method === 'PATCH') {
        console.log('PATCH holding', {
          url: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${url}`,
          payload,
        })
      }

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

        <div className="flex flex-col gap-2">
          <div className="t-title text-white">Stocks &amp; Investments</div>
          <div className="t-body text-slate-400">Indian stocks, US stocks, ETFs, gold, and mutual funds</div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Icon name="refresh" className="h-4 w-4" />
            <span className="whitespace-nowrap">
              Prices last updated {latestUpdate ? formatDisplayDate(latestUpdate.toISOString()) : 'Awaiting backend data'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshAllPrices}
              disabled={isRefreshingAllPrices}
              className="flex h-12 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body font-semibold text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 hover:border-slate-500/70 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
            >
              <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
              {isRefreshingAllPrices ? 'Refreshing...' : 'Refresh Prices'}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-12 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
            >
              <Icon name="add" className="h-4 w-4 text-white" />
              Add Investment
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <MetricCardView
              key={card.label}
              label={card.label}
              value={card.value}
              meta={card.meta}
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
              valueClass={card.color}
            />
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Investment Breakdown</div>
            <div className="mt-1 t-body text-slate-400">Asset mix by current value</div>
            {allocationData.length > 0 ? (
              <div className="mt-6">
                <div className="flex h-3 overflow-hidden rounded-full bg-slate-800/80">
                  {allocationData.map((entry) => (
                    <div key={entry.key} className="h-full" style={{ width: `${Math.max(entry.percentage, 3)}%`, backgroundColor: entry.color }} />
                  ))}
                </div>
                <div className="mt-6 space-y-4">
                  {allocationData.map((entry) => (
                    <div key={entry.key} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                        <span className="t-body text-slate-200">{entry.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="t-nav text-white">{formatINRShort(entry.value)}</div>
                        <div className="t-meta">{entry.percentage.toFixed(1)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">No allocation yet</div>
                <div className="mt-2 t-body text-slate-400">Add investments to populate the breakdown.</div>
              </div>
            )}
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="t-section text-white">Performance</div>
                <div className="mt-1 t-body text-slate-400">Portfolio snapshot trend</div>
              </div>
              <div className="flex items-center gap-1 rounded-[999px] bg-slate-800/80 p-1 text-[11px]">
                {timeFilters.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setActiveRange(filter.value)}
                    className={[
                      'h-8 rounded-[999px] px-3 t-badge transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                      activeRange === filter.value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="t-metric text-white">{portfolioHasSnapshots ? formatINRShort(latestSnapshotValue) : '—'}</div>
              {portfolioHasSnapshots ? <div className={['t-nav', getTrendClass(latestSnapshotReturn)].join(' ')}>{formatSignedPct(latestSnapshotReturn)}</div> : null}
              <div className="t-body text-slate-400">{portfolioHasSnapshots ? 'latest snapshot' : 'waiting for snapshots'}</div>
            </div>

            {portfolioLoading ? (
              <div className="mt-8 rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">Loading portfolio snapshots...</div>
                <div className="mt-2 t-body text-slate-400">Fetching actual and predicted data from the backend.</div>
              </div>
            ) : portfolioError ? (
              <div className="mt-8 rounded-[6px] border border-[rgba(244,63,94,0.35)] bg-[rgba(127,29,29,0.18)] p-4 t-body text-rose-200">
                {portfolioError}
              </div>
            ) : !portfolioHasSnapshots ? (
              <div className="mt-8 rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">No portfolio history yet</div>
                <div className="mt-2 t-body text-slate-400">Save today&apos;s snapshot to start tracking performance.</div>
                <button
                  type="button"
                  onClick={handleSaveSnapshot}
                  disabled={savingSnapshot}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] active:scale-[0.98] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingSnapshot ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                  Save Snapshot
                </button>
              </div>
            ) : (
              <>
                <div className="mt-6 flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-accent-400" />
                    Actual
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    Predicted
                  </span>
                </div>
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={portfolioChartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(51,65,85,0.45)" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(value) => formatINRShort(Number(value))} width={70} />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0' }}
                        labelStyle={{ color: '#e2e8f0' }}
                        formatter={(value, name) => [formatINRShort(Number(value)), name === 'actual_value' ? 'Actual' : 'Predicted']}
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
                <div className="mt-5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSaveSnapshot}
                    disabled={savingSnapshot}
                    className="inline-flex h-11 items-center gap-2 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body font-semibold text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.98] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingSnapshot ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                    Save Snapshot
                  </button>
                  {performanceMessage ? <div className="t-meta text-slate-400">{performanceMessage}</div> : null}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard className="overflow-hidden">
          <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'indian_stock', label: 'Indian Stocks' },
                  { value: 'us_stock', label: 'US Stocks' },
                  { value: 'etf', label: 'ETFs' },
                  { value: 'gold', label: 'Gold' },
                  { value: 'mutual_fund', label: 'Mutual Funds' },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setAssetTypeFilter(filter.value)}
                    className={[
                      'h-9 whitespace-nowrap rounded-[999px] px-4 t-badge transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                      assetTypeFilter === filter.value ? 'bg-[var(--accent-600)] text-white' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 hover:text-white',
                    ].join(' ')}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <label className="flex h-11 min-w-[260px] items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 text-slate-400">
                  <Icon name="search" className="h-4 w-4 shrink-0" />
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by symbol, company, or fund"
                    className="w-full bg-transparent t-body text-slate-200 outline-none placeholder:text-slate-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={handleRefreshAllPrices}
                  disabled={isRefreshingAllPrices}
                  className="flex h-11 items-center gap-2 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-nav text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.98] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
                  Refresh Prices
                </button>
              </div>
            </div>
          </div>

          {holdingsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">Loading investments...</div>
                <div className="mt-2 t-body text-slate-400">Fetching positions from the backend.</div>
              </div>
            </div>
          ) : holdingsError ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-8 text-center">
                <div className="t-section text-rose-300">Unable to load investments</div>
                <div className="mt-2 t-body text-rose-200/80">{holdingsError}</div>
              </div>
            </div>
          ) : filteredHoldings.length === 0 ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-[6px] bg-[#18233d] text-accent-400">
                  <Icon name="empty" className="h-5 w-5" />
                </div>
                <div className="mt-4 t-section text-white">No investments match the filters</div>
                <div className="mt-2 t-body text-slate-400">Try a different class, country, or search term.</div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1520px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    {['Asset', 'Class', 'Country', 'Qty / Units', 'Avg Buy', 'Current Price', 'Invested', 'Current Value', 'P&L', 'Return %', 'Actions'].map((head) => (
                      <th key={head} className="px-5 py-4 t-th">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHoldings.map((row) => {
                    const invested = toNumber(row.invested_amount)
                    const currentValue = toNumber(row.current_value)
                    const pnl = toNumber(row.pnl)
                    const pct = toNumber(row.return_pct)
                    const nativeInvested = toNumber(row.native_invested_amount)
                    const nativeCurrent = toNumber(row.native_current_value)
                    const nativePnl = toNumber(row.native_pnl ?? nativeCurrent - nativeInvested)
                    const pnlTone = getTrendClass(pnl)
                    const returnTone = getTrendClass(pct)
                    const refreshSupported = getRefreshSupported(row)

                    return (
                      <tr key={row.id} className="border-t border-[rgba(51,65,85,0.35)] transition-colors duration-150 hover:bg-[rgba(30,41,59,0.3)]">
                        <td className="px-5 py-3">
                          <div className="t-nav text-white">{row.symbol}</div>
                          <div className="t-meta truncate">{row.company_name}</div>
                          <div className="mt-2 inline-flex rounded-[999px] px-2 py-1 t-badge bg-slate-700/80 text-slate-300">
                            {row.price_source === 'yfinance' ? 'Auto' : 'Manual'}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className={['inline-flex rounded-[999px] px-2 py-1 t-badge', getInvestmentClassBadgeClass(getInvestmentClass(row))].join(' ')}>
                            {getInvestmentClassLabel(row)}
                          </div>
                        </td>
                        <td className="px-5 py-3 t-body text-slate-200">{row.country === 'US' ? 'US' : 'India'}</td>
                        <td className="px-5 py-3 t-num text-slate-200">{toNumber(row.quantity)}</td>
                        <td className="px-5 py-3 t-num text-slate-200">{formatNativeMoney(toNumber(row.avg_buy_price), row.currency)}</td>
                        <td className="px-5 py-3 t-num text-slate-200">{formatNativeMoney(toNumber(row.current_price), row.currency)}</td>
                        <td className="px-5 py-3 t-num text-slate-200">{renderNativeAndInr(nativeInvested, invested, row.currency)}</td>
                        <td className="px-5 py-3 t-num text-white">{renderNativeAndInr(nativeCurrent, currentValue, row.currency)}</td>
                        <td className={['px-5 py-3 t-num', pnlTone].join(' ')}>{renderNativeAndInr(nativePnl, pnl, row.currency)}</td>
                        <td className={['px-5 py-3 t-badge', returnTone].join(' ')}>
                          {pct > 0 ? '↑' : pct < 0 ? '↓' : '•'} {formatPct(pct)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-400">
                          {refreshSupported ? (
                            <button
                              type="button"
                              onClick={() => handleRefreshHolding(row)}
                              disabled={refreshingHoldingId === row.id || isRefreshingAllPrices}
                              title="Refresh market price"
                              className="mr-2 inline-flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border-soft)] px-3 t-badge text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                            >
                              <Icon name="refresh" className={['h-4 w-4', refreshingHoldingId === row.id ? 'animate-spin' : ''].join(' ')} />
                              {refreshingHoldingId === row.id ? 'Refreshing' : 'Refresh'}
                            </button>
                          ) : (
                            <span className="mr-2 inline-flex h-9 items-center rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[rgba(15,23,42,0.72)] px-3 t-badge text-slate-400">
                              Manual only
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="mr-2 rounded-[6px] px-2 py-1 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.95] motion-reduce:transition-none"
                            aria-label={`Edit ${row.symbol}`}
                          >
                            <Icon name="edit" className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHolding(row)}
                            className="rounded-[6px] px-2 py-1 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.95] motion-reduce:transition-none"
                            aria-label={`Delete ${row.symbol}`}
                          >
                            <Icon name="remove" className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {isHoldingDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none',
            isHoldingDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsHoldingModalOpen(false)}
          aria-hidden={!isHoldingDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[#0f172a] shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out motion-reduce:transition-none',
              isHoldingDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
              <div>
                <div className="t-section text-white">{editingHoldingId === null ? 'Add Investment' : 'Edit Investment'}</div>
                <div className="mt-1 t-meta">Manual entry for one investment position</div>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldingModalOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-[6px] text-slate-400 transition-all duration-200 ease-out hover:bg-white/5 hover:text-white active:scale-[0.95] motion-reduce:transition-none"
                aria-label="Close"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {formErrorMessage ? (
                  <div className="mb-5 whitespace-pre-wrap rounded-[6px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 t-body text-rose-200">
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
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
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
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
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
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Name" error={formErrors.company_name}>
                    <input
                      value={holdingForm.company_name}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, company_name: event.target.value }))}
                      placeholder="Reliance Industries / Apple"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Exchange" error={formErrors.exchange}>
                    <select
                      value={holdingForm.exchange}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, exchange: event.target.value }))}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
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
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
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
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'Units' : 'Quantity'} error={formErrors.quantity}>
                    <input
                      value={holdingForm.quantity}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'mutual_fund' ? '450' : '40'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Average Buy Price" error={formErrors.avg_buy_price}>
                    <input
                      value={holdingForm.avg_buy_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, avg_buy_price: event.target.value }))}
                      placeholder={holdingForm.country === 'US' ? '180.50' : '2380'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'NAV' : 'Current Price'} error={formErrors.current_price}>
                    <input
                      value={holdingForm.current_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, current_price: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'mutual_fund' ? '89.15' : '2910'}
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Sector / Category" error={formErrors.sector}>
                    <input
                      value={holdingForm.sector}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, sector: event.target.value }))}
                      placeholder={holdingForm.asset_type === 'gold' ? 'Gold' : 'Technology / FMCG'}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  {holdingForm.asset_type !== 'mutual_fund' ? (
                    <FormField label="Exchange Symbol" error={formErrors.exchange_symbol}>
                      <input
                        value={holdingForm.exchange_symbol}
                        onChange={(event) => setHoldingForm((current) => ({ ...current, exchange_symbol: event.target.value.toUpperCase() }))}
                        placeholder={holdingForm.country === 'US' ? 'AAPL' : 'RELIANCE.NS'}
                        className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                        autoComplete="off"
                      />
                    </FormField>
                  ) : null}

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={holdingForm.as_of_date}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, as_of_date: event.target.value }))}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
                    />
                  </FormField>
                </div>

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    value={holdingForm.notes}
                    onChange={(event) => setHoldingForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                    placeholder="Optional notes about the investment"
                    className="w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 py-3 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                  />
                </FormField>

                <div className="mt-5 rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0b1224] px-4 py-3">
                  <div className="t-meta uppercase text-slate-400">Price source</div>
                  <div className="mt-1 t-body text-slate-200">
                    {holdingForm.asset_type === 'mutual_fund'
                      ? 'Mutual funds stay manual-only.'
                      : holdingForm.asset_type === 'gold'
                        ? 'Gold stays manual unless you explicitly refresh it later.'
                        : 'Auto refresh is available only after a market refresh is triggered.'}
                  </div>
                </div>
              </div>

              <div className="border-t border-[rgba(51,65,85,0.45)] px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsHoldingModalOpen(false)}
                    className="h-11 rounded-[6px] border border-[var(--border-soft)] px-5 t-nav text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.98] motion-reduce:transition-none"
                    disabled={isSavingHolding}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingHolding}
                    className="flex h-11 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-5 t-nav font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 motion-reduce:transition-none"
                  >
                    {isSavingHolding ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                    {isSavingHolding ? 'Saving...' : editingHoldingId === null ? 'Create Investment' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
