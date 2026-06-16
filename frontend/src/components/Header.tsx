import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
import { getTrendClass } from '../lib/format'
import { useTheme } from '../context/ThemeContext'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'

type MarketOverviewItem = {
  name: string
  symbol: string
  price: number | null
  change: number | null
  change_pct: number | null
  currency: string
  source: 'yfinance'
  last_updated: string
  error?: string | null
}

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
    <div className="flex h-12 min-w-[148px] shrink-0 flex-col justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 shadow-sm">
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
}: {
  className?: string
  title?: string
  subtitle?: string
}) {
  const { isDark, toggleTheme } = useTheme()
  const { privacyMode, togglePrivacyMode } = usePrivacyMode()
  const [markets, setMarkets] = useState<MarketChipData[]>(FALLBACK_MARKETS)
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let intervalId: number | undefined

    async function loadMarkets(isInitialLoad: boolean) {
      if (isInitialLoad) setIsLoadingMarkets(true)
      try {
        const response = await apiFetch<MarketOverviewItem[]>('/api/market/overview')
        if (!isMounted) return
        setMarkets(mergeMarkets(response))
        setIsStale(false)
        const updatedTimes = response
          .filter((item) => !item.error && item.last_updated)
          .map((item) => item.last_updated)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
        if (updatedTimes[0]) setLastUpdated(updatedTimes[0])
      } catch {
        if (!isMounted) return
        setIsStale(true)
        if (isInitialLoad) setMarkets(FALLBACK_MARKETS)
      } finally {
        if (isMounted && isInitialLoad) setIsLoadingMarkets(false)
      }
    }

    void loadMarkets(true)
    intervalId = window.setInterval(() => void loadMarkets(false), 60_000)
    return () => {
      isMounted = false
      if (intervalId !== undefined) window.clearInterval(intervalId)
    }
  }, [])

  const marketContent = useMemo(() => {
    if (isLoadingMarkets) {
      return Array.from({ length: 4 }, (_, i) => <MarketChipSkeleton key={i} />)
    }
    return markets.map((chip) => <MarketChip key={chip.symbol} {...chip} />)
  }, [isLoadingMarkets, markets])

  return (
    <header
      className={[
        'h-16 shrink-0 border-b border-slate-200 dark:border-slate-800',
        'bg-white/80 dark:bg-slate-950/95 backdrop-blur-md',
        'px-6 xl:px-8',
        className,
      ].join(' ')}
    >
      <div className="flex h-full items-center justify-between gap-4">
        {/* Page title */}
        <div className="min-w-0 shrink-0">
          <h1 className="truncate text-lg font-bold tracking-[-0.25px] text-slate-900 dark:text-white leading-none">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        {/* Right side: market chips + status + theme toggle */}
        <div className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="no-scrollbar hidden items-center gap-2 overflow-x-auto lg:flex">
            {marketContent}
          </div>

          <div className="hidden shrink-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-500 xl:flex">
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                isStale ? 'bg-amber-400' : 'bg-emerald-400',
              ].join(' ')}
            />
            <span className="whitespace-nowrap">
              {isStale ? 'Stale' : 'Live'}
              {lastUpdated ? ` · ${formatMarketTimestamp(lastUpdated)}` : ''}
            </span>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white active:scale-95"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={togglePrivacyMode}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm transition-all duration-150 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white active:scale-95"
            aria-label={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
            title={privacyMode ? 'Show sensitive values' : 'Hide sensitive values'}
          >
            <Icon name={privacyMode ? 'viewOff' : 'view'} className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
