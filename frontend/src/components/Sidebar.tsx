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
  { key: 'stocks', label: 'Stocks', icon: 'stocks', navigable: true },
  { key: 'banks', label: 'Banks', icon: 'banks', navigable: true },
  { key: 'pfepf', label: 'PF / EPF', icon: 'pfepf', navigable: true },
  { key: 'cards', label: 'Credit Cards', icon: 'cards', navigable: true },
  { key: 'transactions', label: 'Transactions', icon: 'transactions', navigable: true },
  { key: 'analytics', label: 'Analytics', icon: 'analytics', navigable: true },
  { key: 'goals', label: 'Goals', icon: 'portfolio', navigable: true },
  { key: 'tax', label: 'Tax Center', icon: 'reports', navigable: true },
  { key: 'reports', label: 'Reports', icon: 'reports', navigable: true },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

export default function Sidebar({
  className = '',
  activePage,
  onNavigate,
}: {
  className?: string
  activePage: 'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions' | 'analytics' | 'goals' | 'tax' | 'reports'
  onNavigate: (page: 'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions' | 'analytics' | 'goals' | 'tax' | 'reports') => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={[
        'relative flex h-screen shrink-0 flex-col overflow-hidden',
        'border-r border-slate-200 dark:border-slate-700/30',
        'bg-white dark:bg-slate-900',
        'text-slate-700 dark:text-slate-300',
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none no-scrollbar',
        collapsed ? 'w-[68px] px-2 py-4' : 'w-65 px-4 py-5',
        className,
      ].join(' ')}
    >
      {/* Logo + brand */}
      <div className={collapsed ? 'flex items-center justify-center' : 'flex flex-col items-start'}>
        <Logo collapsed={collapsed} />
        <div
          className={[
            'min-w-0 overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none',
            collapsed
              ? 'max-w-0 opacity-0 -translate-x-2 pointer-events-none'
              : 'mt-4 max-w-45 opacity-100 translate-x-0',
          ].join(' ')}
        >
        </div>
      </div>

      {/* Nav items */}
      <nav
        className={[
          'mt-6 flex min-w-0 flex-1 flex-col overflow-y-auto no-scrollbar',
          collapsed ? 'items-center gap-1.5' : 'gap-1',
        ].join(' ')}
      >
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
              onClick={isNavigable ? () => onNavigate(item.key as 'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions' | 'analytics' | 'goals' | 'tax' | 'reports') : undefined}
              disabled={!isNavigable}
              className={[
                'group flex min-w-0 items-center rounded-lg text-left',
                'transition-all duration-150 ease-in-out motion-reduce:transition-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40',
                'active:scale-[0.98]',
                collapsed ? 'h-12.5 w-12.5 justify-center' : 'h-12.5 w-full gap-3 px-3',
                isActive
                  ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                  : isNavigable
                  ? 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  : 'text-slate-400 dark:text-slate-500 cursor-default',
              ].join(' ')}
            >
              <Icon
                name={item.icon}
                className={[
                  'shrink-0',
                  'h-5 w-5',
                  isActive ? 'text-teal-600 dark:text-teal-400' : 'text-current',
                ].join(' ')}
                strokeWidth={isActive ? 2 : 1.75}
              />
              <span
                className={[
                  'overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out motion-reduce:transition-none',
                  collapsed
                    ? 'max-w-0 opacity-0 pointer-events-none'
                    : 'max-w-[140px] opacity-100',
                ].join(' ')}
              >
                <span className="truncate text-sm font-medium tracking-[-0.01em]">{item.label}</span>
              </span>

              {/* Active dot */}
              {!collapsed && isActive ? (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-teal-400 dark:bg-teal-400" />
              ) : null}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={[
          'mt-4 shrink-0 flex items-center rounded-lg px-2.5 py-2.5',
          'text-slate-400 dark:text-slate-500',
          'transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300',
          'active:scale-[0.98] motion-reduce:transition-none',
          collapsed ? 'justify-center' : 'gap-3',
        ].join(' ')}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Icon
          name="collapse"
          className={[
            'h-4 w-4 shrink-0 transition-transform duration-300',
            collapsed ? 'rotate-180' : '',
          ].join(' ')}
        />
        {!collapsed && (
          <span className="text-sm font-medium tracking-[-0.01em]">Collapse</span>
        )}
      </button>
    </aside>
  )
}
