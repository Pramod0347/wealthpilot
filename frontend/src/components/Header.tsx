import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
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
  { name: 'GOLD', symbol: 'GC=F', price: 98450, change: 420.0, change_pct: 0.43, currency: 'USD' },
  { name: 'SILVER', symbol: 'SI=F', price: 109200, change: 840.0, change_pct: 0.78, currency: 'USD' },
]

function formatMarketValue(value: number | string, currency: string, symbol: string) {
  if (typeof value === 'string') {
    return value
  }

  if (symbol === '^NSEI' || symbol === '^BSESN') {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(value)
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
  if (typeof value === 'string') {
    return value
  }

  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function MarketChip({
  name,
  price,
  change,
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
  const positive = Number.isFinite(numericChangePct) ? numericChangePct >= 0 : true

  return (
    <div className="flex h-12 min-w-[150px] shrink-0 flex-col justify-center rounded-xl border border-slate-700/70 bg-slate-900/70 px-4 py-2">
      <div className="flex items-center justify-between gap-3 text-[13px] leading-none">
        <span className="truncate font-medium text-slate-300">{name}</span>
        <span className={['font-medium', positive ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
          {positive ? '↑' : '↓'} {formatChangePct(change_pct)}
        </span>
      </div>
      <div className="mt-2 text-[17px] font-semibold leading-none text-white">{formatMarketValue(price, currency, symbol)}</div>
    </div>
  )
}

function MarketChipSkeleton() {
  return (
    <div className="flex h-12 min-w-[150px] shrink-0 animate-pulse flex-col justify-center rounded-xl border border-slate-700/70 bg-slate-900/60 px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="h-3.5 w-16 rounded bg-slate-700/80" />
        <div className="h-3.5 w-12 rounded bg-slate-700/80" />
      </div>
      <div className="mt-2 h-4 w-20 rounded bg-slate-700/80" />
    </div>
  )
}

function mergeMarkets(apiMarkets: MarketOverviewItem[]) {
  return FALLBACK_MARKETS.map((fallback) => {
    const match = apiMarkets.find((item) => item.symbol === fallback.symbol)
    if (!match || match.error || match.price === null) {
      return fallback
    }

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
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(parsed)
}

export default function Header({
  className = '',
  title = 'Dashboard',
  subtitle = 'Personal finance dashboard • Updated 10 Jun 2026, 3:30 PM IST',
}: {
  className?: string
  title?: string
  subtitle?: string
}) {
  const [markets, setMarkets] = useState<MarketChipData[]>(FALLBACK_MARKETS)
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(true)
  const [isStale, setIsStale] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    let intervalId: number | undefined

    async function loadMarkets(isInitialLoad: boolean) {
      if (isInitialLoad) {
        setIsLoadingMarkets(true)
      }

      try {
        const response = await apiFetch<MarketOverviewItem[]>('/api/market/overview')
        if (!isMounted) {
          return
        }

        setMarkets(mergeMarkets(response))
        setIsStale(false)
        const updatedTimes = response
          .filter((item) => !item.error && item.last_updated)
          .map((item) => item.last_updated)
          .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())
        if (updatedTimes[0]) {
          setLastUpdated(updatedTimes[0])
        }
      } catch {
        if (!isMounted) {
          return
        }

        setIsStale(true)
        if (isInitialLoad) {
          setMarkets(FALLBACK_MARKETS)
        }
      } finally {
        if (isMounted && isInitialLoad) {
          setIsLoadingMarkets(false)
        }
      }
    }

    void loadMarkets(true)
    intervalId = window.setInterval(() => {
      void loadMarkets(false)
    }, 60_000)

    return () => {
      isMounted = false
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
      }
    }
  }, [])

  const marketContent = useMemo(() => {
    if (isLoadingMarkets) {
      return Array.from({ length: 4 }, (_, index) => <MarketChipSkeleton key={index} />)
    }

    return markets.map((chip) => <MarketChip key={chip.symbol} {...chip} />)
  }, [isLoadingMarkets, markets])

  return (
    <header className={['h-[76px] shrink-0 border-b border-slate-800 bg-slate-950/95 px-8', className].join(' ')}>
      <div className="flex h-full items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-white">{title}</h1>
          <p className="mt-1 truncate text-sm text-slate-400">{subtitle}</p>
        </div>

        <div className="flex min-w-0 items-center gap-3 overflow-x-auto">
          <div className="no-scrollbar flex items-center gap-3 overflow-x-auto">{marketContent}</div>

          <div className="hidden shrink-0 items-center gap-2 text-[11px] text-slate-500 xl:flex">
            <span className={['h-1.5 w-1.5 rounded-full', isStale ? 'bg-amber-400/80' : 'bg-emerald-400/80'].join(' ')} />
            <span className="whitespace-nowrap">
              {isStale ? 'Stale' : 'Live'}
              {lastUpdated ? ` • ${formatMarketTimestamp(lastUpdated)}` : ''}
            </span>
          </div>

          <button
            type="button"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-slate-700/70 bg-slate-900/70 text-slate-300 transition-all duration-200 ease-out hover:bg-slate-800/80 hover:text-white active:scale-[0.98] motion-reduce:transition-none"
            aria-label="Theme toggle"
          >
            <Icon name="sun" className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
