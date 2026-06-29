import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PortfolioPerformanceData, PortfolioRange } from '../../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../../lib/format'
import { Icon } from '../Icon'
import PrivateValue from './PrivateValue'

type ChartRow = {
  x: number
  date: string
  label: string
  actual_value: number | null
  estimated_value: number | null
  kind: 'actual' | 'estimated'
}

type PortfolioPerformanceChartProps = {
  data: PortfolioPerformanceData | null
  range: PortfolioRange
  onRangeChange: (range: PortfolioRange) => void
  privacyMode: boolean
  onSaveSnapshot?: () => void
  loading: boolean
  savingSnapshot?: boolean
  title?: string
  description?: string | null
  variant?: 'default' | 'compact'
}

const rangeFilters: Array<{ label: string; value: PortfolioRange }> = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'All', value: 'ALL' },
]

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatMoney(value: number) {
  return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value)
}

function formatMonthDay(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value)
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(value)
}

function formatMonthYear(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(value)
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function tickFormatter(range: PortfolioRange, value: number, spanDays: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  if (range === '1M') return formatMonthDay(date)
  if (range === '3M') return formatMonth(date)
  if (range === '6M') return formatMonth(date)
  if (range === '1Y') return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date)
  return spanDays >= 365 ? formatMonthYear(date) : formatMonth(date)
}

function buildChartRows(data: PortfolioPerformanceData | null): ChartRow[] {
  if (!data) return []
  const rows = new Map<string, ChartRow>()
  data.snapshots.forEach((snapshot) => {
    const x = parseDate(snapshot.date).getTime()
    rows.set(snapshot.date, {
      x,
      date: snapshot.date,
      label: snapshot.date,
      actual_value: toNumber(snapshot.total_value),
      estimated_value: rows.get(snapshot.date)?.estimated_value ?? null,
      kind: 'actual',
    })
  })
  data.prediction.points.forEach((point) => {
    const x = parseDate(point.date).getTime()
    const existing = rows.get(point.date)
    rows.set(point.date, {
      x,
      date: point.date,
      label: point.date,
      actual_value: existing?.actual_value ?? null,
      estimated_value: toNumber(point.estimated_value),
      kind: 'estimated',
    })
  })
  return Array.from(rows.values()).sort((left, right) => left.x - right.x)
}

