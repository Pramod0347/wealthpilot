import { useState } from 'react'
import { Icon, type IconName } from './Icon'
import Logo from './Logo'

type NavItem = {
  key: string
  label: string
  icon: IconName
  navigable?: boolean
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', navigable: true },
  { key: 'portfolio', label: 'Portfolio', icon: 'portfolio' },
  { key: 'stocks', label: 'Stocks', icon: 'stocks', navigable: true },
  { key: 'banks', label: 'Banks', icon: 'banks', navigable: true },
  { key: 'pfepf', label: 'PF / EPF', icon: 'pfepf' },
  { key: 'cards', label: 'Credit Cards', icon: 'cards', navigable: true },
  { key: 'transactions', label: 'Transactions', icon: 'transactions' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics' },
  { key: 'reports', label: 'Reports', icon: 'reports' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({
  className = '',
  activePage,
  onNavigate,
}: {
  className?: string
  activePage: 'dashboard' | 'stocks' | 'banks' | 'cards'
  onNavigate: (page: 'dashboard' | 'stocks' | 'banks' | 'cards') => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'sticky left-0 top-0 relative flex h-screen shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-[var(--border)] bg-[#0b1224] text-slate-200 transition-[width] duration-300 ease-in-out motion-reduce:transition-none no-scrollbar',
        collapsed ? 'w-[72px] px-3 py-4' : 'w-[260px] px-5 py-5',
        className,
      ].join(' ')}
    >
      <div className={collapsed ? 'flex items-center justify-center' : 'flex items-center gap-4'}>
        <Logo />
        <div
          className={[
            'min-w-0 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none',
            collapsed ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' : 'max-w-[160px] opacity-100 translate-x-0',
          ].join(' ')}
        >
          <div className="min-w-0">
            <div className="t-section truncate text-[18px] font-bold leading-none tracking-[-0.03em] text-white">
              WealthPilot
            </div>
            <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.04em] text-slate-400">Personal Finance</div>
          </div>
        </div>
      </div>

      <nav className={['mt-8 flex min-w-0 flex-1 flex-col', collapsed ? 'items-center gap-2' : 'gap-2'].join(' ')}>
        {navItems.map((item) => {
          const isActive = item.key === activePage
          const isNavigable = item.navigable ?? false
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={isNavigable ? () => onNavigate(item.key as 'dashboard' | 'stocks' | 'banks' | 'cards') : undefined}
              className={[
                'group flex min-w-0 items-center rounded-[6px] text-left transition-all duration-300 ease-in-out motion-reduce:transition-none focus-visible:outline-none active:scale-[0.98]',
                collapsed ? 'h-11 w-11 justify-center' : 'h-[52px] w-full gap-4 px-4',
                isActive
                  ? 'bg-[#163443] text-[var(--accent-400)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              ].join(' ')}
              disabled={!isNavigable}
            >
              <Icon
                name={item.icon}
                className={[
                  collapsed ? 'h-5 w-5 shrink-0' : 'h-[18px] w-[18px] shrink-0',
                  isActive ? 'text-[var(--accent-400)]' : 'text-current',
                ].join(' ')}
              />
              <span
                className={[
                  'overflow-hidden whitespace-nowrap text-left transition-all duration-300 ease-in-out motion-reduce:transition-none',
                  collapsed ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none' : 'ml-0 max-w-[140px] opacity-100 translate-x-0',
                ].join(' ')}
              >
                <span className={['t-nav truncate', isActive ? 'text-[var(--accent-400)]' : 'text-current'].join(' ')}>{item.label}</span>
              </span>
              <span
                className={[
                  'ml-auto flex shrink-0 transition-all duration-300 ease-in-out motion-reduce:transition-none',
                  collapsed ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100',
                ].join(' ')}
              >
                {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-400)]" /> : null}
              </span>
            </button>
          )
        })}
      </nav>

      <div
        className={[
          'mt-auto pb-5 transition-all duration-300 ease-in-out motion-reduce:transition-none',
          collapsed ? 'pointer-events-none translate-y-1 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100',
        ].join(' ')}
      >
        <div className="rounded-[6px] bg-gradient-to-br from-[var(--accent-700)] to-[var(--accent-900)] p-5 text-white shadow-[0_18px_50px_rgba(13,148,136,0.12)]">
          <h3 className="t-section text-[16px] font-semibold text-white">Tax season is here</h3>
          <p className="mt-2 t-body text-slate-200/90">Export FY25-26 capital gains report.</p>
          <button
            type="button"
            className="mt-5 h-11 w-full rounded-[6px] bg-white t-nav font-semibold text-slate-900 transition-all duration-200 ease-out hover:brightness-95 active:scale-[0.98] motion-reduce:transition-none"
          >
            Generate report
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={[
          'mt-2 flex items-center rounded-[6px] px-3 py-3 text-[var(--text-muted)] transition-all duration-200 ease-out hover:bg-white/5 hover:text-slate-100 active:scale-[0.98] motion-reduce:transition-none',
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
