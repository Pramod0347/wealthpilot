import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import StocksPage from './components/StocksPage'
import CreditCardsPage from './components/CreditCardsPage'
import BanksPage from './components/BanksPage'
import FixedSavingsPage from './components/FixedSavingsPage'
import CashflowPage from './components/CashflowPage'

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'stocks' | 'banks' | 'pfepf' | 'cards' | 'transactions'>('dashboard')

  const pageConfig = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Personal finance overview',
      content: <Dashboard onOpenStocks={() => setActivePage('stocks')} onOpenCards={() => setActivePage('cards')} />,
    },
    stocks: {
      title: 'Stocks & Investments',
      subtitle: 'Indian stocks, ETFs, and mutual funds',
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
  }[activePage]

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar
        className="sticky top-0 h-screen shrink-0"
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="flex min-w-0 flex-1 flex-col h-screen">
        <Header
          className="sticky top-0 z-40 shrink-0"
          title={pageConfig.title}
          subtitle={pageConfig.subtitle}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-transparent">
          <div className="p-5 xl:p-8">
            {pageConfig.content}
          </div>
        </main>
      </div>
    </div>
  )
}
