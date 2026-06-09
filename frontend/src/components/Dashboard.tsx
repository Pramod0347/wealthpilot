import { useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Icon } from './Icon'
import { formatINR, formatINRShort, formatPct } from '../lib/format'

type SummaryCard = {
  label: string
  value: string
  meta: string
  icon: 'netWorth' | 'up' | 'analytics' | 'cards'
  iconBg: string
  valueClass?: string
  metaClass?: string
}

const summaryCards: SummaryCard[] = [
  { label: 'Net Worth', value: '₹12.09 L', meta: '↑ 8.4% Assets − liabilities', icon: 'netWorth', iconBg: 'bg-accent-500 text-white' },
  { label: 'Current Value', value: '₹5.39 L', meta: 'Invested ₹4.76L', icon: 'up', iconBg: 'bg-slate-800 text-slate-300' },
  { label: 'Total P&L', value: '+₹62,850', meta: '+13.20% overall return', icon: 'analytics', iconBg: 'bg-slate-800 text-slate-300', valueClass: 'text-emerald-400', metaClass: 'text-slate-400' },
  { label: 'Credit Card Dues', value: '₹60,000', meta: 'Due this cycle', icon: 'cards', iconBg: 'bg-amber-500/20 text-amber-400', valueClass: 'text-white' },
]

const performanceData = [
  { label: 'Jan', value: 4.22 },
  { label: 'Feb', value: 4.26 },
  { label: 'Mar', value: 4.24 },
  { label: 'Apr', value: 4.31 },
  { label: 'May', value: 4.38 },
  { label: 'Jun', value: 4.40 },
  { label: 'Jul', value: 4.52 },
  { label: 'Aug', value: 4.63 },
  { label: 'Sep', value: 4.68 },
  { label: 'Oct', value: 4.86 },
  { label: 'Nov', value: 4.96 },
  { label: 'Dec', value: 5.03 },
  { label: 'Jan', value: 5.18 },
  { label: 'Feb', value: 5.24 },
  { label: 'Mar', value: 5.24 },
  { label: 'Apr', value: 5.31 },
  { label: 'May', value: 5.39 },
  { label: 'Jun', value: 5.38 },
]

const allocationData = [
  { name: 'Stocks', value: 42.5, color: '#0d9488' },
  { name: 'Mutual Funds', value: 33.1, color: '#0ea5e9' },
  { name: 'Cash', value: 14.6, color: '#a78bfa' },
  { name: 'Other Assets', value: 9.8, color: '#f59e0b' },
]

const holdings = [
  { stock: 'RELIANCE', company: 'Reliance Industries', qty: 40, avg: 2380, ltp: 2910, invested: 95200, value: 116400 },
  { stock: 'ICICIBANK', company: 'ICICI Bank', qty: 80, avg: 980, ltp: 1245, invested: 78400, value: 99600 },
  { stock: 'TCS', company: 'Tata Consultancy', qty: 25, avg: 3450, ltp: 3890, invested: 86250, value: 97250 },
  { stock: 'INFY', company: 'Infosys', qty: 60, avg: 1420, ltp: 1560, invested: 85200, value: 93600 },
  { stock: 'HDFCBANK', company: 'HDFC Bank', qty: 50, avg: 1580, ltp: 1685, invested: 79000, value: 84250 },
  { stock: 'WIPRO', company: 'Wipro', qty: 100, avg: 520, ltp: 478, invested: 52000, value: 47800 },
]

const cards = [
  { name: 'HDFC Regalia', bank: 'HDFC Bank ••4821', status: 'Due Soon', tone: 'amber', used: 71420, limit: 500000, bill: 38450, dueDate: '12 Jun 2026', percent: 28 },
  { name: 'Axis Ace', bank: 'Axis Bank ••6390', status: 'Paid', tone: 'emerald', used: 89600, limit: 250000, bill: 24200, dueDate: '28 Jun 2026', percent: 36 },
  { name: 'SBI Cashback', bank: 'SBI ••1107', status: 'Overdue', tone: 'rose', used: 119000, limit: 300000, bill: 21550, dueDate: '05 Jun 2026', percent: 40 },
]

