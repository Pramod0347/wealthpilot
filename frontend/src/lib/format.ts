const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const shortInrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const pctFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
})

export function formatINR(value: number) {
  return inrFormatter.format(value)
}

export function formatINRShort(value: number) {
  const abs = Math.abs(value)
  const suffix = abs >= 10000000 ? ' Cr' : abs >= 100000 ? ' L' : ''
  const scaled = abs >= 10000000 ? value / 10000000 : abs >= 100000 ? value / 100000 : value
  const formatted = shortInrFormatter.format(scaled)
  return `${formatted}${suffix}`
}

export function formatPct(value: number) {
  return `${pctFormatter.format(Math.abs(value))}%`
}
