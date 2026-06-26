import { useEffect, useMemo, useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import AnalyticsPage from './components/AnalyticsPage'
import StocksPage from './components/StocksPage'
import CreditCardsPage from './components/CreditCardsPage'
import BanksPage from './components/BanksPage'
import FixedSavingsPage from './components/FixedSavingsPage'
import CashflowPage from './components/CashflowPage'
import GoalsPage from './components/GoalsPage'
import ReportsPage from './components/ReportsPage'
import LoginPage from './components/auth/LoginPage'
import ServerWakeScreen from './components/auth/ServerWakeScreen'
import BottomSheet from './components/ui/BottomSheet'
import { Icon, type IconName } from './components/Icon'
import { ApiError, checkAuth, checkServerHealth, getStoredAuthToken, loginUser, logoutUser, setStoredAuthToken } from './lib/api'

type PageKey = 'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions' | 'analytics' | 'goals' | 'reports'
type BootstrapState =
  | 'checking_server'
  | 'server_warming'
  | 'server_ready'
  | 'checking_auth'
  | 'authenticated'
  | 'unauthenticated'
  | 'server_error'

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
  { key: 'goals', label: 'Goals', icon: 'portfolio' },
  { key: 'reports', label: 'Reports', icon: 'reports' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

function isPageKey(value: NavItem['key']): value is PageKey {
  return ['dashboard', 'stocks', 'banks', 'pfepf', 'cards', 'transactions', 'analytics', 'goals', 'reports'].includes(value)
}

const HEALTH_RETRY_MS = 3_000
const HEALTH_TIMEOUT_MS = 90_000
const SERVER_READY_DELAY_MS = 650

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

export default function App() {
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>('checking_server')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false)
  const [bootstrapNonce, setBootstrapNonce] = useState(0)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const startedAt = Date.now()

    const updateElapsed = () => {
      if (!cancelled) {
        setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
      }
    }

    const bootstrap = async () => {
      setBootstrapState('checking_server')
      setElapsedSeconds(0)
      setAuthError(null)

      while (!cancelled) {
        try {
          updateElapsed()
          await checkServerHealth()
          if (cancelled) return

          setBootstrapState('server_ready')
          await wait(SERVER_READY_DELAY_MS)
          if (cancelled) return

          setBootstrapState('checking_auth')
          const auth = await checkAuth()
          if (cancelled) return

          setBootstrapState(auth.authenticated ? 'authenticated' : 'unauthenticated')
          return
        } catch (error) {
          if (cancelled) return

          const elapsed = Date.now() - startedAt
          updateElapsed()

          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            if (getStoredAuthToken()) {
              setStoredAuthToken('')
              setAuthError('Your session could not be restored on this device. Please sign in again.')
            }
            setBootstrapState('unauthenticated')
            return
          }

          if (elapsed >= HEALTH_TIMEOUT_MS) {
            setBootstrapState('server_error')
            return
          }

          setBootstrapState('server_warming')
          await wait(HEALTH_RETRY_MS)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [bootstrapNonce])

  const handleLogin = async (email: string, phone: string): Promise<void> => {
    setBootstrapState('checking_auth')
    setAuthError(null)
    try {
      const login = await loginUser(email, phone)
      if (!login.authenticated || !login.token) {
        setStoredAuthToken('')
        setBootstrapState('unauthenticated')
        throw new ApiError('Login succeeded but no session token was returned.', 401)
      }

      setStoredAuthToken(login.token ?? '')
      setBootstrapState('authenticated')
    } catch (error) {
      setStoredAuthToken('')
      if (error instanceof ApiError && error.status === 0) {
        setBootstrapState('server_error')
        setAuthError('Cannot reach the secure server right now. Try again in a moment.')
      } else {
        setBootstrapState('unauthenticated')
        if (error instanceof ApiError && error.status === 401) {
          setAuthError('Access denied. Check your email and phone number.')
        } else if (error instanceof ApiError && error.status === 503) {
          setAuthError(error.message)
        } else {
          setAuthError('Login failed. Please try again.')
        }
      }
      throw error
    }
  }

  const handleLogout = async () => {
    try {
      await logoutUser()
    } catch {
      // Best-effort cookie clear; frontend state should still move to login.
    }
    setStoredAuthToken('')
    setAuthError(null)
    setBootstrapState('unauthenticated')
  }

  const pageConfig = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Quick command center for your money',
      content: <Dashboard onOpenStocks={() => setActivePage('stocks')} onOpenCards={() => setActivePage('cards')} onOpenGoals={() => setActivePage('goals')} />,
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
    goals: {
      title: 'Goals',
      subtitle: 'Track personal financial targets and funding progress',
      content: <GoalsPage />,
    },
    reports: {
      title: 'Reports',
      subtitle: 'Read-only financial reports with CSV exports',
      content: <ReportsPage />,
    },
  }[activePage]

  const activeMobileNav = useMemo(() => mobilePrimaryNav.find((item) => item.key === activePage)?.key ?? 'more', [activePage])

  const handleMobileNavigate = (page: PageKey) => {
    setActivePage(page)
    setIsMoreSheetOpen(false)
  }

  if (bootstrapState === 'checking_server' || bootstrapState === 'server_warming' || bootstrapState === 'server_ready' || bootstrapState === 'checking_auth') {
    return (
      <ServerWakeScreen
        state={bootstrapState}
        elapsedSeconds={elapsedSeconds}
      />
    )
  }

  if (bootstrapState === 'server_error') {
    return (
      <ServerWakeScreen
        state="server_error"
        elapsedSeconds={elapsedSeconds}
        onRetry={() => setBootstrapNonce((current) => current + 1)}
      />
    )
  }

  if (bootstrapState === 'unauthenticated') {
    return <LoginPage onLogin={handleLogin} initialError={authError} />
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
