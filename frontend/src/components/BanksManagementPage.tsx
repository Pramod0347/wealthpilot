import { useEffect, useMemo, useState, type SyntheticEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  createBankAccount,
  deleteBankAccount,
  type BankAccount,
  type BankAccountsSummary,
  type BankAccountPayload,
  updateBankAccount,
} from '../lib/api'
import { formatINR, formatINRShort } from '../lib/format'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useBankAccountsQuery, useBankAccountsSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens & Helpers ──────────────────────────────────────────────────

const CARD = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90'
const LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'

type AccountTypeOption = 'all' | 'savings' | 'current' | 'salary' | 'fd' | 'other'
type SortOption = 'balance_desc' | 'balance_asc' | 'name_asc' | 'updated_desc'
type ViewMode = 'cards' | 'table'

type BankAccountFormState = {
  bank_name: string
  account_name: string
  account_type: 'savings' | 'current' | 'salary' | 'fd' | 'other'
  account_number_last4: string
  balance: string
  currency: string
  notes: string
  as_of_date: string
}

type FormErrors = Partial<Record<keyof BankAccountFormState, string>>

const defaultBankAccountForm: BankAccountFormState = {
  bank_name: '',
  account_name: '',
  account_type: 'savings',
  account_number_last4: '',
  balance: '',
  currency: 'INR',
  notes: '',
  as_of_date: new Date().toISOString().split('T')[0],
}

const COMMON_BANKS = [
  'HDFC Bank',
  'SBI Bank',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Bank',
  'IndusInd Bank',
  'IDFC First Bank',
  'Bank of Baroda',
  'Punjab National Bank',
]

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0)
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.validationErrors.length > 0) {
      return error.validationErrors
        .map((item) => `${item.path ? `${item.path}: ` : ''}${item.message}`)
        .join('\n')
    }
    return error.message || 'Request failed'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Request failed'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'No updates yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No updates yet'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date)
}

