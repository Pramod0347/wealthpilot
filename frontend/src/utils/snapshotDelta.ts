export type SnapshotComparison = {
  hasComparison: boolean
  lastDate: string
  lastValue: number
  presentValue: number
  diffAmount: number
  diffPct: number
}

export function formatSnapshotDate(dateStr: string): string {
  if (!dateStr) return ''
  const clean = String(dateStr).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    const year = Number(parts[0])
    const month = Number(parts[1]) - 1
    const day = Number(parts[2])
    const d = new Date(year, month, day)
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d)
  }
  return dateStr
}

export function computeSnapshotComparison(
  snapshots: Array<{ date: string; total_value: string | number }> | undefined,
  presentValue: number
): SnapshotComparison | null {
  if (!snapshots || snapshots.length === 0) {
    return null
  }

  // Filter valid snapshots and sort ascending by date
  const sorted = [...snapshots]
    .filter((s) => Number(s.total_value) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  if (sorted.length === 0) {
    return null
  }

  const cleanDate = (d: string | unknown) => String(d ?? '').slice(0, 10)

  // Local & UTC date strings (YYYY-MM-DD)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const localTodayStr = `${year}-${month}-${day}`
  const utcTodayStr = now.toISOString().slice(0, 10)

  const latestSnap = sorted[sorted.length - 1]
  const latestDate = cleanDate(latestSnap.date)
  const isLatestFromToday = latestDate === localTodayStr || latestDate === utcTodayStr

  let lastSnap = null
  let effectivePresent = presentValue > 0 ? presentValue : Number(latestSnap.total_value)

  if (isLatestFromToday && sorted.length >= 2) {
    // If today's snapshot was already saved, compare today's live/snapshot value against the prior snapshot
    lastSnap = sorted[sorted.length - 2]
  } else if (!isLatestFromToday) {
    // Today's snapshot hasn't been recorded yet, compare today's live value against the latest recorded snapshot
    lastSnap = latestSnap
  } else {
    // Only 1 snapshot exists and it is from today
    lastSnap = latestSnap
  }

  if (!lastSnap) {
    return null
  }

  const lastValue = Number(lastSnap.total_value)
  if (!lastValue || Number.isNaN(lastValue) || lastValue <= 0) {
    return null
  }

  if (effectivePresent <= 0) {
    effectivePresent = lastValue
  }

  const diffAmount = effectivePresent - lastValue
  const diffPct = (diffAmount / lastValue) * 100

  return {
    hasComparison: true,
    lastDate: String(lastSnap.date),
    lastValue,
    presentValue: effectivePresent,
    diffAmount,
    diffPct,
  }
}

