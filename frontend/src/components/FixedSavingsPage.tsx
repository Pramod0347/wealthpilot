import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  createFixedSavingsAccount,
  deleteFixedSavingsAccount,
  type FixedSavingsAccount,
  type FixedSavingsAccountPayload,
  updateFixedSavingsAccount,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { useFixedSavingsAccountsQuery, useFixedSavingsSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

type AccountType = FixedSavingsAccount['account_type']

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

const accountTypeOptions: Array<{ value: AccountType; label: string }> = [
  { value: 'epf', label: 'EPF' },
  { value: 'ppf', label: 'PPF' },
  { value: 'vpf', label: 'VPF' },
  { value: 'nps', label: 'NPS' },
  { value: 'fd', label: 'FD' },
  { value: 'rd', label: 'RD' },
  { value: 'other', label: 'Other' },
]

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0)
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

function accountTypeLabel(value: AccountType) {
  return accountTypeOptions.find((option) => option.value === value)?.label ?? value.toUpperCase()
}

function accountTypeTone(value: AccountType) {
  switch (value) {
    case 'epf':
    case 'vpf':
      return 'bg-teal-500/15 text-teal-300'
    case 'ppf':
      return 'bg-sky-500/15 text-sky-300'
    case 'nps':
      return 'bg-violet-500/15 text-violet-300'
    case 'fd':
    case 'rd':
      return 'bg-amber-500/15 text-amber-300'
    default:
      return 'bg-slate-700/70 text-slate-300'
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
    <div
      className={[
        'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80',
        className,
      ].join(' ')}
    >
      {title ? (
        <div className="border-b border-slate-200 px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:border-slate-700/50 dark:text-slate-500">
          {title}
        </div>
      ) : null}
      {children}
    </div>
  )
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
      <div className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function FixedSavingsPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FixedSavingsFormState>(defaultForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const accountsQuery = useFixedSavingsAccountsQuery()
  const summaryQuery = useFixedSavingsSummaryQuery()
  const accounts = accountsQuery.data ?? []
  const summary = summaryQuery.data ?? null
  const accountsLoading = accountsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const accountsError = accountsQuery.error ? formatApiError(accountsQuery.error) : null
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null

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

  const topAccount = useMemo(() => {
    return [...accounts].sort((left, right) => toNumber(right.current_value) - toNumber(left.current_value))[0] ?? null
  }, [accounts])

  const latestUpdatedAt = useMemo(() => {
    const timestamps = accounts.map((account) => new Date(account.updated_at).getTime()).filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [accounts])

  const summaryCards = useMemo(() => {
    const totalValue = toNumber(summary?.total_value)
    const totalContribution = toNumber(summary?.total_contribution)
    const totalInterest = toNumber(summary?.total_interest)

    return [
      {
        label: 'Total PF / PPF Value',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(totalValue),
        meta: summaryLoading ? 'Fetching balances' : summaryError ? summaryError : 'Across long-term savings accounts',
        icon: 'pfepf' as const,
      },
      {
        label: 'Total Contributions',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(totalContribution),
        meta: summaryLoading ? 'Fetching contributions' : summaryError ? summaryError : 'Employee, employer, and self contributions',
        icon: 'portfolio' as const,
      },
      {
        label: 'Interest / Gains',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(totalInterest),
        meta:
          summaryLoading
            ? 'Fetching returns'
            : summaryError
              ? summaryError
              : totalInterest >= 0
                ? 'Accumulated gains and credited interest'
                : 'Current value is below total contributions',
        icon: 'analytics' as const,
        tone: totalInterest > 0 ? 'emerald' : totalInterest < 0 ? 'rose' : 'slate',
      },
      {
        label: 'Accounts Count',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : String(summary?.accounts_count ?? 0),
        meta: latestUpdatedAt ? `Last updated ${formatDateTime(latestUpdatedAt)}` : 'Manual tracking only',
        icon: 'reports' as const,
      },
    ]
  }, [latestUpdatedAt, summary, summaryError, summaryLoading])

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
    if (!current.current_value.trim()) nextErrors.current_value = 'Current value is required'
    if (current.account_number_last4 && !/^\d{4}$/.test(current.account_number_last4.trim())) {
      nextErrors.account_number_last4 = 'Enter exactly 4 digits'
    }
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
        await createFixedSavingsAccount(payload)
        setStatusTone('emerald')
        setStatusMessage('PF / PPF account added')
      } else {
        await updateFixedSavingsAccount(editingId, payload)
        setStatusTone('emerald')
        setStatusMessage('PF / PPF account updated')
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
    const confirmed = window.confirm(`Delete ${account.account_name}?`)
    if (!confirmed) return

    try {
      await deleteFixedSavingsAccount(account.id)
      setStatusTone('amber')
      setStatusMessage('PF / PPF account removed')
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
          <Icon name="pfepf" className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">PF / EPF</span>
          <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">· Provident fund, PPF, and long-term savings</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className={primaryButtonClass}
        >
          <Icon name="add" className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {statusMessage ? (
        <div
          className={[
            'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
            statusTone === 'emerald'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : statusTone === 'amber'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : statusTone === 'rose'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300',
          ].join(' ')}
        >
          <span>{statusMessage}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SectionCard key={card.label} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{card.label}</div>
                <div
                  className={[
                    'mt-2 font-mono text-2xl font-bold tabular-nums',
                    card.tone === 'emerald'
                      ? privacyMode
                        ? 'text-slate-300 dark:text-slate-300'
                        : 'text-emerald-400'
                      : card.tone === 'rose'
                        ? privacyMode
                          ? 'text-slate-300 dark:text-slate-300'
                          : 'text-rose-400'
                        : 'text-slate-900 dark:text-white',
                  ].join(' ')}
                >
                  {card.label === 'Accounts Count' ? (
                    card.value
                  ) : (
                    <PrivateValue value={card.value} mask="••••" hideColor />
                  )}
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

      <SectionCard title="Accounts">
        {accountsLoading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Loading PF / PPF accounts…</div>
        ) : accountsError ? (
          <div className="px-6 py-10 text-center text-sm text-rose-400">{accountsError}</div>
        ) : accounts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-base font-semibold text-slate-900 dark:text-white">No PF / PPF accounts added yet</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add provident fund, PPF, NPS, or fixed savings accounts to track them here.</div>
            <button
              type="button"
              onClick={openCreate}
              className={['mt-5', primaryButtonClass].join(' ')}
            >
              <Icon name="add" className="h-4 w-4" />
              Add Account
            </button>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {accounts.map((account) => {
              const gain = toNumber(account.gain_or_interest)
              return (
                <div
                  key={account.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors duration-200 hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-900/40 dark:hover:border-slate-600/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-slate-900 dark:text-white">{account.account_name}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {[account.provider_name, account.account_number_last4 ? `••${account.account_number_last4}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Manual account'}
                      </div>
                    </div>
                    <span className={['inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold', accountTypeTone(account.account_type)].join(' ')}>
                      {accountTypeLabel(account.account_type)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Current Value</div>
                      <div className="mt-1 font-mono text-base font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(account.current_value))} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Contribution</div>
                      <div className="mt-1 font-mono text-base font-semibold text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(account.total_contribution))} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Interest / Gains</div>
                      <div className={['mt-1 font-mono text-base font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(gain)].join(' ')}>
                        <PrivateValue value={formatINR(gain)} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Return %</div>
                      <div className={['mt-1 font-mono text-base font-semibold', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(account.return_pct))].join(' ')}>
                        <PrivateValue value={formatPct(toNumber(account.return_pct))} mask="••••" hideColor />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Interest Rate</div>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        {account.interest_rate != null ? `${Number(account.interest_rate).toFixed(2)}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">Maturity</div>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{formatDate(account.maturity_date)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700/50 dark:text-slate-400">
                    <div>As of {formatDate(account.as_of_date)}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(account)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors duration-200 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        aria-label={`Edit ${account.account_name}`}
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 text-rose-400 transition-colors duration-200 hover:bg-rose-500/10"
                        aria-label={`Delete ${account.account_name}`}
                      >
                        <Icon name="remove" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

      {isDrawerMounted ? (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close account drawer"
            onClick={() => setIsModalOpen(false)}
            className={[
              'absolute inset-0 bg-slate-950/55 transition-opacity duration-200',
              isDrawerVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
          />

          <div
            className={[
              'absolute inset-y-0 right-0 flex w-full max-w-xl transform flex-col border-l border-slate-700/60 bg-slate-950 shadow-2xl transition-all duration-250 ease-out',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <div className="text-lg font-semibold text-white">{editingId === null ? 'Add Account' : 'Edit Account'}</div>
                <div className="mt-1 text-sm text-slate-400">Provident fund, PPF, and fixed savings entry</div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors duration-200 hover:bg-slate-800 active:scale-95"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                {formErrorMessage ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {formErrorMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Account Type" error={formErrors.account_type}>
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
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    >
                      {accountTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Account Name" error={formErrors.account_name}>
                    <input
                      value={form.account_name}
                      onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Provider Name" error={formErrors.provider_name}>
                    <input
                      value={form.provider_name}
                      onChange={(event) => setForm((current) => ({ ...current, provider_name: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Last 4 digits" error={formErrors.account_number_last4}>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={form.account_number_last4}
                      onChange={(event) => setForm((current) => ({ ...current, account_number_last4: event.target.value.replace(/\D/g, '') }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Employee Contribution" error={formErrors.employee_contribution}>
                    <input
                      inputMode="decimal"
                      disabled={isPpfLike}
                      value={form.employee_contribution}
                      onChange={(event) => setForm((current) => ({ ...current, employee_contribution: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Employer Contribution" error={formErrors.employer_contribution}>
                    <input
                      inputMode="decimal"
                      disabled={isPpfLike}
                      value={form.employer_contribution}
                      onChange={(event) => setForm((current) => ({ ...current, employer_contribution: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Self Contribution" error={formErrors.self_contribution}>
                    <input
                      inputMode="decimal"
                      value={form.self_contribution}
                      onChange={(event) => setForm((current) => ({ ...current, self_contribution: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Interest Earned" error={formErrors.interest_earned}>
                    <input
                      inputMode="decimal"
                      value={form.interest_earned}
                      onChange={(event) => setForm((current) => ({ ...current, interest_earned: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Current Value" error={formErrors.current_value}>
                    <input
                      inputMode="decimal"
                      value={form.current_value}
                      onChange={(event) => setForm((current) => ({ ...current, current_value: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Interest Rate" error={formErrors.interest_rate}>
                    <input
                      inputMode="decimal"
                      value={form.interest_rate}
                      onChange={(event) => setForm((current) => ({ ...current, interest_rate: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Start Date" error={formErrors.start_date}>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="Maturity Date" error={formErrors.maturity_date}>
                    <input
                      type="date"
                      value={form.maturity_date}
                      onChange={(event) => setForm((current) => ({ ...current, maturity_date: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={form.as_of_date}
                      onChange={(event) => setForm((current) => ({ ...current, as_of_date: event.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                    />
                  </FormField>
                </div>

                {isEpfLike ? (
                  <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3 text-xs text-teal-200">
                    EPF/VPF accounts usually track employee and employer contributions separately.
                  </div>
                ) : null}
                {isPpfLike ? (
                  <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-xs text-sky-200">
                    PPF is self-funded. Employer and employee contribution fields stay disabled.
                  </div>
                ) : null}

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-teal-400"
                  />
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-6 py-4">
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
