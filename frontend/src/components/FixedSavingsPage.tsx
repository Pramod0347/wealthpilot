import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  createFixedSavingsAccount,
  deleteFixedSavingsAccount,
  type FixedSavingsAccount,
  type FixedSavingsAccountPayload,
  updateFixedSavingsAccount,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon, type IconName } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { useFixedSavingsAccountsQuery, useFixedSavingsSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500'
const CARD_CONTAINER =
  'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-7'
const INNER_TILE =
  'rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 transition-colors dark:border-slate-800/60 dark:bg-slate-800/40'

type AccountType = FixedSavingsAccount['account_type']
type ViewMode = 'cards' | 'table'
type SortOption = 'value_desc' | 'value_asc' | 'return_desc' | 'rate_desc' | 'name_asc'

type FixedSavingsFormState = {
  account_type: AccountType
  account_name: string
  provider_name: string
  account_number_last4: string
  employee_contribution: string
  employer_contribution: string
  self_contribution: string
  interest_earned: string
  current_value: string
  interest_rate: string
  start_date: string
  maturity_date: string
  as_of_date: string
  notes: string
}

type FormErrors = Partial<Record<keyof FixedSavingsFormState, string>>

const defaultForm: FixedSavingsFormState = {
  account_type: 'epf',
  account_name: '',
  provider_name: '',
  account_number_last4: '',
  employee_contribution: '',
  employer_contribution: '',
  self_contribution: '',
  interest_earned: '',
  current_value: '',
  interest_rate: '',
  start_date: '',
  maturity_date: '',
  as_of_date: '',
  notes: '',
}

const accountTypeOptions: Array<{ value: AccountType; label: string; fullTitle: string; color: string }> = [
  { value: 'epf', label: 'EPF', fullTitle: 'Employee Provident Fund', color: '#0d9488' },
  { value: 'ppf', label: 'PPF', fullTitle: 'Public Provident Fund', color: '#0284c7' },
  { value: 'vpf', label: 'VPF', fullTitle: 'Voluntary Provident Fund', color: '#10b981' },
  { value: 'nps', label: 'NPS', fullTitle: 'National Pension System', color: '#8b5cf6' },
  { value: 'fd', label: 'Fixed Deposit', fullTitle: 'Fixed Deposit (Bank)', color: '#f59e0b' },
  { value: 'rd', label: 'Recurring Deposit', fullTitle: 'Recurring Deposit', color: '#f97316' },
  { value: 'other', label: 'Other', fullTitle: 'Other Fixed Savings', color: '#64748b' },
]

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isNaN(n) ? 0 : n
}

function formatMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`
  if (abs >= 100_000) return `₹${(amount / 100_000).toFixed(2)} L`
  if (abs >= 1_000) return `₹${(amount / 1_000).toFixed(1)} K`
  return formatINR(amount)
}

function formatApiError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors
        .map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`)
        .join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatCompactTimestamp(value: string | null | undefined): string {
  if (!value) return 'Not updated'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not updated'
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(parsed)
}

function accountTypeMeta(value: AccountType) {
  return accountTypeOptions.find((option) => option.value === value) ?? {
    value,
    label: value.toUpperCase(),
    fullTitle: value.toUpperCase(),
    color: '#64748b',
  }
}

function accountTypeBadgeClasses(value: AccountType) {
  switch (value) {
    case 'epf':
      return 'bg-teal-500/10 text-teal-600 border border-teal-500/25 dark:text-teal-300'
    case 'ppf':
      return 'bg-sky-500/10 text-sky-600 border border-sky-500/25 dark:text-sky-300'
    case 'vpf':
      return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-300'
    case 'nps':
      return 'bg-violet-500/10 text-violet-600 border border-violet-500/25 dark:text-violet-300'
    case 'fd':
    case 'rd':
      return 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300'
    default:
      return 'bg-slate-500/10 text-slate-600 border border-slate-500/25 dark:text-slate-300'
  }
}

