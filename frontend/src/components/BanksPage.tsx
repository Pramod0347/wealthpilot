import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ApiError,
  createBankAccount,
  deleteBankAccount,
  getBankAccounts,
  getBankAccountsSummary,
  type BankAccount,
  type BankAccountsSummary,
  type BankAccountPayload,
  updateBankAccount,
} from '../lib/api'
import { formatINR, formatINRShort } from '../lib/format'
import { Icon } from './Icon'

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
  as_of_date: '',
}

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

  if (error instanceof Error) {
    return error.message
  }

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

function accountTypeLabel(value: BankAccount['account_type']) {
  if (value === 'fd') return 'FD'
  return value.charAt(0).toUpperCase() + value.slice(1)
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
    <section
      className={[
        'rounded-[6px] border border-[rgba(51,65,85,0.5)] bg-[#11192d] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-colors duration-200 ease-out hover:border-slate-600/60 motion-reduce:transition-none',
        className,
      ].join(' ')}
    >
      {title ? <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5 t-section text-white">{title}</div> : null}
      {children}
    </section>
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
      <div className="mb-2 t-label text-slate-300">{label}</div>
      {children}
      {error ? <div className="mt-2 t-meta text-rose-400">{error}</div> : null}
    </label>
  )
}

export default function BanksPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [summary, setSummary] = useState<BankAccountsSummary | null>(null)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<BankAccountFormState>(defaultBankAccountForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  const loadData = async (signal?: AbortSignal) => {
    setAccountsLoading(true)
    setSummaryLoading(true)
    setAccountsError(null)
    setSummaryError(null)

    const [accountsResult, summaryResult] = await Promise.allSettled([
      getBankAccounts(signal),
      getBankAccountsSummary(signal),
    ])

    if (accountsResult.status === 'fulfilled') {
      setAccounts(accountsResult.value)
    } else if (accountsResult.reason?.name !== 'AbortError') {
      setAccountsError(formatApiError(accountsResult.reason))
      setAccounts([])
    }
    setAccountsLoading(false)

    if (summaryResult.status === 'fulfilled') {
      setSummary(summaryResult.value)
    } else if (summaryResult.reason?.name !== 'AbortError') {
      setSummaryError(formatApiError(summaryResult.reason))
      setSummary(null)
    }
    setSummaryLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadData(controller.signal).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = formatApiError(error)
      setAccountsError(message)
      setSummaryError(message)
      setAccountsLoading(false)
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
      if (event.key === 'Escape') {
        setIsModalOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isDrawerMounted])

  const highestBalanceAccount = useMemo(() => {
    return [...accounts].sort((left, right) => toNumber(right.balance) - toNumber(left.balance))[0] ?? null
  }, [accounts])

  const latestUpdatedAt = useMemo(() => {
    const timestamps = accounts.map((account) => new Date(account.updated_at).getTime()).filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [accounts])

  const summaryCards = useMemo(() => {
    const totalCash = toNumber(summary?.total_cash)
    return [
      {
        label: 'Total Cash',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(totalCash),
        meta: summaryLoading ? 'Fetching balances' : summaryError ? summaryError : 'Across all bank accounts',
        icon: 'banks' as const,
      },
      {
        label: 'Accounts Count',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : String(summary?.accounts_count ?? 0),
        meta: summaryLoading ? 'Fetching accounts' : summaryError ? summaryError : 'Manual accounts tracked',
        icon: 'portfolio' as const,
      },
      {
        label: 'Highest Balance',
        value: accountsLoading ? 'Loading...' : highestBalanceAccount ? formatINR(toNumber(highestBalanceAccount.balance)) : 'Not added',
        meta:
          accountsLoading
            ? 'Fetching accounts'
            : highestBalanceAccount
              ? `${highestBalanceAccount.bank_name}${highestBalanceAccount.account_name ? ` · ${highestBalanceAccount.account_name}` : ''}`
              : 'Add your first bank account',
        icon: 'analytics' as const,
      },
      {
        label: 'Last Updated',
        value: accountsLoading ? 'Loading...' : latestUpdatedAt ? formatDateTime(latestUpdatedAt) : 'No updates yet',
        meta: accountsLoading ? 'Fetching accounts' : latestUpdatedAt ? 'Latest bank account change' : 'Awaiting bank account entries',
        icon: 'calendar' as const,
      },
    ]
  }, [accountsLoading, highestBalanceAccount, latestUpdatedAt, summary, summaryError, summaryLoading])

  function openCreateModal() {
    setEditingId(null)
    setForm(defaultBankAccountForm)
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
      as_of_date: account.as_of_date ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  async function refreshData() {
    await loadData()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

  async function handleDelete(account: BankAccount) {
    const confirmed = window.confirm(`Delete ${account.bank_name}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await deleteBankAccount(account.id)
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${account.bank_name}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        {statusMessage ? (
          <div
            className={[
              'rounded-[6px] border px-4 py-3 t-body',
              statusTone === 'emerald'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : statusTone === 'amber'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                  : statusTone === 'rose'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200',
            ].join(' ')}
          >
            {statusMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="t-section text-white">Bank Accounts</div>
            <div className="mt-1 t-meta text-slate-400">Manual cash accounts tracked in the database.</div>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex h-12 shrink-0 items-center gap-3 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
          >
            <Icon name="add" className="h-4 w-4 text-white" />
            Add Bank Account
          </button>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <SectionCard key={card.label} className="px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="t-label text-slate-400">{card.label}</div>
                  <div className="mt-6 font-mono text-2xl font-bold tracking-[-0.03em] text-white">{card.value}</div>
                  <div className="mt-4 t-meta text-slate-400">{card.meta}</div>
                </div>
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[6px] bg-slate-800 text-slate-300">
                  <Icon name={card.icon} className="h-5 w-5" />
                </div>
              </div>
            </SectionCard>
          ))}
        </section>

        <SectionCard>
          <div className="border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="t-section text-white">Accounts</div>
                <div className="mt-1 t-meta text-slate-400">Each balance below is now coming from the backend.</div>
              </div>
            </div>
          </div>

          {accountsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-8 text-center">
                <div className="t-section text-white">Loading bank accounts...</div>
                <div className="mt-2 t-body text-slate-400">Fetching account balances from the backend.</div>
              </div>
            </div>
          ) : accountsError ? (
            <div className="px-6 py-10">
              <div className="rounded-[6px] border border-rose-500/40 bg-rose-500/10 p-8 text-center">
                <div className="t-section text-rose-300">Unable to load bank accounts</div>
                <div className="mt-2 t-body whitespace-pre-wrap text-rose-200/80">{accountsError}</div>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="px-6 py-12">
              <div className="rounded-[6px] border border-dashed border-[rgba(51,65,85,0.6)] bg-[#0f172a] p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-[6px] bg-[#18233d] text-accent-400">
                  <Icon name="banks" className="h-5 w-5" />
                </div>
                <div className="mt-4 t-section text-white">No bank accounts added yet</div>
                <div className="mt-2 t-body text-slate-400">Add your first cash account to include bank balances in the dashboard.</div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex h-11 items-center gap-2 rounded-[6px] bg-[var(--accent-600)] px-4 t-body font-semibold text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] motion-reduce:transition-none"
                >
                  <Icon name="add" className="h-4 w-4 text-white" />
                  Add Bank Account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-6 py-6">
              {accounts.map((account) => (
                <article
                  key={account.id}
                  className="flex flex-col justify-between gap-5 rounded-[6px] border border-[rgba(51,65,85,0.45)] bg-[#1a2438] px-6 py-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-lg font-semibold tracking-[-0.02em] text-white">{account.bank_name}</div>
                      <span className="rounded-[999px] bg-slate-800 px-2.5 py-1 t-badge text-slate-300">
                        {accountTypeLabel(account.account_type)}
                      </span>
                    </div>
                    <div className="mt-1 t-body text-slate-400">
                      {account.account_name ? `${account.account_name} · ` : ''}
                      {account.account_number_last4 ? `••${account.account_number_last4} · ` : ''}
                      {account.as_of_date ? `As of ${formatDate(account.as_of_date)}` : 'No as-of date'}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold tracking-[-0.03em] text-white">{formatINR(toNumber(account.balance))}</div>
                      <div className="mt-1 t-meta text-slate-400">Updated {formatDateTime(account.updated_at)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(account)}
                        className="rounded-[6px] border border-[var(--border-soft)] px-3 py-2 t-badge text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.95] motion-reduce:transition-none"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        className="rounded-[6px] border border-[var(--border-soft)] px-3 py-2 t-badge text-rose-300 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.95] motion-reduce:transition-none"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {isDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/70 backdrop-blur-sm transition-opacity duration-200 ease-out motion-reduce:transition-none',
            isDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsModalOpen(false)}
          aria-hidden={!isDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--border)] bg-[#0f172a] shadow-[0_24px_80px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out motion-reduce:transition-none',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[rgba(51,65,85,0.45)] px-6 py-5">
              <div>
                <div className="t-section text-white">{editingId === null ? 'Add Bank Account' : 'Edit Bank Account'}</div>
                <div className="mt-1 t-meta">Manual entry for one bank account balance</div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-[6px] text-slate-400 transition-all duration-200 ease-out hover:bg-white/5 hover:text-white active:scale-[0.95] motion-reduce:transition-none"
                aria-label="Close"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {formErrorMessage ? (
                  <div className="mb-5 whitespace-pre-wrap rounded-[6px] border border-rose-500/40 bg-rose-500/10 px-4 py-3 t-body text-rose-200">
                    {formErrorMessage}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Bank Name" error={formErrors.bank_name}>
                    <input
                      value={form.bank_name}
                      onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))}
                      placeholder="HDFC Bank"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Account Name" error={formErrors.account_name}>
                    <input
                      value={form.account_name}
                      onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))}
                      placeholder="Family Savings"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Account Type" error={formErrors.account_type}>
                    <select
                      value={form.account_type}
                      onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value as BankAccountFormState['account_type'] }))}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
                    >
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                      <option value="salary">Salary</option>
                      <option value="fd">FD</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>

                  <FormField label="Last 4 Digits" error={formErrors.account_number_last4}>
                    <input
                      value={form.account_number_last4}
                      onChange={(event) => setForm((current) => ({ ...current, account_number_last4: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="4821"
                      inputMode="numeric"
                      maxLength={4}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Balance" error={formErrors.balance}>
                    <input
                      value={form.balance}
                      onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
                      placeholder="425000"
                      inputMode="decimal"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="Currency" error={formErrors.currency}>
                    <input
                      value={form.currency}
                      onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      placeholder="INR"
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={form.as_of_date}
                      onChange={(event) => setForm((current) => ({ ...current, as_of_date: event.target.value }))}
                      className="h-11 w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 t-body text-white outline-none focus:border-[var(--accent-600)]"
                    />
                  </FormField>
                </div>

                <div className="mt-4">
                  <FormField label="Notes" error={formErrors.notes}>
                    <textarea
                      value={form.notes}
                      onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                      rows={4}
                      placeholder="Optional notes about the account"
                      className="w-full rounded-[6px] border border-[var(--border-soft)] bg-[rgba(15,23,42,0.72)] px-4 py-3 t-body text-white outline-none placeholder:text-slate-500 focus:border-[var(--accent-600)]"
                    />
                  </FormField>
                </div>
              </div>

              <div className="border-t border-[rgba(51,65,85,0.45)] px-6 py-4">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-11 rounded-[6px] border border-[var(--border-soft)] px-5 t-nav text-slate-200 transition-all duration-200 ease-out hover:bg-white/5 active:scale-[0.98] motion-reduce:transition-none"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex h-11 items-center gap-2 rounded-[6px] bg-[var(--accent-600)] px-5 t-nav text-white transition-all duration-200 ease-out hover:bg-[var(--accent-700)] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                    disabled={isSaving}
                  >
                    <Icon name="add" className="h-4 w-4 text-white" />
                    {isSaving ? 'Saving...' : editingId === null ? 'Add Bank Account' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