const upcoming = [
  { label: 'SBI Cashback', type: 'Credit Card · 05 Jun', amount: 21550, status: 'Overdue', tone: 'rose' },
  { label: 'Home Loan EMI', type: 'Loan · 07 Jun', amount: 42000, status: 'Due Soon', tone: 'amber' },
  { label: 'Mutual Fund SIP', type: 'Investment · 10 Jun', amount: 15000, status: 'Scheduled', tone: 'slate' },
  { label: 'HDFC Regalia', type: 'Credit Card · 12 Jun', amount: 38450, status: 'Due Soon', tone: 'amber' },
  { label: 'Axis Ace', type: 'Credit Card · 28 Jun', amount: 24200, status: 'Paid', tone: 'emerald' },
]

const insights = [
  {
    tone: 'amber',
    text: "You're overexposed to technology - 38% of your equity sits in IT (TCS, Infosys, Wipro).",
  },
  { tone: 'slate', text: 'HDFC Regalia bill of ₹38,450 is due in 3 days.' },
  { tone: 'emerald', text: 'Your portfolio is up 8.4% this month, outperforming the Nifty 50 by 2.1%.' },
  { tone: 'rose', text: 'SBI Cashback is overdue - pay ₹21,550 now to avoid a late fee.' },
]

const timeFilters = ['1M', '3M', '6M', '1Y', 'All']