export default function PortfolioPerformanceChart({
  data,
  range,
  onRangeChange,
  privacyMode,
  onSaveSnapshot,
  loading,
  savingSnapshot = false,
  title = 'Portfolio Performance',
  description = null,
  variant = 'default',
}: PortfolioPerformanceChartProps) {
  const chartRows = useMemo(() => buildChartRows(data), [data])
  const startDate = data ? parseDate(data.start_date) : null
  const endDate = data ? parseDate(data.end_date) : null
  const lastPredictionDate = data?.prediction.points.length ? parseDate(data.prediction.points[data.prediction.points.length - 1].date) : null
  const domainStart = startDate?.getTime() ?? Date.now()
  const domainEnd = (lastPredictionDate ?? endDate)?.getTime() ?? Date.now()
  const spanDays = startDate && endDate ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000)) : 1

  const yDomain = useMemo(() => {
    const values = chartRows.flatMap((row) => [row.actual_value, row.estimated_value]).filter((value): value is number => value !== null)
    if (values.length === 0) return ['auto', 'auto'] as const
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const spread = Math.max(maxValue - minValue, Math.abs(maxValue) * 0.05, 1)
    return [minValue - spread * 0.08, maxValue + spread * 0.08] as const
  }, [chartRows])

  const hasSnapshots = (data?.summary.snapshot_count ?? 0) > 0
  const predictionAvailable = Boolean(data?.prediction.available)
  const latestValue = data?.summary.latest_value == null ? null : toNumber(data.summary.latest_value)
  const changeAmount = data?.summary.change_amount == null ? null : toNumber(data.summary.change_amount)
  const changePct = data?.summary.change_pct == null ? null : toNumber(data.summary.change_pct)
  const projectedValue = data?.summary.projected_value == null ? null : toNumber(data.summary.projected_value)
  const projectedChangePct = data?.summary.projected_change_pct == null ? null : toNumber(data.summary.projected_change_pct)
  const firstValue = data?.summary.first_value == null ? null : toNumber(data.summary.first_value)
  const latestActualValue = latestValue
  const hasAnyData = Boolean(data)
  const emptyReason = data?.prediction.reason ?? 'Save more snapshots to unlock estimates.'
  const helperText =
    description ??
    (predictionAvailable
      ? 'Projection is based only on your saved snapshot trend.'
      : emptyReason)
  const isCompact = variant === 'compact'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">{title}</div>
          <div className="mt-1 max-w-2xl text-xs font-medium text-slate-400 dark:text-slate-400">{helperText}</div>
        </div>
        <div className="no-scrollbar -mx-1 flex overflow-x-auto px-1 sm:mx-0 sm:px-0">
          <div className="flex min-w-max items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {rangeFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onRangeChange(filter.value)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-150',
                range === filter.value ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200',
              ].join(' ')}
            >
              {filter.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {isCompact ? (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/30 xl:grid-cols-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Latest</div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
              {latestValue === null ? '—' : <PrivateValue value={formatMoney(latestValue)} mask="••••" hideColor />}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Change</div>
            <div className={['mt-1 font-mono text-base font-semibold tabular-nums', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(changePct ?? 0)].join(' ')}>
              {changePct === null ? '—' : <PrivateValue value={formatSignedPct(changePct)} mask="••••" hideColor />}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Snapshots</div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">{data?.summary.snapshot_count ?? 0}</div>
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
              {range === '1M' ? 'Est. 7D' : range === '3M' ? 'Est. 30D' : range === '6M' ? 'Est. 60D' : 'Est. 90D'}
            </div>
            <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
              {projectedValue === null ? '—' : <PrivateValue value={formatMoney(projectedValue)} mask="••••" hideColor />}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Latest Value</div>
            <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
              {latestValue === null ? '—' : <PrivateValue value={formatMoney(latestValue)} mask="••••" hideColor />}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Change</div>
            <div className={['mt-2 font-mono text-base font-semibold tabular-nums', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(changeAmount ?? 0)].join(' ')}>
              {changeAmount === null ? '—' : <PrivateValue value={formatMoney(changeAmount)} mask="••••" hideColor />}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Change %</div>
            <div className={['mt-2 font-mono text-base font-semibold tabular-nums', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(changePct ?? 0)].join(' ')}>
              {changePct === null ? '—' : <PrivateValue value={formatSignedPct(changePct)} mask="••••" hideColor />}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">Snapshot Count</div>
            <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">{data?.summary.snapshot_count ?? 0}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-500">
              {range === '1M' ? 'Estimated 7D Value' : range === '3M' ? 'Estimated 30D Value' : range === '6M' ? 'Estimated 60D Value' : 'Estimated 90D Value'}
            </div>
            <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white">
              {projectedValue === null ? '—' : <PrivateValue value={formatMoney(projectedValue)} mask="••••" hideColor />}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-400 dark:text-slate-400">
              {predictionAvailable ? `Based on ${data?.prediction.method.replaceAll('_', ' ')}` : 'More snapshots needed for prediction'}
            </div>
          </div>
        </div>
      )}

      {predictionAvailable ? (
        <div className={['flex flex-wrap items-center text-xs font-medium text-slate-400 dark:text-slate-400', isCompact ? 'gap-2 sm:gap-3' : 'gap-2'].join(' ')}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-300">
            <Icon name="analytics" className="h-3.5 w-3.5" />
            Estimated Growth
          </span>
          <span>Confidence: {data?.prediction.confidence ?? 'low'}</span>
          {projectedChangePct === null ? null : (
            <span className={privacyMode ? 'text-slate-400' : getTrendClass(projectedChangePct)}>
              <PrivateValue value={formatSignedPct(projectedChangePct)} mask="••••" hideColor />
            </span>
          )}
        </div>
      ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm font-medium tracking-[-0.01em] text-slate-400 dark:border-slate-700 dark:text-slate-400">
          <div className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
            {!hasAnyData
              ? 'Loading chart...'
              : hasSnapshots
                ? (data?.summary.snapshot_count ?? 0) < 3
                  ? 'Add more snapshots to estimate growth.'
                  : 'More snapshots needed for prediction'
                : emptyReason}
          </div>
          {hasAnyData ? <div className="mt-1">{emptyReason}</div> : null}
        </div>
      )}

      {loading ? (
        <div className={['flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40', isCompact ? 'h-[200px] sm:h-[240px]' : 'h-[240px] sm:h-[280px]'].join(' ')}>
          <span className="text-sm font-medium tracking-[-0.01em] text-slate-400">Loading chart…</span>
        </div>
      ) : !hasSnapshots ? null : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-slate-400 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" />Actual</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Estimated</span>
          </div>
          <div className={isCompact ? 'h-[200px] sm:h-[240px]' : 'h-[240px] sm:h-[280px]'}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows} margin={isCompact ? { top: 8, right: 4, left: -10, bottom: 0 } : { top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis
                  dataKey="x"
                  type="number"
                  domain={[domainStart, domainEnd]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: isCompact ? 10 : 11 }}
                  tickFormatter={(value) => tickFormatter(range, Number(value), spanDays)}
                  minTickGap={24}
                  tickCount={isCompact ? (range === '1M' ? 4 : 4) : range === '1M' ? 6 : range === '3M' ? 4 : range === '6M' ? 6 : range === '1Y' ? 6 : 6}
                />
                <YAxis
                  type="number"
                  domain={yDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#64748b', fontSize: isCompact ? 10 : 11 }}
                  width={isCompact ? 58 : 76}
                  tickFormatter={(value) => (privacyMode ? '••••' : formatINRShort(Number(value)))}
                />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(51,65,85,0.7)', borderRadius: '12px', color: '#fff' }}
                  labelFormatter={(value) => `Date: ${formatMonthDay(new Date(Number(value)))}`}
                  formatter={(value, name, item) => {
                    const row = item.payload as ChartRow
                    if (name === 'estimated_value') {
                      const estimatedValue = Number(value)
                      const estimatedChange = latestActualValue === null ? null : estimatedValue - latestActualValue
                      const estimatedChangePct = latestActualValue && latestActualValue > 0 ? (estimatedChange ?? 0) / latestActualValue * 100 : null
                      const label = estimatedChangePct === null
                        ? 'Estimated'
                        : `Estimated (${privacyMode ? '••••' : formatSignedPct(estimatedChangePct)})`
                      return [privacyMode ? '••••' : formatINR(estimatedValue), label]
                    }
                    const actualValue = Number(value)
                    const actualChange = firstValue === null ? null : actualValue - firstValue
                    const actualChangePct = firstValue && firstValue > 0 ? (actualChange ?? 0) / firstValue * 100 : null
                    const label = actualChangePct === null
                      ? 'Portfolio Value'
                      : `Portfolio Value (${privacyMode ? '••••' : formatSignedPct(actualChangePct)})`
                    return [privacyMode ? '••••' : formatINR(actualValue), label]
                  }}
                />
                <Line type="monotone" dataKey="actual_value" name="Actual" stroke="#14b8a6" strokeWidth={2.25} dot={false} connectNulls />
                <Line type="monotone" dataKey="estimated_value" name="Estimated" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="6 4" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {onSaveSnapshot ? (
        <div className="flex justify-center border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onSaveSnapshot}
            disabled={savingSnapshot}
            className="text-sm font-medium tracking-[-0.01em] text-teal-500 transition-colors hover:text-teal-600 disabled:opacity-50 dark:text-teal-400 dark:hover:text-teal-300"
          >
            {savingSnapshot ? 'Saving…' : 'Save Snapshot'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
