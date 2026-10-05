import { useMemo } from 'react'
import type { WealthBucketItem } from '../../lib/api'
import { usePrivacyMode } from '../../context/PrivacyContext'
import { formatINR, formatINRShort, formatPct, formatSignedPct, formatUSD, getTrendClass } from '../../lib/format'
import PrivateValue from './PrivateValue'
import BottomSheet from './BottomSheet'
import { Icon, type IconName } from '../Icon'

type WealthBucket = {
  key: string
  label: string
  value: number
  percentage: number
  items: WealthBucketItem[]
}

const bucketConfig: Record<string, { label: string; icon: IconName; color: string; badgeCls: string }> = {
  ind_stocks: { label: 'Indian Stocks', icon: 'stocks', color: '#14b8a6', badgeCls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  us_stocks: { label: 'US Stocks', icon: 'portfolio', color: '#38bdf8', badgeCls: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  mutual_funds: { label: 'Mutual Funds', icon: 'portfolio', color: '#a78bfa', badgeCls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  banks: { label: 'Bank Accounts', icon: 'banks', color: '#f97316', badgeCls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  epf: { label: 'Fixed Savings / EPF', icon: 'pfepf', color: '#22c55e', badgeCls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  deposits: { label: 'Rental Deposits', icon: 'netWorth', color: '#eab308', badgeCls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  liabilities: { label: 'Card Liabilities', icon: 'cards', color: '#fb7185', badgeCls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  other: { label: 'Other Assets', icon: 'netWorth', color: '#64748b', badgeCls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}

function formatMoney(value: number): string {
  if (Math.abs(value) >= 100000) return formatINRShort(value)
  return formatINR(value)
}

function formatNativeValue(item: WealthBucketItem): string | null {
  if (item.native_value == null || !item.native_currency) return null
  const value = toNumber(item.native_value)
  if (item.native_currency === 'USD') return formatUSD(value)
  if (item.native_currency === 'INR') return formatINR(value)
  return `${item.native_currency} ${value.toFixed(2)}`
}

export default function WealthBucketModal({
  bucket,
  onClose,
}: {
  bucket: WealthBucket | null
  onClose: () => void
}) {
  const { privacyMode } = usePrivacyMode()

  const config = useMemo(() => {
    if (!bucket) return bucketConfig.other
    return bucketConfig[bucket.key] ?? bucketConfig.other
  }, [bucket])

  // Aggregate stats across bucket items
  const bucketStats = useMemo(() => {
    if (!bucket || !bucket.items.length) return null
    let totalPnl = 0
    let hasPnl = false
    let totalNativeUsd = 0
    let hasNativeUsd = false

    bucket.items.forEach((item) => {
      if (item.pnl != null) {
        totalPnl += toNumber(item.pnl)
        hasPnl = true
      }
      if (item.native_currency === 'USD' && item.native_value != null) {
        totalNativeUsd += toNumber(item.native_value)
        hasNativeUsd = true
      }
    })

    const totalValue = bucket.value
    const totalInvested = totalValue - totalPnl
    const returnPct = totalInvested > 0 && hasPnl ? (totalPnl / totalInvested) * 100 : null

    return {
      totalPnl: hasPnl ? totalPnl : null,
      returnPct,
      totalNativeUsd: hasNativeUsd ? totalNativeUsd : null,
      itemsCount: bucket.items.length,
    }
  }, [bucket])

  if (!bucket) return null

  return (
    <BottomSheet
      open={Boolean(bucket)}
      onClose={onClose}
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl"
              style={{ backgroundColor: `${config.color}20`, color: config.color }}
            >
              <Icon name={config.icon} className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{bucket.label}</h2>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{bucket.items.length} item{bucket.items.length === 1 ? '' : 's'}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {privacyMode ? '•••' : `${bucket.percentage.toFixed(1)}% of total assets`}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-white">
              <PrivateValue value={formatMoney(bucket.value)} mask="••••••" hideColor />
            </div>
            {bucketStats?.totalNativeUsd != null && (
              <div className="mt-0.5 font-mono text-xs font-medium text-slate-400">
                <PrivateValue value={formatUSD(bucketStats.totalNativeUsd)} mask="••••" hideColor />
              </div>
            )}
          </div>
        </div>

        {/* Bucket Stats Ribbon */}
        {bucketStats?.totalPnl != null && (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unrealized Gain / Loss</span>
              <div className={['mt-0.5 font-mono text-sm font-bold tabular-nums', getTrendClass(bucketStats.totalPnl)].join(' ')}>
                <PrivateValue
                  value={`${bucketStats.totalPnl >= 0 ? '+' : ''}${formatMoney(bucketStats.totalPnl)}`}
                  mask="••••"
                  hideColor
                />
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bucket Return</span>
              <div className={['mt-0.5 font-mono text-sm font-bold tabular-nums', bucketStats.returnPct != null ? getTrendClass(bucketStats.returnPct) : ''].join(' ')}>
                <PrivateValue
                  value={bucketStats.returnPct != null ? formatSignedPct(bucketStats.returnPct) : '—'}
                  mask="••••"
                  hideColor
                />
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        {bucket.items.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No items recorded in this bucket yet.</div>
        ) : (
          <div className="space-y-3">
            {bucket.items.map((item) => {
              const itemVal = toNumber(item.value)
              const pnl = item.pnl == null ? null : toNumber(item.pnl)
              const returnPct = item.return_pct == null ? null : toNumber(item.return_pct)
              const nativeValue = formatNativeValue(item)
              const weightInBucket = bucket.value > 0 ? (itemVal / bucket.value) * 100 : 0

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.symbol && (
                          <span
                            className="rounded-lg px-2 py-0.5 font-mono text-xs font-bold"
                            style={{ backgroundColor: `${config.color}20`, color: config.color }}
                          >
                            {item.symbol}
                          </span>
                        )}
                        <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 uppercase">
                            {item.badge}
                          </span>
                        )}
                      </div>

                      {item.meta && (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {item.meta}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-base font-bold tabular-nums text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(itemVal)} mask="••••" hideColor />
                      </div>
                      {nativeValue && (
                        <div className="mt-0.5 font-mono text-xs font-medium text-slate-400">
                          <PrivateValue value={nativeValue} mask="••••" hideColor />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-bar: Weight & P&L */}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Bucket share:</span>
                      <span className="font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {privacyMode ? '•••' : `${weightInBucket.toFixed(1)}%`}
                      </span>
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <div
                          style={{ width: `${Math.min(weightInBucket, 100)}%`, backgroundColor: config.color }}
                          className="h-full rounded-full"
                        />
                      </div>
                    </div>

                    {pnl != null || returnPct != null ? (
                      <div className="flex items-center gap-2">
                        {pnl != null && (
                          <span className={['font-mono font-semibold tabular-nums', getTrendClass(pnl)].join(' ')}>
                            <PrivateValue
                              value={`${pnl >= 0 ? '+' : ''}${formatMoney(pnl)}`}
                              mask="••••"
                              hideColor
                            />
                          </span>
                        )}
                        {returnPct != null && (
                          <span
                            className={[
                              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums',
                              returnPct >= 0
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400',
                            ].join(' ')}
                          >
                            <span>{returnPct >= 0 ? '↑' : '↓'}</span>
                            <PrivateValue value={formatPct(Math.abs(returnPct))} mask="•••" hideColor />
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

