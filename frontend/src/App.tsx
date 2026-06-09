import Sidebar from './components/Sidebar'
import Header from './components/Header'
import Dashboard from './components/Dashboard'

export default function App() {
  return (
    <main className="h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex h-screen w-full overflow-hidden bg-[#050816]">
        <Sidebar className="sticky top-0 h-screen shrink-0" />

        <div className="flex min-w-0 flex-1 flex-col h-screen">
          <Header className="sticky top-0 z-40 shrink-0" />

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6 xl:p-8">
              <Dashboard />
            </div>
          </main>
        </div>
      </div>
    </main>
  )
}
