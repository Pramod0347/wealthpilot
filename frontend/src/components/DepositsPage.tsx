import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  createDeposit,
  deleteDeposit,
  type Deposit,
  type DepositPayload,
  type DepositSummary,
  updateDeposit,
} from '../lib/api'
import { formatINR, formatINRShort } from '../lib/format'
import { Icon, type IconName } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useDepositsQuery, useDepositsSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500'
const CARD_CONTAINER =
  'rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:p-7'
const INNER_TILE =
  'rounded-2xl border border-slate-100 bg-slate-50/80 p-4 sm:p-5 transition-colors dark:border-slate-800/60 dark:bg-slate-800/40'

type DepositType = Deposit['type']
type DepositStatus = Deposit['status']
type ViewMode = 'cards' | 'table'
type SortOption = 'amount_desc' | 'amount_asc' | 'date_desc' | 'date_asc' | 'name_asc'

type DepositFormState = {
  name: string
  type: DepositType
  amount: string
  property_name: string
  paid_date: string
  refundable: boolean
  status: DepositStatus
  returned_date: string
  returned_amount: string
  return_deduction: string
  return_notes: string
  description: string
}

type FormErrors = Partial<Record<keyof DepositFormState, string>>

const defaultDepositForm: DepositFormState = {
  name: '',
  type: 'rent_deposit',
  amount: '',
  property_name: '',
  paid_date: '',
  refundable: true,
  status: 'active',
  returned_date: '',
  returned_amount: '',
  return_deduction: '',
  return_notes: '',
  description: '',
}

