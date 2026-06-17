import type { WealthBucketItem } from '../../lib/api'
import { usePrivacyMode } from '../../context/PrivacyContext'
import { formatINR, formatINRShort, formatPct, formatUSD } from '../../lib/format'
import PrivateValue from './PrivateValue'
import BottomSheet from './BottomSheet'

type WealthBucket = {
  key: string
  label: string
  value: number
  percentage: number
  items: WealthBucketItem[]
}

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatMoney(value: number) {
  return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value)
}

function formatNativeValue(item: WealthBucketItem) {
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

  if (!bucket) return null

  return (
    <BottomSheet
      open={Boolean(bucket)}
      onClose={onClose}
      title={bucket.label}
      subtitle={privacyMode ? '•••• · ••••' : `${formatMoney(bucket.value)} · ${formatPct(bucket.percentage)}`}
      className="sm:max-w-lg"
    >
      {bucket.items.length === 0 ? (
        <div className="py-6 text-sm text-slate-500 dark:text-slate-400">No items in this bucket yet.</div>
      ) : (
        <div className="space-y-3">
          {bucket.items.map((item) => {
            const pnl = item.pnl == null ? null : toNumber(item.pnl)
            const returnPct = item.return_pct == null ? null : toNumber(item.return_pct)
            const nativeValue = formatNativeValue(item)
            return (
              <div key={`${item.type}-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                        {item.symbol ? `${item.symbol} · ${item.name}` : item.name}
                      </div>
                      {item.badge ? (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {item.badge}
                        </span>
                      ) : null}
                    </div>
                    {item.meta ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.meta}</div> : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(item.value))} mask="••••" hideColor />
                    </div>
                    {nativeValue ? (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <PrivateValue value={nativeValue} mask="••••" hideColor />
                      </div>
                    ) : null}
                  </div>
                </div>

                {pnl !== null || returnPct !== null ? (
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs dark:border-slate-700/50">
                    <div className={privacyMode ? 'text-slate-400 dark:text-slate-400' : pnl !== null && pnl > 0 ? 'text-emerald-400' : pnl !== null && pnl < 0 ? 'text-rose-400' : 'text-slate-400 dark:text-slate-400'}>
                      <PrivateValue value={pnl !== null ? formatMoney(pnl) : '—'} mask="••••" hideColor />
                    </div>
                    <div className={privacyMode ? 'text-slate-400 dark:text-slate-400' : returnPct !== null && returnPct > 0 ? 'text-emerald-400' : returnPct !== null && returnPct < 0 ? 'text-rose-400' : 'text-slate-400 dark:text-slate-400'}>
                      <PrivateValue value={returnPct !== null ? formatPct(returnPct) : '—'} mask="••••" hideColor />
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </BottomSheet>
  )
}
