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

type ChartPoint = {
  label: string
  date: string
  actual_value: number | null
  predicted_value: number | null
}

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500'
const rangeFilters: Array<{ label: string; value: PortfolioRange }> = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'All', value: 'ALL' },
]

const allocationColors: Record<string, string> = {
  stock_in: '#0d9488',
  stock_us: '#38bdf8',
  etf: '#0ea5e9',
  gold: '#f59e0b',
  mutual_fund: '#a78bfa',
  banks: '#f97316',
  pfepf: '#22c55e',
  liabilities: '#fb7185',
  equity: '#0d9488',
  funds: '#a78bfa',
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatChartDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(date)
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

function SectionCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={['rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80', className].join(' ')}>
      {title ? <div className="border-b border-slate-200 px-5 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:border-slate-700/50 dark:text-slate-500">{title}</div> : null}
      {children}
    </div>
  )
}

export default function PortfolioPage() {
  const { privacyMode } = usePrivacyMode()
  const [intelligence, setIntelligence] = useState<PortfolioIntelligence | null>(null)
  const [performance, setPerformance] = useState<ApiPortfolioPerformance | null>(null)
  const [activeRange, setActiveRange] = useState<PortfolioRange>('6M')
  const [loading, setLoading] = useState(true)
  const [performanceLoading, setPerformanceLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [performanceError, setPerformanceError] = useState<string | null>(null)

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

  const chartData = useMemo(() => buildChartData(performance), [performance])
  const hasPerformance = (performance?.actual.length ?? 0) > 0
  const latestSnapshotReturn = toNumber(intelligence?.performance.latest_snapshot_return_pct)

  const netWorthCards = intelligence
    ? [
        { label: 'Total Assets', value: toNumber(intelligence.net_worth.total_assets), tone: 'text-slate-900 dark:text-white' },
        { label: 'Total Liabilities', value: toNumber(intelligence.net_worth.total_liabilities), tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400' },
        { label: 'Net Worth', value: toNumber(intelligence.net_worth.net_worth), tone: 'text-slate-900 dark:text-white' },
        { label: 'Liquid Assets', value: toNumber(intelligence.net_worth.liquid_assets), tone: 'text-slate-900 dark:text-white' },
        { label: 'Long-Term Assets', value: toNumber(intelligence.net_worth.long_term_assets), tone: 'text-slate-900 dark:text-white' },
        { label: 'Credit Exposure', value: toNumber(intelligence.net_worth.credit_exposure), tone: privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400' },
      ]
    : []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Portfolio Intelligence</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Net worth, allocation, risk, and long-term wealth analysis</p>
      </div>

      {error ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div> : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <SectionCard key={index} className="p-4">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-7 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                </div>
              </SectionCard>
            ))
          : netWorthCards.map((card) => (
              <SectionCard key={card.label} className="p-4">
                <div className={sectionLabel}>{card.label}</div>
                <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', card.tone].join(' ')}>
                  <PrivateValue value={formatMoney(card.value)} mask="••••" hideColor />
                </div>
              </SectionCard>
            ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <SectionCard title="Asset Allocation" className="p-5">
          {!intelligence || intelligence.asset_allocation.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Not added</div>
          ) : (
            <div className="space-y-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {intelligence.asset_allocation.filter((item) => item.kind !== 'liability').map((item) => (
                  <div key={item.key} className="h-full" style={{ width: `${Math.max(toNumber(item.percentage), 0)}%`, backgroundColor: allocationColors[item.key] ?? '#64748b' }} />
                ))}
              </div>
              <div className="space-y-3">
                {intelligence.asset_allocation.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                    <div className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocationColors[item.key] ?? '#64748b' }} />
                      <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(item.amount))} mask="••••" hideColor />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <PrivateValue value={formatPct(toNumber(item.percentage))} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Risk Allocation" className="p-5">
          {!intelligence || intelligence.risk_allocation.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Not added</div>
          ) : (
            <div className="space-y-3">
              {intelligence.risk_allocation.map((item) => (
                <div key={item.key}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                    <div className="text-right">
                      <div className="font-mono font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(item.amount))} mask="••••" hideColor />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <PrivateValue value={formatPct(toNumber(item.percentage))} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(toNumber(item.percentage), 0)}%`, backgroundColor: allocationColors[item.key] ?? '#64748b' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionCard title="Liquidity View" className="p-5">
          {!intelligence ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading liquidity...</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Immediate Cash', toNumber(intelligence.liquidity.immediate_cash)],
                ['Market-Linked', toNumber(intelligence.liquidity.market_linked)],
                ['Locked / Long-Term', toNumber(intelligence.liquidity.locked_long_term)],
                ['Liabilities', toNumber(intelligence.liquidity.liabilities)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className={sectionLabel}>{label}</div>
                  <div className={['mt-2 font-mono text-lg font-bold tabular-nums', label === 'Liabilities' ? privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400' : 'text-slate-900 dark:text-white'].join(' ')}>
                    <PrivateValue value={formatMoney(Number(value))} mask="••••" hideColor />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Cashflow Context" className="p-5">
          {!intelligence || !intelligence.cashflow_context.has_data ? (
            <div className="space-y-2">
              <div className="text-sm text-slate-500 dark:text-slate-400">Not added</div>
              <div className="text-xs text-slate-500 dark:text-slate-500">Cashflow is monthly summary only. Bank balances are manually managed.</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={sectionLabel}>Income</div>
                  <div className="mt-2 font-mono text-lg font-bold text-emerald-400"><PrivateValue value={formatMoney(toNumber(intelligence.cashflow_context.income))} mask="••••" hideColor /></div>
                </div>
                <div>
                  <div className={sectionLabel}>Spend</div>
                  <div className={['mt-2 font-mono text-lg font-bold', privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'].join(' ')}><PrivateValue value={formatMoney(toNumber(intelligence.cashflow_context.spend))} mask="••••" hideColor /></div>
                </div>
                <div>
                  <div className={sectionLabel}>Savings</div>
                  <div className={['mt-2 font-mono text-lg font-bold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings))].join(' ')}><PrivateValue value={formatMoney(toNumber(intelligence.cashflow_context.savings))} mask="••••" hideColor /></div>
                </div>
                <div>
                  <div className={sectionLabel}>Savings Rate</div>
                  <div className={['mt-2 font-mono text-lg font-bold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(intelligence.cashflow_context.savings_rate))].join(' ')}><PrivateValue value={formatPct(toNumber(intelligence.cashflow_context.savings_rate))} mask="••••" hideColor /></div>
                </div>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-500">{intelligence.cashflow_context.note}</div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <SectionCard title="Portfolio Performance" className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                {intelligence?.performance.has_snapshots ? <PrivateValue value={formatMoney(toNumber(intelligence.performance.latest_snapshot_value))} mask="••••" hideColor /> : '—'}
              </div>
              {intelligence?.performance.has_snapshots ? (
                <div className={['mt-1 text-sm font-semibold', privacyMode ? 'text-slate-400 dark:text-slate-400' : getTrendClass(latestSnapshotReturn)].join(' ')}>
                  <PrivateValue value={formatSignedPct(latestSnapshotReturn)} mask="••••" hideColor />
                </div>
              ) : (
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{intelligence?.performance.message ?? 'No portfolio snapshots yet'}</div>
              )}
            </div>
            <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-0.5">
              {rangeFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setActiveRange(filter.value)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150',
                    activeRange === filter.value ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5">
            {performanceLoading ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40">
                <span className="text-sm text-slate-400">Loading chart…</span>
              </div>
            ) : performanceError ? (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{performanceError}</div>
            ) : !hasPerformance ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-800/40">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">No portfolio history yet</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{performance?.message ?? 'More snapshot history needed for prediction.'}</div>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" />Actual</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Predicted</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        width={76}
                        tickFormatter={(value: number) => (privacyMode ? '••••' : formatINRShort(value))}
                      />
                      <Tooltip
                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.7)', borderRadius: '12px', color: '#fff' }}
                        formatter={(value, name) => [
                          privacyMode ? '••••' : formatINR(Number(Array.isArray(value) ? value[0] ?? 0 : value ?? 0)),
                          name === 'actual_value' ? 'Actual' : 'Predicted',
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line type="monotone" dataKey="actual_value" stroke="#14b8a6" strokeWidth={2.25} dot={{ r: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
                      <Line type="monotone" dataKey="predicted_value" stroke="#f59e0b" strokeWidth={2} dot={{ r: 0 }} strokeDasharray="6 4" activeDot={{ r: 4 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {performance?.message ? <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{performance.message}</div> : null}
              </>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Top Movers / Attention" className="p-5">
          {!intelligence ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading analysis...</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Biggest Gainers</div>
                <div className="space-y-2">
                  {intelligence.top_movers.biggest_gainers.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No holdings added</div>
                  ) : (
                    intelligence.top_movers.biggest_gainers.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-white">{item.symbol}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{item.company_name}</div>
                        </div>
                        <div className="text-right">
                          <div className={['font-mono font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-emerald-400'].join(' ')}>
                            <PrivateValue value={formatINR(toNumber(item.pnl))} mask="••••" hideColor />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400"><PrivateValue value={formatPct(toNumber(item.return_pct))} mask="••••" hideColor /></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Biggest Losers</div>
                <div className="space-y-2">
                  {intelligence.top_movers.biggest_losers.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">No holdings added</div>
                  ) : (
                    intelligence.top_movers.biggest_losers.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-white">{item.symbol}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{item.company_name}</div>
                        </div>
                        <div className="text-right">
                          <div className={['font-mono font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400'].join(' ')}>
                            <PrivateValue value={formatINR(toNumber(item.pnl))} mask="••••" hideColor />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400"><PrivateValue value={formatPct(toNumber(item.return_pct))} mask="••••" hideColor /></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-500">Attention</div>
                <div className="space-y-2">
                  {intelligence.top_movers.attention.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-700/50 dark:bg-slate-900/40">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Intelligence / Insights" className="p-5">
        {!intelligence || intelligence.insights.length === 0 ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Not enough portfolio data yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {intelligence.insights.map((insight, index) => (
              <div key={`${index}-${insight}`} className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 dark:border-slate-700/50 dark:bg-slate-900/40 dark:text-slate-300">
                {insight}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
