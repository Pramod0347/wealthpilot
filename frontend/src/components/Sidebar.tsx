import { useState } from 'react'
import Icon, { type IconName } from './Icon'

type NavItem = {
  label: string
  icon: IconName
  active?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: 'grid', active: true },
  { label: 'Portfolio', icon: 'briefcase' },
  { label: 'Stocks', icon: 'trending' },
  { label: 'Credit Cards', icon: 'card' },
  { label: 'Transactions', icon: 'swap' },
  { label: 'Analytics', icon: 'bars' },
  { label: 'Reports', icon: 'file' },
  { label: 'Settings', icon: 'settings' },
]

function LogoMark() {
  return (
    <div className="grid h-[64px] w-[64px] place-items-center rounded-[6px] bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-700)] text-white shadow-[0_18px_50px_rgba(13,148,136,0.25)]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]">
        <path d="M3 17l5-5 4 3 6-7" />
        <path d="M14 8h4v4" />
      </svg>
    </div>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'relative flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-strong)] text-slate-200 transition-[width] duration-300 ease-out',
        collapsed ? 'w-[88px] px-[12px] py-[16px]' : 'w-[376px] px-[24px] py-[24px]',
      ].join(' ')}
    >
      <div className={collapsed ? 'flex items-center justify-center' : 'flex items-center gap-4'}>
        <LogoMark />

        {!collapsed && (
          <div>
            <div className="text-[14px] font-bold leading-tight tracking-[-0.02em] text-white">WealthPilot</div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-[var(--accent-300)]">
              Premium
            </div>
          </div>
        )}
      </div>

      <nav className={collapsed ? 'mt-8 flex flex-1 flex-col items-center gap-3' : 'mt-8 flex flex-col gap-2.5'}>
        {navItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={[
              'group flex items-center rounded-[6px] text-left transition-all duration-200',
              collapsed ? 'h-12 w-12 justify-center' : 'h-[48px] w-full gap-4 px-4',
              item.active
                ? 'bg-[var(--accent-50)] text-[var(--accent-600)]'
                : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-white',
            ].join(' ')}
            aria-label={item.label}
            title={item.label}
          >
            <Icon name={item.icon} className={collapsed ? 'h-5 w-5' : 'h-4 w-4'} />

            {!collapsed && (
              <>
                <span className="text-[13px] font-medium leading-none tracking-[-0.01em]">{item.label}</span>
                <span className="ml-auto">{item.active ? <span className="block h-3 w-3 rounded-full bg-[var(--accent-400)]" /> : null}</span>
              </>
            )}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="mt-auto mb-5 rounded-[6px] bg-gradient-to-br from-[var(--accent-800)] to-[var(--accent-900)] p-5 text-white shadow-[0_18px_50px_rgba(13,148,136,0.12)]">
          <h3 className="text-[13px] font-semibold leading-tight">Tax season is here</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-white/78">Export FY25-26 capital gains report.</p>
          <button
            type="button"
            className="mt-5 h-10 w-full rounded-[6px] bg-white text-[13px] font-semibold text-slate-900 transition-transform hover:scale-[1.01]"
          >
            Generate report
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={[
          'flex items-center gap-4 rounded-[6px] px-4 py-3 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-white',
          collapsed ? 'justify-center' : '',
        ].join(' ')}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon name="chevronL" className="h-4 w-4" />
        {!collapsed && <span className="text-[13px] font-medium">Collapse</span>}
      </button>
    </aside>
  )
}
