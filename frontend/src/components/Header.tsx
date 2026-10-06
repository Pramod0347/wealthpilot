import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from '../context/ThemeContext'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import Logo from './Logo'
import { apiFetch, type MarketOverviewItem } from '../lib/api'
import {
  useDashboardSummaryQuery,
  useMarketOverviewQuery,
  usePortfolioPerformanceQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { computeSnapshotComparison, formatSnapshotDate } from '../utils/snapshotDelta'

type MarketChipData = {
  name: string
  symbol: string
  price: number | string
  change: number | string
  change_pct: number | string
  currency: string
}

const FALLBACK_MARKETS: MarketChipData[] = [
  { name: 'NIFTY 50', symbol: '^NSEI', price: 23222, change: -144.9, change_pct: -0.62, currency: 'INR' },
  { name: 'SENSEX', symbol: '^BSESN', price: 76490, change: -451.2, change_pct: -0.59, currency: 'INR' },
  { name: 'GOLD 24K', symbol: 'GC=F', price: 76500, change: 320.0, change_pct: 0.42, currency: 'INR' },
  { name: 'SILVER 1KG', symbol: 'SI=F', price: 92800, change: 650.0, change_pct: 0.70, currency: 'INR' },
]

function formatMarketValue(value: number | string, currency: string, symbol: string) {
  let numVal = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numVal)) return String(value)

  // Gold 10g 24K sanity normalization:
  // In India, 10g 24K retail gold is ~₹75,000–₹78,000.
  // If upstream parsed article with ~₹1.5L, it calculated 20g/2 tolas.
  if (symbol === 'GC=F' && numVal > 115000 && numVal < 210000) {
    numVal = numVal / 2
  }
  // Silver 1kg sanity normalization:
  if (symbol === 'SI=F' && numVal > 180000 && numVal < 320000) {
    numVal = numVal / 2
  }

  if (symbol === '^NSEI' || symbol === '^BSESN') {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(numVal)
  }
  if (currency === 'USD') {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numVal)}`
  }
  if (currency === 'INR') {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(numVal)}`
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(numVal)
}

function formatChangePct(value: number | string) {
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return String(value)
  const sign = num > 0 ? '+' : ''
  return `${sign}${num.toFixed(2)}%`
}

