import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Icon, type IconName } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import PortfolioPerformanceChart from './ui/PortfolioPerformanceChart'
import {
  ApiError,
  apiFetch,
  createInvestmentTransaction,
  deleteInvestmentTransaction,
  updateInvestmentTransaction,
  type InvestmentTransaction,
  type InvestmentTransactionPayload,
  type PortfolioPerformanceData,
  type PortfolioRange,
} from '../lib/api'
import {
  formatINR,
  formatINRShort,
  formatPct,
  formatSignedPct,
  getTrendClass,
} from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import {
  useHoldingsAnalyticsQuery,
  useHoldingsQuery,
  useInvestmentTransactionsQuery,
  usePortfolioPerformanceQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  tags: string | null
  status: string
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
  tags: string
  price_source: string
  status: string
}

type FormErrors = Partial<Record<keyof HoldingFormState, string>>
type HoldingSortOption = 'value_desc' | 'pnl_desc' | 'return_desc' | 'return_asc' | 'weight_desc' | 'name_asc' | 'asset_type'
type ProfitFilterOption = 'all' | 'profit' | 'loss'
type ExplorerTabOption = 'allocation' | 'sectors' | 'movers'
type ViewMode = 'table' | 'cards'

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
  tags: '',
  price_source: 'manual',
  status: 'Active',
}

const defaultTransactionForm: InvestmentTransactionPayload = {
  transaction_type: 'BUY',
  transaction_mode: 'One Time',
  quantity: '',
  price_per_unit: '',
  fees: '0',
  taxes: '0',
  exchange_rate: '1',
  transaction_date: new Date().toISOString().slice(0, 10),
  notes: null,
}

