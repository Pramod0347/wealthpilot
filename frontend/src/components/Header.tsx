import type { ComponentProps } from 'react'
import Icon from './Icon'

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
        'flex h-[56px] items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 text-[14px] font-medium text-slate-200 transition-colors hover:bg-white/5 hover:text-white',
        className,
      ].join(' ')}
    >
      <Icon name={icon} className="h-5 w-5 text-slate-400" />
      <span>{label}</span>
      <Icon name="chevronD" className="h-4 w-4 text-slate-400" />
    </button>
  )
}

export default function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[rgba(10,16,34,0.92)] px-8 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold leading-none tracking-[-0.03em] text-white">Dashboard</h1>
          <p className="mt-2 text-[13px] leading-none text-[var(--text-muted)]">
            Welcome back, Aarav · Mon, 09 Jun 2026
          </p>
        </div>

        <div className="flex flex-1 items-center justify-end gap-3.5">
          <label className="flex h-[56px] min-w-[430px] max-w-[430px] items-center gap-4 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-5 text-slate-400">
            <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
            <span className="text-[14px] text-slate-400">Search stocks, cards...</span>
          </label>

          <ControlChip icon="calendar" label="FY 2025-26" className="min-w-[250px]" />

          <button
            type="button"
            className="grid h-[56px] w-[56px] place-items-center rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Theme toggle"
          >
            <Icon name="sun" className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="relative grid h-[56px] w-[56px] place-items-center rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Notifications"
          >
            <Icon name="bell" className="h-5 w-5" />
            <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose-500" />
          </button>

          <div className="flex items-center gap-3 pl-1">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--accent-600)] text-[15px] font-bold text-white">
              AS
            </div>
            <div>
              <div className="text-[14px] font-semibold leading-tight text-white">Aarav Sharma</div>
              <div className="text-[12px] leading-tight text-[var(--text-muted)]">Pro plan</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
