import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
import {
  ApiError,
  createCashflowEntry,
  deleteCashflowEntry,
  getCashflowEntries,
  getCashflowMonths,
  getCashflowSummary,
  type CashflowEntry,
  type CashflowEntryPayload,
  type CashflowSummary,
  updateCashflowEntry,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'

const incomeCategories = ['Salary', 'Freelance', 'Bonus', 'Interest', 'Other'] as const
const expenseCategories = ['Food', 'Grocery', 'Bike', 'Social Life', 'House Rent', 'Personal Exp', 'Utilities', 'Subscription', 'Other', 'Going Home', 'Home'] as const

type EntryType = 'income' | 'expense'

type CashflowFormState = {
  month: string
  entry_type: EntryType
  category: string
  source: string
  amount: string
  notes: string
}

type FormErrors = Partial<Record<keyof CashflowFormState, string>>

const sectionTitle = 'text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500'

function currentMonthString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const defaultForm = (month = currentMonthString()): CashflowFormState => ({
  month,
  entry_type: 'expense',
  category: 'Grocery',
  source: '',
  amount: '',
  notes: '',
})

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors.map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`).join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-')
  if (!year || !month) return value
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No updates yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No updates yet'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function getCategories(entryType: EntryType) {
  return entryType === 'income' ? [...incomeCategories] : [...expenseCategories]
}

function getTypeTone(entryType: EntryType) {
  return entryType === 'income' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
}

function toPayload(form: CashflowFormState): CashflowEntryPayload {
  return {
    month: form.month,
    entry_type: form.entry_type,
    category: form.category,
    source: form.source.trim() || null,
    amount: form.amount.trim() || '0',
    notes: form.notes.trim() || null,
  }
}

function SectionCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={['rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80', className].join(' ')}>
      {title ? <div className="border-b border-slate-200 px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:border-slate-700/50 dark:text-slate-500">{title}</div> : null}
      {children}
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

function BreakdownList({
  title,
  emptyText,
  items,
  color,
  privacyMode,
}: {
  title: string
  emptyText: string
  items: CashflowSummary['expenses_by_category']
  color: string
  privacyMode: boolean
}) {
  return (
    <SectionCard title={title} className="p-5">
      {items.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.category}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
                <div className="text-right">
                  <div className="font-mono font-semibold text-slate-900 dark:text-white">
                    <PrivateValue value={formatINR(toNumber(item.amount))} mask="••••" hideColor />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <PrivateValue value={formatPct(toNumber(item.percentage))} mask="••••" hideColor />
                  </div>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(toNumber(item.percentage), 0)}%`, backgroundColor: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

export default function CashflowPage() {
  const { privacyMode } = usePrivacyMode()
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString())
  const [months, setMonths] = useState<string[]>([])
  const [entries, setEntries] = useState<CashflowEntry[]>([])
  const [summary, setSummary] = useState<CashflowSummary | null>(null)
  const [monthsLoading, setMonthsLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [entriesError, setEntriesError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CashflowFormState>(defaultForm())
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  const availableMonths = useMemo(() => {
    const set = new Set([selectedMonth, currentMonthString(), ...months])
    return Array.from(set).sort((left, right) => right.localeCompare(left))
  }, [months, selectedMonth])

  const categoryOptions = useMemo(() => getCategories(form.entry_type), [form.entry_type])

  async function loadMonths(signal?: AbortSignal) {
    setMonthsLoading(true)
    try {
      const response = await getCashflowMonths(signal)
      setMonths(response)
    } finally {
      setMonthsLoading(false)
    }
  }

  async function loadMonthData(month: string, signal?: AbortSignal) {
    setEntriesLoading(true)
    setSummaryLoading(true)
    setEntriesError(null)
    setSummaryError(null)

    const [entriesResult, summaryResult] = await Promise.allSettled([
      getCashflowEntries(month, signal),
      getCashflowSummary(month, signal),
    ])

    if (entriesResult.status === 'fulfilled') setEntries(entriesResult.value)
    else if (entriesResult.reason?.name !== 'AbortError') {
      setEntriesError(formatApiError(entriesResult.reason))
      setEntries([])
    }
    setEntriesLoading(false)

    if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value)
    else if (summaryResult.reason?.name !== 'AbortError') {
      setSummaryError(formatApiError(summaryResult.reason))
      setSummary(null)
    }
    setSummaryLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadMonths(controller.signal).catch(() => setMonthsLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    loadMonthData(selectedMonth, controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = formatApiError(error)
      setEntriesError(message)
      setSummaryError(message)
      setEntriesLoading(false)
      setSummaryLoading(false)
    })
    return () => controller.abort()
  }, [selectedMonth])

  useEffect(() => {
    if (isModalOpen) {
      setIsDrawerMounted(true)
      const frame = window.requestAnimationFrame(() => setIsDrawerVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }
    setIsDrawerVisible(false)
    const timeout = window.setTimeout(() => setIsDrawerMounted(false), 250)
    return () => window.clearTimeout(timeout)
  }, [isModalOpen])

  useEffect(() => {
    if (!isDrawerMounted) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawerMounted])

  const latestUpdatedAt = useMemo(() => {
    const timestamps = entries.map((entry) => new Date(entry.updated_at).getTime()).filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [entries])

  const hasMonthData = (summary?.income_count ?? 0) + (summary?.expense_count ?? 0) > 0
  const incomeVsExpenseTotal = toNumber(summary?.total_income) + toNumber(summary?.total_expense)
  const incomeWidth = incomeVsExpenseTotal > 0 ? (toNumber(summary?.total_income) / incomeVsExpenseTotal) * 100 : 0
  const expenseWidth = incomeVsExpenseTotal > 0 ? (toNumber(summary?.total_expense) / incomeVsExpenseTotal) * 100 : 0
  const savingsRate = toNumber(summary?.savings_rate)
  const netSavings = toNumber(summary?.net_savings)

  const summaryCards = [
    {
      label: 'Total Income',
      value: summaryLoading ? 'Loading...' : hasMonthData ? formatINRShort(toNumber(summary?.total_income)) : 'Not added',
      meta: summaryLoading ? 'Fetching income' : `${summary?.income_count ?? 0} income entries`,
      icon: 'analytics' as const,
      tone: 'emerald' as const,
    },
    {
      label: 'Monthly Spend',
      value: summaryLoading ? 'Loading...' : hasMonthData ? formatINRShort(toNumber(summary?.total_expense)) : 'Not added',
      meta: summaryLoading ? 'Fetching expenses' : `${summary?.expense_count ?? 0} expense entries`,
      icon: 'transactions' as const,
      tone: 'rose' as const,
    },
    {
      label: 'Net Savings',
      value: summaryLoading ? 'Loading...' : hasMonthData ? formatINRShort(netSavings) : 'Not added',
      meta: summaryLoading ? 'Fetching savings' : `For ${formatMonthLabel(selectedMonth)}`,
      icon: 'netWorth' as const,
      tone: netSavings > 0 ? 'emerald' : netSavings < 0 ? 'rose' : 'slate',
    },
    {
      label: 'Savings Rate',
      value: summaryLoading ? 'Loading...' : hasMonthData ? formatPct(savingsRate) : 'Not added',
      meta: latestUpdatedAt ? `Updated ${formatDateTime(latestUpdatedAt)}` : 'No updates yet',
      icon: 'up' as const,
      tone: savingsRate > 0 ? 'emerald' : savingsRate < 0 ? 'rose' : 'slate',
    },
  ]

  function resetForm(month = selectedMonth) {
    setForm(defaultForm(month))
    setFormErrors({})
    setFormErrorMessage(null)
    setEditingId(null)
  }

  function openCreate() {
    resetForm(selectedMonth)
    setStatusMessage(null)
    setIsModalOpen(true)
  }

  function openEdit(entry: CashflowEntry) {
    setEditingId(entry.id)
    setForm({
      month: entry.month,
      entry_type: entry.entry_type,
      category: entry.category,
      source: entry.source ?? '',
      amount: String(entry.amount ?? ''),
      notes: entry.notes ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setStatusMessage(null)
    setIsModalOpen(true)
  }

  function validateForm(current: CashflowFormState) {
    const nextErrors: FormErrors = {}
    if (!/^\d{4}-\d{2}$/.test(current.month)) nextErrors.month = 'Use YYYY-MM'
    if (!current.category.trim()) nextErrors.category = 'Category is required'
    if (!current.amount.trim()) nextErrors.amount = 'Amount is required'
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: SyntheticEvent) {
    event.preventDefault()
    setFormErrorMessage(null)
    if (!validateForm(form)) return

    const payload = toPayload(form)
    setIsSaving(true)
    try {
      if (editingId === null) {
        await createCashflowEntry(payload)
        setStatusTone('emerald')
        setStatusMessage('Cashflow entry added')
      } else {
        await updateCashflowEntry(editingId, payload)
        setStatusTone('emerald')
        setStatusMessage('Cashflow entry updated')
      }

      setIsModalOpen(false)
      await Promise.all([loadMonths(), loadMonthData(selectedMonth)])
      resetForm(selectedMonth)
    } catch (error) {
      setFormErrorMessage(formatApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(entry: CashflowEntry) {
    if (!window.confirm(`Delete ${entry.category} entry for ${entry.month}?`)) return
    try {
      await deleteCashflowEntry(entry.id)
      setStatusTone('amber')
      setStatusMessage('Cashflow entry removed')
      await Promise.all([loadMonths(), loadMonthData(selectedMonth)])
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
          <Icon name="transactions" className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Monthly Cashflow</span>
          <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">· Monthly income, category spends, and savings rate</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-teal-400 active:scale-[0.98]"
        >
          <Icon name="add" className="h-4 w-4" />
          Add Entry
        </button>
      </div>

      {statusMessage ? (
        <div className={['flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', statusTone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : statusTone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : statusTone === 'rose' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-900 text-slate-300'].join(' ')}>
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <SectionCard className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className={sectionTitle}>Month</div>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={sectionTitle}>Manual Month</div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {monthsLoading ? 'Loading saved months…' : `${availableMonths.length} month${availableMonths.length === 1 ? '' : 's'} available`}
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SectionCard key={card.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={sectionTitle}>{card.label}</div>
                <div className={['mt-2 font-mono text-2xl font-bold tabular-nums', card.tone === 'emerald' ? privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-emerald-400' : card.tone === 'rose' ? privacyMode ? 'text-slate-300 dark:text-slate-300' : 'text-rose-400' : 'text-slate-900 dark:text-white'].join(' ')}>
                  {card.label === 'Savings Rate' ? <PrivateValue value={card.value} mask="••••" hideColor /> : card.value === 'Not added' || card.value === 'Loading...' ? card.value : <PrivateValue value={card.value} mask="••••" hideColor />}
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{card.meta}</div>
              </div>
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Icon name={card.icon} className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              </div>
            </div>
          </SectionCard>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title="Income vs Expense" className="p-5">
          {summaryError ? (
            <div className="text-sm text-rose-400">{summaryError}</div>
          ) : !hasMonthData ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">No cashflow entries for this month</div>
          ) : (
            <div>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-emerald-400" style={{ width: `${incomeWidth}%` }} />
                <div className="h-full bg-rose-400" style={{ width: `${expenseWidth}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Income</div>
                  <div className="mt-1 font-mono font-semibold text-emerald-400"><PrivateValue value={formatINR(toNumber(summary?.total_income))} mask="••••" hideColor /></div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Expense</div>
                  <div className="mt-1 font-mono font-semibold text-rose-400"><PrivateValue value={formatINR(toNumber(summary?.total_expense))} mask="••••" hideColor /></div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">Savings</div>
                  <div className={['mt-1 font-mono font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(netSavings)].join(' ')}>
                    <PrivateValue value={formatINR(netSavings)} mask="••••" hideColor />
                  </div>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <BreakdownList title="Expense Breakdown" emptyText="No expense categories for this month" items={summary?.expenses_by_category ?? []} color="#fb7185" privacyMode={privacyMode} />
        <BreakdownList title="Income Breakdown" emptyText="No income categories for this month" items={summary?.income_by_category ?? []} color="#34d399" privacyMode={privacyMode} />
      </div>

      <SectionCard title="Entries">
        {entriesLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading cashflow entries…</div>
        ) : entriesError ? (
          <div className="px-6 py-10 text-center text-sm text-rose-400">{entriesError}</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-base font-semibold text-slate-900 dark:text-white">No cashflow entries for this month</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add income and category spends from your Money Manager summary.</div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-teal-400 active:scale-[0.98]"
            >
              <Icon name="add" className="h-4 w-4" />
              Add Entry
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200 dark:border-slate-700/50">
                <tr className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
                  <th className="px-6 py-3">Month</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 text-sm transition-colors duration-150 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{formatMonthLabel(entry.month)}</td>
                    <td className="px-4 py-3">
                      <span className={['inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', getTypeTone(entry.entry_type)].join(' ')}>
                        {entry.entry_type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{entry.category}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{entry.source || '—'}</td>
                    <td className={['px-4 py-3 font-mono font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : entry.entry_type === 'income' ? 'text-emerald-400' : 'text-rose-400'].join(' ')}>
                      <PrivateValue value={formatINR(toNumber(entry.amount))} mask="••••" hideColor />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{entry.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEdit(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-200 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(entry)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 text-rose-400 transition-colors duration-200 hover:bg-rose-500/10">
                          <Icon name="remove" className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {isDrawerMounted ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button type="button" aria-label="Close cashflow drawer" onClick={() => setIsModalOpen(false)} className={['absolute inset-0 bg-slate-950/55 transition-opacity duration-200', isDrawerVisible ? 'opacity-100' : 'pointer-events-none opacity-0'].join(' ')} />
          <div className={['absolute inset-y-0 right-0 flex w-full max-w-xl transform flex-col border-l border-slate-700/60 bg-slate-950 shadow-2xl transition-all duration-250 ease-out', isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'].join(' ')}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-lg font-semibold text-white">{editingId === null ? 'Add Entry' : 'Edit Entry'}</div>
                <div className="mt-1 text-sm text-slate-400">Monthly income or expense summary entry</div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors duration-200 hover:bg-slate-800 active:scale-95">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {formErrorMessage ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{formErrorMessage}</div> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Month" error={formErrors.month}>
                    <input type="month" value={form.month} onChange={(event) => setForm((current) => ({ ...current, month: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400" />
                  </FormField>
                  <FormField label="Type" error={formErrors.entry_type}>
                    <select
                      value={form.entry_type}
                      onChange={(event) => {
                        const nextType = event.target.value as EntryType
                        const nextCategories = getCategories(nextType)
                        setForm((current) => ({ ...current, entry_type: nextType, category: nextCategories[0] }))
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    >
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </FormField>
                  <FormField label="Category" error={formErrors.category}>
                    <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400">
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Source" error={formErrors.source}>
                    <input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400" />
                  </FormField>
                  <FormField label="Amount" error={formErrors.amount}>
                    <input inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400" />
                  </FormField>
                </div>
                <FormField label="Notes" error={formErrors.notes}>
                  <textarea rows={4} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400" />
                </FormField>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:bg-slate-800 active:scale-[0.98]">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-teal-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                  <Icon name="add" className="h-4 w-4" />
                  {isSaving ? 'Saving...' : editingId === null ? 'Add Entry' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
