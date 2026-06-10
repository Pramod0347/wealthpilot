import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Icon } from './Icon'
import { ApiError, apiFetch } from '../lib/api'
import { formatINR, formatINRShort, formatPct } from '../lib/format'

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
    sector: string | null
    current_value: string | number
    pnl: string | number
    return_pct: string | number
  }>
  top_losers: Array<{
    id: number
    symbol: string
    company_name: string
    asset_type: string
    sector: string | null
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
  exchange_symbol: string
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
  exchange_symbol: '',
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

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
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
    <div className={['rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]', className].join(' ')}>
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

export default function StocksPage() {
  const [holdings, setHoldings] = useState<ApiHolding[]>([])
  const [analytics, setAnalytics] = useState<ApiHoldingsAnalytics | null>(null)
  const [holdingsLoading, setHoldingsLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')
  const [sectorFilter, setSectorFilter] = useState('all')
  const [isHoldingModalOpen, setIsHoldingModalOpen] = useState(false)
  const [holdingForm, setHoldingForm] = useState<HoldingFormState>(defaultHoldingForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSavingHolding, setIsSavingHolding] = useState(false)
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null)
  const [isRefreshingAllPrices, setIsRefreshingAllPrices] = useState(false)
  const [refreshingHoldingId, setRefreshingHoldingId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

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

  const summaryCards = useMemo(() => {
    if (analyticsLoading) {
      return [
        { label: 'Invested', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Current Value', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'P&L', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
        { label: 'Return %', value: 'Loading...', meta: 'Fetching analytics', color: 'text-white' },
      ]
    }

    if (analyticsError || !analytics) {
      return [
        { label: 'Invested', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Current Value', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'P&L', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
        { label: 'Return %', value: '—', meta: analyticsError ?? 'No data available', color: 'text-white' },
      ]
    }

    const pnl = toNumber(analytics.total_pnl)
    const returnPct = toNumber(analytics.total_return_pct)
    return [
      { label: 'Invested', value: formatINR(toNumber(analytics.total_invested)), meta: `${holdings.length} holdings`, color: 'text-white' },
      { label: 'Current Value', value: formatINR(toNumber(analytics.current_value)), meta: 'Live from holdings', color: 'text-white' },
      { label: 'P&L', value: `${pnl >= 0 ? '+' : '-'}${formatINR(Math.abs(pnl)).replace('₹', '')}`, meta: 'Overall portfolio profit/loss', color: pnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
      { label: 'Return %', value: `${returnPct >= 0 ? '+' : '-'}${formatPct(Math.abs(returnPct))}`, meta: 'Based on invested amount', color: returnPct >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    ]
  }, [analytics, analyticsError, analyticsLoading, holdings.length])

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
      const matchesAssetType = assetTypeFilter === 'all' || holding.asset_type === assetTypeFilter
      const matchesSector = sectorFilter === 'all' || (holding.sector ?? 'Uncategorized') === sectorFilter
      return matchesSearch && matchesAssetType && matchesSector
    })
  }, [assetTypeFilter, holdings, searchTerm, sectorFilter])

  const allocationData = useMemo(() => {
    if (analytics?.asset_type_allocation && analytics.asset_type_allocation.length > 0) {
      return analytics.asset_type_allocation.map((entry) => {
        const meta = getAssetTypeMeta(entry.key)
        return {
          key: entry.key,
          name: entry.label || meta.label,
          value: toNumber(entry.amount),
          percentage: toNumber(entry.percentage),
          color: meta.color,
        }
      })
    }

    const totals = holdings.reduce<Record<string, number>>((accumulator, holding) => {
      const meta = getAssetTypeMeta(holding.asset_type)
      accumulator[meta.label] = (accumulator[meta.label] ?? 0) + toNumber(holding.current_value)
      return accumulator
    }, {})

    const totalValue = Object.values(totals).reduce((accumulator, value) => accumulator + value, 0)
    return Object.entries(totals).map(([name, amount]) => {
      const paletteEntry = Object.values(assetTypePalette).find((item) => item.label === name) ?? assetTypePalette.other
      return {
        key: name,
        name,
        value: amount,
        percentage: totalValue > 0 ? (amount / totalValue) * 100 : 0,
        color: paletteEntry.color,
      }
    })
  }, [analytics, holdings])

  async function refreshData() {
    await loadData()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const symbol = holdingForm.symbol.trim().toUpperCase()
    const companyName = holdingForm.company_name.trim()
    const assetType = holdingForm.asset_type.trim()
    const exchangeSymbol = holdingForm.exchange_symbol.trim().toUpperCase()
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

    ;[['quantity', quantity], ['avg_buy_price', avgBuyPrice], ['current_price', currentPrice]].forEach(([field, value]) => {
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
        asset_type: assetType,
        exchange_symbol: exchangeSymbol || null,
        quantity,
        avg_buy_price: avgBuyPrice,
        current_price: currentPrice,
        sector: sector || null,
        notes: notes || null,
        as_of_date: asOfDate || null,
      }

      if (editingHoldingId === null) {
        await apiFetch('/api/holdings', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch(`/api/holdings/${editingHoldingId}`, {
          method: 'PATCH',
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

  function openEditModal(holding: ApiHolding) {
    setEditingHoldingId(holding.id)
    setHoldingForm({
      symbol: holding.symbol,
      company_name: holding.company_name,
      asset_type: holding.asset_type,
      exchange_symbol: holding.exchange_symbol ?? '',
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
    if (holding.asset_type === 'mutual_fund') return
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

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="t-section text-white">Stocks / Holdings</div>
            <div className="mt-1 t-meta text-slate-400">Full management view for holdings, pricing, and filters.</div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={handleRefreshAllPrices}
              disabled={isRefreshingAllPrices}
              className="flex h-12 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body font-semibold text-slate-200 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Icon name="refresh" className={['h-4 w-4', isRefreshingAllPrices ? 'animate-spin' : ''].join(' ')} />
              {isRefreshingAllPrices ? 'Refreshing...' : 'Refresh All Prices'}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-12 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-colors hover:bg-[var(--accent-700)]"
            >
              <Icon name="add" className="h-4 w-4 text-white" />
              Add Holding
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SectionCard key={card.label} className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="t-label text-slate-400">{card.label}</div>
                  <div className={['t-metric mt-6', card.color].join(' ')}>{card.value}</div>
                  <div className="t-meta mt-4 text-slate-400">{card.meta}</div>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-slate-800 text-slate-300">
                  <Icon name={card.label === 'Invested' ? 'netWorth' : card.label === 'Current Value' ? 'up' : 'analytics'} className="h-5 w-5" />
                </div>
              </div>
            </SectionCard>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Asset Type Allocation</div>
            <div className="mt-1 t-body text-slate-400">Based on current market value</div>
            <div className="mt-6 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
              <div className="relative mx-auto h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationData} dataKey="value" innerRadius={58} outerRadius={84} paddingAngle={3} stroke="transparent">
                      {allocationData.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatINRShort(toNumber(value as string | number | null | undefined)), 'Value']}
                      contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="t-meta uppercase text-slate-400">Total assets</div>
                  <div className="mt-1 font-mono text-[18px] font-bold tabular-nums text-white">{formatINR(toNumber(analytics?.current_value ?? 0))}</div>
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
                      <div className="t-nav text-white">{toNumber(entry.percentage).toFixed(1)}%</div>
                      <div className="t-meta">{formatINRShort(toNumber(entry.value))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard className="px-6 py-6">
            <div className="t-section text-white">Top Movers</div>
            <div className="mt-1 t-body text-slate-400">Best and worst performers</div>
            <div className="mt-6 space-y-4">
              <div>
                <div className="t-label text-emerald-400">Top Gainers</div>
                <div className="mt-3 space-y-3">
                  {(analytics?.top_gainers ?? []).slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="t-body truncate text-white">{item.symbol}</div>
                          <div className="t-meta truncate">{item.company_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="t-nav text-emerald-400">+{formatINR(Math.abs(toNumber(item.pnl))).replace('₹', '')}</div>
                          <div className="t-meta text-emerald-400">+{formatPct(Math.abs(toNumber(item.return_pct)))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="t-label text-rose-400">Top Losers</div>
                <div className="mt-3 space-y-3">
                  {(analytics?.top_losers ?? []).slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0f172a] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="t-body truncate text-white">{item.symbol}</div>
                          <div className="t-meta truncate">{item.company_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="t-nav text-rose-400">-{formatINR(Math.abs(toNumber(item.pnl))).replace('₹', '')}</div>
                          <div className="t-meta text-rose-400">-{formatPct(Math.abs(toNumber(item.return_pct)))}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard className="overflow-hidden">
          <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_180px_180px]">
              <label className="flex h-12 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 text-slate-400">
                <Icon name="search" className="h-4 w-4 shrink-0" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search symbol or company"
                  className="w-full bg-transparent t-body text-slate-200 outline-none placeholder:text-slate-500"
                />
              </label>

              <select
                value={assetTypeFilter}
                onChange={(event) => setAssetTypeFilter(event.target.value)}
                className="h-12 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-slate-200 outline-none"
              >
                <option value="all">All asset types</option>
                {assetTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={sectorFilter}
                onChange={(event) => setSectorFilter(event.target.value)}
                className="h-12 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-slate-200 outline-none"
              >
                <option value="all">All sectors</option>
                {sectorOptions
                  .filter((item) => item !== 'all')
                  .map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {holdingsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">Loading holdings...</div>
                <div className="mt-2 t-body text-slate-400">Fetching positions from the backend.</div>
              </div>
            </div>
          ) : holdingsError ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-8 text-center">
                <div className="t-section text-rose-300">Unable to load holdings</div>
                <div className="mt-2 t-body text-rose-200/80">{holdingsError}</div>
              </div>
            </div>
          ) : filteredHoldings.length === 0 ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-[6px] bg-[#18233d] text-accent-400">
                  <Icon name="empty" className="h-5 w-5" />
                </div>
                <div className="mt-4 t-section text-white">No holdings match the filters</div>
                <div className="mt-2 t-body text-slate-400">Try a different asset type, sector, or search term.</div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full border-separate border-spacing-0">
                <thead>
                  <tr className="text-left">
                    {['Stock', 'Asset Type', 'Qty', 'Avg Buy', 'LTP', 'Invested', 'Cur. Value', 'P&L', 'Return %', ''].map((head) => (
                      <th key={head} className="px-6 py-4 t-th">
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
                    const positive = pnl >= 0
                    const refreshDisabled = row.asset_type === 'mutual_fund'

                    return (
                      <tr key={row.id} className="border-t border-[rgba(51,65,85,0.35)]">
                        <td className="px-6 py-5">
                          <div className="t-nav text-white">{row.symbol}</div>
                          <div className="t-meta">{row.company_name}</div>
                          <div className="mt-2 inline-flex rounded-[999px] px-2 py-1 t-badge text-slate-300">
                            {row.asset_type.replace('_', ' ')}
                          </div>
                          <div className="mt-1 t-meta">
                            {row.price_source === 'yfinance' ? 'Live price · yfinance' : 'Manual price'}
                            {row.last_price_refreshed_at ? ` · Refreshed ${formatRefreshTimestamp(row.last_price_refreshed_at)}` : ''}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className={['inline-flex rounded-[999px] px-2 py-1 t-badge', getAssetTypeBadgeClass(row.asset_type)].join(' ')}>
                            {getAssetTypeMeta(row.asset_type).label}
                          </div>
                        </td>
                        <td className="px-6 py-5 t-num text-slate-200">{toNumber(row.quantity)}</td>
                        <td className="px-6 py-5 t-num text-slate-200">{formatINR(toNumber(row.avg_buy_price))}</td>
                        <td className="px-6 py-5 t-num text-slate-200">{formatINR(toNumber(row.current_price))}</td>
                        <td className="px-6 py-5 t-num text-slate-200">{formatINR(invested)}</td>
                        <td className="px-6 py-5 t-num text-white">{formatINR(currentValue)}</td>
                        <td className={['px-6 py-5 t-num', positive ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
                          {positive ? '+' : '-'}
                          {formatINR(Math.abs(pnl)).replace('₹', '')}
                        </td>
                        <td className={['px-6 py-5 t-badge', positive ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
                          {positive ? '↑' : '↓'} {formatPct(pct)}
                        </td>
                        <td className="px-6 py-5 text-right text-slate-400">
                          <button
                            type="button"
                            onClick={() => handleRefreshHolding(row)}
                            disabled={refreshDisabled || refreshingHoldingId === row.id || isRefreshingAllPrices}
                            title={refreshDisabled ? 'Refresh disabled for mutual funds' : 'Refresh market price'}
                            className="mr-2 rounded-[6px] px-3 py-2 t-badge text-accent-400 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon
                                name="refresh"
                                className={['h-4 w-4', refreshingHoldingId === row.id ? 'animate-spin' : ''].join(' ')}
                              />
                              {refreshDisabled ? 'Manual only' : refreshingHoldingId === row.id ? 'Refreshing' : 'Refresh'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(row)}
                            className="mr-2 rounded-[6px] px-2 py-1 hover:bg-white/5"
                            aria-label={`Edit ${row.symbol}`}
                          >
                            <Icon name="edit" className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHolding(row)}
                            className="rounded-[6px] px-2 py-1 hover:bg-white/5"
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

      {isHoldingModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/70 backdrop-blur-sm">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close holding dialog" onClick={() => setIsHoldingModalOpen(false)} />

          <section className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[#0f172a] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
              <div>
                <div className="t-section text-white">{editingHoldingId === null ? 'Add Holding' : 'Edit Holding'}</div>
                <div className="mt-1 t-meta">Manual entry for one stock position</div>
              </div>
              <button
                type="button"
                onClick={() => setIsHoldingModalOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-[6px] text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
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
                  <FormField label="Symbol" error={formErrors.symbol}>
                    <input
                      value={holdingForm.symbol}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                      placeholder="RELIANCE"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Company Name" error={formErrors.company_name}>
                    <input
                      value={holdingForm.company_name}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, company_name: event.target.value }))}
                      placeholder="Reliance Industries"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Asset Type" error={formErrors.asset_type}>
                    <select
                      value={holdingForm.asset_type}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, asset_type: event.target.value }))}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
                    >
                      {assetTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Exchange Symbol" error={formErrors.exchange_symbol}>
                    <input
                      value={holdingForm.exchange_symbol}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, exchange_symbol: event.target.value.toUpperCase() }))}
                      placeholder="RELIANCE.NS"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Quantity" error={formErrors.quantity}>
                    <input
                      value={holdingForm.quantity}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, quantity: event.target.value }))}
                      placeholder="40"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Average Buy Price" error={formErrors.avg_buy_price}>
                    <input
                      value={holdingForm.avg_buy_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, avg_buy_price: event.target.value }))}
                      placeholder="2380"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Current Price" error={formErrors.current_price}>
                    <input
                      value={holdingForm.current_price}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, current_price: event.target.value }))}
                      placeholder="2910"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Sector" error={formErrors.sector}>
                    <input
                      value={holdingForm.sector}
                      onChange={(event) => setHoldingForm((current) => ({ ...current, sector: event.target.value }))}
                      placeholder="Energy"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                      autoComplete="off"
                    />
                  </FormField>

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
                    placeholder="Optional notes about the holding"
                    className="w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 py-3 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                  />
                </FormField>

                <div className="mt-5 rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#0b1224] px-4 py-3">
                  <div className="t-meta uppercase text-slate-400">Currency</div>
                  <div className="mt-1 t-body text-slate-200">INR only. Decimal values are accepted for quantity and prices.</div>
                </div>
              </div>

              <div className="border-t border-[rgba(51,65,85,0.45)] px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsHoldingModalOpen(false)}
                    className="h-11 rounded-[6px] border border-[var(--border-soft)] px-5 t-nav text-slate-200 transition-colors hover:bg-white/5"
                    disabled={isSavingHolding}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingHolding}
                    className="flex h-11 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-5 t-nav font-semibold text-white transition-colors hover:bg-[var(--accent-700)] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSavingHolding ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                    {isSavingHolding ? 'Saving...' : editingHoldingId === null ? 'Create Holding' : 'Save Changes'}
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
