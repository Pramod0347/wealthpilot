import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  createQuickAchievement,
  createFinancialGoal,
  deleteFinancialGoal,
  markFinancialGoalAchieved,
  updateFinancialGoal,
  type BankAccount,
  type FinancialGoal,
  type GoalAchievementPayload,
  type FinancialGoalPayload,
  type FinancialGoalSummary,
  type FixedSavingsAccount,
  type QuickAchievementPayload,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon, type IconName } from './Icon'
import PrivateValue from './ui/PrivateValue'
import {
  useBankAccountsQuery,
  useFinancialGoalsQuery,
  useFinancialGoalsSummaryQuery,
  useFixedSavingsAccountsQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500'
const CARD_CONTAINER =
  'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-7'
const INNER_TILE =
  'rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 transition-colors dark:border-slate-800/60 dark:bg-slate-800/40'

type ViewMode = 'cards' | 'table'
type SortOption = 'progress_desc' | 'progress_asc' | 'date_asc' | 'target_desc' | 'name_asc'

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
  is_emi: boolean
  is_active: boolean
}

type AchievementFormState = {
  name: string
  goal_type: FinancialGoal['goal_type']
  achieved_amount: string
  achieved_date: string
  achievement_type: NonNullable<FinancialGoal['achievement_type']>
  payment_source: NonNullable<FinancialGoal['payment_source']>
  purchase_notes: string
}

type MarkAchievedFormState = {
  achieved_amount: string
  achieved_date: string
  achievement_type: NonNullable<FinancialGoal['achievement_type']>
  payment_source: NonNullable<FinancialGoal['payment_source']>
  purchase_notes: string
}

type FormErrors = Partial<Record<keyof GoalFormState, string>>
type AchievementFormErrors = Partial<Record<keyof AchievementFormState, string>>
type MarkAchievedErrors = Partial<Record<keyof MarkAchievedFormState, string>>

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
  is_emi: false,
  is_active: true,
}

const defaultAchievementForm: AchievementFormState = {
  name: '',
  goal_type: 'custom',
  achieved_amount: '',
  achieved_date: new Date().toISOString().slice(0, 10),
  achievement_type: 'other',
  payment_source: 'bank',
  purchase_notes: '',
}

const defaultMarkAchievedForm: MarkAchievedFormState = {
  achieved_amount: '',
  achieved_date: new Date().toISOString().slice(0, 10),
  achievement_type: 'planned_goal',
  payment_source: 'bank',
  purchase_notes: '',
}

const goalTypeOptions: Array<{ value: FinancialGoal['goal_type']; label: string }> = [
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'house', label: 'House' },
  { value: 'travel', label: 'Travel' },
  { value: 'retirement', label: 'Retirement' },
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

const achievementTypeOptions: Array<{ value: NonNullable<FinancialGoal['achievement_type']>; label: string }> = [
  { value: 'planned_goal', label: 'Planned Goal' },
  { value: 'big_purchase', label: 'Big Purchase' },
  { value: 'gift', label: 'Gift' },
  { value: 'travel', label: 'Travel' },
  { value: 'asset_purchase', label: 'Asset Purchase' },
  { value: 'other', label: 'Other' },
]

