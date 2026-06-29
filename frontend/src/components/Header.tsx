import { useMemo } from 'react'
import { getTrendClass } from '../lib/format'
import { useTheme } from '../context/ThemeContext'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import Logo from './Logo'
import { type MarketOverviewItem } from '../lib/api'
import { useMarketOverviewQuery } from '../queries/hooks'

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
  { name: 'GOLD', symbol: 'GC=F', price: 98450, change: 420.0, change_pct: 0.43, currency: 'INR' },
  { name: 'SILVER', symbol: 'SI=F', price: 109200, change: 840.0, change_pct: 0.78, currency: 'INR' },
]

function formatMarketValue(value: number | string, currency: string, symbol: string) {
  if (typeof value === 'string') return value
  if (symbol === '^NSEI' || symbol === '^BSESN') {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
  }
  if (currency === 'USD') {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`
  }
  if (currency === 'INR') {
    return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)}`
  }
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value)
}

function formatChangePct(value: number | string) {
  if (typeof value === 'string') return value
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function MarketChip({
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
  const toneClass = Number.isFinite(numericChangePct)
    ? getTrendClass(numericChangePct)
    : 'text-slate-500 dark:text-slate-400'
  const arrow = Number.isFinite(numericChangePct) ? (numericChangePct > 0 ? '↑' : numericChangePct < 0 ? '↓' : '•') : '•'
  const displayName = symbol === 'GC=F' ? 'GOLD 10G 24K' : symbol === 'SI=F' ? 'SILVER 1KG' : name

  return (
    <div className="flex h-12 min-w-[136px] shrink-0 flex-col justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm">
      <div className="flex items-center justify-between gap-2 text-[12px] leading-none">
        <span className="truncate font-medium text-slate-600 dark:text-slate-300">{displayName}</span>
        <span className={['font-semibold text-[11px]', toneClass].join(' ')}>
          {`${arrow} ${formatChangePct(change_pct)}`}
        </span>
      </div>
      <div className="mt-1.5 font-mono text-[15px] font-semibold leading-none tabular-nums text-slate-900 dark:text-white">
        {formatMarketValue(price, currency, symbol)}
      </div>
    </div>
  )
}

function MarketChipSkeleton() {
  return (
    <div className="flex h-12 min-w-[148px] shrink-0 animate-pulse flex-col justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="h-3 w-14 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-10 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="mt-1.5 h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-700" />
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

  const marketContent = useMemo(() => {
    if (isLoadingMarkets) {
      return Array.from({ length: 4 }, (_, i) => <MarketChipSkeleton key={i} />)
    }
    return markets.map((chip) => <MarketChip key={chip.symbol} {...chip} />)
  }, [isLoadingMarkets, markets])

  return (
    <header
      className={[
        'shrink-0 border-b border-slate-200 dark:border-slate-800',
        'bg-white/80 dark:bg-slate-950/95 backdrop-blur-md',
        'px-4 lg:px-6 xl:px-8',
        className,
      ].join(' ')}
    >
      <div className="lg:hidden">
        <div className="flex min-h-[76px] items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Logo mobile />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold tracking-[-0.25px] leading-none text-slate-900 dark:text-white">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 truncate pr-2 text-[12px] text-slate-500 dark:text-slate-400">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={togglePrivacyMode}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
              aria-label={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
              title={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
            >
              <Icon name={privacyMode ? 'viewOff' : 'view'} className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/80 py-3 dark:border-slate-800">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            {marketContent}
          </div>
          <div className="mt-2 flex items-center gap-1.5 pl-0.5 text-[11px] text-slate-500 dark:text-slate-500">
            <span className={['h-1.5 w-1.5 rounded-full', isStale ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')} />
            <span className="whitespace-nowrap">
              {isStale ? 'Stale' : 'Live'}
              {lastUpdated ? ` · ${formatMarketTimestamp(lastUpdated)}` : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="hidden min-h-[76px] items-center justify-between gap-6 py-3 lg:flex">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-[-0.25px] leading-none text-slate-900 dark:text-white">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 truncate pr-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto">
            {marketContent}
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500 2xl:flex">
            <span className={['h-1.5 w-1.5 rounded-full', isStale ? 'bg-amber-400' : 'bg-emerald-400'].join(' ')} />
            <span className="whitespace-nowrap">
              {isStale ? 'Stale' : 'Live'}
              {lastUpdated ? ` · ${formatMarketTimestamp(lastUpdated)}` : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={togglePrivacyMode}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
            title={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
          >
            <Icon name={privacyMode ? 'viewOff' : 'view'} className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
          </button>

          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="hidden h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition-all duration-150 hover:border-slate-300 hover:text-slate-900 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white xl:inline-flex"
              aria-label="Log out"
              title="Log out"
            >
              <Icon name="logout" className="h-4 w-4" />
              <span>Logout</span>
            </button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
