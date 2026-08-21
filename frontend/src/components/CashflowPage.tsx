import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
import {
  ApiError,
  createCashflowEntry,
  createGoalEMIPayment,
  deleteCashflowEntry,
  deleteGoalEMIPayment,
  updateFinancialGoal,
  type EMIPayment,
  type FinancialGoal,
  type CashflowEntry,
  type CashflowEntryPayload,
  type CashflowSummary,
  updateCashflowEntry,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { useCashflowEntriesQuery, useCashflowMonthsQuery, useCashflowSummaryQuery, useFinancialGoalsQuery, useGoalEMIPaymentsQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

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

function getGoalLifecycleTone(status: FinancialGoal['status']) {
  if (status === 'achieved') return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
  if (status === 'paused') return 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
  if (status === 'cancelled') return 'bg-slate-700/70 text-slate-300 border border-slate-600/70'
  return 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
}

function getGoalLifecycleLabel(status: FinancialGoal['status']) {
  if (status === 'achieved') return 'Achieved'
  if (status === 'paused') return 'Paused'
  if (status === 'cancelled') return 'Cancelled'
  return 'Active'
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
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState<'monthly' | 'emi'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString())
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
  const [selectedEMIGoalId, setSelectedEMIGoalId] = useState<number | null>(null)
  const [customPlannedEmiAmount, setCustomPlannedEmiAmount] = useState('')
  const [customPlannedEmiMonths, setCustomPlannedEmiMonths] = useState('')
  const [isEMIPlanSaved, setIsEMIPlanSaved] = useState(false)
  const [isEMISettingsSaving, setIsEMISettingsSaving] = useState(false)
  const createEmptyEMIRow = () => {
    const total = Number(0)
    return {
      id: `emi-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      payment_month: currentMonthString(),
      payment_date: new Date().toISOString().slice(0, 10),
      principal_amount: '',
      interest_amount: '',
      gst_amount: '',
      amount: '',
      notes: '',
    }
  }
  const [emiPaymentForm, setEmiPaymentForm] = useState({
    processing_fee: '',
    processing_fee_gst: '',
  })
  const [emiPaymentRows, setEmiPaymentRows] = useState<Array<{ id: string; payment_month: string; payment_date: string; principal_amount: string; interest_amount: string; gst_amount: string; amount: string; notes: string }>>([
    createEmptyEMIRow(),
  ])

  function createEMIRows(count: number) {
    const today = new Date()
    return Array.from({ length: Math.max(count, 1) }, (_, index) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + index, 1)
      const paymentMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      return { ...createEmptyEMIRow(), payment_month: paymentMonth }
    })
  }

  const updateEMIRow = (rowId: string, patch: Partial<{ payment_month: string; payment_date: string; principal_amount: string; interest_amount: string; gst_amount: string; amount: string; notes: string }>) => {
    setEmiPaymentRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const nextRow = { ...row, ...patch }
        const principal = Number(nextRow.principal_amount || 0)
        const interest = Number(nextRow.interest_amount || 0)
        const gst = Number(nextRow.gst_amount || 0)
        const total = principal + interest + gst
        return {
          ...nextRow,
          amount: total > 0 ? total.toFixed(2) : '',
        }
      }),
    )
  }
  const [emiPaymentError, setEmiPaymentError] = useState<string | null>(null)
  const [isEMIPaymentSaving, setIsEMIPaymentSaving] = useState(false)

  const monthsQuery = useCashflowMonthsQuery()
  const entriesQuery = useCashflowEntriesQuery(selectedMonth)
  const summaryQuery = useCashflowSummaryQuery(selectedMonth)
  const goalsQuery = useFinancialGoalsQuery()
  const months = monthsQuery.data ?? []
  const entries = (entriesQuery.data as CashflowEntry[] | undefined) ?? []
  const summary = (summaryQuery.data as CashflowSummary | undefined) ?? null
  const goals = (goalsQuery.data as FinancialGoal[] | undefined) ?? []
  const monthsLoading = monthsQuery.isLoading
  const entriesLoading = entriesQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const goalsLoading = goalsQuery.isLoading
  const entriesError = entriesQuery.error ? formatApiError(entriesQuery.error) : null
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null

  const availableMonths = useMemo(() => {
    const set = new Set([selectedMonth, currentMonthString(), ...months])
    return Array.from(set).sort((left, right) => right.localeCompare(left))
  }, [months, selectedMonth])

  const selectedEMIGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedEMIGoalId) ?? null,
    [goals, selectedEMIGoalId],
  )
  const emiPaymentsQuery = useGoalEMIPaymentsQuery(selectedEMIGoalId)
  const emiPayments = (emiPaymentsQuery.data as EMIPayment[] | undefined) ?? []

  useEffect(() => {
    if (!selectedEMIGoal || emiPaymentsQuery.isLoading) return
    if (customPlannedEmiAmount === '') {
      setCustomPlannedEmiAmount(selectedEMIGoal.emi_monthly_amount == null ? String(selectedEMIGoal.required_monthly_saving ?? '') : String(selectedEMIGoal.emi_monthly_amount))
    }
    if (customPlannedEmiMonths === '') {
      setCustomPlannedEmiMonths(selectedEMIGoal.emi_total_months == null ? String(selectedEMIGoal.months_remaining ?? '') : String(selectedEMIGoal.emi_total_months))
    }
    if (emiPaymentForm.processing_fee === '' && emiPayments[0]) {
      setEmiPaymentForm((current) => ({ ...current, processing_fee: String(emiPayments[0].processing_fee ?? '') }))
    }
    if (emiPaymentForm.processing_fee_gst === '' && emiPayments[0]) {
      setEmiPaymentForm((current) => ({ ...current, processing_fee_gst: String(emiPayments[0].processing_fee_gst ?? '') }))
    }
  }, [customPlannedEmiAmount, customPlannedEmiMonths, emiPaymentForm.processing_fee, emiPaymentForm.processing_fee_gst, emiPayments, emiPaymentsQuery.isLoading, selectedEMIGoal])

  useEffect(() => {
    if (!selectedEMIGoalId || emiPaymentsQuery.isLoading || emiPayments.length === 0) return
    setEmiPaymentRows((current) => current.map((row) => {
      const savedPayment = emiPayments.find((payment) => payment.payment_month === row.payment_month)
      if (!savedPayment) return row
      return {
        ...row,
        payment_date: savedPayment.payment_date,
        principal_amount: String(savedPayment.principal_amount),
        interest_amount: String(savedPayment.interest_amount),
        gst_amount: String(savedPayment.gst_amount),
        amount: String(savedPayment.amount),
        notes: savedPayment.notes ?? '',
      }
    }))
  }, [emiPayments, emiPaymentsQuery.isLoading, selectedEMIGoalId])

  const categoryOptions = useMemo(() => getCategories(form.entry_type), [form.entry_type])

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
  const emiGoals = useMemo(() => {
    return [...goals]
      .filter((goal) => goal.is_emi && goal.status !== 'cancelled')
      .sort((left, right) => {
        const leftStatus = left.status === 'active' ? 0 : left.status === 'paused' ? 1 : 2
        const rightStatus = right.status === 'active' ? 0 : right.status === 'paused' ? 1 : 2
        if (leftStatus !== rightStatus) return leftStatus - rightStatus
        return toNumber(right.progress_pct) - toNumber(left.progress_pct)
      })
  }, [goals])
  const emiActiveCount = emiGoals.filter((goal) => goal.status === 'active' || goal.status === 'paused').length
  const emiTotalTarget = emiGoals.reduce((acc, goal) => acc + toNumber(goal.target_amount), 0)
  const emiTotalPaid = emiGoals.reduce((acc, goal) => acc + toNumber(goal.resolved_current_amount ?? goal.current_amount), 0)
  const emiTotalRemaining = Math.max(emiTotalTarget - emiTotalPaid, 0)
  const emiMonthlyRequired = emiGoals.reduce((acc, goal) => acc + toNumber(goal.required_monthly_saving), 0)

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

  async function refreshData(month = selectedMonth) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowMonths }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowEntries(month) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowSummary(month) }),
      queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports('monthly-cashflow') }),
    ])
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
      await refreshData(payload.month)
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
      await refreshData(entry.month)
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  const selectedEMIPlannedMonthlyAmount = useMemo(() => {
    return Number(customPlannedEmiAmount || 0)
  }, [customPlannedEmiAmount])

  const selectedEMIPlannedMonths = useMemo(() => {
    return Number(customPlannedEmiMonths || 0)
  }, [customPlannedEmiMonths])

  const remainingAmountAfterPlan = isEMIPlanSaved ? Math.max(toNumber(selectedEMIGoal?.target_amount) - toNumber(selectedEMIGoal?.resolved_current_amount ?? selectedEMIGoal?.current_amount), 0) : 0
  const remainingMonthsAfterPlan = isEMIPlanSaved ? toNumber(selectedEMIGoal?.months_remaining) : 0

  function openEMIGoalDetails(goal: FinancialGoal) {
    setSelectedEMIGoalId(goal.id)
    setCustomPlannedEmiAmount(goal.emi_monthly_amount == null ? '' : String(goal.emi_monthly_amount))
    setCustomPlannedEmiMonths(goal.emi_total_months == null ? '' : String(goal.emi_total_months))
    setIsEMIPlanSaved(goal.emi_monthly_amount != null && goal.emi_total_months != null)
    setEmiPaymentForm({
      processing_fee: goal.emi_processing_fee == null ? '' : String(goal.emi_processing_fee),
      processing_fee_gst: goal.emi_processing_fee_gst == null ? '' : String(goal.emi_processing_fee_gst),
    })
    setEmiPaymentRows(createEMIRows(goal.emi_total_months ?? goal.months_remaining ?? 1))
    setEmiPaymentError(null)
  }

  async function saveEMISetup() {
    if (!selectedEMIGoalId || !customPlannedEmiAmount || !customPlannedEmiMonths) {
      setEmiPaymentError('Enter the monthly EMI amount and number of months before saving.')
      return
    }
    setIsEMISettingsSaving(true)
    setEmiPaymentError(null)
    try {
      await updateFinancialGoal(selectedEMIGoalId, {
        emi_monthly_amount: customPlannedEmiAmount,
        emi_total_months: Number(customPlannedEmiMonths),
        emi_processing_fee: emiPaymentForm.processing_fee || undefined,
        emi_processing_fee_gst: emiPaymentForm.processing_fee_gst || undefined,
      })
      setIsEMIPlanSaved(true)
      setEmiPaymentRows(createEMIRows(Number(customPlannedEmiMonths)))
      await queryClient.invalidateQueries({ queryKey: ['goals'] })
    } catch (error) {
      setEmiPaymentError(formatApiError(error))
    } finally {
      setIsEMISettingsSaving(false)
    }
  }

  async function addEMIPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedEMIGoalId) return

    const processingFee = Number(emiPaymentForm.processing_fee || 0)
    const processingFeeGst = Number(emiPaymentForm.processing_fee_gst || 0)
    const rowsToSave = emiPaymentRows.filter((row) => {
      const principal = Number(row.principal_amount || 0)
      const interest = Number(row.interest_amount || 0)
      const gst = Number(row.gst_amount || 0)
      return row.payment_month || row.payment_date || principal > 0 || interest > 0 || gst > 0
    })

    if (rowsToSave.length === 0) {
      setEmiPaymentError('Add at least one monthly EMI row with a valid amount.')
      return
    }

    const hasInvalidRow = rowsToSave.some((row) => {
      const principal = Number(row.principal_amount || 0)
      const interest = Number(row.interest_amount || 0)
      const gst = Number(row.gst_amount || 0)
      const total = principal + interest + gst
      return !row.payment_month || !row.payment_date || total <= 0
    })

    if (hasInvalidRow) {
      setEmiPaymentError('Please fill month, date, and total amount for each payment row.')
      return
    }

    setIsEMIPaymentSaving(true)
    setEmiPaymentError(null)

    try {
      await updateFinancialGoal(selectedEMIGoalId, {
        emi_monthly_amount: customPlannedEmiAmount || undefined,
        emi_total_months: customPlannedEmiMonths ? Number(customPlannedEmiMonths) : undefined,
        emi_processing_fee: emiPaymentForm.processing_fee || undefined,
        emi_processing_fee_gst: emiPaymentForm.processing_fee_gst || undefined,
      })
      for (const row of rowsToSave) {
        const principal = Number(row.principal_amount || 0)
        const interest = Number(row.interest_amount || 0)
        const gst = Number(row.gst_amount || 0)
        const totalAmount = principal + interest + gst

        await createGoalEMIPayment(selectedEMIGoalId, {
          payment_month: row.payment_month,
          payment_date: row.payment_date,
          principal_amount: String(principal),
          interest_amount: String(interest),
          gst_amount: String(gst),
          processing_fee: String(processingFee),
          processing_fee_gst: String(processingFeeGst),
          amount: String(totalAmount),
          notes: row.notes.trim() || null,
        })
      }

      setEmiPaymentRows(createEMIRows(selectedEMIGoal?.emi_total_months ?? selectedEMIGoal?.months_remaining ?? emiPaymentRows.length))
      await queryClient.invalidateQueries({ queryKey: ['goals'] })
      await queryClient.invalidateQueries({ queryKey: ['goalEMIPayments', selectedEMIGoalId] })
      setStatusTone('emerald')
      setStatusMessage('EMI payments recorded.')
    } catch (error) {
      setEmiPaymentError(formatApiError(error))
    } finally {
      setIsEMIPaymentSaving(false)
    }
  }

  async function deleteEMIPayment(payment: EMIPayment) {
    if (!selectedEMIGoalId) return
    if (!window.confirm(`Delete EMI payment of ${formatINRShort(Number(payment.amount))}?`)) return

    try {
      await deleteGoalEMIPayment(selectedEMIGoalId, payment.id)
      await queryClient.invalidateQueries({ queryKey: ['goals'] })
      await queryClient.invalidateQueries({ queryKey: ['goalEMIPayments', selectedEMIGoalId] })
      setStatusTone('amber')
      setStatusMessage('EMI payment removed.')
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
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Transactions</span>
          <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">· Cashflow and global EMI tracking</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
          </div>
        </div>
        {activeView === 'monthly' ? (
          <button
            type="button"
            onClick={openCreate}
            className={primaryButtonClass}
          >
            <Icon name="add" className="h-4 w-4" />
            Add Entry
          </button>
        ) : null}
      </div>

      <SectionCard className="p-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveView('monthly')}
            className={[
              'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              activeView === 'monthly'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            Monthly Cashflow
          </button>
          <button
            type="button"
            onClick={() => setActiveView('emi')}
            className={[
              'rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors',
              activeView === 'emi'
                ? 'bg-teal-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
            ].join(' ')}
          >
            EMI Tracker
          </button>
        </div>
      </SectionCard>

      {statusMessage ? (
        <div className={['flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm', statusTone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : statusTone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : statusTone === 'rose' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-slate-700 bg-slate-900 text-slate-300'].join(' ')}>
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {selectedEMIGoal ? (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-sm"
          onClick={() => setSelectedEMIGoalId(null)}
        >
          <section
            className="relative z-10 flex h-full w-full max-w-[96vw] xl:max-w-[1440px] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-800 dark:bg-[#081225]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-[#0d1930]">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-teal-500/15 text-teal-400"><Icon name="transactions" className="h-4 w-4" /></div>
                  <div>
                    <div className="text-base font-semibold text-slate-900 dark:text-white">{selectedEMIGoal.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">EMI workspace <span className="mx-1 text-slate-400">/</span> payment schedule</div>
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedEMIGoalId(null)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800">
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 px-7 py-7 dark:bg-[#081225]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className={sectionTitle}>Paid so far</div>
                    <div className="mt-2 font-mono text-xl font-bold text-emerald-400">
                      <PrivateValue value={formatINRShort(toNumber(selectedEMIGoal.resolved_current_amount ?? selectedEMIGoal.current_amount))} mask="••••" hideColor />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className={sectionTitle}>Remaining amt</div>
                    <div className="mt-2 font-mono text-xl font-bold text-rose-400">
                      <PrivateValue value={formatINRShort(Math.max(toNumber(selectedEMIGoal.target_amount) - toNumber(selectedEMIGoal.resolved_current_amount ?? selectedEMIGoal.current_amount), 0))} mask="••••" hideColor />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                    <div className={sectionTitle}>Monthly EMI</div>
                    {isEMIPlanSaved ? (
                      <>
                        <div className="mt-2 font-mono text-xl font-bold text-sky-400">
                          <PrivateValue value={formatINRShort(selectedEMIPlannedMonthlyAmount)} mask="••••" hideColor />
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          {selectedEMIPlannedMonths} months remaining
                        </div>
                        <div className="mt-2 rounded-lg bg-slate-900/40 px-2.5 py-1.5 text-[10px] text-slate-300">
                          <div className="text-slate-400">Remaining amount</div>
                          <div className="mt-0.5 font-mono font-semibold text-rose-400">
                            <PrivateValue value={formatINRShort(remainingAmountAfterPlan)} mask="••••" hideColor />
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Set monthly EMI amount and months below</div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">EMI setup & fees</div>
                    <div className="flex items-center gap-2">
                      {isEMIPlanSaved && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">Locked</span>
                      )}
                      {(emiPaymentForm.processing_fee || emiPaymentForm.processing_fee_gst) && (
                        <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-teal-400">Fees set</span>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Planned EMI</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Monthly EMI amount">
                      <input
                        type="number"
                        min="0"
                        step="100"
                        disabled={isEMIPlanSaved}
                        value={customPlannedEmiAmount}
                        onChange={(event) => setCustomPlannedEmiAmount(event.target.value)}
                        className={['h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100', isEMIPlanSaved && 'bg-slate-100 text-slate-600 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-400'].join(' ')}
                      />
                    </FormField>
                    <FormField label="For months">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={isEMIPlanSaved}
                        value={customPlannedEmiMonths}
                        onChange={(event) => setCustomPlannedEmiMonths(event.target.value)}
                        className={['h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100', isEMIPlanSaved && 'bg-slate-100 text-slate-600 cursor-not-allowed dark:bg-slate-800/50 dark:text-slate-400'].join(' ')}
                      />
                    </FormField>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {isEMIPlanSaved ? 'Saved settings are locked. Existing payment rows remain editable.' : 'Enter both values, then save to lock this plan.'}
                    </div>
                    {!isEMIPlanSaved ? (
                      <button type="button" onClick={() => void saveEMISetup()} disabled={isEMISettingsSaving} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-teal-400 disabled:cursor-not-allowed disabled:bg-slate-600">
                        <Icon name="paid" className="h-4 w-4" />
                        {isEMISettingsSaving ? 'Saving...' : 'Save EMI setup'}
                      </button>
                    ) : null}
                  </div>
                    </div>

                    <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Processing fees (one-time)</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Processing Fee">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={emiPaymentForm.processing_fee}
                        onChange={(event) => setEmiPaymentForm((current) => ({ ...current, processing_fee: event.target.value }))}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </FormField>
                    <FormField label="Processing Fee GST (18%)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={emiPaymentForm.processing_fee_gst}
                        onChange={(event) => setEmiPaymentForm((current) => ({ ...current, processing_fee_gst: event.target.value }))}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </FormField>
                  </div>
                </div>
                </div>

                <form onSubmit={addEMIPayment} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Monthly EMI payments</div>
                    <button
                      type="button"
                      onClick={() => setEmiPaymentRows((current) => [...current, createEmptyEMIRow()])}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      <Icon name="add" className="h-3.5 w-3.5" />
                      Add row
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[760px] w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Month</th>
                          <th className="pb-2 pr-2 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Date</th>
                          <th className="pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Principal</th>
                          <th className="pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Interest</th>
                          <th className="pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">GST</th>
                          <th className="pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total</th>
                          <th className="pb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400"> </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {emiPaymentRows.map((row, index) => (
                          <tr key={row.id}>
                            <td className="py-2 pr-2">
                              <input
                                type="month"
                                value={row.payment_month}
                                onChange={(event) => updateEMIRow(row.id, { payment_month: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                value={row.payment_date}
                                onChange={(event) => updateEMIRow(row.id, { payment_date: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.principal_amount}
                                onChange={(event) => updateEMIRow(row.id, { principal_amount: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-right text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.interest_amount}
                                onChange={(event) => updateEMIRow(row.id, { interest_amount: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-right text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.gst_amount}
                                onChange={(event) => updateEMIRow(row.id, { gst_amount: event.target.value })}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-right text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.amount}
                                readOnly
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100/60 px-2.5 text-right text-sm text-slate-900 opacity-90 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-100"
                              />
                            </td>
                            <td className="py-2 text-center">
                              {emiPaymentRows.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() => setEmiPaymentRows((current) => current.filter((item) => item.id !== row.id))}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-rose-500 dark:hover:bg-slate-700"
                                  aria-label={`Remove row ${index + 1}`}
                                >
                                  <Icon name="close" className="h-4 w-4" />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3">
                    <FormField label="Notes for all rows">
                      <textarea
                        rows={2}
                        value={emiPaymentRows[0]?.notes ?? ''}
                        onChange={(event) => setEmiPaymentRows((current) => current.map((row, index) => index === 0 ? { ...row, notes: event.target.value } : row))}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </FormField>
                  </div>

                  {emiPaymentError ? <div className="mt-3 text-sm text-rose-600 dark:text-rose-400">{emiPaymentError}</div> : null}

                  <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={isEMIPaymentSaving} className={['inline-flex items-center gap-2 justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white', isEMIPaymentSaving ? 'cursor-not-allowed bg-slate-400' : 'bg-teal-500 hover:bg-teal-400'].join(' ')}>
                      <Icon name="add" className="h-4 w-4" />
                      {isEMIPaymentSaving ? 'Saving...' : 'Add Payments'}
                    </button>
                  </div>
                </form>

              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeView === 'monthly' ? (
        <>
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
        </>
      ) : null}

      {activeView === 'emi' ? (
        <SectionCard title="EMI Tracker" className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Goal-linked EMI tracker</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                This is a global EMI view and shows only goals marked as EMI.
              </div>
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {goalsLoading ? 'Loading goals…' : `${emiActiveCount} active, ${emiGoals.length} tracked`}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className={sectionTitle}>Tracked Goals</div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{emiGoals.length}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Goals with EMI-style progress</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className={sectionTitle}>Total Target</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">
              <PrivateValue value={formatINRShort(emiTotalTarget)} mask="••••" hideColor />
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across all linked goals</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className={sectionTitle}>Paid So Far</div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-400">
              <PrivateValue value={formatINRShort(emiTotalPaid)} mask="••••" hideColor />
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Using the goal current amount</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
            <div className={sectionTitle}>EMI Needed</div>
            <div className="mt-2 font-mono text-2xl font-bold text-sky-400">
              <PrivateValue value={formatINRShort(emiMonthlyRequired)} mask="••••" hideColor />
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Based on goal progress planning</div>
          </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-700/50 dark:bg-slate-950/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Progress Snapshot</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Remaining amount across all tracked goals: <PrivateValue value={formatINRShort(emiTotalRemaining)} mask="••••" hideColor />
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Updated from Goals data
            </div>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-teal-400 via-sky-400 to-emerald-400"
              style={{ width: `${emiTotalTarget > 0 ? Math.min((emiTotalPaid / emiTotalTarget) * 100, 100) : 0}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Paid: <PrivateValue value={formatPct(emiTotalTarget > 0 ? (emiTotalPaid / emiTotalTarget) * 100 : 0)} mask="••••" hideColor />
            </span>
            <span>
              Remaining: <PrivateValue value={formatPct(emiTotalTarget > 0 ? (emiTotalRemaining / emiTotalTarget) * 100 : 0)} mask="••••" hideColor />
            </span>
          </div>
          </div>

          <div className="mt-5 space-y-3">
          {goalsLoading ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading EMI goals…</div>
          ) : emiGoals.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No EMI goals yet. Edit a goal and turn on Track as EMI to show it here.
            </div>
          ) : (
            emiGoals.map((goal) => {
              const target = toNumber(goal.target_amount)
              const paid = toNumber(goal.resolved_current_amount ?? goal.current_amount)
              const remaining = Math.max(target - paid, 0)
              const progressPct = target > 0 ? Math.min((paid / target) * 100, 100) : 0
              return (
                <div
                  key={goal.id}
                  onClick={() => openEMIGoalDetails(goal)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:border-sky-300 hover:bg-slate-100/80 dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:border-sky-500/50 dark:hover:bg-slate-800/60"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{goal.name}</div>
                        <span className={['inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset', getGoalLifecycleTone(goal.status)].join(' ')}>
                          {getGoalLifecycleLabel(goal.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {goal.goal_type.replaceAll('_', ' ')} · Target <PrivateValue value={formatINRShort(target)} mask="••••" hideColor />
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                      {goal.target_date ? `Target ${goal.target_date}` : 'No target date set'}
                    </div>
                  </div>

                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className={['h-full rounded-full', goal.status === 'achieved' ? 'bg-emerald-400' : 'bg-linear-to-r from-sky-400 to-teal-400'].join(' ')}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Paid so far</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-emerald-400">
                        <PrivateValue value={formatINRShort(paid)} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Remaining amt</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-rose-400">
                        <PrivateValue value={formatINRShort(remaining)} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Monthly EMI</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-sky-400">
                        <PrivateValue value={formatINRShort(toNumber(goal.required_monthly_saving))} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Progress</div>
                      <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatPct(progressPct)} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          </div>
        </SectionCard>
      ) : null}

      {activeView === 'monthly' ? (
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
              className={['mt-5', primaryButtonClass].join(' ')}
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
      ) : null}

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
                <button type="button" onClick={() => setIsModalOpen(false)} className={secondaryButtonClass}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className={primaryButtonClass}>
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