const paymentSourceOptions: Array<{ value: NonNullable<FinancialGoal['payment_source']>; label: string }> = [
  { value: 'bank', label: 'Bank' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' },
]

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(n) ? 0 : n
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

function formatMoney(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`
  if (abs >= 1_000) return `₹${(value / 1_000).toFixed(1)} K`
  return formatINR(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No target date'
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatRemainingMonths(months: number | null | undefined): string | null {
  if (months === null || months === undefined) return null
  if (months <= 0) return 'Due this month'
  if (months === 1) return '1 month left'
  if (months < 12) return `${months} months left`
  const years = (months / 12).toFixed(1)
  return `${years} yrs left`
}

function goalTypeLabel(value: FinancialGoal['goal_type']) {
  return goalTypeOptions.find((item) => item.value === value)?.label ?? value
}

function goalTypeIcon(type: FinancialGoal['goal_type']): IconName {
  switch (type) {
    case 'emergency_fund':
      return 'shield'
    case 'travel':
      return 'portfolio'
    case 'retirement':
      return 'due'
    case 'house':
      return 'banks'
    case 'vehicle':
      return 'buy'
    case 'education':
      return 'reports'
    default:
      return 'ai'
  }
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

function achievementTypeLabel(value: FinancialGoal['achievement_type']) {
  return achievementTypeOptions.find((item) => item.value === value)?.label ?? 'Other'
}

function paymentSourceLabel(value: FinancialGoal['payment_source']) {
  return paymentSourceOptions.find((item) => item.value === value)?.label ?? 'Other'
}

function progressStatusMeta(status: FinancialGoal['progress_status']) {
  if (status === 'completed') {
    return {
      chip: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-300',
      label: 'Completed',
      barColor: '#10b981',
    }
  }
  if (status === 'on_track') {
    return {
      chip: 'bg-sky-500/10 text-sky-600 border border-sky-500/25 dark:text-sky-300',
      label: 'On Track',
      barColor: '#0ea5e9',
    }
  }
  if (status === 'watch') {
    return {
      chip: 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300',
      label: 'Watch',
      barColor: '#f59e0b',
    }
  }
  if (status === 'behind') {
    return {
      chip: 'bg-rose-500/10 text-rose-600 border border-rose-500/25 dark:text-rose-300',
      label: 'Behind',
      barColor: '#f43f5e',
    }
  }
  return {
    chip: 'bg-slate-500/10 text-slate-600 border border-slate-500/25 dark:text-slate-300',
    label: 'In Progress',
    barColor: '#14b8a6',
  }
}

function priorityBadgeClasses(priority: FinancialGoal['priority']) {
  if (priority === 'high') {
    return 'bg-rose-500/10 text-rose-600 border border-rose-500/25 dark:text-rose-300'
  }
  if (priority === 'medium') {
    return 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300'
  }
  return 'bg-slate-500/10 text-slate-600 border border-slate-500/25 dark:text-slate-300'
}

function lifecycleStatusMeta(status: FinancialGoal['status']) {
  if (status === 'achieved') return { chip: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-300', label: 'Achieved' }
  if (status === 'paused') return { chip: 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300', label: 'Paused' }
  if (status === 'cancelled') return { chip: 'bg-slate-500/10 text-slate-600 border border-slate-500/25 dark:text-slate-300', label: 'Cancelled' }
  return { chip: 'bg-sky-500/10 text-sky-600 border border-sky-500/25 dark:text-sky-300', label: 'Active' }
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function GoalsPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()

  // State
  const [activeTab, setActiveTab] = useState<'active' | 'achieved'>('active')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('progress_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Modal / Drawer state
  const [modalMode, setModalMode] = useState<'goal' | 'achievement' | 'markAchieved'>('goal')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null)
  const [goalToAchieve, setGoalToAchieve] = useState<FinancialGoal | null>(null)
  const [form, setForm] = useState<GoalFormState>(defaultForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [achievementForm, setAchievementForm] = useState<AchievementFormState>(defaultAchievementForm)
  const [achievementFormErrors, setAchievementFormErrors] = useState<AchievementFormErrors>({})
  const [markAchievedForm, setMarkAchievedForm] = useState<MarkAchievedFormState>(defaultMarkAchievedForm)
  const [markAchievedErrors, setMarkAchievedErrors] = useState<MarkAchievedErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber'>('emerald')

  // Queries
  const goalsQuery = useFinancialGoalsQuery()
  const summaryQuery = useFinancialGoalsSummaryQuery()
  const bankAccountsQuery = useBankAccountsQuery()
  const fixedSavingsQuery = useFixedSavingsAccountsQuery()

  const goals = (goalsQuery.data as FinancialGoal[] | undefined) ?? []
  const summary = (summaryQuery.data as FinancialGoalSummary | undefined) ?? null
  const bankAccounts = (bankAccountsQuery.data as BankAccount[] | undefined) ?? []
  const fixedSavingsAccounts = (fixedSavingsQuery.data as FixedSavingsAccount[] | undefined) ?? []
  const loading = goalsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const error = goalsQuery.error
    ? formatApiError(goalsQuery.error)
    : summaryQuery.error
      ? formatApiError(summaryQuery.error)
      : null

  // Drawer lifecycle
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

  const activeGoals = useMemo(
    () => goals.filter((goal) => goal.status === 'active' || goal.status === 'paused'),
    [goals],
  )
  const achievedGoals = useMemo(() => goals.filter((goal) => goal.status === 'achieved'), [goals])

  // Summary Metrics
  const totalTarget = toNumber(summary?.total_target_amount)
  const totalSaved = toNumber(summary?.total_current_amount)
  const totalShortfall = toNumber(summary?.total_shortfall_amount)
  const avgProgress = toNumber(summary?.average_progress_pct)
  const monthlyRunRate = toNumber(summary?.monthly_saving_needed_total)
  const fundedShare = totalTarget > 0 ? Math.min(100, Math.max(0, (totalSaved / totalTarget) * 100)) : 0
  const shortfallShare = totalTarget > 0 ? Math.max(0, 100 - fundedShare) : 0

  // Category counts
  const categoryCounts = useMemo(() => {
    const list = activeTab === 'active' ? activeGoals : achievedGoals
    const counts: Record<string, number> = { all: list.length }
    for (const g of list) {
      counts[g.goal_type] = (counts[g.goal_type] ?? 0) + 1
    }
    return counts
  }, [achievedGoals, activeGoals, activeTab])

  // Filtered & Sorted Goals
  const filteredGoals = useMemo(() => {
    const list = activeTab === 'active' ? activeGoals : achievedGoals
    const query = searchTerm.trim().toLowerCase()

    return list.filter((goal) => {
      const matchesSearch =
        !query ||
        goal.name.toLowerCase().includes(query) ||
        (goal.notes ?? '').toLowerCase().includes(query) ||
        (goal.purchase_notes ?? '').toLowerCase().includes(query)

      const matchesCategory = categoryFilter === 'all' || goal.goal_type === categoryFilter
      const matchesStatus = statusFilter === 'all' || goal.progress_status === statusFilter

      return matchesSearch && matchesCategory && matchesStatus
    })
  }, [achievedGoals, activeGoals, activeTab, categoryFilter, searchTerm, statusFilter])

  const sortedGoals = useMemo(() => {
    return [...filteredGoals].sort((a, b) => {
      if (sortOption === 'progress_desc') return toNumber(b.progress_pct) - toNumber(a.progress_pct)
      if (sortOption === 'progress_asc') return toNumber(a.progress_pct) - toNumber(b.progress_pct)
      if (sortOption === 'date_asc') return (a.target_date ?? '9999').localeCompare(b.target_date ?? '9999')
      if (sortOption === 'target_desc') return toNumber(b.target_amount) - toNumber(a.target_amount)
      if (sortOption === 'name_asc') return a.name.localeCompare(b.name)
      return 0
    })
  }, [filteredGoals, sortOption])

  // Health Breakdown counts from summary or calculated
  const healthBreakdown = useMemo(() => {
    const counts = summary?.status_counts ?? {
      completed: activeGoals.filter((g) => g.progress_status === 'completed').length,
      on_track: activeGoals.filter((g) => g.progress_status === 'on_track').length,
      watch: activeGoals.filter((g) => g.progress_status === 'watch').length,
      behind: activeGoals.filter((g) => g.progress_status === 'behind').length,
    }
    const total = activeGoals.length || 1
    return [
      { key: 'completed', label: 'Completed', count: counts.completed ?? 0, color: '#10b981', pct: ((counts.completed ?? 0) / total) * 100 },
      { key: 'on_track', label: 'On Track', count: counts.on_track ?? 0, color: '#0ea5e9', pct: ((counts.on_track ?? 0) / total) * 100 },
      { key: 'watch', label: 'Watch', count: counts.watch ?? 0, color: '#f59e0b', pct: ((counts.watch ?? 0) / total) * 100 },
      { key: 'behind', label: 'Behind', count: counts.behind ?? 0, color: '#f43f5e', pct: ((counts.behind ?? 0) / total) * 100 },
    ]
  }, [activeGoals, summary?.status_counts])

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

  // Actions
  async function refreshData() {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['goals'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.financialGoalsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  function openCreateModal() {
    setModalMode('goal')
    setEditingGoal(null)
    setGoalToAchieve(null)
    setForm(defaultForm)
    setFormErrors({})
    setAchievementForm(defaultAchievementForm)
    setAchievementFormErrors({})
    setMarkAchievedForm(defaultMarkAchievedForm)
    setMarkAchievedErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openAchievementModal() {
    setModalMode('achievement')
    setEditingGoal(null)
    setGoalToAchieve(null)
    setAchievementForm(defaultAchievementForm)
    setAchievementFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(goal: FinancialGoal) {
    setEditingGoal(goal)
    setGoalToAchieve(null)
    setFormErrorMessage(null)
    if (goal.status === 'achieved') {
      setModalMode('achievement')
      setAchievementForm({
        name: goal.name,
        goal_type: goal.goal_type,
        achieved_amount: String(goal.achieved_amount ?? goal.final_amount ?? goal.target_amount),
        achieved_date: goal.achieved_date ?? new Date().toISOString().slice(0, 10),
        achievement_type: goal.achievement_type ?? 'other',
        payment_source: goal.payment_source ?? 'bank',
        purchase_notes: goal.purchase_notes ?? goal.notes ?? '',
      })
      setAchievementFormErrors({})
    } else {
      setModalMode('goal')
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
        is_emi: goal.is_emi ?? false,
        is_active: goal.status === 'active' || goal.status === 'paused',
      })
      setFormErrors({})
    }
    setIsModalOpen(true)
  }

  function openMarkAchievedModal(goal: FinancialGoal) {
    setModalMode('markAchieved')
    setEditingGoal(null)
    setGoalToAchieve(goal)
    setMarkAchievedForm({
      achieved_amount: String(goal.target_amount ?? goal.resolved_current_amount ?? ''),
      achieved_date: new Date().toISOString().slice(0, 10),
      achievement_type: 'planned_goal',
      payment_source: 'bank',
      purchase_notes: '',
    })
    setMarkAchievedErrors({})
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
    const firstSource = form.linked_source_types[0] ?? 'manual'
    const sourceIds =
      firstSource === 'bank_accounts'
        ? form.linked_source_map.bank_accounts
        : firstSource === 'fixed_savings'
          ? form.linked_source_map.fixed_savings
          : []

    return {
      name: form.name.trim(),
      goal_type: form.goal_type,
      target_amount: form.target_amount.trim(),
      current_amount: form.linked_source_types.includes('manual') ? form.current_amount.trim() || '0' : '0',
      target_date: form.target_date || null,
      linked_source_type: firstSource,
      linked_source_ids: sourceIds,
      linked_source_types: form.linked_source_types,
      linked_source_map: form.linked_source_map,
      priority: form.priority,
      notes: form.notes.trim() || null,
      status: form.is_active ? 'active' : 'cancelled',
      achieved_date: null,
      achieved_amount: null,
      achievement_type: null,
      payment_source: null,
      is_big_purchase: false,
      is_emi: form.is_emi,
      purchase_notes: null,
      is_active: form.is_active,
    }
  }

  function buildQuickAchievementPayload(): QuickAchievementPayload | null {
    const nextErrors: AchievementFormErrors = {}
    if (!achievementForm.name.trim()) nextErrors.name = 'Achievement name is required.'
    if (!achievementForm.achieved_amount.trim()) nextErrors.achieved_amount = 'Amount is required.'
    if (!achievementForm.achieved_date) nextErrors.achieved_date = 'Date is required.'
    if (achievementForm.achieved_amount && Number.isNaN(Number(achievementForm.achieved_amount))) {
      nextErrors.achieved_amount = 'Enter a valid amount.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setAchievementFormErrors(nextErrors)
      return null
    }
    setAchievementFormErrors({})
    return {
      name: achievementForm.name.trim(),
      goal_type: achievementForm.goal_type,
      achieved_amount: achievementForm.achieved_amount.trim(),
      achieved_date: achievementForm.achieved_date,
      achievement_type: achievementForm.achievement_type,
      payment_source: achievementForm.payment_source,
      purchase_notes: achievementForm.purchase_notes.trim() || null,
    }
  }

  function buildMarkAchievedPayload(): GoalAchievementPayload | null {
    const nextErrors: MarkAchievedErrors = {}
    if (!markAchievedForm.achieved_amount.trim()) nextErrors.achieved_amount = 'Achieved amount is required.'
    if (!markAchievedForm.achieved_date) nextErrors.achieved_date = 'Achieved date is required.'
    if (markAchievedForm.achieved_amount && Number.isNaN(Number(markAchievedForm.achieved_amount))) {
      nextErrors.achieved_amount = 'Enter a valid amount.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setMarkAchievedErrors(nextErrors)
      return null
    }
    setMarkAchievedErrors({})
    return {
      achieved_amount: markAchievedForm.achieved_amount.trim(),
      achieved_date: markAchievedForm.achieved_date,
      achievement_type: markAchievedForm.achievement_type,
      payment_source: markAchievedForm.payment_source,
      purchase_notes: markAchievedForm.purchase_notes.trim() || null,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrorMessage(null)
    setIsSaving(true)

    try {
      if (modalMode === 'achievement') {
        const payload = buildQuickAchievementPayload()
        if (!payload) return
        if (editingGoal) {
          await updateFinancialGoal(editingGoal.id, {
            name: payload.name,
            goal_type: payload.goal_type,
            status: 'achieved',
            achieved_amount: payload.achieved_amount,
            achieved_date: payload.achieved_date,
            achievement_type: payload.achievement_type,
            payment_source: payload.payment_source,
            purchase_notes: payload.purchase_notes,
            target_amount: String(editingGoal.target_amount),
            current_amount: String(editingGoal.current_amount ?? editingGoal.achieved_amount ?? editingGoal.target_amount),
            is_big_purchase: Number(payload.achieved_amount) >= 20000,
            is_active: false,
          })
          setStatusTone('emerald')
          setStatusMessage(`Updated "${payload.name}".`)
        } else {
          await createQuickAchievement(payload)
          setStatusTone('emerald')
          setStatusMessage(`Added "${payload.name}".`)
        }
      } else if (modalMode === 'markAchieved' && goalToAchieve) {
        const payload = buildMarkAchievedPayload()
        if (!payload) return
        await markFinancialGoalAchieved(goalToAchieve.id, payload)
        setStatusTone('emerald')
        setStatusMessage(`Marked "${goalToAchieve.name}" as achieved! 🎉`)
      } else {
        const payload = buildPayload()
        if (!payload) return
        if (editingGoal) {
          await updateFinancialGoal(editingGoal.id, payload)
          setStatusTone('emerald')
          setStatusMessage(`Updated "${payload.name}".`)
        } else {
          await createFinancialGoal(payload)
          setStatusTone('emerald')
          setStatusMessage(`Created goal "${payload.name}".`)
        }
      }

      setIsModalOpen(false)
      setEditingGoal(null)
      setGoalToAchieve(null)
      setForm(defaultForm)
      setAchievementForm(defaultAchievementForm)
      setMarkAchievedForm(defaultMarkAchievedForm)
      await refreshData()
    } catch (err) {
      setFormErrorMessage(formatApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(goal: FinancialGoal) {
    const confirmed = window.confirm(`Delete "${goal.name}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteFinancialGoal(goal.id)
      setStatusTone('emerald')
      setStatusMessage(`Deleted "${goal.name}".`)
      await refreshData()
    } catch (err) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(err))
    }
  }

  return (
    <div className="min-w-0 w-full space-y-6 lg:space-y-8 pb-12">
      {/* Toast Alert Banner */}
      {statusMessage ? (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm transition-all',
            statusTone === 'emerald'
              ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : statusTone === 'rose'
                ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
                : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <Icon
              name={statusTone === 'emerald' ? 'paid' : statusTone === 'rose' ? 'warning' : 'alert'}
              className="h-4 w-4"
            />
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="shrink-0 p-1 opacity-70 hover:opacity-100"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── TOP COMMAND & PULSE BAR ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-3.5">
        {/* Left: Pulse & Overview */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
            </span>
            <span className={LABEL}>Financial Goals & Milestones</span>
          </div>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {activeGoals.length} Active {activeGoals.length === 1 ? 'Target' : 'Targets'} · {achievedGoals.length} Achieved
          </span>
          {monthlyRunRate > 0 && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
              Runway Pace: {formatMoney(monthlyRunRate)}/mo
            </span>
          )}
        </div>

        {/* Center: Health Breadth Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {(summary?.status_counts?.completed ?? 0) + (summary?.status_counts?.on_track ?? 0)}
            </span>
            <span className="text-slate-400">On Track</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{summary?.status_counts?.watch ?? 0}</span>
            <span className="text-slate-400">Watch</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{summary?.status_counts?.behind ?? 0}</span>
            <span className="text-slate-400">Behind</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
            title="Refresh goals data"
          >
            <Icon name="refresh" className={['h-3.5 w-3.5', isRefreshing ? 'animate-spin' : ''].join(' ')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={openAchievementModal}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
          >
            <Icon name="cards" className="h-3.5 w-3.5" />
            <span>Add Achievement</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all',
              primaryButtonClass,
            ].join(' ')}
          >
            <Icon name="add" className="h-3.5 w-3.5" />
            <span>Add Goal</span>
          </button>
        </div>
      </div>

      {/* ── TOP NAVIGATION TABS (ACTIVE GOALS / ACHIEVED) ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab('active')
            setCategoryFilter('all')
          }}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'active'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ].join(' ')}
        >
          <Icon name="ai" className="h-4 w-4" />
          <span>Active Goals</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {activeGoals.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('achieved')
            setCategoryFilter('all')
          }}
          className={[
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'achieved'
              ? 'border-teal-500 text-teal-600 dark:text-teal-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white',
          ].join(' ')}
        >
          <Icon name="paid" className="h-4 w-4" />
          <span>Achieved Milestones</span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {achievedGoals.length}
          </span>
        </button>
      </div>

      {/* ── ROW 1: HERO VALUATION DECK & HEALTH ALLOCATION ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Left Hero Card */}
        <div className={CARD_CONTAINER}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div>
              <div className={LABEL}>
                {activeTab === 'active'
                  ? 'Active Goals Funding Trajectory'
                  : 'Total Capital Deployed on Achieved Milestones'}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl">
                  {summaryLoading ? (
                    '—'
                  ) : activeTab === 'active' ? (
                    <PrivateValue value={formatMoney(totalSaved)} mask="••••••" hideColor />
                  ) : (
                    <PrivateValue value={formatMoney(toNumber(summary?.total_achieved_amount))} mask="••••••" hideColor />
                  )}
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
                    privacyMode
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : activeTab === 'active'
                        ? 'bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
                  ].join(' ')}
                >
                  {privacyMode ? '•••' : activeTab === 'active' ? `${fundedShare.toFixed(1)}% Funded` : 'Completed'}
                </span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'active' ? (
                <>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                    <span className="text-slate-400">Total Target: </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(totalTarget)} mask="••••" hideColor />
                    </span>
                  </div>
                  <div className="rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-1.5 text-xs dark:border-rose-500/20 dark:bg-rose-500/10">
                    <span className="text-rose-600 dark:text-rose-400">Shortfall: </span>
                    <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                      <PrivateValue value={formatMoney(totalShortfall)} mask="••••" hideColor />
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                    <span className="text-slate-400">Achieved Count: </span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-white">
                      {summary?.achieved_goals_count ?? achievedGoals.length}
                    </span>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs dark:border-teal-500/20 dark:bg-teal-500/10">
                    <span className="text-teal-600 dark:text-teal-400">Big Purchases: </span>
                    <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                      {summary?.big_purchases_count ?? 0}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Progress Track for Active Tab */}
          {activeTab === 'active' ? (
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500 dark:text-slate-400">Capital Funding Trajectory</span>
                <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {totalTarget > 0 ? `${fundedShare.toFixed(1)}% Saved · ${shortfallShare.toFixed(1)}% Shortfall` : '—'}
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  style={{ width: `${fundedShare}%` }}
                  className="bg-teal-500 transition-all duration-500"
                  title={`Saved: ${fundedShare.toFixed(1)}%`}
                />
                <div
                  style={{ width: `${shortfallShare}%` }}
                  className="bg-slate-300 dark:bg-slate-700 transition-all duration-500"
                  title={`Shortfall: ${shortfallShare.toFixed(1)}%`}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-teal-500" />
                  <span>Capital Saved:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    <PrivateValue value={formatMoney(totalSaved)} mask="••••" hideColor />
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-600" />
                  <span>Remaining Shortfall:</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    <PrivateValue value={formatMoney(totalShortfall)} mask="••••" hideColor />
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              Achievements chronicle completed milestones and verified asset purchases across banks, cards, and liquid funds.
            </div>
          )}

          {/* 3 Metric Summary Banner */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            {activeTab === 'active' ? (
              <>
                <div className={INNER_TILE}>
                  <div className={LABEL}>Total Target Capital</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                    <PrivateValue value={formatINR(totalTarget)} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Combined across active targets</div>
                </div>

                <div className={INNER_TILE}>
                  <div className={LABEL}>Monthly Savings Needed</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-teal-600 dark:text-teal-400 sm:text-lg">
                    <PrivateValue value={formatINR(monthlyRunRate)} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Required monthly run-rate</div>
                </div>

                <div className={INNER_TILE}>
                  <div className={LABEL}>Average Progress</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                    <PrivateValue value={formatPct(avgProgress)} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Average goal progression</div>
                </div>
              </>
            ) : (
              <>
                <div className={INNER_TILE}>
                  <div className={LABEL}>This Year Achieved</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                    <PrivateValue value={formatINR(toNumber(summary?.this_year_achieved_amount))} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Completed in current year</div>
                </div>

                <div className={INNER_TILE}>
                  <div className={LABEL}>Average Purchase</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                    <PrivateValue value={formatINR(toNumber(summary?.average_achieved_amount))} mask="••••" hideColor />
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">Mean milestone valuation</div>
                </div>

                <div className={INNER_TILE}>
                  <div className={LABEL}>Big Purchases (&gt;₹20k)</div>
                  <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                    {summary?.big_purchases_count ?? 0}
                  </div>
                  <div className="mt-1 text-xs font-medium text-slate-400">High-value capital outflows</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Card: Health & Guidance */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Icon name="reports" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                {activeTab === 'active' ? 'Health & Status Breakdown' : 'Milestone Summary'}
              </h2>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                {activeTab === 'active'
                  ? 'Pacing and funding status across all goals'
                  : 'Tracking your accomplished milestones'}
              </p>
            </div>
          </div>

          {activeTab === 'active' ? (
            <div className="mt-5 space-y-3.5">
              {healthBreakdown.map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        {item.count} {item.count === 1 ? 'target' : 'targets'}
                      </span>
                      <span className="w-12 text-right font-mono text-[11px] font-medium text-slate-400">
                        {item.pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.pct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}

              {/* Financial Run-rate Advice Box */}
              <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
                <div className="flex items-start gap-2.5">
                  <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                  <div className="text-xs">
                    <span className="font-semibold text-teal-900 dark:text-teal-200">
                      Discipline & Allocation Strategy:
                    </span>{' '}
                    <span className="text-teal-700/90 dark:text-teal-300/80">
                      {monthlyRunRate > 0
                        ? `Saving ${formatMoney(monthlyRunRate)}/month into dedicated liquid funds or linked accounts ensures all active deadlines are met on time.`
                        : 'Review upcoming target dates and link dedicated savings or bank accounts to track automated funding progress.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-xs dark:border-slate-800/60 dark:bg-slate-800/40">
                <div className="font-semibold text-slate-900 dark:text-white">Recent Achievement</div>
                <div className="mt-1 text-slate-500 dark:text-slate-400">
                  {summary?.recent_achieved_goal ? (
                    <>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {summary.recent_achieved_goal.name}
                      </span>{' '}
                      — <PrivateValue value={formatMoney(toNumber(summary.recent_achieved_goal.final_amount))} mask="••••" hideColor /> on{' '}
                      {formatDate(summary.recent_achieved_goal.achieved_date)}
                    </>
                  ) : (
                    'Track purchases as you achieve them to build a log of personal wealth accomplishments.'
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: GOALS EXPLORER & MANAGEMENT ── */}
      <div className={CARD_CONTAINER}>
        {/* Controls Toolbar: Search, Filter Tabs, Sort & View Mode */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                categoryFilter === 'all'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              All ({(activeTab === 'active' ? activeGoals : achievedGoals).length})
            </button>
            {goalTypeOptions.map((opt) => {
              const count = categoryCounts[opt.value] ?? 0
              if (count === 0 && categoryFilter !== opt.value) return null
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategoryFilter(opt.value)}
                  className={[
                    'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                    categoryFilter === opt.value
                      ? 'bg-teal-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {opt.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Right: Search, Status Filter, Sort & View Mode */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-44 sm:min-w-56">
              <Icon name="search" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search target name, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 py-1.5 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-teal-500 focus:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-white dark:focus:border-teal-400 dark:focus:bg-slate-900"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status Filter (Active Tab only) */}
            {activeTab === 'active' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-teal-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:focus:border-teal-400"
              >
                <option value="all">All Statuses</option>
                <option value="on_track">On Track</option>
                <option value="watch">Watch</option>
                <option value="behind">Behind</option>
                <option value="completed">Completed</option>
              </select>
            )}

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort goals"
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-teal-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:focus:border-teal-400"
            >
              <option value="progress_desc">Highest Progress %</option>
              <option value="progress_asc">Lowest Progress %</option>
              <option value="date_asc">Nearest Target Date</option>
              <option value="target_desc">Highest Target Amount</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={[
                  'rounded-lg p-1.5 transition-all',
                  viewMode === 'cards'
                    ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-900 dark:text-teal-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
                ].join(' ')}
                title="Grid Cards View"
              >
                <Icon name="dashboard" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={[
                  'rounded-lg p-1.5 transition-all',
                  viewMode === 'table'
                    ? 'bg-white text-teal-600 shadow-sm dark:bg-slate-900 dark:text-teal-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200',
                ].join(' ')}
                title="Table Ledger View"
              >
                <Icon name="reports" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="pt-6">
          {loading ? (
            <div className="py-16 text-center">
              <Icon name="refresh" className="mx-auto h-6 w-6 animate-spin text-teal-500" />
              <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                Loading financial goals…
              </div>
              <div className="mt-1 text-xs text-slate-400">Resolving balances and linked accounts</div>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-400">
              {error}
            </div>
          ) : (activeTab === 'active' ? activeGoals : achievedGoals).length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Icon name={activeTab === 'active' ? 'ai' : 'paid'} className="h-6 w-6" />
              </div>
              <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                {activeTab === 'active' ? 'No active financial goals yet' : 'No achievements recorded yet'}
              </div>
              <div className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                {activeTab === 'active'
                  ? 'Create targets for your Emergency Fund, vehicle purchase, travel, or retirement to monitor funding pace.'
                  : 'Record big purchases and fulfilled milestones to celebrate your wealth progress.'}
              </div>
              <button
                type="button"
                onClick={activeTab === 'active' ? openCreateModal : openAchievementModal}
                className={['mt-5', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                {activeTab === 'active' ? 'Add Your First Goal' : 'Record Achievement'}
              </button>
            </div>
          ) : sortedGoals.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No targets match &ldquo;{searchTerm}&rdquo; under the selected filter.
            </div>
          ) : viewMode === 'cards' ? (
            /* ── VIEW MODE: CARDS GRID ── */
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {sortedGoals.map((goal) => {
                const isAchieved = goal.status === 'achieved'

                if (isAchieved) {
                  const variance = toNumber(goal.variance_amount)
                  const isSaved = variance <= 0

                  return (
                    <article
                      key={goal.id}
                      className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700/80 hover:shadow-md sm:p-7"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                              <Icon name="paid" className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                                {goal.name}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                  {achievementTypeLabel(goal.achievement_type)}
                                </span>
                                {goal.is_big_purchase && (
                                  <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                                    Big Purchase
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <span className="inline-flex shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 border border-emerald-500/25">
                            Achieved
                          </span>
                        </div>

                        {/* Paid Amount */}
                        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-800/40">
                          <div className="flex items-center justify-between">
                            <span className={LABEL}>Total Paid</span>
                            <span
                              className={[
                                'inline-flex items-center gap-1 font-mono text-[11px] font-semibold',
                                isSaved ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                              ].join(' ')}
                            >
                              {isSaved ? 'Saved ' : 'Overspent '}
                              <PrivateValue value={formatMoney(Math.abs(variance))} mask="••••" hideColor />
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                            <PrivateValue value={formatMoney(toNumber(goal.final_amount))} mask="••••••" hideColor />
                          </div>
                        </div>

                        {/* 4-Tile Grid */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                            <div className={LABEL}>Date Achieved</div>
                            <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                              {formatDate(goal.achieved_date)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                            <div className={LABEL}>Payment Source</div>
                            <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                              {paymentSourceLabel(goal.payment_source)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                            <div className={LABEL}>Planned Target</div>
                            <div className="mt-1 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                              <PrivateValue value={formatMoney(toNumber(goal.target_amount))} mask="••••" hideColor />
                            </div>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                            <div className={LABEL}>Category</div>
                            <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                              {goalTypeLabel(goal.goal_type)}
                            </div>
                          </div>
                        </div>

                        {(goal.purchase_notes || goal.notes) && (
                          <div className="mt-3 text-xs italic text-slate-400">
                            &ldquo;{goal.purchase_notes || goal.notes}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => openEditModal(goal)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          title="Edit"
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(goal)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          title="Delete"
                        >
                          <Icon name="remove" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  )
                }

                // Active Goal Card
                const progress = Math.max(0, Math.min(100, toNumber(goal.progress_pct)))
                const progressMeta = progressStatusMeta(goal.progress_status)
                const isComplete = progress >= 100 || goal.progress_status === 'completed'
                const remainingText = formatRemainingMonths(goal.months_remaining)

                return (
                  <article
                    key={goal.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700/80 hover:shadow-md sm:p-7"
                  >
                    <div>
                      {/* Card Header: Category Icon, Name, Priority & Progress State */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
                            <Icon name={goalTypeIcon(goal.goal_type)} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                              {goal.name}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {goalTypeLabel(goal.goal_type)}
                              </span>
                              <span
                                className={[
                                  'rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize',
                                  priorityBadgeClasses(goal.priority),
                                ].join(' ')}
                              >
                                {goal.priority ?? 'medium'}
                              </span>
                              {goal.is_emi && (
                                <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-600 dark:text-sky-300">
                                  EMI
                                </span>
                              )}
                              {goal.status === 'paused' && (
                                <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                                  Paused
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          className={[
                            'inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                            progressMeta.chip,
                          ].join(' ')}
                        >
                          {progressMeta.label}
                        </span>
                      </div>

                      {/* Current Saved vs Target Valuation Hero */}
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between">
                          <span className={LABEL}>Current Saved</span>
                          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            Target: <PrivateValue value={formatMoney(toNumber(goal.target_amount))} mask="••••" hideColor />
                          </span>
                        </div>
                        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                          <PrivateValue value={formatMoney(toNumber(goal.resolved_current_amount))} mask="••••••" hideColor />
                        </div>

                        {/* Progress Bar with Percentage and Shortfall Notice */}
                        <div className="mt-3.5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              <PrivateValue value={formatPct(progress)} mask="••••" hideColor /> funded
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {isComplete
                                ? 'Fully Funded 🎉'
                                : `${formatMoney(toNumber(goal.shortfall_amount))} remaining`}
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              style={{ width: `${progress}%`, backgroundColor: progressMeta.barColor }}
                              className="h-full rounded-full transition-all duration-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 4-Tile Key Metrics Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Shortfall</div>
                          <div className="mt-1 font-mono text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <PrivateValue value={formatMoney(toNumber(goal.shortfall_amount))} mask="••••" hideColor />
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Monthly Saving</div>
                          <div className="mt-1 font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                            {goal.required_monthly_saving == null ? (
                              '—'
                            ) : (
                              <PrivateValue value={formatMoney(toNumber(goal.required_monthly_saving))} mask="••••" hideColor />
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Target Date</div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {formatDate(goal.target_date)}
                          </div>
                          {remainingText && <div className="text-[10px] text-slate-400">{remainingText}</div>}
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Source</div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-white" title={linkedSourcesSummary(goal)}>
                            {linkedSourcesSummary(goal)}
                          </div>
                        </div>
                      </div>

                      {goal.notes && (
                        <div className="mt-3 line-clamp-2 text-xs italic text-slate-400">
                          &ldquo;{goal.notes}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                      {/* Mark Achieved CTA */}
                      {isComplete ? (
                        <button
                          type="button"
                          onClick={() => openMarkAchievedModal(goal)}
                          className={['inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold', primaryButtonClass].join(' ')}
                        >
                          <Icon name="paid" className="h-3.5 w-3.5" />
                          <span>Mark Achieved 🎉</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openMarkAchievedModal(goal)}
                          className={[
                            'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800',
                          ].join(' ')}
                        >
                          <Icon name="paid" className="h-3.5 w-3.5 text-slate-400" />
                          <span>Mark Achieved</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(goal)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          title={`Edit ${goal.name}`}
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(goal)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          title={`Delete ${goal.name}`}
                        >
                          <Icon name="remove" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            /* ── VIEW MODE: TABLE LEDGER ── */
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Target & Category</th>
                    <th className="px-4 py-3.5">Priority / Status</th>
                    <th className="px-4 py-3.5">Progress</th>
                    <th className="px-4 py-3.5 font-mono text-right">Current Saved</th>
                    <th className="px-4 py-3.5 font-mono text-right">Target Amount</th>
                    <th className="px-4 py-3.5 font-mono text-right">Shortfall</th>
                    <th className="px-4 py-3.5 font-mono text-right">Monthly Needed</th>
                    <th className="px-4 py-3.5">Target Date</th>
                    <th className="px-4 py-3.5">Source</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sortedGoals.map((goal) => {
                    const progress = Math.max(0, Math.min(100, toNumber(goal.progress_pct)))
                    const progressMeta = progressStatusMeta(goal.progress_status)

                    return (
                      <tr
                        key={goal.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
                              <Icon name={goalTypeIcon(goal.goal_type)} className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{goal.name}</div>
                              <div className="text-[11px] text-slate-400">{goalTypeLabel(goal.goal_type)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={[
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                progressMeta.chip,
                              ].join(' ')}
                            >
                              {progressMeta.label}
                            </span>
                            <span
                              className={[
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                                priorityBadgeClasses(goal.priority),
                              ].join(' ')}
                            >
                              {goal.priority ?? 'medium'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-24 space-y-1">
                            <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                              {progress.toFixed(1)}%
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                style={{ width: `${progress}%`, backgroundColor: progressMeta.barColor }}
                                className="h-full rounded-full"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <PrivateValue value={formatINR(toNumber(goal.resolved_current_amount))} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          <PrivateValue value={formatINR(toNumber(goal.target_amount))} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                          <PrivateValue value={formatINR(toNumber(goal.shortfall_amount))} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
                          {goal.required_monthly_saving == null ? (
                            '—'
                          ) : (
                            <PrivateValue value={formatINR(toNumber(goal.required_monthly_saving))} mask="••••" hideColor />
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          <div>{formatDate(goal.target_date)}</div>
                          {goal.months_remaining != null && (
                            <div className="text-[10px] text-slate-400">
                              {formatRemainingMonths(goal.months_remaining)}
                            </div>
                          )}
                        </td>
                        <td className="max-w-32 truncate px-4 py-3.5 text-slate-500">
                          {linkedSourcesSummary(goal)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {goal.status !== 'achieved' && (
                              <button
                                type="button"
                                onClick={() => openMarkAchievedModal(goal)}
                                className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-500/10"
                                title="Mark Achieved"
                              >
                                <Icon name="paid" className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditModal(goal)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              title="Edit"
                            >
                              <Icon name="edit" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(goal)}
                              className="rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                              title="Delete"
                            >
                              <Icon name="remove" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── CREATE / EDIT / MARK ACHIEVED SLIDE-OVER DRAWER ── */}
      {isDrawerMounted ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close drawer"
            onClick={() => setIsModalOpen(false)}
            className={[
              'absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200',
              isDrawerVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
          />

          {/* Drawer Panel */}
          <div
            className={[
              'absolute inset-y-0 right-0 flex w-full max-w-xl transform flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-250 ease-out dark:border-slate-800 dark:bg-slate-950',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
                  <Icon name={modalMode === 'achievement' ? 'cards' : modalMode === 'markAchieved' ? 'paid' : 'ai'} className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                    {modalMode === 'markAchieved'
                      ? 'Mark Goal Achieved'
                      : modalMode === 'achievement'
                        ? editingGoal
                          ? 'Edit Achievement'
                          : 'Record Achievement'
                        : editingGoal
                          ? 'Edit Financial Goal'
                          : 'Add New Financial Goal'}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    {modalMode === 'markAchieved'
                      ? 'Move this target into your completed achievements log.'
                      : modalMode === 'achievement'
                        ? 'Track an accomplished purchase or milestone.'
                        : 'Define a personal financial target and funding timeline.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
                {formErrorMessage && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                    {formErrorMessage}
                  </div>
                )}

                {modalMode === 'goal' ? (
                  <>
                    <div className="space-y-4">
                      <div className={LABEL}>1. Goal Overview & Priority</div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Goal Name" error={formErrors.name}>
                          <input
                            placeholder="e.g. Car Downpayment, Airpods, Europe Trip"
                            value={form.name}
                            onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Goal Category" error={formErrors.goal_type}>
                          <select
                            value={form.goal_type}
                            onChange={(e) =>
                              setForm((cur) => ({ ...cur, goal_type: e.target.value as GoalFormState['goal_type'] }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          >
                            {goalTypeOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </FormField>

                        <FormField label="Target Amount (₹)" error={formErrors.target_amount}>
                          <input
                            inputMode="decimal"
                            placeholder="e.g. 500000"
                            value={form.target_amount}
                            onChange={(e) => setForm((cur) => ({ ...cur, target_amount: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Current Amount (₹)" error={formErrors.current_amount}>
                          <input
                            inputMode="decimal"
                            placeholder="Starting balance"
                            disabled={!form.linked_source_types.includes('manual')}
                            value={form.current_amount}
                            onChange={(e) => setForm((cur) => ({ ...cur, current_amount: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Target Deadline" error={formErrors.target_date}>
                          <input
                            type="date"
                            value={form.target_date}
                            onChange={(e) => setForm((cur) => ({ ...cur, target_date: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Priority" error={formErrors.priority}>
                          <select
                            value={form.priority}
                            onChange={(e) =>
                              setForm((cur) => ({ ...cur, priority: e.target.value as GoalFormState['priority'] }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          >
                            {priorityOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      </div>
                    </div>

                    <div className="space-y-4 pt-2">
                      <div className={LABEL}>2. Funding Sources & Tracking</div>

                      <div>
                        <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Linked Funding Types
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {linkedSourceOptions.map((opt) => (
                            <label
                              key={opt.value}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                            >
                              <span>{opt.label}</span>
                              <input
                                type="checkbox"
                                checked={form.linked_source_types.includes(opt.value)}
                                onChange={() => toggleLinkedSourceType(opt.value)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                              />
                            </label>
                          ))}
                        </div>
                        {formErrors.linked_source_types && (
                          <div className="mt-1.5 text-xs text-rose-500">{formErrors.linked_source_types}</div>
                        )}
                      </div>

                      {form.linked_source_types.includes('bank_accounts') && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Select Bank Accounts to Link
                          </div>
                          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                            {linkedSourceChoices.bank_accounts.length === 0 ? (
                              <div className="text-xs text-slate-400">No bank accounts available.</div>
                            ) : (
                              linkedSourceChoices.bank_accounts.map((choice) => (
                                <label
                                  key={choice.id}
                                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-slate-900 dark:text-white">
                                      {choice.label}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      <PrivateValue value={choice.meta} mask="••••" hideColor />
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={form.linked_source_map.bank_accounts.includes(choice.id)}
                                    onChange={() => toggleLinkedSourceId('bank_accounts', choice.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  />
                                </label>
                              ))
                            )}
                          </div>
                          {formErrors.linked_source_map && (
                            <div className="mt-1 text-xs text-rose-500">{formErrors.linked_source_map}</div>
                          )}
                        </div>
                      )}

                      {form.linked_source_types.includes('fixed_savings') && (
                        <div className="mt-4">
                          <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Select Fixed Savings Accounts to Link
                          </div>
                          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                            {linkedSourceChoices.fixed_savings.length === 0 ? (
                              <div className="text-xs text-slate-400">No fixed savings accounts available.</div>
                            ) : (
                              linkedSourceChoices.fixed_savings.map((choice) => (
                                <label
                                  key={choice.id}
                                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-medium text-slate-900 dark:text-white">
                                      {choice.label}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                      <PrivateValue value={choice.meta} mask="••••" hideColor />
                                    </div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={form.linked_source_map.fixed_savings.includes(choice.id)}
                                    onChange={() => toggleLinkedSourceId('fixed_savings', choice.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                                  />
                                </label>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-white">Track as EMI</div>
                          <div className="text-[11px] text-slate-400">Include in recurring monthly EMI overview</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={form.is_emi}
                          onChange={(e) => setForm((cur) => ({ ...cur, is_emi: e.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <FormField label="Notes & Remarks" error={formErrors.notes}>
                        <textarea
                          rows={3}
                          placeholder="e.g. Downpayment by Diwali, SIP allocation"
                          value={form.notes}
                          onChange={(e) => setForm((cur) => ({ ...cur, notes: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                        />
                      </FormField>
                    </div>
                  </>
                ) : modalMode === 'achievement' ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Achievement Name" error={achievementFormErrors.name}>
                      <input
                        placeholder="e.g. MacBook Pro, Bali Trip, Car Purchase"
                        value={achievementForm.name}
                        onChange={(e) => setAchievementForm((cur) => ({ ...cur, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Category" error={achievementFormErrors.goal_type}>
                      <select
                        value={achievementForm.goal_type}
                        onChange={(e) =>
                          setAchievementForm((cur) => ({
                            ...cur,
                            goal_type: e.target.value as AchievementFormState['goal_type'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {goalTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Amount Paid (₹)" error={achievementFormErrors.achieved_amount}>
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 150000"
                        value={achievementForm.achieved_amount}
                        onChange={(e) => setAchievementForm((cur) => ({ ...cur, achieved_amount: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Achieved Date" error={achievementFormErrors.achieved_date}>
                      <input
                        type="date"
                        value={achievementForm.achieved_date}
                        onChange={(e) => setAchievementForm((cur) => ({ ...cur, achieved_date: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Achievement Type" error={achievementFormErrors.achievement_type}>
                      <select
                        value={achievementForm.achievement_type}
                        onChange={(e) =>
                          setAchievementForm((cur) => ({
                            ...cur,
                            achievement_type: e.target.value as AchievementFormState['achievement_type'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {achievementTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Payment Source" error={achievementFormErrors.payment_source}>
                      <select
                        value={achievementForm.payment_source}
                        onChange={(e) =>
                          setAchievementForm((cur) => ({
                            ...cur,
                            payment_source: e.target.value as AchievementFormState['payment_source'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {paymentSourceOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="sm:col-span-2">
                      <FormField label="Notes & Details" error={achievementFormErrors.purchase_notes}>
                        <textarea
                          rows={3}
                          value={achievementForm.purchase_notes}
                          onChange={(e) => setAchievementForm((cur) => ({ ...cur, purchase_notes: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                        />
                      </FormField>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {goalToAchieve && (
                      <div className="sm:col-span-2 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
                        <div className="font-semibold text-teal-900 dark:text-teal-200">{goalToAchieve.name}</div>
                        <div className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                          Target planned: <PrivateValue value={formatMoney(toNumber(goalToAchieve.target_amount))} mask="••••" hideColor />
                        </div>
                      </div>
                    )}

                    <FormField label="Achieved Amount (₹)" error={markAchievedErrors.achieved_amount}>
                      <input
                        inputMode="decimal"
                        value={markAchievedForm.achieved_amount}
                        onChange={(e) => setMarkAchievedForm((cur) => ({ ...cur, achieved_amount: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Achieved Date" error={markAchievedErrors.achieved_date}>
                      <input
                        type="date"
                        value={markAchievedForm.achieved_date}
                        onChange={(e) => setMarkAchievedForm((cur) => ({ ...cur, achieved_date: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Achievement Type" error={markAchievedErrors.achievement_type}>
                      <select
                        value={markAchievedForm.achievement_type}
                        onChange={(e) =>
                          setMarkAchievedForm((cur) => ({
                            ...cur,
                            achievement_type: e.target.value as MarkAchievedFormState['achievement_type'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {achievementTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Payment Source" error={markAchievedErrors.payment_source}>
                      <select
                        value={markAchievedForm.payment_source}
                        onChange={(e) =>
                          setMarkAchievedForm((cur) => ({
                            ...cur,
                            payment_source: e.target.value as MarkAchievedFormState['payment_source'],
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {paymentSourceOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <div className="sm:col-span-2">
                      <FormField label="Purchase Remarks" error={markAchievedErrors.purchase_notes}>
                        <textarea
                          rows={3}
                          value={markAchievedForm.purchase_notes}
                          onChange={(e) => setMarkAchievedForm((cur) => ({ ...cur, purchase_notes: e.target.value }))}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  {isSaving ? (
                    <Icon name="refresh" className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon name="add" className="h-4 w-4" />
                  )}
                  {isSaving
                    ? 'Saving...'
                    : modalMode === 'achievement'
                      ? editingGoal
                        ? 'Save Achievement'
                        : 'Record Achievement'
                      : modalMode === 'markAchieved'
                        ? 'Mark Achieved'
                        : editingGoal
                          ? 'Save Changes'
                          : 'Create Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
