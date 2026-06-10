import type { ComponentProps } from 'react'
import { Icon } from './Icon'

function ControlChip({
  icon,
  label,
  className = '',
}: {
  icon: ComponentProps<typeof Icon>['name']
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      className={[
        'flex h-[56px] items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-nav text-slate-200 transition-colors hover:bg-white/5 hover:text-white',
        className,
      ].join(' ')}
    >
      <Icon name={icon} className="h-5 w-5 shrink-0 text-slate-400" />
      <span className="truncate">{label}</span>
      <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-slate-400" />
    </button>
  )
}

export default function Header({
  className = '',
  title = 'Dashboard',
  subtitle = 'Welcome back, Aarav · Mon, 09 Jun 2026',
  searchPlaceholder = 'Search stocks, cards...',
}: {
  className?: string
  title?: string
  subtitle?: string
  searchPlaceholder?: string
}) {
  return (
    <header className={['border-b border-[var(--border)] bg-[rgba(10,16,34,0.92)] px-8 py-4 backdrop-blur', className].join(' ')}>
      <div className="flex min-w-0 items-center justify-between gap-6">
        <div className="min-w-0 flex-shrink-0">
          <h1 className="t-title text-[22px] text-white">{title}</h1>
          <p className="mt-2 whitespace-nowrap t-meta text-[var(--text-muted)]">{subtitle}</p>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          <label className="flex h-[56px] min-w-0 flex-1 max-w-[430px] items-center gap-4 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-5 text-slate-400">
            <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
            <span className="truncate t-body text-slate-400">{searchPlaceholder}</span>
          </label>

          <ControlChip icon="calendar" label="FY 2025-26" className="min-w-[246px] shrink-0" />

          <button
            type="button"
            className="grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Theme toggle"
          >
            <Icon name="sun" className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="relative grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Notifications"
          >
            <Icon name="bell" className="h-5 w-5" />
            <span className="absolute right-[12px] top-[12px] h-2.5 w-2.5 rounded-full bg-rose-500" />
          </button>

          <div className="flex shrink-0 items-center gap-3 pl-1">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-600)] text-[15px] font-bold text-white">
              AS
            </div>
            <div className="min-w-0">
              <div className="truncate t-nav text-white">Aarav Sharma</div>
              <div className="t-meta text-[var(--text-muted)]">Pro plan</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