function SectionCard({
  title,
  children,
  className = '',
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={['rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]', className].join(' ')}>
      {title ? <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5 t-section text-white">{title}</div> : null}
      {children}
    </div>
  )
}

export default function Dashboard() {
  const [activeFilter, setActiveFilter] = useState('6M')

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 text-[var(--text-muted)]">
            <Icon name="refresh" className="h-5 w-5 shrink-0" />
            <span className="t-body whitespace-nowrap text-[var(--text-muted)]">Prices last updated</span>
            <span className="t-body whitespace-nowrap font-medium text-slate-200">09 Jun 2026, 3:42 PM IST</span>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              className="flex h-14 items-center gap-3 rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-5 t-body font-semibold text-slate-200 transition-colors hover:bg-white/5"
            >
              <Icon name="cards" className="h-5 w-5 text-slate-300" />
              Add Credit Card
            </button>
            <button
              type="button"
              className="flex h-14 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-5 t-body font-semibold text-white transition-colors hover:bg-[var(--accent-700)]"
            >
              <Icon name="add" className="h-5 w-5 text-white" />
              Add Holding
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SectionCard key={card.label} className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="t-label text-slate-400">{card.label}</div>
                  <div className={['t-metric mt-6 text-white', card.valueClass].filter(Boolean).join(' ')}>{card.value}</div>
                  <div className={['t-meta mt-4', card.metaClass].filter(Boolean).join(' ')}>{card.meta}</div>
                </div>
                <div className={['grid h-12 w-12 shrink-0 place-items-center rounded-[6px]', card.iconBg].join(' ')}>
                  <Icon name={card.icon} className="h-5 w-5" />
                </div>
              </div>
            </SectionCard>
          ))}
        </section>

        <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <SectionCard className="min-w-0 px-6 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="t-section text-white">Portfolio Performance</div>
                <div className="mt-4 flex items-center gap-3">
                  <div className="t-metric-hero text-white">₹5.39 L</div>
                  <div className="rounded-[6px] bg-emerald-500/15 px-3 py-1 t-badge text-emerald-400">↑ +24.70%</div>
                  <div className="t-body text-slate-400">in 6M</div>
                </div>
              </div>
              <div className="flex items-center rounded-[6px] bg-[#2b364e] p-1">
                {timeFilters.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={[
                      'h-9 rounded-[6px] px-4 t-nav transition-colors',
                      activeFilter === filter ? 'bg-[#404d68] text-white' : 'text-slate-400 hover:text-slate-200',
                    ].join(' ')}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 h-[420px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(51,65,85,0.55)" vertical={false} />
                  <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#e2e8f0',
                    }}
                    formatter={(value) => [`₹${Number(value).toFixed(2)} L`, 'Value']}
                  />
                  <Area type="monotone" dataKey="value" stroke="#0d9488" strokeWidth={4} fill="url(#performanceFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard className="min-w-0 px-6 py-6">
            <div className="t-section text-white">Asset Allocation</div>
            <div className="mt-1 t-body text-slate-400">By current market value</div>
            <div className="mt-8 grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
              <div className="relative mx-auto h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      stroke="transparent"
                    >
                      {allocationData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="t-meta uppercase text-slate-400">Total assets</div>
                  <div className="mt-1 font-mono text-[18px] font-bold tabular-nums text-white">₹12.69 L</div>
                </div>
              </div>

              <div className="flex flex-col justify-center gap-4">
                {allocationData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: entry.color }} />
                      <span className="t-body text-slate-200">{entry.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="t-nav text-white">{entry.value.toFixed(1)}%</div>
                      <div className="t-meta">₹{entry.name === 'Stocks' ? '5.39 L' : entry.name === 'Mutual Funds' ? '4.20 L' : entry.name === 'Cash' ? '1.85 L' : '1.25 L'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[rgba(51,65,85,0.45)] pt-4">
              <div>
                <div className="t-meta uppercase text-slate-400">Equity exposure</div>
                <div className="mt-1 t-nav text-white">42.5%</div>
              </div>
              <div>
                <div className="t-meta uppercase text-slate-400">Diversification</div>
                <div className="mt-1 t-nav text-emerald-400">• Balanced</div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div>
              <div className="t-section text-white">Stock Holdings</div>
              <div className="mt-1 t-meta">6 stocks · invested ₹4.76 L · Live · updated 3:42 PM</div>
            </div>
            <button type="button" className="t-body font-semibold text-accent-400 hover:text-accent-300">
              View all →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left">
                  {['Stock', 'Qty', 'Avg Buy', 'LTP', 'Invested', 'Cur. Value', 'P&L', 'Return %', ''].map((head) => (
                    <th key={head} className="px-6 py-4 t-th">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((row) => {
                  const pnl = row.value - row.invested
                  const pct = (pnl / row.invested) * 100
                  const positive = pnl >= 0
                  return (
                    <tr key={row.stock} className="border-t border-[rgba(51,65,85,0.35)]">
                      <td className="px-6 py-5">
                        <div className="t-nav text-white">{row.stock}</div>
                        <div className="t-meta">{row.company}</div>
                      </td>
                      <td className="px-6 py-5 t-num text-slate-200">{row.qty}</td>
                      <td className="px-6 py-5 t-num text-slate-200">{formatINR(row.avg)}</td>
                      <td className="px-6 py-5 t-num text-slate-200">{formatINR(row.ltp)}</td>
                      <td className="px-6 py-5 t-num text-slate-200">{formatINR(row.invested)}</td>
                      <td className="px-6 py-5 t-num text-white">{formatINR(row.value)}</td>
                      <td className={['px-6 py-5 t-num', positive ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
                        {positive ? '+' : ''}
                        {formatINR(Math.abs(pnl)).slice(1)}
                      </td>
                      <td className={['px-6 py-5 t-badge', positive ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
                        {positive ? '↑' : '↓'} {formatPct(pct)}
                      </td>
                      <td className="px-6 py-5 text-right text-slate-400">
                        <button type="button" className="rounded-[6px] px-2 py-1 hover:bg-white/5">
                          <Icon name="more" className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard className="min-w-0">
          <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div className="t-section text-white">Credit Cards</div>
            <div className="t-meta text-slate-400">3 cards · ₹60,000 due</div>
          </div>
          <div className="grid gap-4 px-6 py-6 xl:grid-cols-3">
            {cards.map((card) => {
              const toneMapByStatus = {
                emerald: { border: 'border-emerald-500/60', status: 'bg-emerald-500/15 text-emerald-400', accent: 'text-emerald-400', bar: 'bg-emerald-500' },
                amber: { border: 'border-amber-500/60', status: 'bg-amber-500/15 text-amber-400', accent: 'text-amber-400', bar: 'bg-amber-500' },
                rose: { border: 'border-rose-500/60', status: 'bg-rose-500/15 text-rose-400', accent: 'text-rose-400', bar: 'bg-rose-500' },
              }
              const toneMap = toneMapByStatus[card.tone as keyof typeof toneMapByStatus]

              return (
                <div key={card.name} className={['rounded-[6px] border bg-[#131c31] p-5', toneMap.border].join(' ')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="t-nav text-white">{card.name}</div>
                      <div className="t-meta">{card.bank}</div>
                    </div>
                    <span className={['rounded-[999px] px-3 py-1 t-badge', toneMap.status].join(' ')}>{card.status}</span>
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between t-meta">
                      <span>Used ₹{formatINRShort(card.used).replace('₹', '')}</span>
                      <span>{card.percent}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-800">
                      <div className={['h-2 rounded-full', toneMap.bar].join(' ')} style={{ width: `${card.percent}%` }} />
                    </div>
                    <div className="mt-3 flex items-center justify-between t-meta">
                      <span>Avail. ₹{formatINRShort(card.limit - card.used).replace('₹', '')} of ₹{formatINRShort(card.limit).replace('₹', '')}</span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <div className="t-micro text-slate-400">Bill amount</div>
                      <div className={['mt-1 t-amount', toneMap.accent].join(' ')}>{formatINR(card.bill)}</div>
                    </div>
                    <div className="text-right">
                      <div className="t-micro text-slate-400">Due date</div>
                      <div className="mt-1 t-nav text-white">{card.dueDate}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard>
            <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
              <div className="t-section text-white">Upcoming Payments</div>
              <Icon name="calendar" className="h-5 w-5 text-slate-400" />
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                {upcoming.map((item) => {
                  const tone = item.tone === 'emerald'
                    ? 'text-emerald-400 bg-emerald-500/15'
                    : item.tone === 'rose'
                      ? 'text-rose-400 bg-rose-500/15'
                      : item.tone === 'amber'
                        ? 'text-amber-400 bg-amber-500/15'
                        : 'text-slate-400 bg-slate-800'
                  return (
                    <div key={item.label} className="flex items-center justify-between rounded-[6px] p-3 hover:bg-white/5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-10 w-10 place-items-center rounded-[6px] bg-[#18233d] text-accent-400">
                          <Icon name="cards" className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="t-nav truncate text-white">{item.label}</div>
                          <div className="t-meta truncate">{item.type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="t-num text-white">{formatINR(item.amount)}</div>
                        <div className={['mt-1 inline-flex rounded-[999px] px-2 py-1 t-badge', tone].join(' ')}>{item.status}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
              <div className="flex items-center gap-3 t-section text-white">
                <Icon name="ai" className="h-5 w-5 text-accent-400" />
                AI Insights
              </div>
              <span className="t-badge rounded-[999px] bg-slate-800 px-2 py-1 text-slate-400">Beta</span>
            </div>
            <div className="space-y-4 px-6 py-5">
              {insights.map((item) => {
                const tone = item.tone === 'emerald'
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : item.tone === 'rose'
                    ? 'text-rose-400 bg-rose-500/15'
                    : item.tone === 'amber'
                      ? 'text-amber-400 bg-amber-500/15'
                      : 'text-slate-400 bg-slate-800'
                return (
                  <div key={item.text} className="flex gap-3">
                    <div className={['mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]', tone].join(' ')}>
                      <Icon
                        name={item.tone === 'emerald' ? 'analytics' : item.tone === 'rose' || item.tone === 'amber' ? 'warning' : 'refresh'}
                        className="h-4 w-4"
                      />
                    </div>
                    <p className="t-insight text-slate-300">{item.text}</p>
                  </div>
                )
              })}

              <button
                type="button"
                className="mt-4 h-12 w-full rounded-[6px] border border-[var(--border-soft)] bg-transparent t-nav text-slate-200 transition-colors hover:bg-white/5"
              >
                Ask WealthPilot AI
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
