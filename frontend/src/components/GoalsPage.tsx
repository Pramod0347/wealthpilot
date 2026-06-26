import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ApiError,
  createFinancialGoal,
  deleteFinancialGoal,
  getBankAccounts,
  getFinancialGoals,
  getFinancialGoalsSummary,
  getFixedSavingsAccounts,
  updateFinancialGoal,
  type BankAccount,
  type FinancialGoal,
  type FinancialGoalPayload,
  type FinancialGoalSummary,
  type FixedSavingsAccount,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct } from '../lib/format'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'

type GoalFormState = {
  name: string
  goal_type: FinancialGoal['goal_type']
  target_amount: string
  current_amount: string
  target_date: string
  linked_source_types: Array<NonNullable<FinancialGoal['linked_source_type']>>
  linked_source_map: {
    bank_accounts: number[]
    fixed_savings: number[]
    holdings: number[]
  }
  priority: NonNullable<FinancialGoal['priority']>
  notes: string
  is_active: boolean
}

type FormErrors = Partial<Record<keyof GoalFormState, string>>

const defaultForm: GoalFormState = {
  name: '',
  goal_type: 'emergency_fund',
  target_amount: '',
  current_amount: '',
  target_date: '',
  linked_source_types: ['manual'],
  linked_source_map: {
    bank_accounts: [],
    fixed_savings: [],
    holdings: [],
  },
  priority: 'medium',
  notes: '',
  is_active: true,
}

const goalTypeOptions: Array<{ value: FinancialGoal['goal_type']; label: string }> = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'travel', label: 'Travel' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'house', label: 'House' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'education', label: 'Education' },
  { value: 'custom', label: 'Custom' },
]

const linkedSourceOptions: Array<{ value: NonNullable<FinancialGoal['linked_source_type']>; label: string }> = [
  { value: 'manual', label: 'Manual' },
  { value: 'bank_accounts', label: 'Bank Accounts' },
  { value: 'fixed_savings', label: 'Fixed Savings' },
  { value: 'total_networth', label: 'Total Net Worth' },
]

const priorityOptions: Array<{ value: GoalFormState['priority']; label: string }> = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

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

function formatMoney(value: number) {
  return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No target date'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function goalTypeLabel(value: FinancialGoal['goal_type']) {
  return goalTypeOptions.find((item) => item.value === value)?.label ?? value
}

function linkedSourceLabel(value: NonNullable<FinancialGoal['linked_source_type']>) {
  return linkedSourceOptions.find((item) => item.value === value)?.label ?? value
}

function linkedSourcesSummary(goal: FinancialGoal) {
  const sourceTypes: Array<NonNullable<FinancialGoal['linked_source_type']>> =
    goal.linked_source_types?.length
      ? goal.linked_source_types
      : goal.linked_source_type
        ? [goal.linked_source_type]
        : ['manual']
  return sourceTypes.map((type) => linkedSourceLabel(type)).join(', ')
}