const assetTypeOptions = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'gold', label: 'Gold' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const assetTypePalette: Record<string, { label: string; color: string; bg: string }> = {
  indian_stock: { label: 'Indian Stocks', color: '#14b8a6', bg: 'bg-teal-500/15' },
  us_stock: { label: 'US Stocks', color: '#38bdf8', bg: 'bg-sky-500/15' },
  etf: { label: 'ETFs', color: '#818cf8', bg: 'bg-indigo-500/15' },
  gold: { label: 'Gold', color: '#f59e0b', bg: 'bg-amber-500/15' },
  mutual_fund: { label: 'Mutual Funds', color: '#c084fc', bg: 'bg-purple-500/15' },
  cash: { label: 'Cash', color: '#f97316', bg: 'bg-orange-500/15' },
  other: { label: 'Other Assets', color: '#94a3b8', bg: 'bg-slate-500/15' },
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
      return error.validationErrors
        .map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`)
        .join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function isGoldHolding(holding: ApiHolding): boolean {
  const text = [holding.symbol, holding.company_name, holding.sector, holding.notes, holding.exchange_symbol]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return (
    holding.asset_type === 'gold' ||
    (holding.asset_type === 'other' && text.includes('gold')) ||
    (holding.asset_type === 'etf' && text.includes('gold'))
  )
}

function getInvestmentClass(holding: ApiHolding): string {
  if (holding.asset_type === 'mutual_fund') return 'mutual_fund'
  if (isGoldHolding(holding)) return 'gold'
  if (holding.country === 'US' && holding.asset_type === 'stock') return 'us_stock'
  if (holding.asset_type === 'stock') return 'indian_stock'
  if (holding.asset_type === 'etf') return 'etf'
  return 'other'
}

function getInvestmentClassLabel(holding: ApiHolding): string {
  const className = getInvestmentClass(holding)
  if (className === 'indian_stock') return 'Indian Stock'
  if (className === 'us_stock') return 'US Stock'
  if (className === 'etf') return 'ETF'
  if (className === 'gold') return 'Gold'
  if (className === 'mutual_fund') return 'Mutual Fund'
  return 'Other'
}

function getInvestmentClassBadgeClass(className: string): string {
  if (className === 'indian_stock') {
    return 'inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-400 ring-1 ring-inset ring-teal-500/20'
  }
  if (className === 'us_stock') {
    return 'inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-400 ring-1 ring-inset ring-sky-500/20'
  }
  if (className === 'etf') {
    return 'inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 ring-1 ring-inset ring-indigo-500/20'
  }
  if (className === 'gold') {
    return 'inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20'
  }
  if (className === 'mutual_fund') {
    return 'inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:bg-purple-500/15 dark:text-purple-400 ring-1 ring-inset ring-purple-500/20'
  }
  return 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300'
}

function getHoldingMarketSymbol(holding: ApiHolding): string {
  if (holding.asset_type === 'mutual_fund') {
    return holding.exchange_symbol ? `AMFI: ${holding.exchange_symbol}` : holding.symbol
  }
  if (holding.country === 'US') return (holding.exchange_symbol || holding.symbol).toUpperCase()
  return (holding.exchange_symbol || `${holding.symbol}.NS`).toUpperCase()
}

function getRefreshSupported(holding: ApiHolding): boolean {
  return holding.status === 'Active' || toNumber(holding.quantity) > 0 || Boolean(holding.exchange_symbol)
}

function sortHoldings(holdings: ApiHolding[], sortOption: HoldingSortOption, totalValue: number): ApiHolding[] {
  const rows = [...holdings]
  rows.sort((left, right) => {
    if (sortOption === 'value_desc') return toNumber(right.current_value) - toNumber(left.current_value)
    if (sortOption === 'pnl_desc') return toNumber(right.pnl) - toNumber(left.pnl)
    if (sortOption === 'return_desc') return toNumber(right.return_pct) - toNumber(left.return_pct)
    if (sortOption === 'return_asc') return toNumber(left.return_pct) - toNumber(right.return_pct)
    if (sortOption === 'weight_desc') {
      const wRight = totalValue > 0 ? toNumber(right.current_value) / totalValue : 0
      const wLeft = totalValue > 0 ? toNumber(left.current_value) / totalValue : 0
      return wRight - wLeft
    }
    if (sortOption === 'asset_type') {
      const typeCompare = getInvestmentClassLabel(left).localeCompare(getInvestmentClassLabel(right))
      if (typeCompare !== 0) return typeCompare
    }
    return left.company_name.localeCompare(right.company_name)
  })
  return rows
}

function formatNativeMoney(value: number, currency: string): string {
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
      <div className="flex flex-col items-end">
        <span className="font-semibold text-slate-900 dark:text-white">
          <PrivateValue value={formatINR(inrValue)} mask="••••" hideColor />
        </span>
        <span className="text-[11px] text-slate-400 font-normal">
          <PrivateValue value={formatNativeMoney(nativeValue, currency)} mask="••••" hideColor />
        </span>
      </div>
    )
  }
  return (
    <span className="font-semibold text-slate-900 dark:text-white">
      <PrivateValue value={formatINR(inrValue)} mask="••••" hideColor />
    </span>
  )
}

function formatDisplayDate(value: string | null | undefined): string {
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

function formatCompactTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not updated'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not updated'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(parsed)
}

function getSourceBadgeMeta(holding: ApiHolding) {
  if (holding.price_source === 'yfinance' || holding.price_source === 'mfapi' || holding.price_source === 'auto') {
    const isMf = holding.price_source === 'mfapi' || holding.asset_type === 'mutual_fund'
    return {
      label: 'Live Auto',
      title: isMf ? 'Automated daily NAV feed from AMFI / MFAPI' : 'Automated live feed from Yahoo Finance',
      className:
        'inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/20',
      icon: 'refresh' as const,
    }
  }
  return {
    label: 'Manual',
    title: 'Manual price entry',
    className:
      'inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20',
    icon: 'edit' as const,
  }
}

function getCountryDefaults(country: string) {
  if (country === 'US') {
    return { currency: 'USD', exchange: 'NASDAQ', fx_rate_to_inr: '83.50' }
  }
  return { currency: 'INR', exchange: 'NSE', fx_rate_to_inr: '1' }
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
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StocksPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [profitFilter, setProfitFilter] = useState<ProfitFilterOption>('all')
  const [sortOption, setSortOption] = useState<HoldingSortOption>('value_desc')
  const [explorerTab, setExplorerTab] = useState<ExplorerTabOption>('allocation')
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [pageTab, setPageTab] = useState<'holdings' | 'transactions'>('holdings')

  // Modals & Drawers
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false)
  const [isHoldingDrawerMounted, setIsHoldingDrawerMounted] = useState(false)
  const [isHoldingDrawerVisible, setIsHoldingDrawerVisible] = useState(false)
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(defaultHoldingForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null)
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null)
  const [drawerTab, setDrawerTab] = useState<'overview' | 'transactions'>('overview')

  // Transaction Modal State
  const [transactionModalOpen, setTransactionModalOpen] = useState(false)
  const [transactionForm, setTransactionForm] = useState(defaultTransactionForm)
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null)
  const [transactionError, setTransactionError] = useState<string | null>(null)
  const [savingTransaction, setSavingTransaction] = useState(false)
  const [transactionFrom, setTransactionFrom] = useState('')
  const [transactionTo, setTransactionTo] = useState('')

  // Price Refresh & Snapshot State
  const [isRefreshingAllPrices, setIsRefreshingAllPrices] = useState(false)
  const [refreshingHoldingId, setRefreshingHoldingId] = useState<number | null>(null)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [activeRange, setActiveRange] = useState<PortfolioRange>('6M')

  // Queries
  const holdingsQuery = useHoldingsQuery()
  const analyticsQuery = useHoldingsAnalyticsQuery()
  const portfolioPerformanceQuery = usePortfolioPerformanceQuery(activeRange)
  const allPerformanceQuery = usePortfolioPerformanceQuery('ALL')
  const transactionsQuery = useInvestmentTransactionsQuery(undefined)

  const holdings = (holdingsQuery.data ?? []) as ApiHolding[]
  const transactions = transactionsQuery.data ?? []
  const analytics = (analyticsQuery.data ?? null) as ApiHoldingsAnalytics | null
  const holdingsLoading = holdingsQuery.isLoading
  const analyticsLoading = analyticsQuery.isLoading
  const holdingsError = holdingsQuery.error ? formatApiError(holdingsQuery.error) : null
  const portfolioPerformance = (portfolioPerformanceQuery.data ?? null) as PortfolioPerformanceData | null
  const portfolioLoading = portfolioPerformanceQuery.isLoading
  const portfolioError = portfolioPerformanceQuery.error ? formatApiError(portfolioPerformanceQuery.error) : null

  // Drawer Animation Effects
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
      if (event.key === 'Escape') setIsHoldingModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHoldingDrawerMounted])

  // Filtered & Grouped Data
  const openHoldings = useMemo(() => holdings.filter((h) => toNumber(h.quantity) > 0), [holdings])

  const liveUsdInrRate = useMemo(() => {
    const firstUs = holdings.find((h) => h.country === 'US')
    return firstUs ? toNumber(firstUs.effective_fx_rate_to_inr) : 0
  }, [holdings])

  const totalCurrentValue = useMemo(() => {
    if (analytics) return toNumber(analytics.current_value)
    return openHoldings.reduce((sum, h) => sum + toNumber(h.current_value), 0)
  }, [analytics, openHoldings])

  const totalInvestedCapital = useMemo(() => {
    if (analytics) return toNumber(analytics.total_invested)
    return openHoldings.reduce((sum, h) => sum + toNumber(h.invested_amount), 0)
  }, [analytics, openHoldings])

  const totalUnrealizedPnl = useMemo(() => {
    if (analytics) return toNumber(analytics.total_pnl)
    return totalCurrentValue - totalInvestedCapital
  }, [analytics, totalCurrentValue, totalInvestedCapital])

  const totalReturnPct = useMemo(() => {
    if (analytics) return toNumber(analytics.total_return_pct)
    return totalInvestedCapital > 0 ? (totalUnrealizedPnl / totalInvestedCapital) * 100 : 0
  }, [analytics, totalInvestedCapital, totalUnrealizedPnl])

  const realizedProfitTotal = useMemo(() => {
    return transactions.reduce((acc, row) => acc + toNumber(row.realized_pnl), 0)
  }, [transactions])

  const totalLifetimePnl = useMemo(() => {
    return totalUnrealizedPnl + realizedProfitTotal
  }, [totalUnrealizedPnl, realizedProfitTotal])

  // Breadth: Gainers vs Losers count
  const portfolioBreadth = useMemo(() => {
    let gainers = 0
    let losers = 0
    openHoldings.forEach((h) => {
      if (toNumber(h.pnl) >= 0) gainers += 1
      else losers += 1
    })
    return { gainers, losers }
  }, [openHoldings])

  // 4 Core Category Pillars
  const categoryPillars = useMemo(() => {
    const categories = {
      indian_stock: { label: 'Indian Stocks', color: '#14b8a6', invested: 0, current: 0, pnl: 0, count: 0 },
      mutual_fund: { label: 'Mutual Funds', color: '#c084fc', invested: 0, current: 0, pnl: 0, count: 0 },
      us_stock: { label: 'US Stocks', color: '#38bdf8', invested: 0, current: 0, pnl: 0, count: 0, nativeUsd: 0 },
      etf_gold: { label: 'ETFs & Gold', color: '#f59e0b', invested: 0, current: 0, pnl: 0, count: 0 },
    }

    openHoldings.forEach((h) => {
      const cls = getInvestmentClass(h)
      const inv = toNumber(h.invested_amount)
      const cur = toNumber(h.current_value)
      const p = toNumber(h.pnl)

      if (cls === 'indian_stock') {
        categories.indian_stock.invested += inv
        categories.indian_stock.current += cur
        categories.indian_stock.pnl += p
        categories.indian_stock.count += 1
      } else if (cls === 'mutual_fund') {
        categories.mutual_fund.invested += inv
        categories.mutual_fund.current += cur
        categories.mutual_fund.pnl += p
        categories.mutual_fund.count += 1
      } else if (cls === 'us_stock') {
        categories.us_stock.invested += inv
        categories.us_stock.current += cur
        categories.us_stock.pnl += p
        categories.us_stock.count += 1
        categories.us_stock.nativeUsd += toNumber(h.native_current_value)
      } else if (cls === 'etf' || cls === 'gold' || cls === 'other') {
        categories.etf_gold.invested += inv
        categories.etf_gold.current += cur
        categories.etf_gold.pnl += p
        categories.etf_gold.count += 1
      }
    })

    return categories
  }, [openHoldings])

  // Allocation breakdown bar data
  const allocationSegments = useMemo(() => {
    if (analytics?.asset_type_allocation?.length) {
      return analytics.asset_type_allocation.map((item) => ({
        key: item.key,
        label: item.label,
        value: toNumber(item.amount),
        percentage: toNumber(item.percentage),
        color: assetTypePalette[item.key]?.color ?? '#64748b',
      }))
    }
    const pillars = [
      { key: 'indian_stock', label: 'Indian Stocks', value: categoryPillars.indian_stock.current, color: '#14b8a6' },
      { key: 'mutual_fund', label: 'Mutual Funds', value: categoryPillars.mutual_fund.current, color: '#c084fc' },
      { key: 'us_stock', label: 'US Market', value: categoryPillars.us_stock.current, color: '#38bdf8' },
      { key: 'etf_gold', label: 'ETFs & Gold', value: categoryPillars.etf_gold.current, color: '#f59e0b' },
    ]
    return pillars.map((p) => ({
      ...p,
      percentage: totalCurrentValue > 0 ? (p.value / totalCurrentValue) * 100 : 0,
    }))
  }, [analytics, categoryPillars, totalCurrentValue])

  // Sector breakdown data
  const sectorSegments = useMemo(() => {
    if (analytics?.sector_allocation?.length) {
      return analytics.sector_allocation.map((item) => ({
        key: item.key,
        label: item.label,
        value: toNumber(item.amount),
        percentage: toNumber(item.percentage),
      }))
    }
    const map = new Map<string, number>()
    openHoldings.forEach((h) => {
      const sec = h.sector || (isGoldHolding(h) ? 'Commodities (Gold)' : 'Uncategorized')
      map.set(sec, (map.get(sec) ?? 0) + toNumber(h.current_value))
    })
    return Array.from(map.entries())
      .map(([label, value]) => ({
        key: label,
        label,
        value,
        percentage: totalCurrentValue > 0 ? (value / totalCurrentValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
  }, [analytics, openHoldings, totalCurrentValue])

  // Top Gainers and Losers
  const topMovers = useMemo(() => {
    const sortedByReturn = [...openHoldings].sort((a, b) => toNumber(b.return_pct) - toNumber(a.return_pct))
    const gainers = sortedByReturn.slice(0, 3)
    const losers = [...openHoldings].sort((a, b) => toNumber(a.return_pct) - toNumber(b.return_pct)).slice(0, 3)
    return { gainers, losers }
  }, [openHoldings])

  // Filter chips with dynamic counts
  const filterChips = useMemo(() => {
    const counts = openHoldings.reduce<Record<string, number>>(
      (acc, h) => {
        const key = getInvestmentClass(h)
        acc.all += 1
        acc[key] = (acc[key] ?? 0) + 1
        return acc
      },
      { all: 0 },
    )
    return [
      { value: 'all', label: 'All Assets', count: counts.all ?? 0 },
      { value: 'indian_stock', label: 'Indian Stocks', count: counts.indian_stock ?? 0 },
      { value: 'mutual_fund', label: 'Mutual Funds', count: counts.mutual_fund ?? 0 },
      { value: 'us_stock', label: 'US Stocks', count: counts.us_stock ?? 0 },
      { value: 'etf', label: 'ETFs', count: counts.etf ?? 0 },
      { value: 'gold', label: 'Gold', count: counts.gold ?? 0 },
    ]
  }, [openHoldings])

  // Filtered Holdings
  const filteredHoldings = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return openHoldings.filter((h) => {
      const matchesSearch =
        !query ||
        h.symbol.toLowerCase().includes(query) ||
        h.company_name.toLowerCase().includes(query) ||
        (h.sector ?? '').toLowerCase().includes(query) ||
        (h.notes ?? '').toLowerCase().includes(query)

      const holdingClass = getInvestmentClass(h)
      const matchesAssetType =
        assetTypeFilter === 'all' ||
        holdingClass === assetTypeFilter ||
        (assetTypeFilter === 'etf_gold' && (holdingClass === 'etf' || holdingClass === 'gold'))

      const matchesCountry = countryFilter === 'all' || h.country === countryFilter

      const pnl = toNumber(h.pnl)
      const matchesProfit =
        profitFilter === 'all' || (profitFilter === 'profit' ? pnl >= 0 : pnl < 0)

      return matchesSearch && matchesAssetType && matchesCountry && matchesProfit
    })
  }, [assetTypeFilter, countryFilter, openHoldings, profitFilter, searchTerm])

  const sortedHoldings = useMemo(() => {
    return sortHoldings(filteredHoldings, sortOption, totalCurrentValue)
  }, [filteredHoldings, sortOption, totalCurrentValue])

  // Exited Positions (Bought & Sold)
  const exitedPositions = useMemo(() => {
    const ledgers = new Map<number, InvestmentTransaction[]>()
    for (const row of transactions) {
      const bucket = ledgers.get(row.investment_id)
      if (bucket) bucket.push(row)
      else ledgers.set(row.investment_id, [row])
    }

    return holdings
      .filter((h) => toNumber(h.quantity) === 0)
      .map((h) => {
        const rows = (ledgers.get(h.id) ?? []).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
        const buyRows = rows.filter((r) => r.transaction_type === 'BUY')
        const sellRows = rows.filter((r) => r.transaction_type === 'SELL')
        const invested = buyRows.reduce((sum, r) => sum + toNumber(r.total), 0)
        const proceeds = sellRows.reduce((sum, r) => sum + toNumber(r.total), 0)
        const profit = sellRows.reduce((sum, r) => sum + toNumber(r.realized_pnl), 0)
        const quantitySold = sellRows.reduce((sum, r) => sum + toNumber(r.quantity), 0)
        const returnPct = invested > 0 ? (profit / invested) * 100 : 0
        const isIpo = buyRows.some((r) => r.transaction_mode === 'IPO')

        return {
          holding: h,
          invested,
          proceeds,
          profit,
          returnPct,
          quantitySold,
          isIpo,
          boughtOn: buyRows[0]?.transaction_date ?? h.created_at.slice(0, 10),
          soldOn: sellRows[sellRows.length - 1]?.transaction_date ?? h.updated_at.slice(0, 10),
        }
      })
  }, [holdings, transactions])

  const exitedBookedTotal = useMemo(() => {
    return exitedPositions.reduce((sum, p) => sum + p.profit, 0)
  }, [exitedPositions])

  const selectedHolding = useMemo(() => {
    return holdings.find((h) => h.id === selectedHoldingId) ?? null
  }, [holdings, selectedHoldingId])

  const selectedTransactions = selectedHolding
    ? transactions.filter((row) => row.investment_id === selectedHolding.id)
    : []

  const latestUpdate = useMemo(() => {
    const timestamps = holdings
      .flatMap((h) => [h.updated_at, h.last_price_refreshed_at])
      .filter(Boolean) as string[]
    if (timestamps.length === 0) return null
    return (
      timestamps
        .map((v) => new Date(v))
        .filter((d) => !Number.isNaN(d.getTime()))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
    )
  }, [holdings])

  // Data Refresh Handlers
  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.holdings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.holdingsAnalytics }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.portfolioIntelligence }),
      queryClient.invalidateQueries({ queryKey: ['reports', 'investment-holdings'] }),
      queryClient.invalidateQueries({ queryKey: ['investmentTransactions'] }),
    ])
  }

  async function handleRefreshAllPrices() {
    setIsRefreshingAllPrices(true)
    setStatusMessage(null)
    try {
      const response = await apiFetch<BulkRefreshResponse>('/api/holdings/refresh-prices', { method: 'POST' })
      if (response.failed_count > 0) {
        setStatusTone('amber')
        setStatusMessage(`Updated ${response.updated_count} positions. ${response.failed_count} failed.`)
      } else {
        setStatusTone('emerald')
        setStatusMessage(`Refreshed prices for ${response.updated_count} positions.`)
      }
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setIsRefreshingAllPrices(false)
    }
  }

  async function handleRefreshHolding(holding: ApiHolding) {
    setRefreshingHoldingId(holding.id)
    setStatusMessage(null)
    try {
      await apiFetch(`/api/holdings/${holding.id}/refresh-price`, { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage(`Updated market price for ${holding.symbol}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setRefreshingHoldingId(null)
    }
  }

  async function handleSaveSnapshot() {
    setSavingSnapshot(true)
    setStatusMessage(null)
    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      setStatusTone('emerald')
      setStatusMessage("Today's portfolio valuation snapshot saved.")
      await queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] })
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary })
      await queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary })
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setSavingSnapshot(false)
    }
  }

  async function handleDeleteHolding(holding: ApiHolding) {
    if (!window.confirm(`Delete ${holding.symbol} (${holding.company_name})? This cannot be undone.`)) return
    try {
      await apiFetch(`/api/holdings/${holding.id}`, { method: 'DELETE' })
      setSelectedHoldingId(null)
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${holding.symbol}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  // Holding Modal Handlers
  function openCreateModal() {
    setEditingHoldingId(null)
    setHoldingForm(defaultHoldingForm)
    setFormErrors({})
    setFormErrorMessage(null)
    setIsHoldingModalOpen(true)
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
      tags: holding.tags ?? '',
      price_source: holding.price_source,
      status: holding.status,
    })
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

    ;[
      ['quantity', quantity],
      ['avg_buy_price', avgBuyPrice],
      ['current_price', currentPrice],
      ['fx_rate_to_inr', fxRateToInr],
    ].forEach(([field, value]) => {
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
      const payload: Record<string, unknown> = {
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
        tags: holdingForm.tags.trim() || null,
        price_source: holdingForm.price_source,
        status: holdingForm.status,
      }
      if (editingHoldingId !== null) {
        delete payload.quantity
        delete payload.avg_buy_price
        if (holdingForm.price_source !== 'manual') delete payload.current_price
      }

      const method = editingHoldingId === null ? 'POST' : 'PATCH'
      const url = editingHoldingId === null ? '/api/holdings' : `/api/holdings/${editingHoldingId}`

      await apiFetch(url, { method, body: JSON.stringify(payload) })
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

  // Transactions Modal Handlers
  function openTransactionModal(
    holding: ApiHolding,
    type: 'BUY' | 'SELL',
    transaction?: InvestmentTransaction,
  ) {
    setEditingTransactionId(transaction ? transaction.id : null)
    setTransactionError(null)
    setTransactionForm(
      transaction
        ? {
            transaction_type: transaction.transaction_type,
            transaction_mode: transaction.transaction_mode,
            quantity: String(transaction.quantity),
            price_per_unit: String(transaction.price_per_unit),
            fees: String(transaction.fees),
            taxes: String(transaction.taxes),
            exchange_rate: String(transaction.exchange_rate),
            transaction_date: transaction.transaction_date,
            notes: transaction.notes,
          }
        : {
            ...defaultTransactionForm,
            transaction_type: type,
            transaction_mode: holding.asset_type === 'mutual_fund' ? 'SIP' : 'One Time',
            price_per_unit: String(holding.current_price),
            exchange_rate: String(holding.effective_fx_rate_to_inr ?? 1),
          },
    )
    setTransactionModalOpen(true)
  }

  async function handleTransactionSubmit(event: FormEvent) {
    event.preventDefault()
    if (!selectedHolding) return
    setSavingTransaction(true)
    setTransactionError(null)
    try {
      if (editingTransactionId) {
        await updateInvestmentTransaction(editingTransactionId, transactionForm)
      } else {
        await createInvestmentTransaction(selectedHolding.id, transactionForm)
      }
      setTransactionModalOpen(false)
      await refreshData()
    } catch (error) {
      setTransactionError(formatApiError(error))
    } finally {
      setSavingTransaction(false)
    }
  }

  async function handleDeleteTransaction(row: InvestmentTransaction) {
    if (!window.confirm('Delete this transaction? Holding balance will be recalculated.')) return
    try {
      await deleteInvestmentTransaction(row.id)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1600px] space-y-6 lg:space-y-8">
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
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-3">
        {/* Left: Sync Pulse & Rate */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Live Feed</span>
          </div>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {latestUpdate ? `Synced ${formatCompactTimestamp(latestUpdate.toISOString())}` : 'Live prices active'}
          </span>
          {liveUsdInrRate > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
              USD/INR: ₹{privacyMode ? '•••' : liveUsdInrRate.toFixed(2)}
            </span>
          )}
        </div>

        {/* Center: Market Breadth Indicators */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-medium text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{portfolioBreadth.gainers}</span>
            <span className="text-slate-400">Gainers</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="text-rose-600 dark:text-rose-400 font-semibold">{portfolioBreadth.losers}</span>
            <span className="text-slate-400">Drawdown</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <Icon name="portfolio" className="h-3.5 w-3.5 text-purple-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{openHoldings.length}</span>
            <span className="text-slate-400">Positions</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleRefreshAllPrices}
            disabled={isRefreshingAllPrices}
            className={['inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all', secondaryButtonClass].join(' ')}
            title="Refresh market prices for auto-tracked holdings"
          >
            <Icon name="refresh" className={['h-3.5 w-3.5', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
            <span>{isRefreshingAllPrices ? 'Refreshing...' : 'Refresh Prices'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveSnapshot}
            disabled={savingSnapshot}
            className={['inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all', secondaryButtonClass].join(' ')}
            title="Record today's snapshot"
          >
            <Icon name="netWorth" className="h-3.5 w-3.5 text-teal-500" />
            <span className="hidden sm:inline">Save Snapshot</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className={['inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all', primaryButtonClass].join(' ')}
          >
            <Icon name="add" className="h-3.5 w-3.5" />
            <span>Add Investment</span>
          </button>
        </div>
      </div>

      {/* ── TOP NAVIGATION TABS (HOLDINGS / TRANSACTIONS) ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setPageTab('holdings')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all',
            pageTab === 'holdings'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ].join(' ')}
        >
          <Icon name="stocks" className="h-4 w-4" />
          <span>Holdings & Positions</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {openHoldings.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPageTab('transactions')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all',
            pageTab === 'transactions'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ].join(' ')}
        >
          <Icon name="analytics" className="h-4 w-4" />
          <span>All Transactions Ledger</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {transactions.length}
          </span>
        </button>
      </div>

      {/* ── TAB CONTENT: TRANSACTIONS LEDGER ── */}
      {pageTab === 'transactions' ? (
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search ticker, company or notes..."
              className="h-10 min-w-56 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-900 dark:border-slate-700 dark:text-white placeholder:text-slate-400 focus:border-teal-500 focus:outline-none"
            />
            <select
              value={assetTypeFilter}
              onChange={(event) => setAssetTypeFilter(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All Asset Classes</option>
              <option value="indian_stock">Indian Stocks</option>
              <option value="mutual_fund">Mutual Funds</option>
              <option value="etf">ETFs</option>
              <option value="gold">Gold</option>
              <option value="us_stock">US Stocks</option>
            </select>
            <input
              aria-label="From date"
              type="date"
              value={transactionFrom}
              onChange={(event) => setTransactionFrom(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
            />
            <input
              aria-label="To date"
              type="date"
              value={transactionTo}
              onChange={(event) => setTransactionTo(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-transparent px-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
            />
            <button
              type="button"
              onClick={() => {
                const header = 'Date,Investment,Type,Mode,Quantity,Price,Fees,Taxes,Amount,Realized P&L,Notes'
                const rows = transactions.map((row) =>
                  [
                    row.transaction_date,
                    row.investment_name,
                    row.transaction_type,
                    row.transaction_mode,
                    row.quantity,
                    row.price_per_unit,
                    row.fees,
                    row.taxes,
                    row.total,
                    row.realized_pnl,
                    JSON.stringify(row.notes ?? ''),
                  ].join(','),
                )
                const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
                const link = document.createElement('a')
                link.href = URL.createObjectURL(blob)
                link.download = 'wealthpilot-investment-transactions.csv'
                link.click()
                URL.revokeObjectURL(link.href)
              }}
              className={['h-10 px-4 text-xs font-semibold', secondaryButtonClass].join(' ')}
            >
              Export CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/50">
                <tr>
                  {['Date', 'Investment', 'Type', 'Mode', 'Qty', 'Price/Unit', 'Fees & Taxes', 'Total Amount', 'Realized P&L', 'Notes'].map((label) => (
                    <th key={label} className="px-4 py-3 font-semibold text-slate-500 dark:text-slate-400">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions
                  .filter((row) => {
                    const holding = holdings.find((item) => item.id === row.investment_id)
                    const matchesType = assetTypeFilter === 'all' || (holding && getInvestmentClass(holding) === assetTypeFilter)
                    const matchesSearch =
                      !searchTerm ||
                      `${row.investment_name} ${row.investment_symbol} ${row.notes ?? ''}`
                        .toLowerCase()
                        .includes(searchTerm.toLowerCase())
                    return (
                      matchesType &&
                      matchesSearch &&
                      (!transactionFrom || row.transaction_date >= transactionFrom) &&
                      (!transactionTo || row.transaction_date <= transactionTo)
                    )
                  })
                  .map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">{row.transaction_date}</td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{row.investment_symbol}</div>
                        <div className="text-[11px] text-slate-400">{row.investment_name}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={[
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                            row.transaction_type === 'BUY'
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                          ].join(' ')}
                        >
                          {row.transaction_type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">{row.transaction_mode}</td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                        {privacyMode ? '•••' : row.quantity}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(row.price_per_unit))} mask="••••" hideColor />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        ₹{(toNumber(row.fees) + toNumber(row.taxes)).toFixed(1)}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(row.total))} mask="••••" hideColor />
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold tabular-nums">
                        {row.transaction_type === 'SELL' ? (
                          <span className={privacyMode ? 'text-slate-400' : getTrendClass(toNumber(row.realized_pnl))}>
                            <PrivateValue
                              value={`${toNumber(row.realized_pnl) >= 0 ? '+' : ''}${formatINR(toNumber(row.realized_pnl))}`}
                              mask="••••"
                              hideColor
                            />
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="max-w-44 truncate px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                        {row.notes || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── TAB CONTENT: HOLDINGS & PORTFOLIO COMMAND ── */}
      {pageTab === 'holdings' ? (
        <>
          {/* ── ROW 1: HERO VALUATION DECK & 4 ASSET PILLARS ── */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            {/* Main Portfolio Balance Hero */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div>
                  <div className={LABEL}>Total Portfolio Valuation</div>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-bold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl">
                      {holdingsLoading ? '—' : <PrivateValue value={formatMoney(totalCurrentValue)} mask="••••••" hideColor />}
                    </span>
                    <span
                      className={[
                        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
                        privacyMode
                          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          : totalPnlClass(totalUnrealizedPnl),
                      ].join(' ')}
                    >
                      {privacyMode ? '•••' : `${totalUnrealizedPnl >= 0 ? '↑ +' : '↓ '}${formatSignedPct(totalReturnPct)}`}
                    </span>
                  </div>
                </div>

                {/* Capital Metrics Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                    <span className="text-slate-400">Total Invested: </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(totalInvestedCapital)} mask="••••" hideColor />
                    </span>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs dark:border-teal-500/20 dark:bg-teal-500/10">
                    <span className="text-teal-600 dark:text-teal-400">Realized Profit: </span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                      <PrivateValue
                        value={`${realizedProfitTotal >= 0 ? '+' : ''}${formatMoney(realizedProfitTotal)}`}
                        mask="••••"
                        hideColor
                      />
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Metric Summary Banner */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className={LABEL}>Unrealized P&L</div>
                  <div className={['mt-2 font-mono text-base font-semibold tabular-nums sm:text-lg', privacyMode ? 'text-slate-400' : getTrendClass(totalUnrealizedPnl)].join(' ')}>
                    <PrivateValue
                      value={`${totalUnrealizedPnl >= 0 ? '+' : ''}${formatMoney(totalUnrealizedPnl)}`}
                      mask="••••"
                      hideColor
                    />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Current open positions</div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className={LABEL}>Booked Realized P&L</div>
                  <div className={['mt-2 font-mono text-base font-semibold tabular-nums sm:text-lg', privacyMode ? 'text-slate-400' : getTrendClass(realizedProfitTotal)].join(' ')}>
                    <PrivateValue
                      value={`${realizedProfitTotal >= 0 ? '+' : ''}${formatMoney(realizedProfitTotal)}`}
                      mask="••••"
                      hideColor
                    />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">From sells & IPOs</div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-800/60 dark:bg-slate-800/40">
                  <div className={LABEL}>Net Lifetime Profit</div>
                  <div className={['mt-2 font-mono text-base font-semibold tabular-nums sm:text-lg', privacyMode ? 'text-slate-400' : getTrendClass(totalLifetimePnl)].join(' ')}>
                    <PrivateValue
                      value={`${totalLifetimePnl >= 0 ? '+' : ''}${formatMoney(totalLifetimePnl)}`}
                      mask="••••"
                      hideColor
                    />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Realized + Unrealized</div>
                </div>
              </div>

              {/* Multi-segment Allocation Bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>Portfolio Asset Mix</span>
                  <span className="text-[11px] text-slate-400">Click any pillar below to filter positions</span>
                </div>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 shadow-inner">
                  {allocationSegments.map((segment) => (
                    <div
                      key={segment.key}
                      style={{ width: `${Math.max(segment.percentage, 0)}%`, backgroundColor: segment.color }}
                      className="h-full transition-all"
                      title={`${segment.label}: ${formatMoney(segment.value)} (${segment.percentage.toFixed(1)}%)`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* 4 Interactive Category Pillars (Click to filter table!) */}
            <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
              {/* 1. Indian Direct Stocks */}
              <div
                onClick={() => setAssetTypeFilter(assetTypeFilter === 'indian_stock' ? 'all' : 'indian_stock')}
                className={[
                  'group flex flex-col justify-between rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md',
                  assetTypeFilter === 'indian_stock'
                    ? 'border-teal-500 bg-teal-500/10 ring-2 ring-teal-500/20'
                    : 'border-slate-200 bg-white hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-teal-500/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-teal-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Indian Stocks</span>
                  </div>
                  <span className="rounded-md bg-teal-50 dark:bg-teal-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                    {categoryPillars.indian_stock.count} stocks
                  </span>
                </div>
                <div className="mt-3 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                  <PrivateValue value={formatMoney(categoryPillars.indian_stock.current)} mask="••••" hideColor />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {totalCurrentValue > 0 ? `${((categoryPillars.indian_stock.current / totalCurrentValue) * 100).toFixed(1)}%` : '0%'}
                  </span>
                  <span className={['font-mono font-medium', getTrendClass(categoryPillars.indian_stock.pnl)].join(' ')}>
                    {privacyMode ? '•••' : `${categoryPillars.indian_stock.pnl >= 0 ? '+' : ''}${formatMoney(categoryPillars.indian_stock.pnl)}`}
                  </span>
                </div>
              </div>

              {/* 2. Mutual Funds */}
              <div
                onClick={() => setAssetTypeFilter(assetTypeFilter === 'mutual_fund' ? 'all' : 'mutual_fund')}
                className={[
                  'group flex flex-col justify-between rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md',
                  assetTypeFilter === 'mutual_fund'
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/20'
                    : 'border-slate-200 bg-white hover:border-purple-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-purple-500/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Mutual Funds</span>
                  </div>
                  <span className="rounded-md bg-purple-50 dark:bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    {categoryPillars.mutual_fund.count} funds
                  </span>
                </div>
                <div className="mt-3 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                  <PrivateValue value={formatMoney(categoryPillars.mutual_fund.current)} mask="••••" hideColor />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {totalCurrentValue > 0 ? `${((categoryPillars.mutual_fund.current / totalCurrentValue) * 100).toFixed(1)}%` : '0%'}
                  </span>
                  <span className={['font-mono font-medium', getTrendClass(categoryPillars.mutual_fund.pnl)].join(' ')}>
                    {privacyMode ? '•••' : `${categoryPillars.mutual_fund.pnl >= 0 ? '+' : ''}${formatMoney(categoryPillars.mutual_fund.pnl)}`}
                  </span>
                </div>
              </div>

              {/* 3. US Market */}
              <div
                onClick={() => setAssetTypeFilter(assetTypeFilter === 'us_stock' ? 'all' : 'us_stock')}
                className={[
                  'group flex flex-col justify-between rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md',
                  assetTypeFilter === 'us_stock'
                    ? 'border-sky-500 bg-sky-500/10 ring-2 ring-sky-500/20'
                    : 'border-slate-200 bg-white hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-sky-500/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">US Market</span>
                  </div>
                  <span className="rounded-md bg-sky-50 dark:bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                    {categoryPillars.us_stock.count} assets
                  </span>
                </div>
                <div className="mt-3 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                  <PrivateValue value={formatMoney(categoryPillars.us_stock.current)} mask="••••" hideColor />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {totalCurrentValue > 0 ? `${((categoryPillars.us_stock.current / totalCurrentValue) * 100).toFixed(1)}%` : '0%'}
                  </span>
                  <span className="font-mono text-[11px] text-sky-600 dark:text-sky-400">
                    ${categoryPillars.us_stock.nativeUsd.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* 4. ETFs & Gold */}
              <div
                onClick={() => setAssetTypeFilter(assetTypeFilter === 'etf_gold' ? 'all' : 'etf_gold')}
                className={[
                  'group flex flex-col justify-between rounded-2xl border p-4 shadow-sm cursor-pointer transition-all hover:shadow-md',
                  assetTypeFilter === 'etf_gold'
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white hover:border-amber-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-amber-500/40',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">ETFs & Gold</span>
                  </div>
                  <span className="rounded-md bg-amber-50 dark:bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    {categoryPillars.etf_gold.count} assets
                  </span>
                </div>
                <div className="mt-3 font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                  <PrivateValue value={formatMoney(categoryPillars.etf_gold.current)} mask="••••" hideColor />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    {totalCurrentValue > 0 ? `${((categoryPillars.etf_gold.current / totalCurrentValue) * 100).toFixed(1)}%` : '0%'}
                  </span>
                  <span className={['font-mono font-medium', getTrendClass(categoryPillars.etf_gold.pnl)].join(' ')}>
                    {privacyMode ? '•••' : `${categoryPillars.etf_gold.pnl >= 0 ? '+' : ''}${formatMoney(categoryPillars.etf_gold.pnl)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 2: PERFORMANCE CHART & INTELLIGENCE EXPLORER ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {/* Left: Performance Chart */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
              {portfolioError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                  {portfolioError}
                </div>
              ) : (
                <PortfolioPerformanceChart
                  data={portfolioPerformance}
                  range={activeRange}
                  onRangeChange={setActiveRange}
                  privacyMode={privacyMode}
                  loading={portfolioLoading}
                  onSaveSnapshot={handleSaveSnapshot}
                  savingSnapshot={savingSnapshot}
                  title="Portfolio Trend & Projections"
                  description="Broker snapshot trajectory with 60-day projected growth estimate"
                  variant="compact"
                />
              )}
            </div>

            {/* Right: Diversification & Intelligence Hub */}
            <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Icon name="portfolio" className="h-4 w-4 text-teal-500" />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">Portfolio Intelligence</span>
                  </div>
                  {/* Explorer Tabs */}
                  <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setExplorerTab('allocation')}
                      className={[
                        'rounded-lg px-2.5 py-1 font-semibold transition-all',
                        explorerTab === 'allocation'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                      ].join(' ')}
                    >
                      Asset Mix
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplorerTab('sectors')}
                      className={[
                        'rounded-lg px-2.5 py-1 font-semibold transition-all',
                        explorerTab === 'sectors'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                      ].join(' ')}
                    >
                      Sectors
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplorerTab('movers')}
                      className={[
                        'rounded-lg px-2.5 py-1 font-semibold transition-all',
                        explorerTab === 'movers'
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                      ].join(' ')}
                    >
                      Top Movers
                    </button>
                  </div>
                </div>

                {/* Tab 1: Asset Mix */}
                {explorerTab === 'allocation' && (
                  <div className="mt-4 space-y-3.5">
                    {allocationSegments.map((segment) => (
                      <div key={segment.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{segment.label}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                            <span className="font-bold">{privacyMode ? '•••' : `${segment.percentage.toFixed(1)}%`}</span>
                            <span className="text-slate-400 font-normal">
                              (<PrivateValue value={formatINRShort(segment.value)} mask="••••" hideColor />)
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            style={{ width: `${Math.min(segment.percentage, 100)}%`, backgroundColor: segment.color }}
                            className="h-full rounded-full transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 2: Sector Breakdown */}
                {explorerTab === 'sectors' && (
                  <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-1">
                    {sectorSegments.map((sector) => (
                      <div key={sector.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-semibold text-slate-800 dark:text-slate-200">{sector.label}</span>
                          <div className="flex items-center gap-2 font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                            <span className="font-bold">{privacyMode ? '•••' : `${sector.percentage.toFixed(1)}%`}</span>
                            <span className="text-slate-400 font-normal">
                              <PrivateValue value={formatINRShort(sector.value)} mask="••••" hideColor />
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            style={{ width: `${Math.min(sector.percentage, 100)}%` }}
                            className="h-full rounded-full bg-teal-500 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab 3: Top Movers */}
                {explorerTab === 'movers' && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* Gainers */}
                    <div className="space-y-2 rounded-2xl bg-emerald-500/5 p-3 dark:bg-emerald-500/10">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        <Icon name="up" className="h-3.5 w-3.5" />
                        <span>Top Gainers</span>
                      </div>
                      <div className="space-y-2 mt-2">
                        {topMovers.gainers.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedHoldingId(item.id)}
                            className="group flex items-center justify-between rounded-xl bg-white p-2 text-xs shadow-xs cursor-pointer hover:bg-emerald-50 transition-all dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{item.symbol}</div>
                              <div className="text-[10px] text-slate-400 truncate">{item.company_name}</div>
                            </div>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {privacyMode ? '•••' : `+${formatPct(Math.max(toNumber(item.return_pct), 0))}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Losers */}
                    <div className="space-y-2 rounded-2xl bg-rose-500/5 p-3 dark:bg-rose-500/10">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        <Icon name="warning" className="h-3.5 w-3.5" />
                        <span>Top Drags</span>
                      </div>
                      <div className="space-y-2 mt-2">
                        {topMovers.losers.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedHoldingId(item.id)}
                            className="group flex items-center justify-between rounded-xl bg-white p-2 text-xs shadow-xs cursor-pointer hover:bg-rose-50 transition-all dark:bg-slate-900 dark:hover:bg-slate-800"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">{item.symbol}</div>
                              <div className="text-[10px] text-slate-400 truncate">{item.company_name}</div>
                            </div>
                            <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                              {privacyMode ? '•••' : `${formatSignedPct(toNumber(item.return_pct))}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Insight Pill */}
              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 flex items-center justify-between">
                <span>Holdings spread across {sectorSegments.length} market sectors</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {((categoryPillars.indian_stock.current / (totalCurrentValue || 1)) * 100).toFixed(0)}% Domestic Equity
                </span>
              </div>
            </div>
          </div>

          {/* ── ROW 3: BROKER-GRADE HOLDINGS TABLE & COMMAND DECK ── */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90 overflow-hidden">
            {/* Table Header & Controls Toolbar */}
            <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <div className={LABEL}>Portfolio Positions</div>
                    <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                      Broker-Style Active Holdings ({filteredHoldings.length})
                    </div>
                  </div>

                  {/* Right Controls: Search, Sort, View Toggle */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Search Input */}
                    <div className="relative min-w-44 flex-1 sm:w-64 sm:flex-initial">
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Search symbol, company, sector..."
                        className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Sort Dropdown */}
                    <select
                      value={sortOption}
                      onChange={(event) => setSortOption(event.target.value as HoldingSortOption)}
                      className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <option value="value_desc">Valuation: High to Low</option>
                      <option value="pnl_desc">P&L: Top Profits First</option>
                      <option value="return_desc">Return %: Highest Gainers</option>
                      <option value="return_asc">Return %: Biggest Drawdown</option>
                      <option value="weight_desc">Portfolio Weight</option>
                      <option value="name_asc">Alphabetical (A-Z)</option>
                    </select>

                    {/* Profit / Loss Quick Filter */}
                    <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setProfitFilter('all')}
                        className={[
                          'rounded-lg px-2 py-1 font-semibold transition-all',
                          profitFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white',
                        ].join(' ')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfitFilter('profit')}
                        className={[
                          'rounded-lg px-2 py-1 font-semibold transition-all',
                          profitFilter === 'profit'
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-400',
                        ].join(' ')}
                      >
                        Profit
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfitFilter('loss')}
                        className={[
                          'rounded-lg px-2 py-1 font-semibold transition-all',
                          profitFilter === 'loss'
                            ? 'bg-rose-500 text-white shadow-xs'
                            : 'text-rose-600 hover:text-rose-700 dark:text-rose-400',
                        ].join(' ')}
                      >
                        Loss
                      </button>
                    </div>

                    {/* View Switcher (Table / Card) */}
                    <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-xs dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={[
                          'rounded-lg p-1.5 transition-all',
                          viewMode === 'table'
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-white',
                        ].join(' ')}
                        title="Table Spreadsheet View"
                      >
                        <Icon name="portfolio" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={[
                          'rounded-lg p-1.5 transition-all',
                          viewMode === 'cards'
                            ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-white',
                        ].join(' ')}
                        title="Card Grid View"
                      >
                        <Icon name="cards" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Asset Class Filter Pills */}
                <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                  {filterChips.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setAssetTypeFilter(filter.value)}
                      className={[
                        'h-8 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-all active:scale-95',
                        assetTypeFilter === filter.value
                          ? 'bg-teal-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                      ].join(' ')}
                    >
                      {filter.label} <span className="opacity-75">({filter.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Holdings Data Presentation */}
            {holdingsLoading ? (
              <div className="p-12 text-center">
                <Icon name="refresh" className="mx-auto h-8 w-8 animate-spin text-teal-500" />
                <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">Loading holdings...</div>
              </div>
            ) : filteredHoldings.length === 0 ? (
              <div className="p-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <Icon name="empty" className="h-6 w-6" />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">No positions match your filter</div>
                <div className="mt-1 text-xs text-slate-400">Try adjusting your search terms or asset category.</div>
              </div>
            ) : viewMode === 'table' ? (
              /* ── TABLE VIEW ── */
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                    <tr>
                      <th className="sticky left-0 z-10 bg-slate-50/95 px-4 py-3 dark:bg-slate-800/95">
                        <span className={LABEL}>Symbol / Asset</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Weight</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Units & Avg Buy</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Invested</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>LTP / NAV</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Current Value</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Unrealized P&L</span>
                      </th>
                      <th className="px-3 py-3 text-right">
                        <span className={LABEL}>Return %</span>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <span className={LABEL}>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedHoldings.map((row) => {
                      const invested = toNumber(row.invested_amount)
                      const currentValue = toNumber(row.current_value)
                      const pnl = toNumber(row.pnl)
                      const pct = toNumber(row.return_pct)
                      const nativeInvested = toNumber(row.native_invested_amount)
                      const nativeCurrent = toNumber(row.native_current_value)
                      const nativePnl = toNumber(row.native_pnl ?? nativeCurrent - nativeInvested)
                      const sourceMeta = getSourceBadgeMeta(row)
                      const holdingClass = getInvestmentClass(row)
                      const weightPct = totalCurrentValue > 0 ? (currentValue / totalCurrentValue) * 100 : 0

                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedHoldingId(row.id)}
                          className="group cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          {/* Symbol & Company */}
                          <td className="sticky left-0 z-10 bg-white px-4 py-3.5 dark:bg-slate-900 group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/40">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={[
                                  'h-8 w-1 shrink-0 rounded-full',
                                  pnl >= 0 ? 'bg-emerald-500' : 'bg-rose-500',
                                ].join(' ')}
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                                    {row.symbol}
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {row.country === 'US' ? 'US' : 'IN'}
                                  </span>
                                  <span className={getInvestmentClassBadgeClass(holdingClass)}>
                                    {getInvestmentClassLabel(row)}
                                  </span>
                                  <span className={sourceMeta.className} title={sourceMeta.title}>
                                    <Icon name={sourceMeta.icon} className="h-3 w-3" />
                                    {sourceMeta.label}
                                  </span>
                                </div>
                                <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                                  {row.company_name} {row.sector ? `· ${row.sector}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Portfolio Weight */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                            <div className="font-semibold">{privacyMode ? '•••' : `${weightPct.toFixed(1)}%`}</div>
                            <div className="mt-1 h-1 w-12 ml-auto overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                style={{ width: `${Math.min(weightPct * 2, 100)}%` }}
                                className="h-full rounded-full bg-teal-500"
                              />
                            </div>
                          </td>

                          {/* Units & Avg Buy Price */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {privacyMode ? '••••' : toNumber(row.quantity)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              <PrivateValue value={formatNativeMoney(toNumber(row.avg_buy_price), row.currency)} mask="••••" hideColor />
                            </div>
                          </td>

                          {/* Capital Invested */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums text-slate-900 dark:text-white">
                            <PrivateValue value={formatINR(invested)} mask="••••" hideColor />
                          </td>

                          {/* LTP / NAV */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums">
                            <div className="font-bold text-slate-900 dark:text-white">
                              <PrivateValue value={formatNativeMoney(toNumber(row.current_price), row.currency)} mask="••••" hideColor />
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {privacyMode ? '••••' : formatCompactTimestamp(row.last_price_refreshed_at ?? row.updated_at)}
                            </div>
                          </td>

                          {/* Current Value (INR + Native) */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums">
                            {renderNativeAndInr(nativeCurrent, currentValue, row.currency)}
                          </td>

                          {/* Unrealized P&L */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs font-bold tabular-nums">
                            <span className={privacyMode ? 'text-slate-400' : getTrendClass(pnl)}>
                              <PrivateValue
                                value={`${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`}
                                mask="••••"
                                hideColor
                              />
                            </span>
                            {row.currency === 'USD' && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                <PrivateValue value={`${nativePnl >= 0 ? '+' : ''}$${nativePnl.toFixed(2)}`} mask="••••" hideColor />
                              </div>
                            )}
                          </td>

                          {/* Return % */}
                          <td className="px-3 py-3.5 text-right font-mono text-xs tabular-nums">
                            <span
                              className={[
                                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
                                privacyMode
                                  ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                  : pnl >= 0
                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                                    : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                              ].join(' ')}
                            >
                              {privacyMode ? '•••' : `${pnl >= 0 ? '↑' : '↓'} ${formatPct(Math.abs(pct))}`}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-teal-50 group-hover:text-teal-600 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-teal-500/20 dark:group-hover:text-teal-400 transition-colors">
                              <Icon name="chevronDown" className="h-4 w-4 -rotate-90" />
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* ── CARDS VIEW ── */
              <div className="p-4 sm:p-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedHoldings.map((row) => {
                  const currentValue = toNumber(row.current_value)
                  const pnl = toNumber(row.pnl)
                  const pct = toNumber(row.return_pct)
                  const holdingClass = getInvestmentClass(row)
                  const weightPct = totalCurrentValue > 0 ? (currentValue / totalCurrentValue) * 100 : 0

                  return (
                    <div
                      key={`card-${row.id}`}
                      onClick={() => setSelectedHoldingId(row.id)}
                      className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-teal-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-teal-500/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                              {row.symbol}
                            </span>
                            <span className={getInvestmentClassBadgeClass(holdingClass)}>
                              {getInvestmentClassLabel(row)}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                            {row.company_name}
                          </div>
                        </div>
                        <span
                          className={[
                            'font-mono text-xs font-bold rounded-lg px-2 py-0.5',
                            pnl >= 0
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                          ].join(' ')}
                        >
                          {privacyMode ? '•••' : `${pnl >= 0 ? '+' : ''}${formatSignedPct(pct)}`}
                        </span>
                      </div>

                      <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400">Current Value</div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white">
                            <PrivateValue value={formatINR(currentValue)} mask="••••" hideColor />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-slate-400">P&L</div>
                          <div className={['font-mono font-bold', getTrendClass(pnl)].join(' ')}>
                            <PrivateValue
                              value={`${pnl >= 0 ? '+' : ''}${formatINR(pnl)}`}
                              mask="••••"
                              hideColor
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{toNumber(row.quantity)} units @ {formatNativeMoney(toNumber(row.avg_buy_price), row.currency)}</span>
                        <span>{weightPct.toFixed(1)}% of portfolio</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── ROW 4: CLOSED POSITIONS & REALIZED GAINS ("BOUGHT & SOLD") ── */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <div className={LABEL}>Closed Trades & Realized Profits</div>
                <div className="mt-0.5 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                  Bought & Sold ({exitedPositions.length} positions)
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Total Booked Profit</div>
                <div className={['font-mono text-lg font-bold sm:text-xl', privacyMode ? 'text-slate-400' : getTrendClass(exitedBookedTotal)].join(' ')}>
                  <PrivateValue
                    value={`${exitedBookedTotal >= 0 ? '+' : ''}${formatINR(exitedBookedTotal)}`}
                    mask="••••"
                    hideColor
                  />
                </div>
              </div>
            </div>

            {exitedPositions.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                No closed positions yet. Exited investments will automatically appear here with booked gains.
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {exitedPositions.map((entry) => (
                  <div
                    key={entry.holding.id}
                    onClick={() => setSelectedHoldingId(entry.holding.id)}
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/50 p-4 shadow-xs transition-all hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                            {entry.holding.symbol}
                          </span>
                          {entry.isIpo && (
                            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-400 uppercase">
                              IPO
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                          {entry.holding.company_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={['font-mono text-sm font-bold', getTrendClass(entry.profit)].join(' ')}>
                          <PrivateValue
                            value={`${entry.profit >= 0 ? '+' : ''}${formatINR(entry.profit)}`}
                            mask="••••"
                            hideColor
                          />
                        </div>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          +{entry.returnPct.toFixed(1)}% booked
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2.5 text-xs text-slate-500 dark:border-slate-800">
                      <span>Invested: <PrivateValue value={formatINR(entry.invested)} mask="••••" hideColor /></span>
                      <span className="text-right">Proceeds: <PrivateValue value={formatINR(entry.proceeds)} mask="••••" hideColor /></span>
                      <span>Qty: {entry.quantitySold}</span>
                      <span className="text-right text-[11px] text-slate-400">{entry.boughtOn} → {entry.soldOn}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* ── MODAL: HOLDING DETAIL DRAWER / DIALOG (DESKTOP & MOBILE) ── */}
      <BottomSheet
        open={selectedHolding !== null}
        onClose={() => setSelectedHoldingId(null)}
        title={selectedHolding ? `${selectedHolding.symbol} · ${selectedHolding.company_name}` : 'Investment Details'}
        subtitle={selectedHolding ? getInvestmentClassLabel(selectedHolding) : ''}
      >
        {selectedHolding ? (
          <div className="space-y-5">
            {/* Header Tabs inside Drawer: Overview / Transactions */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDrawerTab('overview')}
                className={[
                  'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all',
                  drawerTab === 'overview'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab('transactions')}
                className={[
                  'px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all',
                  drawerTab === 'transactions'
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                Transactions ({selectedTransactions.length})
              </button>
              {drawerTab === 'transactions' && (
                <button
                  type="button"
                  onClick={() => openTransactionModal(selectedHolding, 'BUY')}
                  className="ml-auto text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  + Add Transaction
                </button>
              )}
            </div>

            {/* Drawer Tab 1: Overview */}
            {drawerTab === 'overview' && (
              <div className="space-y-4">
                {/* KPI Ribbon */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <div className={LABEL}>Current Valuation</div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {renderNativeAndInr(toNumber(selectedHolding.native_current_value), toNumber(selectedHolding.current_value), selectedHolding.currency)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <div className={LABEL}>Unrealized P&L</div>
                    <div className={['mt-1 font-mono text-sm font-bold', getTrendClass(toNumber(selectedHolding.pnl))].join(' ')}>
                      {renderNativeAndInr(toNumber(selectedHolding.native_pnl), toNumber(selectedHolding.pnl), selectedHolding.currency)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <div className={LABEL}>Total Return</div>
                    <div className={['mt-1 font-mono text-sm font-bold', getTrendClass(toNumber(selectedHolding.return_pct))].join(' ')}>
                      <PrivateValue value={formatSignedPct(toNumber(selectedHolding.return_pct))} mask="••••" hideColor />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                    <div className={LABEL}>Holding Units</div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {privacyMode ? '••••' : toNumber(selectedHolding.quantity)}
                    </div>
                  </div>
                </div>

                {/* Pricing & Market Details Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">Average Buy Price</div>
                    <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatNativeMoney(toNumber(selectedHolding.avg_buy_price), selectedHolding.currency)} mask="••••" hideColor />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">Current Price (LTP)</div>
                    <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatNativeMoney(toNumber(selectedHolding.current_price), selectedHolding.currency)} mask="••••" hideColor />
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">Invested Capital</div>
                    <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                      {renderNativeAndInr(toNumber(selectedHolding.native_invested_amount), toNumber(selectedHolding.invested_amount), selectedHolding.currency)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">Exchange & Symbol</div>
                    <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                      {getHoldingMarketSymbol(selectedHolding)}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">Price Source & Feed</div>
                    <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                      {selectedHolding.price_source === 'yfinance' ? 'Auto-Refreshed' : 'Manual Entry'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/60">
                    <div className="text-slate-400">FX Rate to INR</div>
                    <div className="mt-1 font-mono font-bold text-slate-900 dark:text-white">
                      {selectedHolding.country === 'US' ? `₹${toNumber(selectedHolding.effective_fx_rate_to_inr).toFixed(2)}` : '1.00'}
                    </div>
                  </div>
                </div>

                {selectedHolding.notes && (
                  <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                    <span className="font-semibold text-slate-400 block mb-0.5">Notes:</span>
                    {selectedHolding.notes}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  {getRefreshSupported(selectedHolding) && (
                    <button
                      type="button"
                      onClick={() => void handleRefreshHolding(selectedHolding)}
                      disabled={refreshingHoldingId === selectedHolding.id || isRefreshingAllPrices}
                      className={['inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl', secondaryButtonClass].join(' ')}
                    >
                      <Icon name="refresh" className={['h-3.5 w-3.5', refreshingHoldingId === selectedHolding.id ? 'animate-spin' : ''].join(' ')} />
                      <span>{refreshingHoldingId === selectedHolding.id ? 'Refreshing…' : 'Refresh Price'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openTransactionModal(selectedHolding, 'BUY')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-500"
                  >
                    Buy Units
                  </button>

                  <button
                    type="button"
                    onClick={() => openTransactionModal(selectedHolding, 'SELL')}
                    disabled={toNumber(selectedHolding.quantity) <= 0}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-500 disabled:opacity-40"
                  >
                    Sell Units
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHoldingId(null)
                      openEditModal(selectedHolding)
                    }}
                    className={['inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl', secondaryButtonClass].join(' ')}
                  >
                    <Icon name="edit" className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleDeleteHolding(selectedHolding)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 dark:text-rose-400"
                  >
                    <Icon name="remove" className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}

            {/* Drawer Tab 2: Transactions */}
            {drawerTab === 'transactions' && (
              <div className="space-y-3">
                {selectedTransactions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    No transactions recorded for {selectedHolding.symbol} yet.
                  </div>
                ) : (
                  selectedTransactions.map((row) => (
                    <div
                      key={row.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={[
                            'font-bold uppercase tracking-wider',
                            row.transaction_type === 'BUY' ? 'text-emerald-500' : 'text-rose-500',
                          ].join(' ')}
                        >
                          {row.transaction_type} · {row.transaction_mode}
                        </span>
                        <span className="text-slate-400">{row.transaction_date}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                        <span>Units: {row.quantity}</span>
                        <span>Price: {formatNativeMoney(toNumber(row.price_per_unit), selectedHolding.currency)}</span>
                        <span>Fees & Taxes: ₹{(toNumber(row.fees) + toNumber(row.taxes)).toFixed(1)}</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Total: {formatINR(toNumber(row.total))}
                        </span>
                      </div>
                      {row.transaction_type === 'SELL' && (
                        <div className="mt-2 text-xs font-bold">
                          <span className="text-slate-400">Booked P&L: </span>
                          <span className={getTrendClass(toNumber(row.realized_pnl))}>
                            {toNumber(row.realized_pnl) >= 0 ? '+' : ''}{formatINR(toNumber(row.realized_pnl))}
                          </span>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-200/40 pt-2 dark:border-slate-700/40">
                        <button
                          type="button"
                          onClick={() => openTransactionModal(selectedHolding, row.transaction_type, row)}
                          className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTransaction(row)}
                          className="text-xs font-semibold text-rose-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}
      </BottomSheet>

      {/* ── MODAL: ADD / EDIT TRANSACTION ── */}
      {transactionModalOpen && selectedHolding ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={() => setTransactionModalOpen(false)}
        >
          <form
            onSubmit={handleTransactionSubmit}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingTransactionId ? 'Edit Transaction' : 'Record Transaction'}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedHolding.symbol} ({selectedHolding.company_name})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransactionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            {transactionError && (
              <div className="mt-3 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                {transactionError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3.5">
              <FormField label="Type">
                <select
                  value={transactionForm.transaction_type}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      transaction_type: event.target.value as 'BUY' | 'SELL',
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </FormField>

              <FormField label="Mode">
                <select
                  value={transactionForm.transaction_mode}
                  onChange={(event) =>
                    setTransactionForm((current) => ({
                      ...current,
                      transaction_mode: event.target.value as 'One Time' | 'SIP' | 'IPO',
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="One Time">One Time</option>
                  <option value="SIP">SIP</option>
                  <option value="IPO">IPO</option>
                </select>
              </FormField>

              <FormField label="Quantity / Units">
                <input
                  required
                  type="number"
                  min="0.0001"
                  step="any"
                  value={transactionForm.quantity}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, quantity: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <FormField label={`Price per Unit (${selectedHolding.currency})`}>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={transactionForm.price_per_unit}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, price_per_unit: event.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <FormField label="Fees (₹)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transactionForm.fees}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, fees: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <FormField label="Taxes (₹)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={transactionForm.taxes}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, taxes: event.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              {selectedHolding.country === 'US' && (
                <FormField label="FX Rate to INR">
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    value={transactionForm.exchange_rate}
                    onChange={(event) =>
                      setTransactionForm((current) => ({ ...current, exchange_rate: event.target.value }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </FormField>
              )}

              <FormField label="Date">
                <input
                  required
                  type="date"
                  value={transactionForm.transaction_date}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, transaction_date: event.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>
            </div>

            <div className="mt-3">
              <FormField label="Notes">
                <textarea
                  rows={2}
                  value={transactionForm.notes ?? ''}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, notes: event.target.value || null }))
                  }
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                />
              </FormField>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setTransactionModalOpen(false)}
                className={secondaryButtonClass}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingTransaction}
                className={primaryButtonClass}
              >
                {savingTransaction ? 'Saving...' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* ── MODAL: CREATE / EDIT INVESTMENT POSITION ── */}
      {isHoldingDrawerMounted && (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200',
            isHoldingDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsHoldingModalOpen(false)}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-140 flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
              isHoldingDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  {editingHoldingId === null ? 'Add Investment Position' : 'Edit Investment Position'}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Track stocks, ETFs, mutual funds, and gold
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldingModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {formErrorMessage && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {formErrorMessage}
                  </div>
                )}

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
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {assetTypeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Country" error={formErrors.country}>
                    <select
                      value={holdingForm.country}
                      onChange={(event) => updateCountry(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="IN">India (NSE/BSE)</option>
                      <option value="US">United States (NASDAQ/NYSE)</option>
                    </select>
                  </FormField>

                  <FormField label="Symbol / Ticker" error={formErrors.symbol}>
                    <input
                      value={holdingForm.symbol}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))
                      }
                      placeholder="RELIANCE / AAPL"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Company / Fund Name" error={formErrors.company_name}>
                    <input
                      value={holdingForm.company_name}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, company_name: event.target.value }))
                      }
                      placeholder="Reliance Industries Ltd."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Exchange" error={formErrors.exchange}>
                    <select
                      value={holdingForm.exchange}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, exchange: event.target.value }))
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, currency: event.target.value }))
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </FormField>

                  <FormField label="FX Rate to INR" error={formErrors.fx_rate_to_inr}>
                    <input
                      value={holdingForm.fx_rate_to_inr}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, fx_rate_to_inr: event.target.value }))
                      }
                      placeholder={holdingForm.country === 'US' ? '83.50' : '1'}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'Units' : 'Quantity'} error={formErrors.quantity}>
                    <input
                      value={holdingForm.quantity}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, quantity: event.target.value }))
                      }
                      placeholder="100"
                      disabled={editingHoldingId !== null}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                    />
                  </FormField>

                  <FormField label="Average Buy Price" error={formErrors.avg_buy_price}>
                    <input
                      value={holdingForm.avg_buy_price}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, avg_buy_price: event.target.value }))
                      }
                      placeholder="1500"
                      disabled={editingHoldingId !== null}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                    />
                  </FormField>

                  <FormField label={holdingForm.asset_type === 'mutual_fund' ? 'NAV' : 'Current Price'} error={formErrors.current_price}>
                    <input
                      value={holdingForm.current_price}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, current_price: event.target.value }))
                      }
                      placeholder="1650"
                      disabled={editingHoldingId !== null && holdingForm.price_source !== 'manual'}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                    />
                  </FormField>

                  <FormField label="Sector / Category" error={formErrors.sector}>
                    <input
                      value={holdingForm.sector}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, sector: event.target.value }))
                      }
                      placeholder="Technology / Finance / Gold"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  {holdingForm.asset_type === 'mutual_fund' ? (
                    <FormField label="AMFI Scheme Code for Auto-NAV (e.g. 122639)" error={formErrors.exchange_symbol}>
                      <input
                        value={holdingForm.exchange_symbol}
                        onChange={(event) =>
                          setHoldingForm((current) => ({ ...current, exchange_symbol: event.target.value.trim() }))
                        }
                        placeholder="122639 (PPFAS) / 120292 (ICICI)"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        autoComplete="off"
                      />
                    </FormField>
                  ) : (
                    <FormField label="Ticker Symbol for Auto-Price (e.g. RELIANCE.NS / QQQ)" error={formErrors.exchange_symbol}>
                      <input
                        value={holdingForm.exchange_symbol}
                        onChange={(event) =>
                          setHoldingForm((current) => ({ ...current, exchange_symbol: event.target.value.toUpperCase() }))
                        }
                        placeholder={holdingForm.country === 'US' ? 'QQQ / AMZN / AAPL' : 'RELIANCE.NS / GOLDBEES.NS'}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 uppercase dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        autoComplete="off"
                      />
                    </FormField>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Pricing Feed Mode">
                    <select
                      value={holdingForm.price_source}
                      onChange={(event) =>
                        setHoldingForm((current) => ({ ...current, price_source: event.target.value }))
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="yfinance">Auto Refresh (Yahoo / Live Feed)</option>
                      <option value="mfapi">Auto Refresh (AMFI / MFAPI Daily NAV)</option>
                      <option value="manual">Manual Entry</option>
                    </select>
                  </FormField>

                  <FormField label="Position Status">
                    <select
                      value={holdingForm.status}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, status: event.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    rows={2}
                    value={holdingForm.notes}
                    onChange={(event) => setHoldingForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Investment thesis, target price, etc..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsHoldingModalOpen(false)}
                  className={secondaryButtonClass}
                  disabled={isSavingHolding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingHolding}
                  className={primaryButtonClass}
                >
                  {isSavingHolding ? 'Saving...' : editingHoldingId === null ? 'Create Position' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function totalPnlClass(pnl: number) {
  if (pnl >= 0) return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
  return 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
}
