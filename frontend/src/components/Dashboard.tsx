import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Icon } from './Icon'
import { ApiError, apiFetch } from '../lib/api'
import { formatINR, formatINRShort, formatPct } from '../lib/format'

type ApiDashboardSummary = {
  total_invested: string | number
  current_value: string | number
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
  exchange_symbol: string | null
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

type SummaryCard = {
  label: string
  value: string
  meta: string
  icon: 'netWorth' | 'up' | 'analytics' | 'portfolio' | 'cards'
  iconBg: string
  valueClass?: string
  metaClass?: string
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
  quantity: '',
  avg_buy_price: '',
  current_price: '',
  sector: '',
  notes: '',
  as_of_date: '',
}

const performanceData = [
  { label: 'Jan', value: 4.22 },
  { label: 'Feb', value: 4.26 },
  { label: 'Mar', value: 4.24 },
  { label: 'Apr', value: 4.31 },
  { label: 'May', value: 4.38 },
  { label: 'Jun', value: 4.40 },
  { label: 'Jul', value: 4.52 },
  { label: 'Aug', value: 4.63 },
  { label: 'Sep', value: 4.68 },
  { label: 'Oct', value: 4.86 },
  { label: 'Nov', value: 4.96 },
  { label: 'Dec', value: 5.03 },
  { label: 'Jan', value: 5.18 },
  { label: 'Feb', value: 5.24 },
  { label: 'Mar', value: 5.24 },
  { label: 'Apr', value: 5.31 },
  { label: 'May', value: 5.39 },
  { label: 'Jun', value: 5.38 },
]

const assetTypeOptions = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

const assetTypePalette: Record<string, { label: string; color: string }> = {
  stock: { label: 'Stocks', color: '#0d9488' },
  etf: { label: 'ETFs', color: '#0ea5e9' },
  mutual_fund: { label: 'Mutual Funds', color: '#a78bfa' },
  cash: { label: 'Cash', color: '#f59e0b' },
  other: { label: 'Other Assets', color: '#64748b' },
}

const cards = [
  { name: 'HDFC Regalia', bank: 'HDFC Bank ••4821', status: 'Due Soon', tone: 'amber', used: 71420, limit: 500000, bill: 38450, dueDate: '12 Jun 2026', percent: 28 },
  { name: 'Axis Ace', bank: 'Axis Bank ••6390', status: 'Paid', tone: 'emerald', used: 89600, limit: 250000, bill: 24200, dueDate: '28 Jun 2026', percent: 36 },
  { name: 'SBI Cashback', bank: 'SBI ••1107', status: 'Overdue', tone: 'rose', used: 119000, limit: 300000, bill: 21550, dueDate: '05 Jun 2026', percent: 40 },
]

const upcoming = [
  { label: 'SBI Cashback', type: 'Credit Card · 05 Jun', amount: 21550, status: 'Overdue', tone: 'rose' },
  { label: 'Home Loan EMI', type: 'Loan · 07 Jun', amount: 42000, status: 'Due Soon', tone: 'amber' },
  { label: 'Mutual Fund SIP', type: 'Investment · 10 Jun', amount: 15000, status: 'Scheduled', tone: 'slate' },
  { label: 'HDFC Regalia', type: 'Credit Card · 12 Jun', amount: 38450, status: 'Due Soon', tone: 'amber' },
  { label: 'Axis Ace', type: 'Credit Card · 28 Jun', amount: 24200, status: 'Paid', tone: 'emerald' },
]

const insights = [
  {
    tone: 'amber',
    text: "You're overexposed to technology - 38% of your equity sits in IT (TCS, Infosys, Wipro).",
  },
  { tone: 'slate', text: 'HDFC Regalia bill of ₹38,450 is due in 3 days.' },
  { tone: 'emerald', text: 'Your portfolio is up 8.4% this month, outperforming the Nifty 50 by 2.1%.' },
  { tone: 'rose', text: 'SBI Cashback is overdue - pay ₹21,550 now to avoid a late fee.' },
]

const timeFilters = ['1M', '3M', '6M', '1Y', 'All']

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function getAssetTypeMeta(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  return assetTypePalette[normalized] ?? assetTypePalette.other
}

function getAssetTypeBadgeClass(assetType: string | null | undefined) {
  const normalized = (assetType || 'other').toLowerCase()
  if (normalized === 'stock') return 'bg-accent-500/15 text-accent-400'
  if (normalized === 'etf') return 'bg-sky-500/15 text-sky-400'
  if (normalized === 'mutual_fund') return 'bg-violet-500/15 text-violet-400'
  if (normalized === 'cash') return 'bg-amber-500/15 text-amber-400'
  return 'bg-slate-700 text-slate-300'
}

function formatRefreshTimestamp(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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

function buildSummaryCards(summary: ApiDashboardSummary | null, loading: boolean, error: string | null): SummaryCard[] {
  if (loading) {
    return [
      { label: 'Total Invested', value: 'Loading...', meta: 'Fetching from backend', icon: 'netWorth', iconBg: 'bg-accent-500 text-white' },
      { label: 'Current Value', value: 'Loading...', meta: 'Fetching from backend', icon: 'up', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total P&L', value: 'Loading...', meta: 'Fetching from backend', icon: 'analytics', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total Return %', value: 'Loading...', meta: 'Fetching from backend', icon: 'portfolio', iconBg: 'bg-amber-500/20 text-amber-400' },
    ]
  }

  if (error || summary === null) {
    return [
      { label: 'Total Invested', value: '—', meta: error ?? 'No data available', icon: 'netWorth', iconBg: 'bg-accent-500 text-white' },
      { label: 'Current Value', value: '—', meta: error ?? 'No data available', icon: 'up', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total P&L', value: '—', meta: error ?? 'No data available', icon: 'analytics', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Total Return %', value: '—', meta: error ?? 'No data available', icon: 'portfolio', iconBg: 'bg-amber-500/20 text-amber-400' },
    ]
  }

  const totalInvested = toNumber(summary.total_invested)
  const currentValue = toNumber(summary.current_value)
  const totalPnl = toNumber(summary.total_pnl)
  const totalReturnPct = toNumber(summary.total_return_pct)
  const pnlPositive = totalPnl >= 0
  const returnPositive = totalReturnPct >= 0

  return [
    {
      label: 'Total Invested',
      value: formatINR(totalInvested),
      meta: `${summary.holdings_count} holdings`,
      icon: 'netWorth',
      iconBg: 'bg-accent-500 text-white',
    },
    {
      label: 'Current Value',
      value: formatINR(currentValue),
      meta: 'Live from holdings',
      icon: 'up',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Total P&L',
      value: `${pnlPositive ? '+' : '-'}${formatINR(Math.abs(totalPnl)).replace('₹', '')}`,
      meta: `${pnlPositive ? '+' : '-'}${formatPct(Math.abs(totalReturnPct))} overall return`,
      icon: 'analytics',
      iconBg: 'bg-slate-800 text-slate-300',
      valueClass: pnlPositive ? 'text-emerald-400' : 'text-rose-400',
      metaClass: 'text-slate-400',
    },
    {
      label: 'Total Return %',
      value: `${returnPositive ? '+' : '-'}${formatPct(Math.abs(totalReturnPct))}`,
      meta: 'Based on holdings',
      icon: 'portfolio',
      iconBg: 'bg-amber-500/20 text-amber-400',
      valueClass: returnPositive ? 'text-white' : 'text-rose-400',
    },
  ]
}

function buildCreditCardSummaryCards(summary: ApiDashboardSummary | null, loading: boolean, error: string | null): SummaryCard[] {
  if (loading) {
    return [
      { label: 'Total Dues', value: 'Loading...', meta: 'Fetching from backend', icon: 'cards', iconBg: 'bg-amber-500/20 text-amber-400' },
      { label: 'Card Limit', value: 'Loading...', meta: 'Fetching from backend', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Used Amount', value: 'Loading...', meta: 'Fetching from backend', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Utilization', value: 'Loading...', meta: 'Fetching from backend', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
    ]
  }

  if (error || summary === null) {
    return [
      { label: 'Total Dues', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-amber-500/20 text-amber-400' },
      { label: 'Card Limit', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Used Amount', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
      { label: 'Utilization', value: '—', meta: error ?? 'No data available', icon: 'cards', iconBg: 'bg-slate-800 text-slate-300' },
    ]
  }

  const totalDues = toNumber(summary.total_credit_card_dues)
  const totalCardLimit = toNumber(summary.total_card_limit)
  const totalCardUsed = toNumber(summary.total_card_used)
  const utilization = toNumber(summary.overall_card_utilization)

  return [
    {
      label: 'Total Dues',
      value: formatINR(totalDues),
      meta: `${summary.overdue_count} overdue · ${summary.due_soon_count} due soon`,
      icon: 'cards',
      iconBg: 'bg-amber-500/20 text-amber-400',
      valueClass: totalDues > 0 ? 'text-amber-300' : 'text-white',
    },
    {
      label: 'Card Limit',
      value: formatINR(totalCardLimit),
      meta: 'Across all credit cards',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Used Amount',
      value: formatINR(totalCardUsed),
      meta: 'Current swipes and dues',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
    },
    {
      label: 'Utilization',
      value: `${utilization.toFixed(2)}%`,
      meta: 'Overall card utilization',
      icon: 'cards',
      iconBg: 'bg-slate-800 text-slate-300',
      valueClass: utilization >= 80 ? 'text-rose-400' : utilization >= 50 ? 'text-amber-400' : 'text-emerald-400',
    },
  ]
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
    <div className={['rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors duration-200 ease-out hover:border-slate-600/60 motion-reduce:transition-none', className].join(' ')}>
      {title ? <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5 t-section text-white">{title}</div> : null}
      {children}
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
      <div className="mb-2 t-label text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-2 t-meta text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function Dashboard({
  onOpenStocks,
  onOpenCards,
}: {
  onOpenStocks?: () => void
  onOpenCards?: () => void
} = {}) {
  const [activeFilter, setActiveFilter] = useState('6M')
  const [summary, setSummary] = useState<ApiDashboardSummary | null>(null)
  const [holdings, setHoldings] = useState<ApiHolding[]>([])
  const [creditCards, setCreditCards] = useState<ApiCreditCard[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [holdingsLoading, setHoldingsLoading] = useState(true)
  const [cardsLoading, setCardsLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [cardsError, setCardsError] = useState<string | null>(null)
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false)
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(defaultHoldingForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [isRefreshingAllPrices, setIsRefreshingAllPrices] = useState(false)
  const [refreshingHoldingId, setRefreshingHoldingId] = useState<number | null>(null)
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null)
  const [refreshTone, setRefreshTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  const loadDashboardData = async (signal?: AbortSignal) => {
    setSummaryLoading(true)
    setHoldingsLoading(true)
    setCardsLoading(true)
    setSummaryError(null)
    setHoldingsError(null)
    setCardsError(null)

    const [summaryResult, holdingsResult, cardsResult] = await Promise.allSettled([
      apiFetch<ApiDashboardSummary>('/api/dashboard/summary', { signal }),
      apiFetch<ApiHolding[]>('/api/holdings', { signal }),
      apiFetch<ApiCreditCard[]>('/api/credit-cards', { signal }),
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
  }

  useEffect(() => {
    const controller = new AbortController()

    loadDashboardData(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }
      const message = formatApiError(error)
      setSummaryError(message)
      setHoldingsError(message)
      setCardsError(message)
      setSummaryLoading(false)
      setHoldingsLoading(false)
      setCardsLoading(false)
    })

    return () => controller.abort()
  }, [])

  const summaryCards = useMemo(
    () => buildSummaryCards(summary, summaryLoading, summaryError),
    [summary, summaryLoading, summaryError],
  )

  const allocationData = useMemo(() => {
    if (summary?.allocations && summary.allocations.length > 0) {
      return summary.allocations.map((entry) => {
        const meta = getAssetTypeMeta(entry.asset_type)
        return {
          key: entry.asset_type,
          name: entry.label || meta.label,
          value: toNumber(entry.amount),
          percentage: toNumber(entry.percentage),
          color: meta.color,
        }
      })
    }

    const totals = holdings.reduce<Record<string, { name: string; value: number; color: string }>>(
      (accumulator, holding) => {
        const key = (holding.asset_type || 'other').toLowerCase()
        const meta = getAssetTypeMeta(key)
        accumulator[key] = {
          name: meta.label,
          value: (accumulator[key]?.value ?? 0) + toNumber(holding.current_value),
          color: meta.color,
        }
        return accumulator
      },
      {},
    )

    const totalValue = Object.values(totals).reduce((accumulator, item) => accumulator + item.value, 0)

    return Object.entries(totals).map(([key, item]) => {
      return {
        key,
        name: item.name,
        value: item.value,
        percentage: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
        color: item.color,
      }
    })
  }, [holdings, summary])

  const equityExposurePct = useMemo(() => {
    if (allocationData.length === 0) {
      return 0
    }

    return allocationData.reduce((accumulator, entry) => {
      return entry.key === 'stock' || entry.key === 'etf' ? accumulator + entry.percentage : accumulator
    }, 0)
  }, [allocationData])

  async function handleCreateHolding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const symbol = holdingForm.symbol.trim().toUpperCase()
    const companyName = holdingForm.company_name.trim()
    const assetType = holdingForm.asset_type.trim()
    const quantity = holdingForm.quantity.trim()
    const avgBuyPrice = holdingForm.avg_buy_price.trim()
    const currentPrice = holdingForm.current_price.trim()
    const sector = holdingForm.sector.trim()
    const notes = holdingForm.notes.trim()
    const asOfDate = holdingForm.as_of_date.trim()

    if (!symbol) nextErrors.symbol = 'Symbol is required.'
    if (!companyName) nextErrors.company_name = 'Company name is required.'
    if (!assetType) nextErrors.asset_type = 'Asset type is required.'
    if (!quantity) nextErrors.quantity = 'Quantity is required.'
    if (!avgBuyPrice) nextErrors.avg_buy_price = 'Average buy price is required.'
    if (!currentPrice) nextErrors.current_price = 'Current price is required.'

    const numericChecks = [
      ['quantity', quantity],
      ['avg_buy_price', avgBuyPrice],
      ['current_price', currentPrice],
    ] as const

    numericChecks.forEach(([field, value]) => {
      if (value && Number.isNaN(Number(value))) {
        nextErrors[field] = 'Enter a valid decimal number.'
      }
    })

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setIsSavingHolding(true)

    try {
      await apiFetch('/api/holdings', {
        method: 'POST',
        body: JSON.stringify({
          symbol,
          company_name: companyName,
          asset_type: assetType,
          quantity,
          avg_buy_price: avgBuyPrice,
          current_price: currentPrice,
          sector: sector || null,
          notes: notes || null,
          as_of_date: asOfDate || null,
        }),
      })

      setIsHoldingModalOpen(false)
      setHoldingForm(defaultHoldingForm)
      await loadDashboardData()
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

  async function handleRefreshHolding(holdingId: number) {
    setRefreshingHoldingId(holdingId)
    setRefreshMessage(null)

    try {
      await apiFetch<ApiHolding>(`/api/holdings/${holdingId}/refresh-price`, {
        method: 'POST',
      })
      setRefreshTone('emerald')
      setRefreshMessage('Price refreshed successfully.')
      await loadDashboardData()
    } catch (error) {
      setRefreshTone('rose')
      setRefreshMessage(formatApiError(error))
    } finally {
      setRefreshingHoldingId(null)
    }
  }

  async function handleRefreshAllPrices() {
    setIsRefreshingAllPrices(true)
    setRefreshMessage(null)

    try {
      const result = await apiFetch<BulkRefreshResponse>('/api/holdings/refresh-prices', {
        method: 'POST',
      })
      if (result.failed_count > 0) {
        setRefreshTone('amber')
        setRefreshMessage(`Refreshed ${result.updated_count} holdings. ${result.failed_count} failed.`)
      } else {
        setRefreshTone('emerald')
        setRefreshMessage(`Refreshed ${result.updated_count} holdings successfully.`)
      }
      await loadDashboardData()
    } catch (error) {
      setRefreshTone('rose')
      setRefreshMessage(formatApiError(error))
    } finally {
      setIsRefreshingAllPrices(false)
    }
  }

  useEffect(() => {
    if (!isHoldingModalOpen) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsHoldingModalOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isHoldingModalOpen])

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 text-[var(--text-muted)]">
            <Icon name="refresh" className="h-5 w-5 shrink-0" />
            <span className="t-body whitespace-nowrap text-[var(--text-muted)]">Prices last updated</span>
            <span className="t-body whitespace-nowrap font-medium text-slate-200">09 Jun 2026, 3:42 PM IST</span>
          </div>
          <button
            type="button"
            onClick={onOpenStocks}
            className="flex h-14 shrink-0 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-5 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
          >
            <Icon name="stocks" className="h-5 w-5 text-white" />
            Open Stocks
          </button>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SectionCard key={card.label} className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="t-label text-slate-400">{card.label}</div>
                  <div className={['t-metric mt-6 text-white', card.valueClass].filter(Boolean).join(' ')}>{card.value}</div>
                  <div className={['t-meta mt-4', card.metaClass].filter(Boolean).join(' ')}>{card.meta}</div>
                </div>
                <div className={['grid h-12 w-12 shrink-0 place-items-center rounded-[6px]', card.iconBg].join(' ')}>
                  <Icon name={card.icon} className="h-5 w-5" />
                </div>
              </div>
            </SectionCard>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {buildCreditCardSummaryCards(summary, cardsLoading, cardsError).map((card) => (
            <SectionCard key={card.label} className="px-6 py-6">
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
          ))}
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <SectionCard className="min-w-0 px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="t-section text-white">Portfolio Performance</div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="t-metric-hero text-white">
                    {summary ? formatINRShort(toNumber(summary.current_value)) : 'Portfolio snapshot pending'}
                  </div>
                  <div className="rounded-[6px] bg-emerald-500/15 px-3 py-1 t-badge text-emerald-400">↑ +24.70%</div>
                  <div className="t-body text-slate-400">{summary ? 'from holdings' : 'waiting for snapshots'}</div>
                </div>
              </div>
              <div className="flex items-center rounded-[6px] bg-[#2b364e] p-1">
                {timeFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={[
                      'h-9 rounded-[6px] px-4 t-nav transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none',
                      activeFilter === filter ? 'bg-[#404d68] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 h-[420px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(51,65,85,0.55)" vertical={false} />
                  <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                    }}
                    formatter={(value) => [`₹${Number(value).toFixed(2)} L`, 'Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={4} fill="url(#performanceFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard className="min-w-0 px-6 py-6">
            <div className="t-section text-white">Asset Allocation</div>
            <div className="mt-1 t-body text-slate-400">By current market value</div>
            <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
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
                      <div className="mt-1 font-mono text-[18px] font-bold tabular-nums text-white">{formatINR(toNumber(summary?.current_value ?? 0))}</div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center gap-4">
                    {allocationData.map((entry) => (
                      <div key={entry.key} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                          <span className="t-body text-slate-200">{entry.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="t-nav text-white">{entry.percentage.toFixed(1)}%</div>
                          <div className="t-meta">{formatINRShort(entry.value)}</div>
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

        <SectionCard className="min-w-0">
          <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div>
              <div className="t-section text-white">Credit Cards</div>
              <div className="mt-1 t-meta">
                {cardsLoading ? 'Loading cards from backend...' : cardsError ? 'Unable to load cards' : `${creditCards.length} cards`}
              </div>
            </div>
            <button type="button" onClick={onOpenCards} className="t-body font-semibold text-accent-400 hover:text-accent-300">
              View all →
            </button>
          </div>

          {cardsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">Loading cards...</div>
                <div className="mt-2 t-body text-slate-400">Fetching credit card positions from the backend.</div>
              </div>
            </div>
          ) : cardsError ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-8 text-center">
                <div className="t-section text-rose-300">Unable to load cards</div>
                <div className="mt-2 t-body text-rose-200/80">{cardsError}</div>
              </div>
            </div>
          ) : creditCards.length === 0 ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-[6px] bg-[#18233d] text-accent-400">
                  <Icon name="cards" className="h-5 w-5" />
                </div>
                <div className="mt-4 t-section text-white">No credit cards yet</div>
                <div className="mt-2 t-body text-slate-400">Add your first card on the Credit Cards page.</div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 px-6 py-6 xl:grid-cols-3">
              {creditCards.slice(0, 3).map((card) => {
                const toneMapByStatus = {
                  paid: { border: 'border-emerald-500/60', status: 'bg-emerald-500/15 text-emerald-400', accent: 'text-emerald-400', bar: 'bg-emerald-500' },
                  due_soon: { border: 'border-amber-500/60', status: 'bg-amber-500/15 text-amber-400', accent: 'text-amber-400', bar: 'bg-amber-500' },
                  overdue: { border: 'border-rose-500/60', status: 'bg-rose-500/15 text-rose-400', accent: 'text-rose-400', bar: 'bg-rose-500' },
                }
                const toneMap = toneMapByStatus[card.status]

                return (
                  <div key={card.id} className={['rounded-[6px] border bg-[#131c31] p-5', toneMap.border].join(' ')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="t-nav text-white">{card.card_name}</div>
                        <div className="t-meta">{card.bank_name} ••{card.last4}</div>
                      </div>
                      <span className={['rounded-[999px] px-3 py-1 t-badge', toneMap.status].join(' ')}>{card.status.replace('_', ' ')}</span>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between t-meta">
                        <span>Used {formatINRShort(toNumber(card.used_amount))}</span>
                        <span>{toNumber(card.utilization_pct).toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-800">
                        <div className={['h-2 rounded-full', toneMap.bar].join(' ')} style={{ width: `${Math.min(toNumber(card.utilization_pct), 100)}%` }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between t-meta">
                        <span>Avail. {formatINRShort(toNumber(card.available_limit))} of {formatINRShort(toNumber(card.total_limit))}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <div className="t-micro text-slate-400">Bill amount</div>
                        <div className={['mt-1 t-amount', toneMap.accent].join(' ')}>{formatINR(toNumber(card.current_bill_amount))}</div>
                      </div>
                      <div className="text-right">
                        <div className="t-micro text-slate-400">Due date</div>
                        <div className="mt-1 t-nav text-white">{card.due_date}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