function statusMeta(status: FinancialGoal['status']) {
  if (status === 'completed') return { chip: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20', label: 'Completed' }
  if (status === 'on_track') return { chip: 'bg-sky-500/15 text-sky-300 border border-sky-500/20', label: 'On Track' }
  if (status === 'watch') return { chip: 'bg-amber-500/15 text-amber-300 border border-amber-500/20', label: 'Watch' }
  if (status === 'behind') return { chip: 'bg-rose-500/15 text-rose-300 border border-rose-500/20', label: 'Behind' }
  return { chip: 'bg-slate-700/70 text-slate-300 border border-slate-600/70', label: 'Unknown' }
}

function priorityMeta(priority: FinancialGoal['priority']) {
  if (priority === 'high') return 'bg-rose-500/15 text-rose-300'
  if (priority === 'medium') return 'bg-amber-500/15 text-amber-300'
  return 'bg-slate-700/70 text-slate-300'
}

function SectionCard({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={['rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80', className].join(' ')}>
      {title ? <div className="border-b border-slate-200 px-5 py-4 text-sm font-semibold text-slate-900 dark:border-slate-700/50 dark:text-white">{title}</div> : null}
      {children}
    </section>
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

function SummaryMetric({ label, value, meta }: { label: string; value: ReactNode; meta: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta}</div>
    </div>
  )
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<FinancialGoal[]>([])
  const [summary, setSummary] = useState<FinancialGoalSummary | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [fixedSavingsAccounts, setFixedSavingsAccounts] = useState<FixedSavingsAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null)
  const [form, setForm] = useState<GoalFormState>(defaultForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  const loadData = async (signal?: AbortSignal) => {
    setLoading(true)
    setSummaryLoading(true)
    setError(null)

    const [goalsResult, summaryResult, banksResult, fixedResult] = await Promise.allSettled([
      getFinancialGoals(undefined, signal),
      getFinancialGoalsSummary(signal),
      getBankAccounts(signal),
      getFixedSavingsAccounts(signal),
    ])

    if (goalsResult.status === 'fulfilled') {
      setGoals(goalsResult.value)
    } else if (goalsResult.reason?.name !== 'AbortError') {
      setError(formatApiError(goalsResult.reason))
      setGoals([])
    }

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value)
    } else if (summaryResult.reason?.name !== 'AbortError') {
      setError((current) => current ?? formatApiError(summaryResult.reason))
      setSummary(null)
    }

    if (banksResult.status === 'fulfilled') {
      setBankAccounts(banksResult.value)
    }
    if (fixedResult.status === 'fulfilled') {
      setFixedSavingsAccounts(fixedResult.value)
    }

    setLoading(false)
    setSummaryLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal).catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const message = formatApiError(err)
      setError(message)
      setLoading(false)
      setSummaryLoading(false)
    })
    return () => controller.abort()
  }, [])

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

  const activeGoals = useMemo(() => goals.filter((goal) => goal.is_active), [goals])

  const linkedSourceChoices = useMemo(() => {
    return {
      bank_accounts: bankAccounts.map((account) => ({
        id: account.id,
        label: `${account.bank_name}${account.account_name ? ` · ${account.account_name}` : ''}`,
        meta: formatMoney(toNumber(account.balance)),
      })),
      fixed_savings: fixedSavingsAccounts.map((account) => ({
        id: account.id,
        label: `${account.account_name} · ${account.account_type.toUpperCase()}`,
        meta: formatMoney(toNumber(account.current_value)),
      })),
      holdings: [] as Array<{ id: number; label: string; meta: string }>,
    }
  }, [bankAccounts, fixedSavingsAccounts])

  function openCreateModal() {
    setEditingGoal(null)
    setForm(defaultForm)
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(goal: FinancialGoal) {
    setEditingGoal(goal)
    setForm({
      name: goal.name,
      goal_type: goal.goal_type,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      target_date: goal.target_date ?? '',
      linked_source_types: goal.linked_source_types?.length
        ? goal.linked_source_types
        : goal.linked_source_type
          ? [goal.linked_source_type]
          : ['manual'],
      linked_source_map: {
        bank_accounts: goal.linked_source_map?.bank_accounts ?? (goal.linked_source_type === 'bank_accounts' ? goal.linked_source_ids ?? [] : []),
        fixed_savings: goal.linked_source_map?.fixed_savings ?? (goal.linked_source_type === 'fixed_savings' ? goal.linked_source_ids ?? [] : []),
        holdings: goal.linked_source_map?.holdings ?? [],
      },
      priority: goal.priority ?? 'medium',
      notes: goal.notes ?? '',
      is_active: goal.is_active,
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function toggleLinkedSourceType(type: NonNullable<FinancialGoal['linked_source_type']>) {
    setForm((current) => ({
      ...current,
      linked_source_types: current.linked_source_types.includes(type)
        ? current.linked_source_types.filter((value) => value !== type)
        : [...current.linked_source_types, type],
    }))
  }

  function toggleLinkedSourceId(type: 'bank_accounts' | 'fixed_savings' | 'holdings', id: number) {
    setForm((current) => ({
      ...current,
      linked_source_map: {
        ...current.linked_source_map,
        [type]: current.linked_source_map[type].includes(id)
          ? current.linked_source_map[type].filter((value) => value !== id)
          : [...current.linked_source_map[type], id],
      },
    }))
  }

  function buildPayload(): FinancialGoalPayload | null {
    const nextErrors: FormErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Goal name is required.'
    if (!form.target_amount.trim()) nextErrors.target_amount = 'Target amount is required.'
    if (form.target_amount && Number.isNaN(Number(form.target_amount))) nextErrors.target_amount = 'Enter a valid amount.'
    if (form.current_amount && Number.isNaN(Number(form.current_amount))) nextErrors.current_amount = 'Enter a valid amount.'
    if (form.linked_source_types.length === 0) nextErrors.linked_source_types = 'Select at least one linked source type.'
    if (form.linked_source_types.includes('total_networth') && form.linked_source_types.length > 1) {
      nextErrors.linked_source_types = 'Total Net Worth must be used alone.'
    }
    if (form.linked_source_types.includes('bank_accounts') && form.linked_source_map.bank_accounts.length === 0) {
      nextErrors.linked_source_map = 'Select at least one bank account.'
    }
    if (form.linked_source_types.includes('fixed_savings') && form.linked_source_map.fixed_savings.length === 0) {
      nextErrors.linked_source_map = 'Select at least one fixed savings account.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return null
    }

    setFormErrors({})

    const primarySourceType =
      form.linked_source_types.length === 1
        ? form.linked_source_types[0]
        : form.linked_source_types.includes('manual')
          ? 'manual'
          : form.linked_source_types[0]

    return {
      name: form.name.trim(),
      goal_type: form.goal_type,
      target_amount: form.target_amount.trim(),
      current_amount: form.current_amount.trim() || '0',
      target_date: form.target_date || null,
      linked_source_type: primarySourceType ?? 'manual',
      linked_source_ids:
        primarySourceType === 'manual' || primarySourceType === 'total_networth'
          ? null
          : primarySourceType === 'bank_accounts'
            ? form.linked_source_map.bank_accounts
            : primarySourceType === 'fixed_savings'
              ? form.linked_source_map.fixed_savings
              : form.linked_source_map.holdings,
      linked_source_types: form.linked_source_types,
      linked_source_map: {
        bank_accounts: form.linked_source_map.bank_accounts,
        fixed_savings: form.linked_source_map.fixed_savings,
        holdings: form.linked_source_map.holdings,
      },
      priority: form.priority,
      notes: form.notes.trim() || null,
      is_active: form.is_active,
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrorMessage(null)
    const payload = buildPayload()
    if (!payload) return

    setIsSaving(true)
    try {
      if (editingGoal) {
        await updateFinancialGoal(editingGoal.id, payload)
        setStatusTone('emerald')
        setStatusMessage(`Updated ${payload.name}.`)
      } else {
        await createFinancialGoal(payload)
        setStatusTone('emerald')
        setStatusMessage(`Created ${payload.name}.`)
      }
      setIsModalOpen(false)
      setEditingGoal(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      setFormErrorMessage(formatApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(goal: FinancialGoal) {
    const confirmed = window.confirm(`Delete ${goal.name}? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteFinancialGoal(goal.id)
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${goal.name}.`)
      await loadData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="min-w-0 w-full space-y-6">
      {statusMessage ? (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm',
            statusTone === 'emerald'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200'
              : statusTone === 'rose'
                ? 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200'
                : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          ].join(' ')}
        >
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Financial Goals</div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Track goal targets, progress, shortfall, and required monthly saving.</div>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-700"
        >
          <Icon name="add" className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric label="Active Goals" value={summaryLoading ? '—' : summary?.active_goals_count ?? 0} meta="Currently tracked" />
        <SummaryMetric label="Total Target" value={summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_target_amount))} mask="••••" hideColor />} meta="Across active goals" />
        <SummaryMetric label="Total Saved" value={summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_current_amount))} mask="••••" hideColor />} meta="Resolved current amount" />
        <SummaryMetric label="Total Shortfall" value={summaryLoading ? '—' : <PrivateValue value={formatMoney(toNumber(summary?.total_shortfall_amount))} mask="••••" hideColor />} meta="Remaining to target" />
        <SummaryMetric label="Avg Progress" value={summaryLoading ? '—' : <PrivateValue value={formatPct(toNumber(summary?.average_progress_pct))} mask="••••" hideColor />} meta="Across active goals" />
      </div>

      <SectionCard title="Goals">
        {error ? (
          <div className="p-5">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>
          </div>
        ) : loading ? (
          <div className="p-5 text-sm text-slate-500 dark:text-slate-400">Loading goals...</div>
        ) : activeGoals.length === 0 ? (
          <div className="p-5">
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">No financial goals added yet.</div>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-accent-600 hover:text-accent-500 dark:text-accent-400 dark:hover:text-accent-300"
              >
                <Icon name="add" className="h-4 w-4" />
                Add your first goal
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeGoals.map((goal) => {
              const status = statusMeta(goal.status)
              const progress = Math.max(0, Math.min(100, toNumber(goal.progress_pct)))
              return (
                <article key={goal.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700/50 dark:bg-slate-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-slate-900 dark:text-white">{goal.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{goalTypeLabel(goal.goal_type)}</span>
                        <span className={['rounded-full px-2.5 py-1 text-[11px] font-semibold', priorityMeta(goal.priority)].join(' ')}>{goal.priority ?? 'medium'}</span>
                      </div>
                    </div>
                    <span className={['inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', status.chip].join(' ')}>{status.label}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-500">Target</div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(goal.target_amount))} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-500">Current</div>
                      <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(goal.resolved_current_amount))} mask="••••" hideColor />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>Progress</span>
                      <span><PrivateValue value={formatPct(progress)} mask="••••" hideColor /></span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Shortfall</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        <PrivateValue value={formatMoney(toNumber(goal.shortfall_amount))} mask="••••" hideColor />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Required / month</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        <PrivateValue value={goal.required_monthly_saving == null ? '—' : formatMoney(toNumber(goal.required_monthly_saving))} mask="••••" hideColor />
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Target date</span>
                      <span className="font-medium text-slate-900 dark:text-white">{formatDate(goal.target_date)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500 dark:text-slate-400">Source</span>
                      <span className="font-medium text-slate-900 dark:text-white">{linkedSourcesSummary(goal)}</span>
                    </div>
                  </div>

                  {goal.notes ? <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">{goal.notes}</div> : null}

                  <div className="mt-5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/50"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(goal)}
                      className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/15"
                    >
                      <Icon name="remove" className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>

      {isDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200',
            isDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsModalOpen(false)}
          aria-hidden={!isDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">{editingGoal ? 'Edit Goal' : 'Add Goal'}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Track one personal financial target.</div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {formErrorMessage ? (
                  <div className="mb-5 whitespace-pre-wrap rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {formErrorMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Goal Name" error={formErrors.name}>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>

                  <FormField label="Goal Type" error={formErrors.goal_type}>
                    <select value={form.goal_type} onChange={(event) => setForm((current) => ({ ...current, goal_type: event.target.value as GoalFormState['goal_type'] }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {goalTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FormField>

                  <FormField label="Target Amount" error={formErrors.target_amount}>
                    <input value={form.target_amount} onChange={(event) => setForm((current) => ({ ...current, target_amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>

                  <FormField label="Current Amount" error={formErrors.current_amount}>
                    <input value={form.current_amount} onChange={(event) => setForm((current) => ({ ...current, current_amount: event.target.value }))} inputMode="decimal" disabled={!form.linked_source_types.includes('manual')} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>

                  <FormField label="Target Date" error={formErrors.target_date}>
                    <input type="date" value={form.target_date} onChange={(event) => setForm((current) => ({ ...current, target_date: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>

                  <FormField label="Priority" error={formErrors.priority}>
                    <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as GoalFormState['priority'] }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </FormField>

                  <div className="sm:col-span-2">
                    <div className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">Linked Source Types</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {linkedSourceOptions.map((option) => (
                        <label key={option.value} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{option.label}</span>
                          <input
                            type="checkbox"
                            checked={form.linked_source_types.includes(option.value)}
                            onChange={() => toggleLinkedSourceType(option.value)}
                            className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                          />
                        </label>
                      ))}
                    </div>
                    {formErrors.linked_source_types ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{formErrors.linked_source_types}</div> : null}
                  </div>

                  <FormField label="Status" error={formErrors.is_active}>
                    <select value={String(form.is_active)} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.value === 'true' }))} className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </FormField>
                </div>

                {form.linked_source_types.includes('bank_accounts') ? (
                  <div className="mt-5">
                    <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Linked Bank Accounts</div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                      {linkedSourceChoices.bank_accounts.length === 0 ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">No eligible accounts available.</div>
                      ) : (
                        linkedSourceChoices.bank_accounts.map((choice) => (
                          <label key={choice.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/50">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{choice.label}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400"><PrivateValue value={choice.meta} mask="••••" hideColor /></div>
                            </div>
                            <input type="checkbox" checked={form.linked_source_map.bank_accounts.includes(choice.id)} onChange={() => toggleLinkedSourceId('bank_accounts', choice.id)} className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500" />
                          </label>
                        ))
                      )}
                    </div>
                    {formErrors.linked_source_map ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{formErrors.linked_source_map}</div> : null}
                  </div>
                ) : null}

                {form.linked_source_types.includes('fixed_savings') ? (
                  <div className="mt-5">
                    <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Linked Fixed Savings</div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700/50 dark:bg-slate-900/40">
                      {linkedSourceChoices.fixed_savings.length === 0 ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">No eligible accounts available.</div>
                      ) : (
                        linkedSourceChoices.fixed_savings.map((choice) => (
                          <label key={choice.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-100/70 dark:hover:bg-slate-800/50">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-white">{choice.label}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400"><PrivateValue value={choice.meta} mask="••••" hideColor /></div>
                            </div>
                            <input type="checkbox" checked={form.linked_source_map.fixed_savings.includes(choice.id)} onChange={() => toggleLinkedSourceId('fixed_savings', choice.id)} className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500" />
                          </label>
                        ))
                      )}
                    </div>
                    {formErrors.linked_source_map ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{formErrors.linked_source_map}</div> : null}
                  </div>
                ) : null}

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSaving} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                  {isSaving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : editingGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
