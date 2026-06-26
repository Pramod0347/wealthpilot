import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, apiFetch, getPortfolioIntelligence, type PortfolioIntelligence, type PortfolioPerformanceData, type PortfolioRange } from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import PortfolioPerformanceChart from './ui/PortfolioPerformanceChart'

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500'
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
  const [performance, setPerformance] = useState<PortfolioPerformanceData | null>(null)
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
    apiFetch<PortfolioPerformanceData>(`/api/portfolio/performance?range=${activeRange}`, { signal: controller.signal })
      .then(setPerformance)
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setPerformanceError(formatApiError(err))
      })
      .finally(() => setPerformanceLoading(false))
    return () => controller.abort()
  }, [activeRange])

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
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
        <Icon name="portfolio" className="h-4 w-4 shrink-0 text-slate-400" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Portfolio Intelligence</span>
        <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">· Net worth, allocation, risk, and long-term wealth analysis</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
        </div>
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
        <SectionCard className="p-5">
          {performanceError ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{performanceError}</div>
          ) : (
            <PortfolioPerformanceChart
              data={performance}
              range={activeRange}
              onRangeChange={setActiveRange}
              privacyMode={privacyMode}
              loading={performanceLoading}
              variant="compact"
            />
          )}
        </SectionCard>

        <SectionCard title="Top Movers / Attention" className="p-5">
          {!intelligence ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading analysis...</div>
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Biggest Gainers</div>
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
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Biggest Losers</div>
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
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Attention</div>
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
          <div className="grid gap-3 sm:grid-cols-2">
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