const depositTypeOptions: Array<{ value: DepositType; label: string; fullTitle: string; color: string }> = [
  { value: 'rent_deposit', label: 'Rent Deposit', fullTitle: 'House Rent Deposit', color: '#0d9488' },
  { value: 'security_deposit', label: 'Security Deposit', fullTitle: 'Security Deposit', color: '#0284c7' },
  { value: 'office_deposit', label: 'Office Deposit', fullTitle: 'Office / Commercial Deposit', color: '#8b5cf6' },
  { value: 'other', label: 'Other', fullTitle: 'Other Refundable Deposit', color: '#f59e0b' },
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
  if (!value) return 'No date'
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

function typeMeta(value: DepositType) {
  return depositTypeOptions.find((opt) => opt.value === value) ?? {
    value,
    label: 'Other',
    fullTitle: 'Other Deposit',
    color: '#64748b',
  }
}

function typeBadgeClasses(value: DepositType) {
  switch (value) {
    case 'rent_deposit':
      return 'bg-teal-500/10 text-teal-600 border border-teal-500/25 dark:text-teal-300'
    case 'security_deposit':
      return 'bg-sky-500/10 text-sky-600 border border-sky-500/25 dark:text-sky-300'
    case 'office_deposit':
      return 'bg-violet-500/10 text-violet-600 border border-violet-500/25 dark:text-violet-300'
    default:
      return 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300'
  }
}

function statusBadgeClasses(status: DepositStatus) {
  if (status === 'returned') {
    return 'bg-amber-500/10 text-amber-600 border border-amber-500/25 dark:text-amber-300'
  }
  return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 dark:text-emerald-300'
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

export default function DepositsPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()

  // State
  const [statusTab, setStatusTab] = useState<'all' | 'active' | 'returned'>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('amount_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Drawer / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<DepositFormState>(defaultDepositForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'emerald' | 'rose' | 'amber'>('emerald')

  // Queries
  const depositsQuery = useDepositsQuery()
  const summaryQuery = useDepositsSummaryQuery()
  const deposits = depositsQuery.data ?? []
  const summary = (summaryQuery.data ?? null) as DepositSummary | null
  const depositsLoading = depositsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const depositsError = depositsQuery.error ? formatApiError(depositsQuery.error) : null
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

  const latestUpdatedAt = useMemo(() => {
    const timestamps = deposits
      .map((deposit) => new Date(deposit.updated_at).getTime())
      .filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [deposits])

  // Summary Metrics
  const activeCapital = toNumber(summary?.active_deposits)
  const returnedCapital = toNumber(summary?.returned_amount)
  const totalDeductions = toNumber(summary?.return_deductions)
  const activeCount = summary?.active_count ?? deposits.filter((d) => d.status === 'active').length
  const returnedCount = summary?.returned_count ?? deposits.filter((d) => d.status === 'returned').length

  const totalCapitalLifetime = activeCapital + returnedCapital + totalDeductions
  const activeShare = totalCapitalLifetime > 0 ? (activeCapital / totalCapitalLifetime) * 100 : 0
  const returnedShare = totalCapitalLifetime > 0 ? (returnedCapital / totalCapitalLifetime) * 100 : 0
  const deductionShare = totalCapitalLifetime > 0 ? (totalDeductions / totalCapitalLifetime) * 100 : 0

  // Category counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deposits.length }
    for (const d of deposits) {
      counts[d.type] = (counts[d.type] ?? 0) + 1
    }
    return counts
  }, [deposits])

  // Breakdown by Type
  const categoryBreakdown = useMemo(() => {
    const map = new Map<DepositType, { value: number; count: number }>()
    for (const d of deposits) {
      const cur = map.get(d.type) ?? { value: 0, count: 0 }
      cur.value += toNumber(d.amount)
      cur.count += 1
      map.set(d.type, cur)
    }
    const totalAmount = deposits.reduce((sum, d) => sum + toNumber(d.amount), 0) || 1

    return depositTypeOptions
      .map((opt) => {
        const data = map.get(opt.value) ?? { value: 0, count: 0 }
        return {
          type: opt.value,
          label: opt.label,
          fullTitle: opt.fullTitle,
          color: opt.color,
          value: data.value,
          count: data.count,
          percentage: (data.value / totalAmount) * 100,
        }
      })
      .filter((item) => item.count > 0 || item.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [deposits])

  // Filter & Sort
  const filteredDeposits = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return deposits.filter((deposit) => {
      const matchesSearch =
        !query ||
        deposit.name.toLowerCase().includes(query) ||
        (deposit.property_name ?? '').toLowerCase().includes(query) ||
        (deposit.description ?? '').toLowerCase().includes(query) ||
        (deposit.return_notes ?? '').toLowerCase().includes(query)

      const matchesStatus =
        statusTab === 'all' || deposit.status === statusTab

      const matchesType =
        typeFilter === 'all' || deposit.type === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
  }, [deposits, searchTerm, statusTab, typeFilter])

  const sortedDeposits = useMemo(() => {
    return [...filteredDeposits].sort((a, b) => {
      if (sortOption === 'amount_desc') return toNumber(b.amount) - toNumber(a.amount)
      if (sortOption === 'amount_asc') return toNumber(a.amount) - toNumber(b.amount)
      if (sortOption === 'date_desc') return (b.paid_date ?? '').localeCompare(a.paid_date ?? '')
      if (sortOption === 'date_asc') return (a.paid_date ?? '').localeCompare(b.paid_date ?? '')
      if (sortOption === 'name_asc') return a.name.localeCompare(b.name)
      return 0
    })
  }, [filteredDeposits, sortOption])

  // Actions
  async function refreshData() {
    setIsRefreshing(true)
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
        queryClient.invalidateQueries({ queryKey: queryKeys.depositsSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(defaultDepositForm)
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(deposit: Deposit) {
    setEditingId(deposit.id)
    setForm({
      name: deposit.name,
      type: deposit.type,
      amount: String(deposit.amount),
      property_name: deposit.property_name ?? '',
      paid_date: deposit.paid_date ?? '',
      refundable: deposit.refundable,
      status: deposit.status,
      returned_date: deposit.returned_date ?? '',
      returned_amount: deposit.returned_amount == null ? '' : String(deposit.returned_amount),
      return_deduction: deposit.return_deduction == null ? '' : String(deposit.return_deduction),
      return_notes: deposit.return_notes ?? '',
      description: deposit.description ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const name = form.name.trim()
    const amount = form.amount.trim()

    if (!name) nextErrors.name = 'Deposit name is required.'
    if (!amount) nextErrors.amount = 'Amount is required.'
    if (amount && Number.isNaN(Number(amount))) nextErrors.amount = 'Enter a valid amount.'
    if (amount && Number(amount) <= 0) nextErrors.amount = 'Amount must be greater than 0.'
    if (form.status === 'returned' && !form.returned_date) nextErrors.returned_date = 'Return date is required.'
    if (form.status === 'returned' && !form.returned_amount) nextErrors.returned_amount = 'Returned amount is required.'
    if (form.status === 'returned' && form.returned_amount && Number(form.returned_amount) > Number(amount)) {
      nextErrors.returned_amount = 'Returned amount cannot exceed the original deposit amount.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    const payload: DepositPayload = {
      name,
      type: form.type,
      amount,
      property_name: form.property_name.trim() || null,
      description: form.description.trim() || null,
      paid_date: form.paid_date || null,
      refundable: form.refundable,
      status: form.status,
      returned_date: form.status === 'returned' ? form.returned_date || null : null,
      returned_amount: form.status === 'returned' ? form.returned_amount || null : null,
      return_deduction:
        form.status === 'returned'
          ? form.return_deduction || String(Math.max(Number(amount) - Number(form.returned_amount || 0), 0))
          : null,
      return_notes: form.status === 'returned' ? form.return_notes.trim() || null : null,
    }

    setIsSaving(true)
    try {
      if (editingId === null) {
        await createDeposit(payload)
        setBannerTone('emerald')
        setStatusMessage(`Added "${name}" successfully.`)
      } else {
        await updateDeposit(editingId, payload)
        setBannerTone('emerald')
        setStatusMessage(`Updated "${name}" successfully.`)
      }
      setIsModalOpen(false)
      setEditingId(null)
      setForm(defaultDepositForm)
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors.length > 0) {
        const mappedErrors: FormErrors = {}
        error.validationErrors.forEach((item) => {
          if (item.path in defaultDepositForm) {
            mappedErrors[item.path as keyof DepositFormState] = item.message
          }
        })
        setFormErrors(mappedErrors)
        setFormErrorMessage('Please fix the highlighted fields.')
      } else {
        setFormErrorMessage(formatApiError(error))
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(deposit: Deposit) {
    const confirmed = window.confirm(`Delete "${deposit.name}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteDeposit(deposit.id)
      setBannerTone('emerald')
      setStatusMessage(`Deleted "${deposit.name}".`)
      await refreshData()
    } catch (error) {
      setBannerTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="min-w-0 w-full space-y-6 lg:space-y-8 pb-12">
      {/* Toast Alert Banner */}
      {statusMessage ? (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm transition-all',
            bannerTone === 'emerald'
              ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : bannerTone === 'rose'
                ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
                : 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <Icon
              name={bannerTone === 'emerald' ? 'paid' : bannerTone === 'rose' ? 'warning' : 'alert'}
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
            <span className={LABEL}>Refundable Deposits & Escrow</span>
          </div>
          <span className="hidden text-slate-300 dark:text-slate-700 sm:inline">|</span>
          <span className="text-xs text-slate-600 dark:text-slate-300">
            {latestUpdatedAt ? `Synced ${formatCompactTimestamp(latestUpdatedAt)}` : 'Manual tracking active'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
            Asset Treatment: 100% Principal Tracked
          </span>
        </div>

        {/* Center: Health & Status Breadth Pills */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{activeCount}</span>
            <span className="text-slate-400">Active Held</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{returnedCount}</span>
            <span className="text-slate-400">Returned</span>
          </div>
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 dark:border-slate-800 dark:bg-slate-800/60">
            <Icon name="banks" className="h-3.5 w-3.5 text-teal-500" />
            <span className="font-semibold text-slate-900 dark:text-white">{deposits.length}</span>
            <span className="text-slate-400">Total Deposits</span>
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={refreshData}
            disabled={isRefreshing}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all',
              secondaryButtonClass,
            ].join(' ')}
            title="Refresh deposits balances"
          >
            <Icon name="refresh" className={['h-3.5 w-3.5', isRefreshing ? 'animate-spin' : ''].join(' ')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
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
            <span>Add Deposit</span>
          </button>
        </div>
      </div>

      {/* ── ROW 1: HERO VALUATION DECK & ALLOCATION ── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        {/* Main Active Deposits Valuation Hero */}
        <div className={CARD_CONTAINER}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div>
              <div className={LABEL}>Total Active Refundable Deposits Held</div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-[-0.02em] text-slate-900 dark:text-white sm:text-4xl">
                  {summaryLoading ? (
                    '—'
                  ) : (
                    <PrivateValue value={formatMoney(activeCapital)} mask="••••••" hideColor />
                  )}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {activeCount} Active {activeCount === 1 ? 'Deposit' : 'Deposits'}
                </span>
              </div>
            </div>

            {/* Badges for Recovered & Deductions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-1.5 text-xs dark:border-teal-500/20 dark:bg-teal-500/10">
                <span className="text-teal-600 dark:text-teal-400">Historical Recovered: </span>
                <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                  <PrivateValue value={formatMoney(returnedCapital)} mask="••••" hideColor />
                </span>
              </div>
              {totalDeductions > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-1.5 text-xs dark:border-amber-500/20 dark:bg-amber-500/10">
                  <span className="text-amber-600 dark:text-amber-400">Total Deductions: </span>
                  <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                    <PrivateValue value={formatMoney(totalDeductions)} mask="••••" hideColor />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Visual Progress Bar: Active Held vs Recovered vs Deducted */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-500 dark:text-slate-400">Capital Lifecycle Distribution</span>
              <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                {totalCapitalLifetime > 0
                  ? `${activeShare.toFixed(1)}% Held · ${returnedShare.toFixed(1)}% Recovered`
                  : '—'}
              </span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                style={{ width: `${activeShare}%` }}
                className="bg-teal-500 transition-all duration-500"
                title={`Active Held: ${activeShare.toFixed(1)}%`}
              />
              <div
                style={{ width: `${returnedShare}%` }}
                className="bg-emerald-400 transition-all duration-500"
                title={`Returned: ${returnedShare.toFixed(1)}%`}
              />
              <div
                style={{ width: `${deductionShare}%` }}
                className="bg-rose-400 transition-all duration-500"
                title={`Deductions: ${deductionShare.toFixed(1)}%`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                <span>Currently Held:</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  <PrivateValue value={formatMoney(activeCapital)} mask="••••" hideColor />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Returned to You:</span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                  <PrivateValue value={formatMoney(returnedCapital)} mask="••••" hideColor />
                </span>
              </div>
              {totalDeductions > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  <span>Deductions Withheld:</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    <PrivateValue value={formatMoney(totalDeductions)} mask="••••" hideColor />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3 Metric Summary Banner */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
            <div className={INNER_TILE}>
              <div className={LABEL}>Active Held Capital</div>
              <div className="mt-2 font-mono text-base font-semibold tabular-nums text-slate-900 dark:text-white sm:text-lg">
                <PrivateValue value={formatINR(activeCapital)} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Tied in active properties / offices</div>
            </div>

            <div className={INNER_TILE}>
              <div className={LABEL}>Refunded to Bank</div>
              <div className="mt-2 font-mono text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-lg">
                <PrivateValue value={formatINR(returnedCapital)} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Recovered upon lease / tenure exit</div>
            </div>

            <div className={INNER_TILE}>
              <div className={LABEL}>Withheld Deductions</div>
              <div className="mt-2 font-mono text-base font-semibold tabular-nums text-amber-600 dark:text-amber-400 sm:text-lg">
                <PrivateValue value={formatINR(totalDeductions)} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-xs font-medium text-slate-400">Maintenance & exit charges</div>
            </div>
          </div>
        </div>

        {/* Right Card: Allocation by Deposit Category */}
        <div className={CARD_CONTAINER}>
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400">
              <Icon name="banks" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                Allocation by Deposit Type
              </h2>
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Breakdown across rent, security & commercial escrow
              </p>
            </div>
          </div>

          {/* Category Breakdown List */}
          <div className="mt-5 space-y-3.5">
            {categoryBreakdown.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No deposit allocations tracked yet</div>
            ) : (
              categoryBreakdown.map((item) => (
                <div key={item.type} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</span>
                      <span className="text-[11px] text-slate-400">
                        ({item.count} {item.count === 1 ? 'deposit' : 'deposits'})
                      </span>
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

          {/* Net Worth Protection Explainer Pill */}
          <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
            <div className="flex items-start gap-2.5">
              <Icon name="shield" className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
              <div className="text-xs">
                <span className="font-semibold text-teal-900 dark:text-teal-200">
                  Asset Classification Rule:
                </span>{' '}
                <span className="text-teal-700/90 dark:text-teal-300/80">
                  Refundable deposits contribute directly to your total net worth. Once returned, amounts flow back into your liquid bank accounts.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: DEPOSITS EXPLORER & MANAGEMENT ── */}
      <div className={CARD_CONTAINER}>
        {/* Controls Toolbar: Search, Filter Tabs, Sort & View Mode */}
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Filter Status & Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusTab('all')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                statusTab === 'all'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              All ({deposits.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('active')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                statusTab === 'active'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              Active Held ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('returned')}
              className={[
                'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all',
                statusTab === 'returned'
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              Returned ({returnedCount})
            </button>
          </div>

          {/* Right: Search, Category Filter, Sort & View Mode */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-44 sm:min-w-60">
              <Icon name="search" className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search deposit, property..."
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

            {/* Category Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-teal-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:focus:border-teal-400"
            >
              <option value="all">All Types</option>
              {depositTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({typeCounts[opt.value] ?? 0})
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort deposits"
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-all focus:border-teal-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:focus:border-teal-400"
            >
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
              <option value="date_desc">Newest Paid Date</option>
              <option value="date_asc">Oldest Paid Date</option>
              <option value="name_asc">Deposit Name (A-Z)</option>
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
          {depositsLoading ? (
            <div className="py-16 text-center">
              <Icon name="refresh" className="mx-auto h-6 w-6 animate-spin text-teal-500" />
              <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                Loading deposits…
              </div>
              <div className="mt-1 text-xs text-slate-400">Retrieving rental and escrow entries</div>
            </div>
          ) : depositsError ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-400">
              {depositsError}
            </div>
          ) : deposits.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                <Icon name="banks" className="h-6 w-6" />
              </div>
              <div className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                No refundable deposits added yet
              </div>
              <div className="mx-auto mt-1 max-w-md text-xs text-slate-400">
                Track house rent deposits, landlord advances, and security escrows separately from liquid bank cash.
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className={['mt-5', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                Add Your First Deposit
              </button>
            </div>
          ) : sortedDeposits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No deposits match &ldquo;{searchTerm}&rdquo; under the selected filter.
            </div>
          ) : viewMode === 'cards' ? (
            /* ── VIEW MODE: CARDS GRID ── */
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {sortedDeposits.map((deposit) => {
                const isReturned = deposit.status === 'returned'
                const returnedAmt = toNumber(deposit.returned_amount)
                const deductionAmt = toNumber(deposit.return_deduction)

                return (
                  <article
                    key={deposit.id}
                    className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700/80 hover:shadow-md sm:p-7"
                  >
                    <div>
                      {/* Card Header: Icon, Title, Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
                            <Icon name="banks" className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                              {deposit.name}
                            </h3>
                            <p className="truncate text-xs font-medium text-slate-400 dark:text-slate-500">
                              {deposit.property_name || 'Individual Escrow'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={[
                              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              typeBadgeClasses(deposit.type),
                            ].join(' ')}
                          >
                            {typeMeta(deposit.type).label}
                          </span>
                          <span
                            className={[
                              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                              statusBadgeClasses(deposit.status),
                            ].join(' ')}
                          >
                            {deposit.status === 'returned' ? 'Returned' : 'Active'}
                          </span>
                        </div>
                      </div>

                      {/* Main Valuation Display */}
                      <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800/60 dark:bg-slate-800/40">
                        <div className="flex items-center justify-between">
                          <span className={LABEL}>Principal Deposit</span>
                          {deposit.refundable && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 dark:text-teal-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                              Refundable
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                          <PrivateValue value={formatINR(toNumber(deposit.amount))} mask="••••••" hideColor />
                        </div>

                        {/* Returned Details Box if status is returned */}
                        {isReturned ? (
                          <div className="mt-3.5 rounded-xl border border-amber-500/20 bg-amber-50/60 p-3 dark:border-amber-500/25 dark:bg-amber-500/10">
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                                  Refunded
                                </div>
                                <div className="mt-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  <PrivateValue value={formatINR(returnedAmt)} mask="••••" hideColor />
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                                  Deduction
                                </div>
                                <div className="mt-1 font-mono font-semibold text-amber-600 dark:text-amber-400">
                                  <PrivateValue value={formatINR(deductionAmt)} mask="••••" hideColor />
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                                  Returned On
                                </div>
                                <div className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {formatDate(deposit.returned_date)}
                                </div>
                              </div>
                            </div>
                            {deposit.return_notes && (
                              <div className="mt-2 text-[11px] italic text-amber-700 dark:text-amber-300">
                                &ldquo;{deposit.return_notes}&rdquo;
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>

                      {/* 4-Tile Key Metrics Grid */}
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Paid Date</div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {formatDate(deposit.paid_date)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Property / Vendor</div>
                          <div className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {deposit.property_name || '—'}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Scheme</div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {typeMeta(deposit.type).label}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/60 dark:bg-slate-800/30">
                          <div className={LABEL}>Lifecycle</div>
                          <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                            {deposit.status === 'returned' ? 'Closed' : 'Active Escrow'}
                          </div>
                        </div>
                      </div>

                      {deposit.description && (
                        <div className="mt-3 text-xs italic text-slate-400">
                          &ldquo;{deposit.description}&rdquo;
                        </div>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500 dark:border-slate-800">
                      <span>Updated {formatDate(deposit.updated_at)}</span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(deposit)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                          title={`Edit ${deposit.name}`}
                        >
                          <Icon name="edit" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(deposit)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10"
                          title={`Delete ${deposit.name}`}
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
                    <th className="px-4 py-3.5">Deposit Name & Property</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 font-mono text-right">Principal Amount</th>
                    <th className="px-4 py-3.5 font-mono text-right">Refunded Amount</th>
                    <th className="px-4 py-3.5 font-mono text-right">Deduction</th>
                    <th className="px-4 py-3.5">Paid Date</th>
                    <th className="px-4 py-3.5">Returned Date</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {sortedDeposits.map((deposit) => {
                    const amt = toNumber(deposit.amount)
                    const returnedAmt = toNumber(deposit.returned_amount)
                    const deductionAmt = toNumber(deposit.return_deduction)

                    return (
                      <tr
                        key={deposit.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="grid h-7 w-7 place-items-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400">
                              <Icon name="banks" className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{deposit.name}</div>
                              <div className="text-[11px] text-slate-400">{deposit.property_name || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              typeBadgeClasses(deposit.type),
                            ].join(' ')}
                          >
                            {typeMeta(deposit.type).label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              statusBadgeClasses(deposit.status),
                            ].join(' ')}
                          >
                            {deposit.status === 'returned' ? 'Returned' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          <PrivateValue value={formatINR(amt)} mask="••••" hideColor />
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {deposit.status === 'returned' ? (
                            <PrivateValue value={formatINR(returnedAmt)} mask="••••" hideColor />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {deposit.status === 'returned' && deductionAmt > 0 ? (
                            <PrivateValue value={formatINR(deductionAmt)} mask="••••" hideColor />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          {formatDate(deposit.paid_date)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                          {deposit.status === 'returned' ? formatDate(deposit.returned_date) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(deposit)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              title="Edit"
                            >
                              <Icon name="edit" className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(deposit)}
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

      {/* ── CREATE / EDIT DEPOSIT SLIDE-OVER DRAWER ── */}
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
                  <Icon name="banks" className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
                    {editingId === null ? 'Add Refundable Deposit' : 'Edit Deposit Details'}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
                    Track rent advances, security escrows, and lease deposits
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

                {/* Section 1: Deposit Identity */}
                <div className="space-y-4">
                  <div className={LABEL}>1. Deposit Overview</div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Deposit Name" error={formErrors.name}>
                      <input
                        placeholder="e.g. House Rent Deposit, Office Security"
                        value={form.name}
                        onChange={(e) => setForm((cur) => ({ ...cur, name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Deposit Type" error={formErrors.type}>
                      <select
                        value={form.type}
                        onChange={(e) =>
                          setForm((cur) => ({ ...cur, type: e.target.value as DepositType }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        {depositTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.fullTitle}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Principal Amount (₹)" error={formErrors.amount}>
                      <input
                        inputMode="decimal"
                        placeholder="e.g. 50000"
                        value={form.amount}
                        onChange={(e) => setForm((cur) => ({ ...cur, amount: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Property / Landlord Name" error={formErrors.property_name}>
                      <input
                        placeholder="e.g. Sunset Heights #402"
                        value={form.property_name}
                        onChange={(e) => setForm((cur) => ({ ...cur, property_name: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Paid Date" error={formErrors.paid_date}>
                      <input
                        type="date"
                        value={form.paid_date}
                        onChange={(e) => setForm((cur) => ({ ...cur, paid_date: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      />
                    </FormField>

                    <FormField label="Deposit Status" error={formErrors.status}>
                      <select
                        value={form.status}
                        onChange={(e) =>
                          setForm((cur) => ({ ...cur, status: e.target.value as DepositStatus }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                      >
                        <option value="active">Active (Currently Held)</option>
                        <option value="returned">Returned (Refunded to You)</option>
                      </select>
                    </FormField>
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={form.refundable}
                      onChange={(e) => setForm((cur) => ({ ...cur, refundable: e.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">Refundable Principal</div>
                      <div className="text-[11px] text-slate-400">Included as a capital asset in total net worth</div>
                    </div>
                  </label>
                </div>

                {/* Section 2: Return Details if status is returned */}
                {form.status === 'returned' && (
                  <div className="space-y-4 pt-2">
                    <div className={LABEL}>2. Return & Refund Details</div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-50/50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField label="Returned Date" error={formErrors.returned_date}>
                          <input
                            type="date"
                            value={form.returned_date}
                            onChange={(e) => setForm((cur) => ({ ...cur, returned_date: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Amount Returned (₹)" error={formErrors.returned_amount}>
                          <input
                            inputMode="decimal"
                            placeholder="e.g. 45000"
                            value={form.returned_amount}
                            onChange={(e) => setForm((cur) => ({ ...cur, returned_amount: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Deduction / Withheld Charges (₹)">
                          <input
                            inputMode="decimal"
                            placeholder="e.g. 5000"
                            value={form.return_deduction}
                            onChange={(e) => setForm((cur) => ({ ...cur, return_deduction: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>

                        <FormField label="Return Notes / Deductions Rationale">
                          <input
                            placeholder="e.g. Painting and cleaning deduction"
                            value={form.return_notes}
                            onChange={(e) => setForm((cur) => ({ ...cur, return_notes: e.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 outline-none transition-colors focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:border-teal-400"
                          />
                        </FormField>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 3: Remarks */}
                <div className="pt-2">
                  <FormField label="Notes & Lease Remarks" error={formErrors.description}>
                    <textarea
                      rows={3}
                      placeholder="e.g. Agreement duration 11 months, 1-month notice period"
                      value={form.description}
                      onChange={(e) => setForm((cur) => ({ ...cur, description: e.target.value }))}
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
                  {isSaving ? 'Saving...' : editingId === null ? 'Add Deposit' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
