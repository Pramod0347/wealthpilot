import Sidebar from './components/Sidebar'
import Header from './components/Header'

export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="flex-1">
          <Header />

          <div className="min-h-[480px]" />
        </section>
      </div>
    </main>
  )
}
