import { useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import AnalyticsPage from './components/AnalyticsPage'
import StocksPage from './components/StocksPage'
import CreditCardsPage from './components/CreditCardsPage'
import BanksPage from './components/BanksPage'
import FixedSavingsPage from './components/FixedSavingsPage'
import CashflowPage from './components/CashflowPage'
import LoginPage from './components/auth/LoginPage'
import BottomSheet from './components/ui/BottomSheet'
import { Icon, type IconName } from './components/Icon'

const ACCESS_STORAGE_KEY = 'wealthpilot_owner_access'
const OWNER_EMAIL = (import.meta.env.VITE_OWNER_EMAIL as string | undefined)?.trim() || 'pgoudar347@gmail.com'
const OWNER_PHONE = (import.meta.env.VITE_OWNER_PHONE as string | undefined)?.trim() || '8296090286'

type PageKey = 'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions' | 'analytics'

type NavItem = {
  key: PageKey | 'more' | 'reports' | 'settings'
  label: string
  icon: IconName
}

const mobilePrimaryNav: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'stocks', label: 'Stocks', icon: 'stocks' },
  { key: 'banks', label: 'Banks', icon: 'banks' },
  { key: 'cards', label: 'Cards', icon: 'cards' },
  { key: 'more', label: 'More', icon: 'menu' },
]

const mobileMoreNav: NavItem[] = [
  { key: 'pfepf', label: 'PF / EPF', icon: 'pfepf' },
  { key: 'transactions', label: 'Cashflow', icon: 'transactions' },
  { key: 'analytics', label: 'Analytics', icon: 'analytics' },
  { key: 'reports', label: 'Reports', icon: 'reports' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

function isPageKey(value: NavItem['key']): value is PageKey {
  return ['dashboard', 'stocks', 'banks', 'pfepf', 'cards', 'transactions', 'analytics'].includes(value)
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => localStorage.getItem(ACCESS_STORAGE_KEY) === 'granted')
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)

  const handleUnlock = () => {
    localStorage.setItem(ACCESS_STORAGE_KEY, 'granted')
    setIsUnlocked(true)
  }

  const handleLogout = () => {
    localStorage.removeItem(ACCESS_STORAGE_KEY)
    setIsUnlocked(false)
  }

  const pageConfig = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Quick command center for your money',
      content: <Dashboard onOpenStocks={() => setActivePage('stocks')} onOpenCards={() => setActivePage('cards')} />,
    },
    stocks: {
      title: 'Stocks & Investments',
      subtitle: 'Indian stocks, US stocks, ETFs, gold, and mutual funds',
      content: <StocksPage />,
    },
    banks: {
      title: 'Banks',
      subtitle: 'Cash accounts and balances across your banks',
      content: <BanksPage />,
    },
    pfepf: {
      title: 'PF / EPF',
      subtitle: 'Provident fund, PPF, and long-term savings',
      content: <FixedSavingsPage />,
    },
    cards: {
      title: 'Credit Cards',
      subtitle: 'Bills, limits, and payment tracker',
      content: <CreditCardsPage />,
    },
    transactions: {
      title: 'Monthly Cashflow',
      subtitle: 'Monthly income, category spends, and savings rate',
      content: <CashflowPage />,
    },
    analytics: {
      title: 'Financial Analytics',
      subtitle: 'Net worth, risk, allocation, cashflow, and credit health',
      content: <AnalyticsPage />,
    },
  }[activePage]

  const activeMobileNav = useMemo(() => {
    return mobilePrimaryNav.find((item) => item.key === activePage)?.key ?? 'more'
  }, [activePage])

  const handleMobileNavigate = (page: PageKey) => {
    setActivePage(page)
    setIsMoreSheetOpen(false)
  }

  if (!isUnlocked) {
    return (
      <LoginPage
        expectedEmail={OWNER_EMAIL}
        expectedPhone={OWNER_PHONE}
        onUnlock={handleUnlock}
      />
    )
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        className="sticky top-0 hidden h-screen shrink-0 lg:flex"
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="flex min-w-0 flex-1 flex-col h-screen">
        <Header
          className="sticky top-0 z-40 shrink-0"
          title={pageConfig.title}
          subtitle={pageConfig.subtitle}
          onLogout={handleLogout}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-transparent">
          <div className="p-4 pb-24 sm:p-5 sm:pb-28 lg:p-8 lg:pb-8">
            {pageConfig.content}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobilePrimaryNav.map((item) => {
            const isActive = item.key === 'more' ? isMoreSheetOpen || activeMobileNav === 'more' : activeMobileNav === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'more') {
                    setIsMoreSheetOpen(true)
                    return
                  }
                  if (isPageKey(item.key)) {
                    handleMobileNavigate(item.key)
                  }
                }}
                className={[
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-colors duration-200 active:scale-[0.98]',
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                <Icon name={item.icon} className="h-4.5 w-4.5" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <BottomSheet
        open={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        title="More"
        subtitle="Additional WealthPilot sections"
      >
        <div className="space-y-2">
          {mobileMoreNav.map((item) => {
            const isPage = isPageKey(item.key)
            const isActive = item.key === activePage
            let handleClick: (() => void) | undefined
            if (isPage) {
              const pageKey = item.key as PageKey
              handleClick = () => handleMobileNavigate(pageKey)
            }
            return (
              <button
                key={item.key}
                type="button"
                onClick={handleClick}
                disabled={!isPage}
                className={[
                  'flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-4 text-left transition-colors duration-200',
                  isActive
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300'
                    : isPage
                      ? 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800'
                      : 'bg-slate-50 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500',
                ].join(' ')}
              >
                <Icon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  {!isPage ? <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">Coming later</div> : null}
                </div>
              </button>
            )
          })}

          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-rose-50 px-4 text-left text-rose-700 transition-colors duration-200 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
          >
            <Icon name="logout" className="h-4.5 w-4.5 shrink-0" />
            <div className="text-sm font-medium">Logout</div>
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
