import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import Logo from './Logo'

type NavItem = {
  label: string
  icon: IconName
  active?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', active: true },
  { label: 'Portfolio', icon: 'portfolio' },
  { label: 'Stocks', icon: 'stocks' },
  { label: 'Credit Cards', icon: 'cards' },
  { label: 'Transactions', icon: 'transactions' },
  { label: 'Analytics', icon: 'analytics' },
  { label: 'Reports', icon: 'reports' },
  { label: 'Settings', icon: 'settings' },
]

export default function Sidebar({ className = '' }: { className?: string }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'sticky left-0 top-0 relative flex shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface-strong)] text-slate-200 transition-[width] duration-300 ease-out',
        collapsed ? 'w-[72px] px-3 py-4' : 'w-[260px] px-5 py-5',
        className,
      ].join(' ')}
    >
      <div className={collapsed ? 'flex items-center justify-center' : 'flex items-center gap-3'}>
        <Logo />
        {!collapsed && (
          <div className="min-w-0">
            <div className="t-section truncate text-[18px] font-bold leading-none tracking-[-0.03em] text-white">
              WealthPilot
            </div>
            <div className="mt-1 t-micro text-[var(--accent-400)]">Premium</div>
          </div>
        )}
      </div>

      <nav className={['mt-6 flex min-w-0 flex-1 flex-col', collapsed ? 'items-center gap-2' : 'gap-2'].join(' ')}>
        {navItems.map((item) => {
          const isActive = item.active
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              className={[
                'group flex min-w-0 items-center rounded-[6px] text-left transition-colors duration-200 focus-visible:outline-none',
                collapsed ? 'h-11 w-11 justify-center' : 'h-[52px] w-full gap-4 px-4',
                isActive
                  ? 'bg-[#15313d] text-[var(--accent-400)]'
                  : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-slate-100',
              ].join(' ')}
            >
              <Icon name={item.icon} className={collapsed ? 'h-5 w-5 shrink-0' : 'h-[18px] w-[18px] shrink-0'} />
              {!collapsed && (
                <>
                  <span className="t-nav truncate">{item.label}</span>
                  <span className="ml-auto flex shrink-0">
                    {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-400)]" /> : null}
                  </span>
                </>
              )}
            </button>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="mt-auto pb-5">
          <div className="rounded-[6px] bg-gradient-to-br from-[var(--accent-700)] to-[var(--accent-900)] p-5 text-white shadow-[0_18px_50px_rgba(13,148,136,0.12)]">
            <h3 className="t-section text-[16px] font-semibold text-white">Tax season is here</h3>
            <p className="mt-2 t-body text-slate-200/90">Export FY25-26 capital gains report.</p>
            <button
              type="button"
              className="mt-5 h-11 w-full rounded-[6px] bg-white t-nav font-semibold text-slate-900 transition-transform hover:scale-[1.01]"
            >
              Generate report
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={[
          'mt-2 flex items-center rounded-[6px] px-3 py-3 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-slate-100',
          collapsed ? 'justify-center' : 'gap-4',
        ].join(' ')}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon name="collapse" className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="t-nav">Collapse</span>}
      </button>
    </aside>
  )
}