function getDefaultFormForType(accountType: AccountType): FixedSavingsFormState {
  if (accountType === 'ppf') {
    return {
      ...defaultForm,
      account_type: accountType,
      provider_name: 'SBI',
    }
  }
  if (accountType === 'epf') {
    return {
      ...defaultForm,
      account_type: accountType,
      provider_name: 'EPFO',
    }
  }
  return {
    ...defaultForm,
    account_type: accountType,
  }
}

function toPayload(form: FixedSavingsFormState): FixedSavingsAccountPayload {
  const isPpfLike = form.account_type === 'ppf'
  return {
    account_type: form.account_type,
    account_name: form.account_name.trim(),
    provider_name: form.provider_name.trim() || null,
    account_number_last4: form.account_number_last4.trim() || null,
    employee_contribution: isPpfLike ? '0' : form.employee_contribution.trim() || '0',
    employer_contribution: isPpfLike ? '0' : form.employer_contribution.trim() || '0',
    self_contribution: form.self_contribution.trim() || '0',
    interest_earned: form.interest_earned.trim() || '0',
    current_value: form.current_value.trim() || '0',
    interest_rate: form.interest_rate.trim() || null,
    start_date: form.start_date || null,
    maturity_date: form.maturity_date || null,
    as_of_date: form.as_of_date || null,
    notes: form.notes.trim() || null,
  }
}