function accountTypeLabel(value: BankAccount['account_type']): string {
  if (value === 'fd') return 'Fixed Deposit'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getAccountBadgeMeta(accountType: BankAccount['account_type']) {
  if (accountType === 'salary') {
    return {
      label: 'Salary',
      badgeClass: 'inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 ring-1 ring-inset ring-sky-500/20',
      dotClass: 'bg-sky-500',
    }
  }
  if (accountType === 'current') {
    return {
      label: 'Current',
      badgeClass: 'inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 ring-1 ring-inset ring-purple-500/20',
      dotClass: 'bg-purple-500',
    }
  }
  if (accountType === 'fd') {
    return {
      label: 'Fixed Deposit',
      badgeClass: 'inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20',
      dotClass: 'bg-amber-500',
    }
  }
  if (accountType === 'other') {
    return {
      label: 'Other',
      badgeClass: 'inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-500/20',
      dotClass: 'bg-slate-400',
    }
  }
  return {
    label: 'Savings',
    badgeClass: 'inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20',
    dotClass: 'bg-emerald-500',
  }
}

type BankBrandStyle = {
  gradient: string
  ring: string
  accent: string
  badge: string
  logoBadge: string
  logoText: string
}

function getBankBrandStyle(bankName: string): BankBrandStyle {
  const norm = bankName.toLowerCase()
  if (norm.includes('sbi') || norm.includes('state bank')) {
    return {
      gradient: 'from-blue-900 via-indigo-950 to-slate-950',
      ring: 'ring-blue-500/30',
      accent: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      logoBadge: 'bg-blue-600 text-white shadow-blue-500/20',
      logoText: 'SBI',
    }
  }
  if (norm.includes('hdfc')) {
    return {
      gradient: 'from-sky-950 via-slate-900 to-slate-950',
      ring: 'ring-sky-500/30',
      accent: 'text-sky-400',
      badge: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
      logoBadge: 'bg-sky-600 text-white shadow-sky-500/20',
      logoText: 'HDFC',
    }
  }
  if (norm.includes('icici')) {
    return {
      gradient: 'from-orange-950 via-amber-950 to-slate-950',
      ring: 'ring-orange-500/30',
      accent: 'text-orange-400',
      badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
      logoBadge: 'bg-orange-600 text-white shadow-orange-500/20',
      logoText: 'ICICI',
    }
  }
  if (norm.includes('axis')) {
    return {
      gradient: 'from-rose-950 via-pink-950 to-slate-950',
      ring: 'ring-rose-500/30',
      accent: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      logoBadge: 'bg-rose-600 text-white shadow-rose-500/20',
      logoText: 'AXIS',
    }
  }
  if (norm.includes('kotak')) {
    return {
      gradient: 'from-red-950 via-slate-900 to-slate-950',
      ring: 'ring-red-500/30',
      accent: 'text-red-400',
      badge: 'bg-red-500/20 text-red-300 border border-red-500/30',
      logoBadge: 'bg-red-600 text-white shadow-red-500/20',
      logoText: 'KOTAK',
    }
  }
  return {
    gradient: 'from-teal-950 via-slate-900 to-slate-950',
    ring: 'ring-teal-500/30',
    accent: 'text-teal-400',
    badge: 'bg-teal-500/20 text-teal-300 border border-teal-500/30',
    logoBadge: 'bg-teal-600 text-white shadow-teal-500/20',
    logoText: bankName.slice(0, 3).toUpperCase(),
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
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {label}
      </div>
      {children}
      {error ? <div className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BanksPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<AccountTypeOption>('all')
  const [sortOption, setSortOption] = useState<SortOption>('balance_desc')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isQuickUpdateOpen, setIsQuickUpdateOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [quickUpdateAccount, setQuickUpdateAccount] = useState<BankAccount | null>(null)
  const [quickBalance, setQuickBalance] = useState('')
  const [quickDate, setQuickDate] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)

  // Forms
  const [form, setForm] = useState<BankAccountFormState>(defaultBankAccountForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  // Queries
  const accountsQuery = useBankAccountsQuery()
  const summaryQuery = useBankAccountsSummaryQuery()
  const accounts = accountsQuery.data ?? []
  const summary = (summaryQuery.data ?? null) as BankAccountsSummary | null
  const accountsLoading = accountsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const accountsError = accountsQuery.error ? formatApiError(accountsQuery.error) : null

  // Drawer Animation Lifecycle
  useEffect(() => {
    if (isModalOpen || selectedAccount) {
      setIsDrawerMounted(true)
      const frame = window.requestAnimationFrame(() => setIsDrawerVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }
    setIsDrawerVisible(false)
    const timeout = window.setTimeout(() => setIsDrawerMounted(false), 250)
    return () => window.clearTimeout(timeout)
  }, [isModalOpen, selectedAccount])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false)
        setSelectedAccount(null)
        setIsQuickUpdateOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Calculations
  const totalCash = useMemo(() => {
    return toNumber(summary?.total_cash || accounts.reduce((acc, a) => acc + toNumber(a.balance), 0))
  }, [summary, accounts])

  const highestBalanceAccount = useMemo(() => {
    return [...accounts].sort((a, b) => toNumber(b.balance) - toNumber(a.balance))[0] ?? null
  }, [accounts])

  const latestUpdatedAt = useMemo(() => {
    const timestamps = accounts
      .map((a) => new Date(a.updated_at).getTime())
      .filter((v) => !Number.isNaN(v))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [accounts])

  // Distribution
  const distribution = useMemo(() => {
    if (totalCash <= 0) return []
    return accounts
      .map((account) => {
        const bal = toNumber(account.balance)
        const share = (bal / totalCash) * 100
        return {
          id: account.id,
          bank_name: account.bank_name,
          account_type: account.account_type,
          balance: bal,
          share,
          brand: getBankBrandStyle(account.bank_name),
        }
      })
      .sort((a, b) => b.balance - a.balance)
  }, [accounts, totalCash])

  // Liquidity Tier Breakdown
  const tierBreakdown = useMemo(() => {
    const operational = accounts
      .filter((a) => a.account_type === 'salary' || a.account_type === 'current')
      .reduce((sum, a) => sum + toNumber(a.balance), 0)
    const emergency = accounts
      .filter((a) => a.account_type === 'savings')
      .reduce((sum, a) => sum + toNumber(a.balance), 0)
    const fixed = accounts
      .filter((a) => a.account_type === 'fd' || a.account_type === 'other')
      .reduce((sum, a) => sum + toNumber(a.balance), 0)

    return {
      operational,
      emergency,
      fixed,
      operationalPct: totalCash > 0 ? (operational / totalCash) * 100 : 0,
      emergencyPct: totalCash > 0 ? (emergency / totalCash) * 100 : 0,
      fixedPct: totalCash > 0 ? (fixed / totalCash) * 100 : 0,
    }
  }, [accounts, totalCash])

  // Filtering & Sorting
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (typeFilter !== 'all' && account.account_type !== typeFilter) return false
      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase()
      const nameMatch = account.bank_name.toLowerCase().includes(term)
      const accNameMatch = account.account_name?.toLowerCase().includes(term)
      const last4Match = account.account_number_last4?.includes(term)
      const notesMatch = account.notes?.toLowerCase().includes(term)
      return nameMatch || accNameMatch || last4Match || notesMatch
    })
  }, [accounts, typeFilter, searchTerm])

  const sortedAccounts = useMemo(() => {
    const list = [...filteredAccounts]
    list.sort((a, b) => {
      if (sortOption === 'balance_desc') return toNumber(b.balance) - toNumber(a.balance)
      if (sortOption === 'balance_asc') return toNumber(a.balance) - toNumber(b.balance)
      if (sortOption === 'name_asc') return a.bank_name.localeCompare(b.bank_name)
      if (sortOption === 'updated_desc') {
        const timeB = new Date(b.updated_at).getTime() || 0
        const timeA = new Date(a.updated_at).getTime() || 0
        return timeB - timeA
      }
      return 0
    })
    return list
  }, [filteredAccounts, sortOption])

  // Actions
  function openCreateModal() {
    setEditingId(null)
    setForm({
      ...defaultBankAccountForm,
      as_of_date: new Date().toISOString().split('T')[0],
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(account: BankAccount) {
    setEditingId(account.id)
    setForm({
      bank_name: account.bank_name,
      account_name: account.account_name ?? '',
      account_type: account.account_type,
      account_number_last4: account.account_number_last4 ?? '',
      balance: String(account.balance),
      currency: account.currency || 'INR',
      notes: account.notes ?? '',
      as_of_date: account.as_of_date ?? new Date().toISOString().split('T')[0],
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openQuickUpdate(account: BankAccount) {
    setQuickUpdateAccount(account)
    setQuickBalance(String(account.balance))
    setQuickDate(new Date().toISOString().split('T')[0])
    setIsQuickUpdateOpen(true)
  }

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.bankAccounts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.bankAccountsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
    ])
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const bankName = form.bank_name.trim()
    const balance = form.balance.trim()
    const currency = form.currency.trim().toUpperCase() || 'INR'
    const last4 = form.account_number_last4.trim()

    if (!bankName) nextErrors.bank_name = 'Bank name is required.'
    if (!balance) nextErrors.balance = 'Balance is required.'
    if (balance && Number.isNaN(Number(balance))) nextErrors.balance = 'Enter a valid decimal number.'
    if (last4 && last4.length !== 4) nextErrors.account_number_last4 = 'Enter exactly 4 digits.'

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    const payload: BankAccountPayload = {
      bank_name: bankName,
      account_name: form.account_name.trim() || null,
      account_type: form.account_type,
      account_number_last4: last4 || null,
      balance,
      currency,
      notes: form.notes.trim() || null,
      as_of_date: form.as_of_date.trim() || null,
    }

    setIsSaving(true)
    try {
      if (editingId === null) {
        await createBankAccount(payload)
        setStatusTone('emerald')
        setStatusMessage(`Added ${bankName}.`)
      } else {
        await updateBankAccount(editingId, payload)
        setStatusTone('emerald')
        setStatusMessage(`Updated ${bankName}.`)
      }

      setIsModalOpen(false)
      setEditingId(null)
      setForm(defaultBankAccountForm)
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors.length > 0) {
        const mappedErrors: FormErrors = {}
        error.validationErrors.forEach((item) => {
          if (item.path in defaultBankAccountForm) {
            mappedErrors[item.path as keyof BankAccountFormState] = item.message
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

  async function handleQuickBalanceSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quickUpdateAccount) return

    const trimmed = quickBalance.trim()
    if (!trimmed || Number.isNaN(Number(trimmed))) {
      alert('Please enter a valid numeric balance.')
      return
    }

    setIsSaving(true)
    try {
      await updateBankAccount(quickUpdateAccount.id, {
        bank_name: quickUpdateAccount.bank_name,
        account_name: quickUpdateAccount.account_name,
        account_type: quickUpdateAccount.account_type,
        account_number_last4: quickUpdateAccount.account_number_last4,
        balance: trimmed,
        currency: quickUpdateAccount.currency || 'INR',
        notes: quickUpdateAccount.notes,
        as_of_date: quickDate || null,
      })
      setStatusTone('emerald')
      setStatusMessage(`Updated balance for ${quickUpdateAccount.bank_name}.`)
      setIsQuickUpdateOpen(false)
      setQuickUpdateAccount(null)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(account: BankAccount) {
    const confirmed = window.confirm(`Delete ${account.bank_name}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteBankAccount(account.id)
      if (selectedAccount?.id === account.id) {
        setSelectedAccount(null)
      }
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${account.bank_name}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  const concentrationPct = useMemo(() => {
    if (!highestBalanceAccount || totalCash <= 0) return 0
    return (toNumber(highestBalanceAccount.balance) / totalCash) * 100
  }, [highestBalanceAccount, totalCash])

  return (
    <div className="space-y-6 pb-12">
      {/* ── STATUS BANNER ── */}
      {statusMessage && (
        <div
          className={[
            'flex items-center justify-between rounded-2xl border px-4 py-3 text-xs shadow-xs',
            statusTone === 'emerald'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
              : statusTone === 'rose'
                ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300'
                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <Icon name={statusTone === 'emerald' ? 'paid' : 'alert'} className="h-4 w-4 shrink-0" />
            <span className="font-semibold">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── ROW 1: HEADER & EXECUTIVE CONTEXT COMMAND BAR ── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Icon name="banks" className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Banks & Cash Liquidity
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live cash balances, emergency liquidity reserves, and multi-bank treasury
              </p>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {highestBalanceAccount && (
            <button
              type="button"
              onClick={() => openQuickUpdate(highestBalanceAccount)}
              className={['inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl', secondaryButtonClass].join(' ')}
              title="Fast update for your primary bank balance"
            >
              <Icon name="edit" className="h-3.5 w-3.5" />
              <span>Fast Balance Update</span>
            </button>
          )}

          <button
            type="button"
            onClick={openCreateModal}
            className={['inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs', primaryButtonClass].join(' ')}
          >
            <Icon name="add" className="h-4 w-4" />
            <span>Add Bank Account</span>
          </button>
        </div>
      </div>

      {/* ── ROW 2: 4 TOP EXECUTIVE KPI CARDS (Bento Grid) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Liquid Cash */}
        <div className={[CARD, 'p-4 sm:p-5 relative overflow-hidden'].join(' ')}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>Total Liquid Cash</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Treasury
            </span>
          </div>

          <div className="mt-2 text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            <PrivateValue
              value={summaryLoading ? 'Loading…' : formatINR(totalCash)}
              mask="••••••••"
              hideColor
            />
          </div>

          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>{accounts.length} monitored accounts</span>
            <span className="font-semibold text-teal-600 dark:text-teal-400">
              {formatINRShort(totalCash)}
            </span>
          </div>

          {/* Mini Cash Distribution Strip */}
          {distribution.length > 0 && (
            <div className="mt-3.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {distribution.map((item) => (
                <div
                  key={`kpi-bar-${item.id}`}
                  style={{ width: `${Math.max(item.share, 4)}%` }}
                  title={`${item.bank_name}: ${item.share.toFixed(1)}%`}
                  className={item.share > 50 ? 'bg-teal-500' : item.share > 20 ? 'bg-sky-500' : 'bg-indigo-400'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Card 2: Primary Treasury Account */}
        <div className={[CARD, 'p-4 sm:p-5'].join(' ')}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>Primary Operating Bank</span>
            {highestBalanceAccount && (
              <span className={getAccountBadgeMeta(highestBalanceAccount.account_type).badgeClass}>
                {accountTypeLabel(highestBalanceAccount.account_type)}
              </span>
            )}
          </div>

          <div className="mt-2 text-xl font-bold font-mono text-slate-900 dark:text-white sm:text-2xl truncate">
            <PrivateValue
              value={highestBalanceAccount ? formatINR(toNumber(highestBalanceAccount.balance)) : '—'}
              mask="••••••"
              hideColor
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
              {highestBalanceAccount ? highestBalanceAccount.bank_name : 'No accounts'}
            </span>
            <span className="font-mono text-teal-600 dark:text-teal-400">
              {concentrationPct.toFixed(1)}% of cash
            </span>
          </div>

          <div className="mt-3 text-[11px] text-slate-400 truncate">
            {highestBalanceAccount?.account_name ? `${highestBalanceAccount.account_name} · ` : ''}
            {highestBalanceAccount?.account_number_last4 ? `••${highestBalanceAccount.account_number_last4}` : 'No last 4'}
          </div>
        </div>

        {/* Card 3: Liquidity Tiers */}
        <div className={[CARD, 'p-4 sm:p-5'].join(' ')}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>Liquidity Tiers</span>
            <span className="text-[10px] font-mono text-slate-400">3 Tiers</span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Emergency Reserve
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                <PrivateValue value={formatINRShort(tierBreakdown.emergency)} mask="••••" hideColor />
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-sky-500" />
                Operational & Salary
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                <PrivateValue value={formatINRShort(tierBreakdown.operational)} mask="••••" hideColor />
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Fixed & Parked
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                <PrivateValue value={formatINRShort(tierBreakdown.fixed)} mask="••••" hideColor />
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Audit & Concentration Health */}
        <div className={[CARD, 'p-4 sm:p-5'].join(' ')}>
          <div className="flex items-center justify-between">
            <span className={LABEL}>Treasury Health</span>
            <span className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
              concentrationPct > 80
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                : 'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
            ].join(' ')}>
              {concentrationPct > 80 ? 'Concentrated' : 'Diversified'}
            </span>
          </div>

          <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
            {concentrationPct > 80
              ? `${concentrationPct.toFixed(0)}% in single bank`
              : 'Well-spread liquidity buffer'}
          </div>

          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {latestUpdatedAt ? `Last audit ${formatDate(latestUpdatedAt.split('T')[0])}` : 'Awaiting balance entry'}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] dark:border-slate-800 text-slate-400">
            <span>Avg Balance:</span>
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
              <PrivateValue
                value={accounts.length > 0 ? formatINR(Math.round(totalCash / accounts.length)) : '—'}
                mask="••••"
                hideColor
              />
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TREASURY ANALYTICS & CAPITAL ALLOCATION ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Bank Allocation & Concentration Visualizer */}
        <div className={[CARD, 'p-5 sm:p-6 lg:col-span-2'].join(' ')}>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <div className={LABEL}>Treasury Allocation</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                Multi-Bank Cash Distribution ({accounts.length} Banks)
              </h2>
            </div>
            <span className="text-xs text-slate-400">Total: {formatINR(totalCash)}</span>
          </div>

          {/* Allocation Bar */}
          <div className="mt-5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {distribution.map((item, idx) => (
                <div
                  key={`dist-bar-${item.id}`}
                  style={{ width: `${Math.max(item.share, 4)}%` }}
                  title={`${item.bank_name}: ${item.share.toFixed(1)}%`}
                  className={[
                    'transition-all duration-300',
                    idx === 0 ? 'bg-teal-500' : idx === 1 ? 'bg-sky-500' : idx === 2 ? 'bg-indigo-500' : 'bg-slate-500',
                  ].join(' ')}
                />
              ))}
            </div>
          </div>

          {/* Bank Allocation List */}
          <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800/80">
            {distribution.map((item, idx) => (
              <div
                key={`dist-row-${item.id}`}
                className="flex items-center justify-between py-2.5 text-xs transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-1 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      'h-2.5 w-2.5 rounded-full shrink-0',
                      idx === 0 ? 'bg-teal-500' : idx === 1 ? 'bg-sky-500' : idx === 2 ? 'bg-indigo-500' : 'bg-slate-400',
                    ].join(' ')}
                  />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">{item.bank_name}</span>
                    <span className="ml-2 text-[10px] text-slate-400 uppercase">({accountTypeLabel(item.account_type)})</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-slate-400">{item.share.toFixed(1)}%</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    <PrivateValue value={formatINR(item.balance)} mask="••••" hideColor />
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Allocation Tip */}
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 flex items-center justify-between">
            <span>
              {concentrationPct > 70
                ? '💡 Tip: Over 70% in one bank. Consider maintaining ₹50k+ in a secondary bank for operational continuity.'
                : '✓ Balanced distribution across your banking accounts.'}
            </span>
            <span className="font-mono text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
              {accounts.length} Active Vaults
            </span>
          </div>
        </div>

        {/* Right 1 Col: Liquidity Pillars */}
        <div className={[CARD, 'p-5 sm:p-6 flex flex-col justify-between'].join(' ')}>
          <div>
            <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className={LABEL}>Treasury Pillars</div>
              <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                Cash Utility Tiers
              </h2>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <Icon name="shield" className="h-3.5 w-3.5" />
                    Savings & Emergency
                  </span>
                  <span className="font-mono font-bold">{tierBreakdown.emergencyPct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 text-base font-bold font-mono text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(tierBreakdown.emergency)} mask="••••" hideColor />
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Instant safety buffer for unpredicted needs</div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                    <Icon name="transactions" className="h-3.5 w-3.5" />
                    Salary & Operational
                  </span>
                  <span className="font-mono font-bold">{tierBreakdown.operationalPct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 text-base font-bold font-mono text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(tierBreakdown.operational)} mask="••••" hideColor />
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Daily expenses, bills, and monthly cashflow</div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Icon name="calendar" className="h-3.5 w-3.5" />
                    Fixed / High Yield
                  </span>
                  <span className="font-mono font-bold">{tierBreakdown.fixedPct.toFixed(0)}%</span>
                </div>
                <div className="mt-2 text-base font-bold font-mono text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(tierBreakdown.fixed)} mask="••••" hideColor />
                </div>
                <div className="mt-1 text-[11px] text-slate-400">Term deposits and parked liquidity</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={openCreateModal}
              className={['w-full justify-center py-2 text-xs font-semibold rounded-xl', secondaryButtonClass].join(' ')}
            >
              <Icon name="add" className="h-3.5 w-3.5" />
              <span>Link Another Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 4: BROKER-GRADE ACCOUNTS COMMAND DECK ── */}
      <div className={[CARD, 'overflow-hidden'].join(' ')}>
        {/* Table & Controls Toolbar */}
        <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className={LABEL}>Cash Ledger & Accounts</div>
                <h2 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                  Monitored Bank Accounts ({filteredAccounts.length})
                </h2>
              </div>

              {/* Right Controls: Search, Sort, View Toggle */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative min-w-44 flex-1 sm:w-64 sm:flex-initial">
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search bank, nickname, last 4..."
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800/60 dark:text-white"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs focus:border-teal-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="balance_desc">Balance: High to Low</option>
                  <option value="balance_asc">Balance: Low to High</option>
                  <option value="name_asc">Bank Name (A-Z)</option>
                  <option value="updated_desc">Recently Updated</option>
                </select>

                {/* View Mode Toggle: Cards vs Table */}
                <div className="flex items-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    title="Executive Bank Card View"
                    className={[
                      'rounded-lg p-1.5 transition-all',
                      viewMode === 'cards'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icon name="cards" className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    title="Data Grid Table View"
                    className={[
                      'rounded-lg p-1.5 transition-all',
                      viewMode === 'table'
                        ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white'
                        : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icon name="dashboard" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Account Type Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800/80">
              {(
                [
                  ['all', `All Accounts (${accounts.length})`],
                  ['savings', `Savings (${accounts.filter((a) => a.account_type === 'savings').length})`],
                  ['salary', `Salary (${accounts.filter((a) => a.account_type === 'salary').length})`],
                  ['current', `Current (${accounts.filter((a) => a.account_type === 'current').length})`],
                  ['fd', `Fixed Deposit (${accounts.filter((a) => a.account_type === 'fd').length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTypeFilter(key)}
                  className={[
                    'rounded-full px-3 py-1 text-xs font-semibold transition-all',
                    typeFilter === key
                      ? 'bg-teal-600 text-white shadow-xs dark:bg-teal-500'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Body: Loading / Error / Empty / Cards / Table */}
        {accountsLoading ? (
          <div className="p-12 text-center text-slate-400">Loading bank accounts...</div>
        ) : accountsError ? (
          <div className="p-8 text-center text-rose-500">{accountsError}</div>
        ) : sortedAccounts.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
              <Icon name="banks" className="h-6 w-6" />
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
              No matching bank accounts
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first cash account to start tracking'}
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className={['mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl', primaryButtonClass].join(' ')}
            >
              <Icon name="add" className="h-4 w-4" />
              <span>Add Bank Account</span>
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* ── CARDS VIEW (Executive Bank Cards with Brand Gradients) ── */
          <div className="p-4 sm:p-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedAccounts.map((account) => {
              const brand = getBankBrandStyle(account.bank_name)
              const badgeMeta = getAccountBadgeMeta(account.account_type)
              const balance = toNumber(account.balance)
              const share = totalCash > 0 ? (balance / totalCash) * 100 : 0

              return (
                <div
                  key={`bank-card-${account.id}`}
                  className={[
                    'group relative flex flex-col justify-between rounded-3xl p-5 text-white transition-all duration-300 shadow-md hover:shadow-xl hover:-translate-y-1',
                    'bg-linear-to-br',
                    brand.gradient,
                    brand.ring,
                    'ring-1 ring-inset',
                  ].join(' ')}
                >
                  {/* Card Header: Brand Logo & Type Badge */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={[
                            'grid h-10 w-10 place-items-center rounded-2xl text-xs font-bold tracking-wider uppercase',
                            brand.logoBadge,
                          ].join(' ')}
                        >
                          {brand.logoText}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-white tracking-tight">
                            {account.bank_name}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-40">
                            {account.account_name || 'Primary Vault'}
                          </div>
                        </div>
                      </div>

                      <span className={['text-[10px] font-semibold px-2 py-0.5 rounded-full', brand.badge].join(' ')}>
                        {badgeMeta.label}
                      </span>
                    </div>

                    {/* Masked Card Number & EMV Chip Emulation */}
                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Golden Chip Emulation */}
                        <div className="h-6 w-8 rounded-md bg-linear-to-br from-amber-200 via-amber-400 to-amber-600 opacity-80 shadow-xs" />
                        <span className="text-[10px] text-slate-400 font-mono">
                          {account.currency || 'INR'}
                        </span>
                      </div>
                      <span className="font-mono text-xs tracking-widest text-slate-300">
                        •••• •••• •••• {account.account_number_last4 || '••••'}
                      </span>
                    </div>

                    {/* Balance */}
                    <div className="mt-5">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Available Balance
                      </div>
                      <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-white">
                        <PrivateValue value={formatINR(balance)} mask="••••••••" hideColor />
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Metadata & Actions */}
                  <div className="mt-6 border-t border-white/10 pt-3 flex items-center justify-between text-xs">
                    <div className="text-[11px] text-slate-400">
                      <span className="font-mono text-teal-400 font-semibold">{share.toFixed(1)}%</span> of cash
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openQuickUpdate(account)}
                        className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition-all"
                        title="Quick update balance"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(account)}
                        className="rounded-lg bg-white/10 p-1 text-slate-300 hover:bg-white/20 hover:text-white transition-all"
                        title="Edit account details"
                      >
                        <Icon name="edit" className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        className="rounded-lg bg-rose-500/20 p-1 text-rose-300 hover:bg-rose-500/30 transition-all"
                        title="Delete account"
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
          /* ── TABLE VIEW (Broker-Grade Spreadsheet) ── */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-semibold uppercase text-slate-500 dark:text-slate-400">Bank & Account</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 dark:text-slate-400">Type</th>
                  <th className="px-3 py-3 font-semibold uppercase text-slate-500 dark:text-slate-400">Last 4</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase text-slate-500 dark:text-slate-400">Share</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase text-slate-500 dark:text-slate-400">Current Balance</th>
                  <th className="px-3 py-3 text-right font-semibold uppercase text-slate-500 dark:text-slate-400">Last Updated</th>
                  <th className="px-4 py-3 text-right font-semibold uppercase text-slate-500 dark:text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedAccounts.map((account) => {
                  const brand = getBankBrandStyle(account.bank_name)
                  const badgeMeta = getAccountBadgeMeta(account.account_type)
                  const balance = toNumber(account.balance)
                  const share = totalCash > 0 ? (balance / totalCash) * 100 : 0

                  return (
                    <tr
                      key={`bank-row-${account.id}`}
                      className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* Bank & Nickname */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={[
                              'grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[10px] font-bold tracking-wider uppercase shadow-xs',
                              brand.logoBadge,
                            ].join(' ')}
                          >
                            {brand.logoText}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {account.bank_name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {account.account_name || 'Primary account'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-3 py-3.5">
                        <span className={badgeMeta.badgeClass}>
                          {badgeMeta.label}
                        </span>
                      </td>

                      {/* Last 4 Digits */}
                      <td className="px-3 py-3.5 font-mono text-slate-500 dark:text-slate-400">
                        {account.account_number_last4 ? `••${account.account_number_last4}` : '—'}
                      </td>

                      {/* Share of Liquidity */}
                      <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {privacyMode ? '•••' : `${share.toFixed(1)}%`}
                        </div>
                        <div className="mt-1 h-1 w-12 ml-auto overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            style={{ width: `${Math.min(share * 2, 100)}%` }}
                            className="h-full rounded-full bg-teal-500"
                          />
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">
                        <PrivateValue value={formatINR(balance)} mask="••••••••" hideColor />
                      </td>

                      {/* Last Updated */}
                      <td className="px-3 py-3.5 text-right font-mono text-[11px] text-slate-400">
                        {account.as_of_date ? formatDate(account.as_of_date) : formatDateTime(account.updated_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openQuickUpdate(account)}
                            className="rounded-lg bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 dark:bg-teal-500/10 dark:text-teal-300 hover:bg-teal-100 transition-all"
                            title="Quick update balance"
                          >
                            Update
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(account)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-all"
                            title="Edit"
                          >
                            <Icon name="edit" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(account)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/15 dark:hover:text-rose-400 transition-all"
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

      {/* ── FAST BALANCE UPDATE POPUP MODAL ── */}
      {isQuickUpdateOpen && quickUpdateAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          onClick={() => setIsQuickUpdateOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Icon name="edit" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Update Balance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {quickUpdateAccount.bank_name} {quickUpdateAccount.account_number_last4 ? `(••${quickUpdateAccount.account_number_last4})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickUpdateOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleQuickBalanceSubmit} className="mt-5 space-y-4">
              <FormField label="Current Account Balance (₹)">
                <input
                  type="number"
                  step="any"
                  value={quickBalance}
                  onChange={(e) => setQuickBalance(e.target.value)}
                  placeholder="e.g. 125000"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-base font-bold text-slate-900 focus:border-teal-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <FormField label="As Of Date">
                <input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </FormField>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickUpdateOpen(false)}
                  className={['px-4 py-2 text-xs font-semibold rounded-xl', secondaryButtonClass].join(' ')}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={['px-5 py-2 text-xs font-bold rounded-xl text-white shadow-xs', primaryButtonClass].join(' ')}
                >
                  {isSaving ? 'Updating...' : 'Save Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT BANK ACCOUNT MODAL & SLIDE-OVER DRAWER ── */}
      {isDrawerMounted && (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200',
            isDrawerVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
          ].join(' ')}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={[
              'relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
              isDrawerVisible ? 'translate-x-0' : 'translate-x-full',
            ].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Icon name="banks" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingId === null ? 'Add Bank Account' : 'Edit Bank Account'}
                  </h3>
                  <p className="text-xs text-slate-400">Manual cash account balance entry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {formErrorMessage && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
                    {formErrorMessage}
                  </div>
                )}

                {/* Quick Bank Chips */}
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">Quick Bank Selection:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_BANKS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setForm((c) => ({ ...c, bank_name: b }))}
                        className={[
                          'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all border',
                          form.bank_name === b
                            ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                        ].join(' ')}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Bank Name" error={formErrors.bank_name}>
                    <input
                      value={form.bank_name}
                      onChange={(e) => setForm((c) => ({ ...c, bank_name: e.target.value }))}
                      placeholder="e.g. HDFC Bank"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Account Nickname / Purpose" error={formErrors.account_name}>
                    <input
                      value={form.account_name}
                      onChange={(e) => setForm((c) => ({ ...c, account_name: e.target.value }))}
                      placeholder="e.g. Emergency Fund / Salary"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Account Type" error={formErrors.account_type}>
                    <select
                      value={form.account_type}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, account_type: e.target.value as BankAccountFormState['account_type'] }))
                      }
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="savings">Savings Account</option>
                      <option value="salary">Salary Account</option>
                      <option value="current">Current Account</option>
                      <option value="fd">Fixed Deposit (FD)</option>
                      <option value="other">Other Cash Vault</option>
                    </select>
                  </FormField>

                  <FormField label="Last 4 Digits" error={formErrors.account_number_last4}>
                    <input
                      value={form.account_number_last4}
                      onChange={(e) =>
                        setForm((c) => ({ ...c, account_number_last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                      }
                      placeholder="1234"
                      maxLength={4}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Current Balance" error={formErrors.balance}>
                    <input
                      type="number"
                      step="any"
                      value={form.balance}
                      onChange={(e) => setForm((c) => ({ ...c, balance: e.target.value }))}
                      placeholder="e.g. 150000"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      autoComplete="off"
                    />
                  </FormField>

                  <FormField label="Currency" error={formErrors.currency}>
                    <select
                      value={form.currency}
                      onChange={(e) => setForm((c) => ({ ...c, currency: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </FormField>

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={form.as_of_date}
                      onChange={(e) => setForm((c) => ({ ...c, as_of_date: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </FormField>
                </div>

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                    placeholder="e.g. Auto-sweep enabled, min balance ₹10,000, linked to credit card bill auto-pay..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white resize-none"
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={secondaryButtonClass}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  {isSaving ? 'Saving...' : editingId === null ? 'Add Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
