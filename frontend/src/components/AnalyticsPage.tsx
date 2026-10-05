import { useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AnalyticsCategoryAverageItem, AnalyticsSummary, PortfolioIntelligence, PortfolioPerformanceData, PortfolioRange } from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useAnalyticsSummaryQuery, useDashboardSummaryQuery, usePortfolioIntelligenceQuery, usePortfolioPerformanceQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { secondaryButtonClass } from '../styles/buttonStyles'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'

const colors = ['#2dd4bf', '#60a5fa', '#a78bfa', '#fbbf24', '#fb7185', '#34d399', '#94a3b8']
const ranges: PortfolioRange[] = ['1M', '3M', '6M', '1Y', 'ALL']
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/75'

function valueOf(value: string | number | null | undefined) { return Number(value ?? 0) }
function money(value: number) { return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value) }
function month(value: string) {
  const date = new Date(`${value}-01T00:00:00`)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
}
function date(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(parsed)
}

function Card({ eyebrow, title, children, className = '' }: { eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return <section className={`${panel} ${className}`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p><h2 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>{children}</section>
}

function TooltipCard({ active, payload, label, hidden }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string; hidden: boolean }) {
  if (!active || !payload?.length) return null
  return <div className="min-w-36 rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 text-xs shadow-2xl">
    <p className="mb-1.5 font-semibold text-slate-200">{label}</p>
    {payload.map((item) => <div key={item.name} className="flex items-center gap-2 py-0.5 text-slate-400"><i className="h-2 w-2 rounded-full" style={{ background: item.color }} />{item.name}<span className="ml-auto pl-5 font-medium text-white">{hidden ? '••••' : money(valueOf(item.value))}</span></div>)}
  </div>
}

function Empty({ children }: { children: ReactNode }) { return <div className="grid h-52 place-items-center rounded-xl border border-dashed border-slate-700 px-5 text-center text-sm text-slate-500">{children}</div> }

export default function AnalyticsPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<PortfolioRange>('6M')
  const intelligenceQuery = usePortfolioIntelligenceQuery()
  const analyticsQuery = useAnalyticsSummaryQuery()
  const dashboardQuery = useDashboardSummaryQuery()
  const performanceQuery = usePortfolioPerformanceQuery(range)
  const intelligence = intelligenceQuery.data as PortfolioIntelligence | undefined
  const analytics = analyticsQuery.data as AnalyticsSummary | undefined
  const performance = performanceQuery.data as PortfolioPerformanceData | undefined
  const dashboard = dashboardQuery.data
  const flow = analytics?.cashflow_analytics
  const investments = analytics?.investment_analytics
  const goals = analytics?.goals_analytics
  const snapshots = useMemo(() => (performance?.snapshots ?? []).map((item) => ({ label: date(item.date), value: valueOf(item.total_value) })), [performance])
  const cashflow = useMemo(() => (flow?.monthly_trend ?? []).map((item) => ({ label: month(item.month), income: valueOf(item.income), spend: valueOf(item.expense), savings: valueOf(item.net_savings) })), [flow])
  const allocation = (investments?.bucket_allocation ?? []).filter((item) => valueOf(item.value) > 0)
  const expenseMix = flow?.current_expense_by_category?.length ? flow.current_expense_by_category : (flow?.average_expense_by_category ?? [])
  const incomeMix = flow?.current_income_by_category?.length ? flow.current_income_by_category : (flow?.average_income_by_category ?? [])
  // Recharts renders Pie slices only from numeric values. API decimals arrive as strings.
  const allocationChart = useMemo(() => allocation.map((item) => ({ ...item, value: valueOf(item.value) })), [allocation])
  const expenseMixChart = useMemo(() => expenseMix.map((item) => ({ ...item, value: valueOf(item.average_amount) })), [expenseMix])
  const incomeMixChart = useMemo(() => incomeMix.map((item) => ({ ...item, value: valueOf(item.average_amount) })), [incomeMix])
  const rangeChange = performance?.summary.change_pct == null ? null : valueOf(performance.summary.change_pct)
  const currentMonthLabel = flow?.current_month ? month(flow.current_month) : 'latest tracked month'
  const hasErrors = [intelligenceQuery.error, analyticsQuery.error, dashboardQuery.error, performanceQuery.error].some(Boolean)
  const goalsChart = [{ name: 'On track', value: goals?.on_track_count ?? 0 }, { name: 'Watch', value: goals?.watch_count ?? 0 }, { name: 'Behind', value: goals?.behind_count ?? 0 }, { name: 'Completed', value: goals?.completed_count ?? 0 }].filter((item) => item.value > 0)
  const utilization = Math.min(100, valueOf(dashboard?.overall_card_utilization))

  const refresh = async () => { await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.portfolioIntelligence }),
    queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
    queryClient.invalidateQueries({ queryKey: ['portfolio', 'performance'] }),
  ]) }

  const performanceNarrative = useMemo(() => {
    if (rangeChange === null) return 'Save portfolio snapshots regularly to establish a comparable trend.'
    if (rangeChange < 0) {
      const names = intelligence?.top_movers.biggest_losers.slice(0, 2).map((item) => item.symbol).join(' and ')
      return `The portfolio is down ${formatPct(Math.abs(rangeChange))} over this range.${names ? ` ${names} are the largest current detractors.` : ''} Review position size and your original thesis before making changes.`
    }
    return `The portfolio is up ${formatPct(rangeChange)} over this range. Compare future updates using the same range to separate actual progress from short-term movement.`
  }, [intelligence, rangeChange])

  const labelForCategory = (item: AnalyticsCategoryAverageItem) => item.category

  return <div className="space-y-5 pb-10">
    <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-5 shadow-sm dark:border-slate-700/60 dark:from-slate-900 dark:to-slate-900/70">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-500/15 text-teal-400"><Icon name="analytics" className="h-5 w-5" /></span><div><h1 className="text-lg font-semibold text-slate-900 dark:text-white">Your financial story</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Visual trends across portfolio, cashflow, credit, and goals.</p></div></div><button type="button" onClick={refresh} className={secondaryButtonClass}><Icon name="refresh" className="h-3.5 w-3.5" />Refresh data</button></div>
      <div className="mt-5 grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-700/60 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Portfolio value</p><p className="mt-1 font-mono text-xl font-semibold text-slate-900 dark:text-white"><PrivateValue value={performance?.summary.latest_value == null ? '—' : money(valueOf(performance.summary.latest_value))} mask="••••" hideColor /></p></div><div><p className="text-xs text-slate-500">Savings rate · {currentMonthLabel}</p><p className="mt-1 font-mono text-xl font-semibold text-teal-400"><PrivateValue value={flow?.current_month_summary.savings_rate == null ? '—' : formatPct(valueOf(flow.current_month_summary.savings_rate))} mask="••••" hideColor /></p></div><div><p className="text-xs text-slate-500">Tracked coverage</p><p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{performance?.summary.snapshot_count ?? 0} <span className="text-sm font-normal text-slate-500">snapshots · {flow?.months_count ?? 0} months</span></p></div></div>
    </header>
    {hasErrors && <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Some data could not refresh. The charts below show the records that are available.</div>}

    <Card eyebrow="Portfolio movement" title="How your investments have moved" className="overflow-hidden">
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><span className={`font-mono text-2xl font-semibold ${rangeChange === null ? 'text-slate-300' : privacyMode ? 'text-slate-300' : getTrendClass(rangeChange)}`}><PrivateValue value={rangeChange === null ? '—' : `${rangeChange > 0 ? '+' : ''}${formatPct(rangeChange)}`} mask="••••" hideColor /></span><span className="ml-2 text-xs text-slate-500">change in selected range</span></div><div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">{ranges.map((item) => <button key={item} type="button" onClick={() => setRange(item)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${range === item ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{item}</button>)}</div></div>
      <div className="mt-4 h-72">{snapshots.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={snapshots} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}><defs><linearGradient id="portfolioGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={rangeChange != null && rangeChange < 0 ? '#fb7185' : '#2dd4bf'} stopOpacity=".3"/><stop offset="1" stopColor={rangeChange != null && rangeChange < 0 ? '#fb7185' : '#2dd4bf'} stopOpacity="0"/></linearGradient></defs><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false}/><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={28}/><YAxis width={70} tickFormatter={(v: number) => privacyMode ? '•••' : formatINRShort(v)} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}/><Tooltip content={<TooltipCard hidden={privacyMode}/>}/><Area type="monotone" dataKey="value" name="Portfolio" stroke={rangeChange != null && rangeChange < 0 ? '#fb7185' : '#2dd4bf'} strokeWidth={2.5} fill="url(#portfolioGradient)"/></AreaChart></ResponsiveContainer> : <Empty>Save snapshots to show your portfolio trend.</Empty>}</div>
      <p className="mt-3 rounded-xl border border-slate-700/50 bg-slate-950/20 px-4 py-3 text-sm leading-relaxed text-slate-400">{performanceNarrative}</p>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
      <Card eyebrow="Cashflow timeline" title="Income, spending, and what you kept">
        <p className="mt-2 text-xs text-slate-500">Every month recorded in your database is shown, including September and partially recorded months.</p>
        <div className="mt-4 h-64">{cashflow.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={cashflow} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={4}><CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false}/><XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis width={66} tickFormatter={(v: number) => privacyMode ? '•••' : formatINRShort(v)} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}/><Tooltip content={<TooltipCard hidden={privacyMode}/>}/><Bar dataKey="income" name="Income" fill="#2dd4bf" radius={[5, 5, 0, 0]}/><Bar dataKey="spend" name="Spend" fill="#fb7185" radius={[5, 5, 0, 0]}/><Line type="monotone" dataKey="savings" name="Saved" stroke="#60a5fa" strokeWidth={2.5} dot={{ r: 3 }}/></BarChart></ResponsiveContainer> : <Empty>Add transactions to see your month-by-month cashflow.</Empty>}</div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-400"/>Income</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400"/>Spend</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-400"/>Saved</span></div>
      </Card>
      <Card eyebrow="Asset allocation" title="Where your money is held">
        {allocation.length ? <div className="mt-2 grid items-center gap-3 sm:grid-cols-[190px_1fr]"><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={allocationChart} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={57} outerRadius={88} paddingAngle={3} stroke="none">{allocationChart.map((item, index) => <Cell key={item.key} fill={colors[index % colors.length]}/>)}</Pie><Tooltip content={<TooltipCard hidden={privacyMode} />} /></PieChart></ResponsiveContainer></div><div className="space-y-3">{allocation.map((item, index) => <div key={item.key} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }}/><span className="min-w-0 flex-1 truncate text-sm text-slate-400">{item.label}</span><span className="text-xs font-medium text-slate-200"><PrivateValue value={formatPct(valueOf(item.percentage))} mask="••" hideColor /></span></div>)}</div></div> : <Empty>Add holdings, banks, or savings accounts to see allocation.</Empty>}
      </Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card eyebrow={`Expense mix · ${currentMonthLabel}`} title="What this month’s spending went toward">
        <div className="mt-3 grid items-center gap-3 sm:grid-cols-[190px_1fr]">{expenseMix.length ? <><div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseMixChart} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2} stroke="none">{expenseMixChart.map((item, index) => <Cell key={item.category} fill={colors[index % colors.length]}/>)}</Pie><Tooltip content={<TooltipCard hidden={privacyMode} />} /></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{expenseMix.slice(0, 6).map((item, index) => <div key={item.category} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }}/><span className="min-w-0 flex-1 truncate text-sm text-slate-400">{labelForCategory(item)}</span><span className="text-xs text-slate-200"><PrivateValue value={formatPct(valueOf(item.percentage_of_avg_spend))} mask="••" hideColor /></span></div>)}</div></> : <Empty>No expense categories for {currentMonthLabel}.</Empty>}</div>
      </Card>
      <Card eyebrow={`Income mix · ${currentMonthLabel}`} title="What funded the month">
        <div className="mt-3 grid items-center gap-3 sm:grid-cols-[190px_1fr]">{incomeMix.length ? <><div className="h-52"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={incomeMixChart} dataKey="value" nameKey="category" cx="50%" cy="50%" innerRadius={48} outerRadius={82} paddingAngle={2} stroke="none">{incomeMixChart.map((item, index) => <Cell key={item.category} fill={colors[index % colors.length]}/>)}</Pie><Tooltip content={<TooltipCard hidden={privacyMode} />} /></PieChart></ResponsiveContainer></div><div className="space-y-2.5">{incomeMix.slice(0, 6).map((item, index) => <div key={item.category} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: colors[index % colors.length] }}/><span className="min-w-0 flex-1 truncate text-sm text-slate-400">{labelForCategory(item)}</span><span className="text-xs text-slate-200"><PrivateValue value={formatPct(valueOf(item.percentage_of_avg_income))} mask="••" hideColor /></span></div>)}</div></> : <Empty>No income categories for {currentMonthLabel}.</Empty>}</div>
      </Card>
    </div>

    <div className="grid gap-5 xl:grid-cols-3">
      <Card eyebrow="Holdings" title="Largest positions" className="xl:col-span-1">{(investments?.top_holdings ?? []).length ? <div className="mt-4 space-y-3">{investments?.top_holdings.map((item) => <div key={item.symbol}><div className="flex justify-between gap-3 text-sm"><span className="truncate text-slate-300">{item.symbol}</span><span className={valueOf(item.return_pct) >= 0 ? 'text-teal-400' : 'text-rose-400'}><PrivateValue value={item.return_pct === null ? '—' : formatPct(valueOf(item.return_pct))} mask="••" hideColor /></span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(100, valueOf(item.percentage_of_portfolio))}%` }}/></div></div>)}</div> : <Empty>Add holdings to compare positions.</Empty>}</Card>
      <Card eyebrow="Goals" title="Progress at a glance" className="xl:col-span-1">{goalsChart.length ? <div className="mt-1 grid items-center sm:grid-cols-[150px_1fr]"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={goalsChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={43} outerRadius={70} paddingAngle={3} stroke="none">{goalsChart.map((item, index) => <Cell key={item.name} fill={['#60a5fa', '#fbbf24', '#fb7185', '#34d399'][index]}/>)}</Pie><Tooltip content={<TooltipCard hidden={privacyMode} />} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{goalsChart.map((item, index) => <div key={item.name} className="flex items-center gap-2 text-sm"><i className="h-2 w-2 rounded-full" style={{ background: ['#60a5fa', '#fbbf24', '#fb7185', '#34d399'][index] }}/><span className="flex-1 text-slate-400">{item.name}</span><span className="text-slate-200">{item.value}</span></div>)}</div></div> : <Empty>Add goals to track their status.</Empty>}</Card>
      <Card eyebrow="Credit health" title="Card utilisation" className="xl:col-span-1"><div className="mt-2 grid items-center sm:grid-cols-[145px_1fr]"><div className="h-44"><ResponsiveContainer width="100%" height="100%"><RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="90%" startAngle={90} endAngle={-270} data={[{ value: utilization, fill: utilization > 50 ? '#fbbf24' : '#2dd4bf' }]}><RadialBar background={{ fill: '#1e293b' }} dataKey="value" cornerRadius={8}/></RadialBarChart></ResponsiveContainer></div><div><p className="font-mono text-2xl font-semibold text-slate-100"><PrivateValue value={formatPct(utilization)} mask="••••" hideColor /></p><p className="mt-1 text-sm text-slate-500">of available credit used</p><p className="mt-3 text-xs text-slate-400">{dashboard?.overdue_count ? `${dashboard.overdue_count} overdue payment${dashboard.overdue_count === 1 ? '' : 's'} need attention.` : dashboard?.due_soon_count ? `${dashboard.due_soon_count} payment${dashboard.due_soon_count === 1 ? '' : 's'} due soon.` : 'No overdue payments.'}</p></div></div></Card>
    </div>
  </div>
}
