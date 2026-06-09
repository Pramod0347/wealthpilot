type IconName =
  | 'grid'
  | 'briefcase'
  | 'trending'
  | 'card'
  | 'swap'
  | 'bars'
  | 'file'
  | 'settings'
  | 'chevronL'
  | 'chevronD'
  | 'search'
  | 'calendar'
  | 'sun'
  | 'bell'
  | 'refresh'
  | 'plus'
  | 'wallet'
  | 'chart'

const ICONS: Record<IconName, string> = {
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  briefcase: 'M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 8V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3M3 13h18',
  trending: 'M3 17l6-6 4 4 8-8M21 7v6h-6',
  card: 'M2 6h20v12H2zM2 10h20M6 15h4',
  swap: 'M7 10l-4 4 4 4M3 14h13M17 14l4-4-4-4M21 10H8',
  bars: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  file: 'M6 2h9l5 5v15H6zM15 2v5h5M9 13h6M9 17h6',
  settings: 'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h7M15 18h5M14 4v4M8 10v4M11 16v4',
  chevronL: 'M15 6l-6 6 6 6',
  chevronD: 'M6 9l6 6 6-6',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M21 21l-4.3-4.3',
  calendar: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M6 6L4.5 4.5M19.5 19.5 18 18M18 6l1.5-1.5M4.5 19.5 6 18M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8',
  bell: 'M6 9a6 6 0 0 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M9 21h6',
  refresh: 'M3 12a9 9 0 0 1 15-6.6L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.6L3 16M3 21v-5h5',
  plus: 'M12 5v14M5 12h14',
  wallet: 'M3 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l2-3h11l2 3M17 13h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
}

export default function Icon({
  name,
  className = '',
  stroke = 2,
}: {
  name: IconName
  className?: string
  stroke?: number
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

export type { IconName }