function FormField({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function FixedSavingsPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortOption, setSortOption] = useState<SortOption>('value_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Drawer / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FixedSavingsFormState>(defaultForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber'>('emerald')

  // Queries
  const accountsQuery = useFixedSavingsAccountsQuery()
  const summaryQuery = useFixedSavingsSummaryQuery()
  const accounts = accountsQuery.data ?? []
  const summary = summaryQuery.data ?? null
  const accountsLoading = accountsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const accountsError = accountsQuery.error ? formatApiError(accountsQuery.error) : null
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null

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

  // Calculated Metrics
  const totalValue = toNumber(summary?.total_value)
  const totalContribution = toNumber(summary?.total_contribution)
  const totalInterest = toNumber(summary?.total_interest)
  const returnPct = totalContribution > 0 ? (totalInterest / totalContribution) * 100 : 0

  const latestUpdatedAt = useMemo(() => {
    const timestamps = accounts
      .map((account) => new Date(account.updated_at).getTime())
      .filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [accounts])

  // Scheme count map
  const schemeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length }
    for (const acc of accounts) {
      counts[acc.account_type] = (counts[acc.account_type] ?? 0) + 1
    }
    return counts
  }, [accounts])

  // Filter & Sort
  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return accounts.filter((acc) => {
      const matchesSearch =
        !query ||
        acc.account_name.toLowerCase().includes(query) ||
        (acc.provider_name ?? '').toLowerCase().includes(query) ||
        (acc.account_number_last4 ?? '').includes(query) ||
        (acc.notes ?? '').toLowerCase().includes(query)

      const matchesType =
        typeFilter === 'all' ||
        acc.account_type === typeFilter ||
        (typeFilter === 'fd_rd' && (acc.account_type === 'fd' || acc.account_type === 'rd'))

      return matchesSearch && matchesType
    })
  }, [accounts, searchTerm, typeFilter])

  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => {
      if (sortOption === 'value_desc') return toNumber(b.current_value) - toNumber(a.current_value)
      if (sortOption === 'value_asc') return toNumber(a.current_value) - toNumber(b.current_value)
      if (sortOption === 'return_desc') return toNumber(b.return_pct) - toNumber(a.return_pct)
      if (sortOption === 'rate_desc') return toNumber(b.interest_rate) - toNumber(a.interest_rate)
      if (sortOption === 'name_asc') return a.account_name.localeCompare(b.account_name)
      return 0
    })
  }, [filteredAccounts, sortOption])

  // Scheme Breakdown from Summary or Accounts
  const typeBreakdown = useMemo(() => {
    if (summary?.by_type && summary.by_type.length > 0) {
      return summary.by_type
        .filter((item) => toNumber(item.current_value) > 0 || item.count > 0)
        .map((item) => {
          const val = toNumber(item.current_value)
          const pct = totalValue > 0 ? (val / totalValue) * 100 : 0
          const meta = accountTypeMeta(item.account_type)
          return {
            type: item.account_type,
            label: meta.label,
            fullTitle: meta.fullTitle,
            color: meta.color,
            value: val,
            percentage: pct,
            count: item.count,
            interestEarned: toNumber(item.interest_earned),
          }
        })
        .sort((a, b) => b.value - a.value)
    }

    // Fallback: derive directly from accounts
    const map = new Map<AccountType, { value: number; count: number; interest: number }>()
    for (const acc of accounts) {
      const cur = map.get(acc.account_type) ?? { value: 0, count: 0, interest: 0 }
      cur.value += toNumber(acc.current_value)
      cur.count += 1
      cur.interest += toNumber(acc.gain_or_interest)
      map.set(acc.account_type, cur)
    }
    return Array.from(map.entries())
      .map(([type, data]) => {
        const meta = accountTypeMeta(type)
        return {
          type,
          label: meta.label,
          fullTitle: meta.fullTitle,
          color: meta.color,
          value: data.value,
          percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
          count: data.count,
          interestEarned: data.interest,
        }
      })
      .sort((a, b) => b.value - a.value)
  }, [accounts, summary?.by_type, totalValue])

  // Proportions for the Hero composition bar
  const contributionShare = totalValue > 0 ? Math.min(100, Math.max(0, (totalContribution / totalValue) * 100)) : 0
  const interestShare = totalValue > 0 ? Math.min(100, Math.max(0, (totalInterest / totalValue) * 100)) : 0

  // Actions
  async function handleRefresh() {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavingsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  function resetForm(nextType: AccountType = 'epf') {
    setForm(getDefaultFormForType(nextType))
    setFormErrors({})
    setFormErrorMessage(null)
    setEditingId(null)
  }

  function openCreate() {
    resetForm('epf')
    setStatusMessage(null)
    setIsModalOpen(true)
  }

  function openEdit(account: FixedSavingsAccount) {
    setEditingId(account.id)
    setForm({
      account_type: account.account_type,
      account_name: account.account_name ?? '',
      provider_name: account.provider_name ?? '',
      account_number_last4: account.account_number_last4 ?? '',
      employee_contribution: String(account.employee_contribution ?? ''),
      employer_contribution: String(account.employer_contribution ?? ''),
      self_contribution: String(account.self_contribution ?? ''),
      interest_earned: String(account.interest_earned ?? ''),
      current_value: String(account.current_value ?? ''),
      interest_rate: account.interest_rate == null ? '' : String(account.interest_rate),
      start_date: account.start_date ?? '',
      maturity_date: account.maturity_date ?? '',
      as_of_date: account.as_of_date ?? '',
      notes: account.notes ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setStatusMessage(null)
    setIsModalOpen(true)
  }

  function validateForm(current: FixedSavingsFormState) {
    const nextErrors: FormErrors = {}
    if (!current.account_name.trim()) nextErrors.account_name = 'Account name is required'
    if (!current.current_value.trim()) nextErrors.current_value = 'Current balance is required'
    if (current.account_number_last4 && !/^\d{4}$/.test(current.account_number_last4.trim())) {
      nextErrors.account_number_last4 = 'Enter exactly 4 digits'
    }
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormErrorMessage(null)

    if (!validateForm(form)) return

    const payload = toPayload(form)
    setIsSaving(true)

    try {
      if (editingId === null) {
        await createFixedSavingsAccount(payload)
        setStatusTone('emerald')
        setStatusMessage(`Added "${payload.account_name}" successfully.`)
      } else {
        await updateFixedSavingsAccount(editingId, payload)
        setStatusTone('emerald')
        setStatusMessage(`Updated "${payload.account_name}" successfully.`)
      }

      setIsModalOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavingsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
      resetForm(form.account_type)
    } catch (error) {
      setFormErrorMessage(formatApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(account: FixedSavingsAccount) {
    const confirmed = window.confirm(
      `Delete ${account.account_name}? This will remove it from your net worth calculations.`,
    )
    if (!confirmed) return

    try {
      await deleteFixedSavingsAccount(account.id)
      setStatusTone('amber')
      setStatusMessage(`Deleted "${account.account_name}".`)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.fixedSavingsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  const isPpfLike = form.account_type === 'ppf'
  const isEpfLike = form.account_type === 'epf' || form.account_type === 'vpf'

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
        {/* Left: Pulse & Live Sync Status */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
            </span>
            <span className={LABEL}>Provident Fund & Fixed Savings</span>
          </div>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {latestUpdatedAt ? `Synced ${formatCompactTimestamp(latestUpdatedAt)}` : 'Manual tracking active'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
            Tax Status: EEE / 80C Exempt
          </span>
        </div>

        {/* Center: Scheme Breadth Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{schemeCounts.epf ?? 0}</span>
            <span className="text-slate-400">EPF</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{schemeCounts.ppf ?? 0}</span>
            <span className="text-slate-400">PPF</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <Icon name="pfepf" className="h-3.5 w-3.5 text-teal-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{accounts.length}</span>
            <span className="text-slate-400">Total Accounts</span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
            title="Refresh fixed savings balances"
          >
            <Icon name="refresh" className={['h-3.5 w-3.5', isRefreshing ? 'animate-spin' : ''].join(' ')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            type="button"
            onClick={openCreate}
            className={['inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-all', primaryButtonClass].join(' ')}
          >
            <Icon name="add" className="h-3.5 w-3.5" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: HERO VALUATION DECK & COMPOSITION ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Main PF / Long-Term Savings Valuation Hero */}
        <div className={CARD_CONTAINER}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div>
              <div className={LABEL}>Total Provident Fund & Fixed Savings Valuation</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl">
                  {summaryLoading ? (
                    '—'
                  ) : (
                    <PrivateValue value={formatMoney(totalValue)} mask="••••••" hideColor />
                  )}
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums',
                    privacyMode
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : totalInterest >= 0
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                  ].join(' ')}
                >
                  {privacyMode ? '•••' : `${totalInterest >= 0 ? '↑ +' : '↓ '}${formatSignedPct(returnPct)}`}
                </span>
              </div>
            </div>

            {/* Micro badges for invested capital & total profit */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-slate-400">Total Deposits: </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  <PrivateValue value={formatMoney(totalContribution)} mask="••••" hideColor />
                </span>
              </div>
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs dark:border-teal-500/20 dark:bg-teal-500/10">
                <span className="text-teal-600 dark:text-teal-400">Accrued Interest: </span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                  <PrivateValue
                    value={`${totalInterest >= 0 ? '+' : ''}${formatMoney(totalInterest)}`}
                    mask="••••"
                    hideColor
                  />
                </span>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar: Contribution vs Compounded Interest */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Portfolio Capital Composition</span>
              <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                {totalValue > 0 ? `${contributionShare.toFixed(1)}% Deposits · ${interestShare.toFixed(1)}% Interest` : '—'}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                style={{ width: `${contributionShare}%` }}
                className="bg-teal-500 transition-all duration-500"
                title={`Deposits: ${contributionShare.toFixed(1)}%`}
              />
              <div
                style={{ width: `${interestShare}%` }}
                className="bg-emerald-400 transition-all duration-500"
                title={`Interest / Gains: ${interestShare.toFixed(1)}%`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                <span>Contributions:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  <PrivateValue value={formatMoney(totalContribution)} mask="••••" hideColor />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Interest & Gains:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <PrivateValue
                    value={`${totalInterest >= 0 ? '+' : ''}${formatMoney(totalInterest)}`}
                    mask="••••"
                    hideColor
                  />
                </span>
              </div>
            </div>
          </div>

          {/* 3 Metric Summary Banner */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            <div className={INNER_TILE}>
              <div className={LABEL}>Total Contributed</div>
              <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                <PrivateValue value={formatINR(totalContribution)} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Employee, employer & self deposits</div>
            </div>

            <div className={INNER_TILE}>
              <div className={LABEL}>Accrued Interest</div>
              <div
                className={[
                  'mt-2 font-mono text-base font-semibold tabular-nums sm:text-lg',
                  privacyMode ? 'text-slate-400' : getTrendClass(totalInterest),
                ].join(' ')}
              >
                <PrivateValue
                  value={`${totalInterest >= 0 ? '+' : ''}${formatINR(totalInterest)}`}
                  mask="••••"
                  hideColor
                />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Compounded tax-free growth</div>
            </div>

            <div className={INNER_TILE}>
              <div className={LABEL}>Effective Return %</div>
              <div
                className={[
                  'mt-2 font-mono text-base font-semibold tabular-nums sm:text-lg',
                  privacyMode ? 'text-slate-400' : getTrendClass(returnPct),
                ].join(' ')}
              >
                <PrivateValue value={formatSignedPct(returnPct)} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Cumulative return on deposits</div>
            </div>
          </div>
        </div>

        {/* Right: Allocation by Scheme Type & Tax Status */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Icon name="pfepf" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                Allocation by Scheme Type
              </h2>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Distribution across EPF, PPF, NPS & Fixed Deposits
              </p>
            </div>
          </div>

          {/* Scheme Breakdown List */}
          <div className="mt-5 space-y-3.5">
            {typeBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No scheme allocations yet</div>
            ) : (
              typeBreakdown.map((item) => (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</span>
                      <span className="text-[11px] text-slate-400">({item.count} {item.count === 1 ? 'account' : 'accounts'})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(item.value)} mask="••••" hideColor />
                      </span>
                      <span className="w-12 text-right font-mono text-[11px] font-medium text-slate-400">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* EEE Tax-Advantage Explainer Pill */}
          <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
            <div className="flex items-start gap-2.5">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <div className="text-xs">
                <span className="font-semibold text-teal-900 dark:text-teal-200">
                  EEE Tax Exemption Advantage:
                </span>{' '}
                <span className="text-teal-700/90 dark:text-teal-300/80">
                  EPF & PPF deposits qualify under Sec 80C, annual compounding interest is tax-free, and maturity withdrawals are exempt.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: ACCOUNTS EXPLORER & MANAGEMENT ── */}
      <div className={CARD_CONTAINER}>
        {/* Controls Toolbar: Search, Filter Tabs, Sort & View Mode */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Filter Scheme Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === 'all'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              All ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('epf')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === 'epf'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              EPF ({schemeCounts.epf ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('ppf')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === 'ppf'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              PPF ({schemeCounts.ppf ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('nps')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === 'nps'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              NPS ({schemeCounts.nps ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('fd_rd')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                typeFilter === 'fd_rd'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              FD / RD ({(schemeCounts.fd ?? 0) + (schemeCounts.rd ?? 0)})
            </button>
          </div>

          {/* Right: Search, Sort & View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-48 sm:min-w-64">
              <Icon name="search" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search account, bank, UAN..."
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

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort accounts"
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-teal-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:focus:border-teal-400"
            >
              <option value="value_desc">Highest Valuation</option>
              <option value="value_asc">Lowest Valuation</option>
              <option value="return_desc">Highest Return %</option>
              <option value="rate_desc">Highest Interest Rate</option>
              <option value="name_asc">Account Name (A-Z)</option>
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

        {/* Content Body: Loading / Error / Empty / Cards / Table */}
        <div className="pt-6">
          {accountsLoading ? (
            <div className="py-16 text-center">
              <Icon name="refresh" className="mx-auto h-6 w-6 animate-spin text-teal-500" />
              <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                Loading fixed savings accounts…
              </div>
              <div className="mt-1 text-xs text-slate-400">Retrieving balances and contributions</div>
            </div>
          ) : accountsError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-400">
              {accountsError}
            </div>
          ) : accounts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Icon name="pfepf" className="h-6 w-6" />
              </div>
              <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                No Fixed Savings accounts added yet
              </div>
              <div className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                Add your EPFO Provident Fund, SBI / Post Office PPF, NPS retirement, or bank Fixed Deposits to track compounding returns.
              </div>
              <button
                type="button"
                onClick={openCreate}
                className={['mt-5', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                Add Your First Account
              </button>
            </div>
          ) : sortedAccounts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No accounts match &ldquo;{searchTerm}&rdquo; under the selected filter.
            </div>
          ) : viewMode === 'cards' ? (
            /* ── VIEW MODE: CARDS GRID ── */
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sortedAccounts.map((account) => {
                const gain = toNumber(account.gain_or_interest)
                const curVal = toNumber(account.current_value)
                const contrib = toNumber(account.total_contribution)
                const empContrib = toNumber(account.employee_contribution)
                const empyrContrib = toNumber(account.employer_contribution)
                const selfContrib = toNumber(account.self_contribution)
                const isEpf = account.account_type === 'epf' || account.account_type === 'vpf'

                // Composition percentages
                const empPct = curVal > 0 ? (empContrib / curVal) * 100 : 0
                const empyrPct = curVal > 0 ? (empyrContrib / curVal) * 100 : 0
                const selfPct = curVal > 0 ? (selfContrib / curVal) * 100 : 0
                const gainPct = curVal > 0 ? (Math.max(0, gain) / curVal) * 100 : 0

                return (
                  <div
                    key={account.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700/80 hover:shadow-md sm:p-7"
                  >
                    <div>
                      {/* Card Header: Provider Avatar, Title, Scheme Badge & Return Pill */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 font-mono text-xs font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {(account.provider_name || account.account_name).slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                              {account.account_name}
                            </h3>
                            <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                              {[
                                account.provider_name,
                                account.account_number_last4 ? `••${account.account_number_last4}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Manual tracking'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={[
                              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              accountTypeBadgeClasses(account.account_type),
                            ].join(' ')}
                          >
                            {accountTypeMeta(account.account_type).label}
                          </span>
                          <span
                            className={[
                              'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums',
                              privacyMode
                                ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                : gain >= 0
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                            ].join(' ')}
                          >
                            {privacyMode ? '•••' : `${gain >= 0 ? '+' : ''}${formatPct(toNumber(account.return_pct))}`}
                          </span>
                        </div>
                      </div>

                      {/* Main Valuation Display */}
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between">
                          <span className={LABEL}>Current Valuation</span>
                          {account.interest_rate != null && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                              {Number(account.interest_rate).toFixed(2)}% p.a.
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                          <PrivateValue value={formatINR(curVal)} mask="••••••" hideColor />
                        </div>

                        {/* Stacked Composition Bar */}
                        <div className="mt-3.5 space-y-1.5">
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            {isEpf ? (
                              <>
                                <div
                                  style={{ width: `${empPct}%` }}
                                  className="bg-teal-500 transition-all"
                                  title={`Employee Share: ${empPct.toFixed(1)}%`}
                                />
                                <div
                                  style={{ width: `${empyrPct}%` }}
                                  className="bg-sky-500 transition-all"
                                  title={`Employer Share: ${empyrPct.toFixed(1)}%`}
                                />
                                <div
                                  style={{ width: `${gainPct}%` }}
                                  className="bg-emerald-400 transition-all"
                                  title={`Interest: ${gainPct.toFixed(1)}%`}
                                />
                              </>
                            ) : (
                              <>
                                <div
                                  style={{ width: `${selfPct}%` }}
                                  className="bg-sky-500 transition-all"
                                  title={`Self Contribution: ${selfPct.toFixed(1)}%`}
                                />
                                <div
                                  style={{ width: `${gainPct}%` }}
                                  className="bg-emerald-400 transition-all"
                                  title={`Interest: ${gainPct.toFixed(1)}%`}
                                />
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                            {isEpf ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                                  <span>Employee:</span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    <PrivateValue value={formatINRShort(empContrib)} mask="•••" hideColor />
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                  <span>Employer:</span>
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                    <PrivateValue value={formatINRShort(empyrContrib)} mask="•••" hideColor />
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                <span>Self Deposit:</span>
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                  <PrivateValue value={formatINRShort(selfContrib || contrib)} mask="•••" hideColor />
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>Interest:</span>
                              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                                <PrivateValue value={formatINRShort(gain)} mask="•••" hideColor />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4-Tile Financial Breakdown */}
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Principal</div>
                          <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            <PrivateValue value={formatINR(contrib)} mask="••••" hideColor />
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Interest / Gains</div>
                          <div
                            className={[
                              'mt-1 font-mono text-sm font-semibold',
                              privacyMode ? 'text-slate-400' : getTrendClass(gain),
                            ].join(' ')}
                          >
                            <PrivateValue
                              value={`${gain >= 0 ? '+' : ''}${formatINR(gain)}`}
                              mask="••••"
                              hideColor
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Annual Rate</div>
                          <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {account.interest_rate != null ? `${Number(account.interest_rate).toFixed(2)}%` : '—'}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Maturity Date</div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {formatDate(account.maturity_date)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: As of Date & Action Buttons */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <div className="flex items-center gap-2 min-w-0">
                        <span>As of {formatDate(account.as_of_date)}</span>
                        {account.notes && (
                          <span
                            className="truncate max-w-36 text-slate-400 italic"
                            title={account.notes}
                          >
                            · {account.notes}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(account)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          title={`Edit ${account.account_name}`}
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(account)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          title={`Delete ${account.account_name}`}
                        >
                          <Icon name="remove" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── VIEW MODE: TABLE LEDGER ── */
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">Account & Scheme</th>
                    <th className="px-4 py-3.5">Provider / Bank</th>
                    <th className="px-4 py-3.5 font-mono">Last 4</th>
                    <th className="px-4 py-3.5 font-mono text-right">Current Value</th>
                    <th className="px-4 py-3.5 font-mono text-right">Total Contributed</th>
                    <th className="px-4 py-3.5 font-mono text-right">Interest / Gains</th>
                    <th className="px-4 py-3.5 font-mono text-right">Interest Rate</th>
                    <th className="px-4 py-3.5 font-mono text-right">Return %</th>
                    <th className="px-4 py-3.5">Maturity</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sortedAccounts.map((account) => {
                    const gain = toNumber(account.gain_or_interest)
                    const curVal = toNumber(account.current_value)
                    const contrib = toNumber(account.total_contribution)

                    return (
                      <tr
                        key={account.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                accountTypeBadgeClasses(account.account_type),
                              ].join(' ')}
                            >
                              {accountTypeMeta(account.account_type).label}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {account.account_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          {account.provider_name || '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">
                          {account.account_number_last4 ? `••${account.account_number_last4}` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <PrivateValue value={formatINR(curVal)} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                          <PrivateValue value={formatINR(contrib)} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold">
                          <span className={privacyMode ? 'text-slate-400' : getTrendClass(gain)}>
                            <PrivateValue
                              value={`${gain >= 0 ? '+' : ''}${formatINR(gain)}`}
                              mask="••••"
                              hideColor
                            />
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {account.interest_rate != null ? `${Number(account.interest_rate).toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold">
                          <span
                            className={
                              privacyMode ? 'text-slate-400' : getTrendClass(toNumber(account.return_pct))
                            }
                          >
                            <PrivateValue value={formatPct(toNumber(account.return_pct))} mask="•••" hideColor />
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          {formatDate(account.maturity_date)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(account)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              title="Edit"
                            >
                              <Icon name="edit" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(account)}
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

      {/* ── CREATE / EDIT ACCOUNT SLIDE-OVER DRAWER ── */}
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
                  <Icon name="pfepf" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                    {editingId === null ? 'Add Fixed Savings Account' : 'Edit Account Details'}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    Provident Fund, PPF, NPS, or Fixed Deposit ledger entry
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

                {/* Section 1: Account Scheme & Identity */}
                <div className="space-y-4">
                  <div className={LABEL}>1. Scheme & Identity</div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Account Scheme" error={formErrors.account_type}>
                      <select
                        value={form.account_type}
                        onChange={(event) => {
                          const nextType = event.target.value as AccountType
                          setForm((current) => ({
                            ...getDefaultFormForType(nextType),
                            ...current,
                            account_type: nextType,
                            employee_contribution: nextType === 'ppf' ? '' : current.employee_contribution,
                            employer_contribution: nextType === 'ppf' ? '' : current.employer_contribution,
                            provider_name:
                              nextType === 'epf'
                                ? current.provider_name || 'EPFO'
                                : nextType === 'ppf'
                                  ? current.provider_name || 'SBI'
                                  : current.provider_name,
                          }))
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {accountTypeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.fullTitle}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Account Name" error={formErrors.account_name}>
                      <input
                        placeholder="e.g. EPF - Tech Corp or PPF Account"
                        value={form.account_name}
                        onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Provider / Bank" error={formErrors.provider_name}>
                      <input
                        placeholder="e.g. EPFO, SBI, HDFC, Post Office"
                        value={form.provider_name}
                        onChange={(event) => setForm((current) => ({ ...current, provider_name: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Last 4 Digits / UAN" error={formErrors.account_number_last4}>
                      <input
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="e.g. 3617"
                        value={form.account_number_last4}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            account_number_last4: event.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Section 2: Financial Balances & Contributions */}
                <div className="space-y-4 pt-2">
                  <div className={LABEL}>2. Balances & Contributions</div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Current Value (₹)" error={formErrors.current_value}>
                      <input
                        inputMode="decimal"
                        placeholder="Total current accumulated balance"
                        value={form.current_value}
                        onChange={(event) => setForm((current) => ({ ...current, current_value: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Interest Rate (% p.a.)" error={formErrors.interest_rate}>
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 8.25 for EPF or 7.10 for PPF"
                        value={form.interest_rate}
                        onChange={(event) => setForm((current) => ({ ...current, interest_rate: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    {isEpfLike ? (
                      <>
                        <FormField label="Employee Share (₹)" error={formErrors.employee_contribution}>
                          <input
                            inputMode="decimal"
                            placeholder="Your total contribution"
                            value={form.employee_contribution}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, employee_contribution: event.target.value }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Employer Share (₹)" error={formErrors.employer_contribution}>
                          <input
                            inputMode="decimal"
                            placeholder="Company matching contribution"
                            value={form.employer_contribution}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, employer_contribution: event.target.value }))
                            }
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>
                      </>
                    ) : (
                      <FormField label="Self Contribution (₹)" error={formErrors.self_contribution}>
                        <input
                          inputMode="decimal"
                          placeholder="Total deposited principal"
                          value={form.self_contribution}
                          onChange={(event) =>
                            setForm((current) => ({ ...current, self_contribution: event.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                        />
                      </FormField>
                    )}

                    <FormField label="Interest Earned (₹)" error={formErrors.interest_earned}>
                      <input
                        inputMode="decimal"
                        placeholder="Accrued compound interest"
                        value={form.interest_earned}
                        onChange={(event) => setForm((current) => ({ ...current, interest_earned: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Section 3: Dates & Timeline */}
                <div className="space-y-4 pt-2">
                  <div className={LABEL}>3. Dates & Timeline</div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField label="Start Date" error={formErrors.start_date}>
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Maturity Date" error={formErrors.maturity_date}>
                      <input
                        type="date"
                        value={form.maturity_date}
                        onChange={(event) => setForm((current) => ({ ...current, maturity_date: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="As Of Date" error={formErrors.as_of_date}>
                      <input
                        type="date"
                        value={form.as_of_date}
                        onChange={(event) => setForm((current) => ({ ...current, as_of_date: event.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>
                  </div>
                </div>

                {/* Section 4: Notes */}
                <div className="pt-2">
                  <FormField label="Notes & Tracking Remarks" error={formErrors.notes}>
                    <textarea
                      rows={3}
                      placeholder="e.g. Passbook updated on EPFO member portal, or 15-year lock-in notes"
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                    />
                  </FormField>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={secondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  <Icon name="add" className="h-4 w-4" />
                  {isSaving ? 'Saving...' : editingId === null ? 'Add Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