function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`
}

function MarketTickerCard({
  name,
  price,
  change_pct,
  currency,
  symbol,
}: {
  name: string
  price: number | string
  change: number | string
  change_pct: number | string
  currency: string
  symbol: string
}) {
  const numericChangePct = typeof change_pct === 'number' ? change_pct : Number(change_pct)
  const isPositive = Number.isFinite(numericChangePct) && numericChangePct >= 0
  const displayName =
    symbol === 'GC=F' ? 'GOLD 24K' : symbol === 'SI=F' ? 'SILVER 1KG' : name

  return (
    <div className="group flex min-w-[124px] shrink-0 flex-col justify-between rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-2xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/95 dark:hover:border-slate-700">
      {/* Top row: Label + Trend Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          {displayName}
        </span>
        <span
          className={[
            'inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums leading-none',
            isPositive
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
          ].join(' ')}
        >
          {isPositive ? '↑' : '↓'} {formatChangePct(change_pct)}
        </span>
      </div>
      {/* Bottom row: Value */}
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
        {formatMarketValue(price, currency, symbol)}
      </div>
    </div>
  )
}

function MarketTickerSkeleton() {
  return (
    <div className="flex h-[48px] min-w-[124px] shrink-0 flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-100/90 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900/80 animate-pulse">
      <div className="flex items-center justify-between gap-2">
        <div className="h-2.5 w-12 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-2.5 w-8 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-1 h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  )
}

function mergeMarkets(apiMarkets: MarketOverviewItem[]) {
  return FALLBACK_MARKETS.map((fallback) => {
    const match = apiMarkets.find((item) => item.symbol === fallback.symbol)
    if (!match || match.error || match.price === null) return fallback
    return {
      name: match.name,
      symbol: match.symbol,
      price: match.price,
      change: match.change ?? fallback.change,
      change_pct: match.change_pct ?? fallback.change_pct,
      currency: match.currency,
    }
  })
}

function formatMarketTimestamp(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
    .format(parsed)
    .replace('AM', 'am')
    .replace('PM', 'pm')
}

export default function Header({
  className = '',
  title = 'Dashboard',
  subtitle = '',
  onLogout,
}: {
  className?: string
  title?: string
  subtitle?: string
  onLogout?: () => void
}) {
  const { isDark, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()

  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [snapshotJustSaved, setSnapshotJustSaved] = useState(false)

  // Market Indices Query
  const marketOverviewQuery = useMarketOverviewQuery()
  const marketResponse = marketOverviewQuery.data ?? []
  const markets = marketResponse.length > 0 ? mergeMarkets(marketResponse) : FALLBACK_MARKETS
  const isLoadingMarkets = marketOverviewQuery.isLoading
  const isStale = Boolean(marketOverviewQuery.error)
  const lastUpdated = useMemo(() => {
    const updatedTimes = marketResponse
      .filter((item) => !item.error && item.last_updated)
      .map((item) => item.last_updated)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    return updatedTimes[0] ?? null
  }, [marketResponse])

  // Portfolio Snapshot & Investments Valuation Query
  // Note: Portfolio snapshots record investment holdings valuation (current_value),
  // not net worth which additionally includes liquid cash, EPF, and fixed deposits.
  const performanceQuery = usePortfolioPerformanceQuery('ALL')
  const dashboardSummaryQuery = useDashboardSummaryQuery()

  const summary = dashboardSummaryQuery.data
  const investmentsValuation = typeof summary?.current_value === 'number'
    ? summary.current_value
    : Number(summary?.current_value ?? 0)
  const snapshots = performanceQuery.data?.snapshots

  const snapshotComparison = useMemo(() => {
    return computeSnapshotComparison(snapshots, investmentsValuation)
  }, [snapshots, investmentsValuation])

  // Trigger snapshot save directly from header
  async function handleSaveTodaySnapshot() {
    if (savingSnapshot) return
    setSavingSnapshot(true)
    try {
      await apiFetch('/api/portfolio/snapshots/today', { method: 'POST' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.portfolioIntelligence }),
      ])
      setSnapshotJustSaved(true)
      setTimeout(() => setSnapshotJustSaved(false), 3000)
    } catch (err) {
      console.error('Failed to record snapshot from header', err)
    } finally {
      setSavingSnapshot(false)
    }
  }

  const marketContent = useMemo(() => {
    if (isLoadingMarkets) {
      return Array.from({ length: 4 }, (_, i) => <MarketTickerSkeleton key={i} />)
    }
    return markets.map((chip) => <MarketTickerCard key={chip.symbol} {...chip} />)
  }, [isLoadingMarkets, markets])

  return (
    <header
      className={[
        'sticky top-0 z-30 shrink-0 border-b border-slate-200/90 dark:border-slate-800/80',
        'bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl',
        'px-4 lg:px-6 xl:px-8',
        className,
      ].join(' ')}
    >
      {/* ── MOBILE VIEW (< lg) ── */}
      <div className="lg:hidden">
        {/* Mobile Top Row: Logo, Title & Utility controls */}
        <div className="flex min-h-[64px] items-center justify-between gap-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo mobile />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {/* Mobile Snapshot Delta Badge */}
            {snapshotComparison ? (
              <button
                type="button"
                onClick={handleSaveTodaySnapshot}
                disabled={savingSnapshot}
                className={[
                  'inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold tabular-nums shadow-xs transition-all active:scale-95',
                  snapshotComparison.diffAmount >= 0
                    ? 'border-emerald-200/80 bg-emerald-50/80 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-rose-200/80 bg-rose-50/80 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400',
                ].join(' ')}
                title={`Snapshot comparison vs ${formatSnapshotDate(snapshotComparison.lastDate)}. Tap to record today.`}
              >
                <span className="text-[10px] font-bold uppercase opacity-75">Snap:</span>
                {privacyMode ? (
                  '•••'
                ) : (
                  <span className="font-mono font-semibold">
                    {snapshotComparison.diffAmount >= 0 ? '+' : ''}
                    {snapshotComparison.diffPct.toFixed(1)}%
                  </span>
                )}
              </button>
            ) : null}

            {/* Privacy Toggle */}
            <button
              type="button"
              onClick={togglePrivacyMode}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
              aria-label={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
              title={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
            >
              <Icon name={privacyMode ? 'viewOff' : 'view'} className="h-4 w-4" />
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile Market Strip */}
        <div className="border-t border-slate-100 py-2 dark:border-slate-800/80">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
            {marketContent}
          </div>
        </div>
      </div>

      {/* ── DESKTOP VIEW (lg+) ── */}
      <div className="hidden min-h-[68px] items-center justify-between gap-4 py-2 lg:flex">
        {/* Left: Page Title & Breadcrumb */}
        <div className="min-w-0 max-w-xs shrink-0">
          <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs font-medium text-slate-400 dark:text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        {/* Center: EXECUTIVE SNAPSHOT COMMAND CARD */}
        <div className="flex shrink-0 items-center justify-center">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-white/95 px-4.5 py-2 shadow-xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/95 dark:hover:border-slate-700">
            {/* Left Info: Label, Dot, Date, and Values */}
            <div className="flex flex-col">
              {/* Top row: Live Dot + Category Label + vs Date */}
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span
                    className={[
                      'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                      snapshotComparison && snapshotComparison.diffAmount >= 0 ? 'bg-emerald-400' : 'bg-rose-400',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'relative inline-flex h-2 w-2 rounded-full',
                      snapshotComparison && snapshotComparison.diffAmount >= 0 ? 'bg-emerald-500' : 'bg-rose-500',
                    ].join(' ')}
                  />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  Investments Snap Δ
                </span>
                {snapshotComparison && (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    vs {formatSnapshotDate(snapshotComparison.lastDate)}
                  </span>
                )}
              </div>

              {/* Bottom row: Bold Mono Delta + Return Badge */}
              <div className="mt-0.5 flex items-baseline gap-2">
                {privacyMode ? (
                  <span className="font-mono text-base font-semibold text-slate-400">••••••</span>
                ) : snapshotComparison ? (
                  <>
                    <span
                      className={[
                        'font-mono text-base font-semibold tabular-nums',
                        snapshotComparison.diffAmount >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {snapshotComparison.diffAmount >= 0 ? '+' : ''}
                      {formatMoney(snapshotComparison.diffAmount)}
                    </span>
                    <span
                      className={[
                        'inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
                        snapshotComparison.diffAmount >= 0
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
                      ].join(' ')}
                    >
                      {snapshotComparison.diffAmount >= 0 ? '↑ +' : '↓ '}
                      {snapshotComparison.diffPct.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-slate-400">No snapshot baseline</span>
                )}
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Fast Snapshot Record Action Button */}
            <button
              type="button"
              onClick={handleSaveTodaySnapshot}
              disabled={savingSnapshot}
              className={[
                'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 shadow-xs',
                snapshotJustSaved
                  ? 'bg-emerald-500 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
              ].join(' ')}
              title="Record today's net worth and holdings valuation snapshot"
            >
              <Icon
                name={savingSnapshot ? 'refresh' : snapshotJustSaved ? 'paid' : 'add'}
                className={['h-3.5 w-3.5', savingSnapshot ? 'animate-spin' : ''].join(' ')}
              />
              <span>{savingSnapshot ? 'Saving...' : snapshotJustSaved ? 'Saved!' : 'Record'}</span>
            </button>
          </div>
        </div>

        {/* Right: Structured Market Tickers & Utilities */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
          {/* Market Tickers Strip */}
          <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto">
            {marketContent}
          </div>

          {/* Live Status Indicator */}
          <div className="hidden shrink-0 items-center gap-1.5 pl-1 text-[11px] text-slate-500 dark:text-slate-400 xl:flex">
            <span
              className={['h-1.5 w-1.5 rounded-full', isStale ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')}
            />
            <span className="whitespace-nowrap">
              {isStale ? 'Stale' : 'Live'}
              {lastUpdated ? ` · ${formatMarketTimestamp(lastUpdated)}` : ''}
            </span>
          </div>

          <span className="hidden h-5 w-px bg-slate-200 dark:bg-slate-800 xl:inline" />

          {/* Privacy Toggle */}
          <button
            type="button"
            onClick={togglePrivacyMode}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
            title={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
          >
            <Icon name={privacyMode ? 'viewOff' : 'view'} className="h-4 w-4" />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
          </button>

          {/* Logout Action */}
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="hidden h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-xs transition-all hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white xl:inline-flex"
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
