import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'
import StocksPage from './components/StocksPage'
import CreditCardsPage from './components/CreditCardsPage'

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'stocks' | 'cards'>('dashboard')
  const pageConfig = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Personal finance dashboard • Updated 10 Jun 2026, 3:30 PM IST',
      content: <Dashboard onOpenStocks={() => setActivePage('stocks')} onOpenCards={() => setActivePage('cards')} />,
    },
    stocks: {
      title: 'Stocks / Holdings',
      subtitle: 'Personal finance dashboard • Updated 10 Jun 2026, 3:30 PM IST',
      content: <StocksPage />,
    },
    cards: {
      title: 'Credit Cards',
      subtitle: 'Personal finance dashboard • Updated 10 Jun 2026, 3:30 PM IST',
      content: <CreditCardsPage />,
    },
  }[activePage]

  return (
    <main className="h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex h-screen w-full overflow-hidden bg-[#050816]">
        <Sidebar className="sticky top-0 h-screen shrink-0" activePage={activePage} onNavigate={setActivePage} />

        <div className="flex min-w-0 flex-1 flex-col h-screen">
          <Header
            className="sticky top-0 z-40 shrink-0"
            title={pageConfig.title}
            subtitle={pageConfig.subtitle}
          />

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6 xl:p-8">
              {pageConfig.content}
            </div>
          </main>
        </div>
      </div>
    </main>
  )
}
