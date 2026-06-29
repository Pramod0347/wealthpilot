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

function getAccountTone(accountType: BankAccount['account_type']) {
  if (accountType === 'salary') return 'bg-sky-500'
  if (accountType === 'current') return 'bg-violet-500'
  if (accountType === 'fd') return 'bg-amber-500'
  if (accountType === 'other') return 'bg-slate-500'
  return 'bg-emerald-500'
}

function getAccountTypeCount(accounts: BankAccount[], types: BankAccount['account_type'][]) {
  return accounts.filter((account) => types.includes(account.account_type)).length
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
        'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm',
        className,
      ].join(' ')}
    >
      {title ? (
        <div className="border-b border-slate-200 dark:border-slate-700/50 px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">
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

export default function BanksPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()
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
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null)
  const accountsQuery = useBankAccountsQuery()
  const summaryQuery = useBankAccountsSummaryQuery()
  const accounts = accountsQuery.data ?? []
  const summary = (summaryQuery.data ?? null) as BankAccountsSummary | null
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

  const distribution = useMemo(() => {
    const total = toNumber(summary?.total_cash)
    if (total <= 0) return []

    return accounts
      .map((account) => ({
        id: account.id,
        bank_name: account.bank_name,
        balance: toNumber(account.balance),
        share: (toNumber(account.balance) / total) * 100,
        tone: getAccountTone(account.account_type),
      }))
      .filter((account) => account.balance > 0)
      .sort((left, right) => right.balance - left.balance)
  }, [accounts, summary])

  const savingsCount = useMemo(() => getAccountTypeCount(accounts, ['savings']), [accounts])
  const currentSalaryCount = useMemo(() => getAccountTypeCount(accounts, ['current', 'salary']), [accounts])

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

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        {statusMessage ? (
          <div
            className={[
              'rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3',
              statusTone === 'emerald'
                ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : statusTone === 'amber'
                  ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100'
                  : statusTone === 'rose'
                    ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
            ].join(' ')}
          >
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="space-y-4 md:hidden">
          <div className="rounded-2xl bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Cash</div>
                <div className="mt-2 font-mono text-2xl font-bold tracking-[-0.03em] text-slate-100">
                  <PrivateValue
                    value={summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(toNumber(summary?.total_cash))}
                    mask="••••"
                    hideColor
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className={['h-10 justify-center rounded-full px-3.5 py-0 text-[12px]', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="mt-2 text-[12px] text-slate-400">
              {summaryLoading
                ? 'Fetching accounts'
                : `${summary?.accounts_count ?? 0} accounts${latestUpdatedAt ? ` · Updated ${formatDateTime(latestUpdatedAt)}` : ''}`}
            </div>

            {distribution.length > 0 ? (
              <>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-800">
                  {distribution.map((account) => (
                    <div
                      key={`bank-distribution-${account.id}`}
                      className={account.tone}
                      style={{ width: `${Math.max(account.share, 6)}%` }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-900/70 px-4 py-4 ring-1 ring-slate-800/80">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Highest Balance</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">
                <PrivateValue value={highestBalanceAccount ? formatINRShort(toNumber(highestBalanceAccount.balance)) : 'Not added'} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{highestBalanceAccount?.bank_name ?? 'Add an account'}</div>
            </div>
            <div className="rounded-2xl bg-slate-900/70 px-4 py-4 ring-1 ring-slate-800/80">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Savings Accounts</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{savingsCount}</div>
              <div className="mt-1 text-[11px] text-slate-500">Current / Salary: {currentSalaryCount}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className={['h-11 flex-1 justify-center', primaryButtonClass].join(' ')}
            >
              <Icon name="add" className="h-4 w-4" />
              Add Bank
            </button>
            <button
              type="button"
              onClick={() => highestBalanceAccount && openEditModal(highestBalanceAccount)}
              disabled={!highestBalanceAccount}
              className={['h-11 flex-1 justify-center', secondaryButtonClass].join(' ')}
            >
              <Icon name="edit" className="h-4 w-4" />
              Update Balance
            </button>
          </div>

          {accountsLoading ? (
            <div className="rounded-2xl bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
              <div className="text-sm text-slate-400">Loading bank accounts…</div>
            </div>
          ) : accountsError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">{accountsError}</div>
          ) : accounts.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
              <div className="text-sm font-semibold text-slate-100">No bank accounts added yet</div>
              <div className="mt-2 text-[12px] text-slate-500">Add Bank Account to start tracking your cash balances.</div>
              <button
                type="button"
                onClick={openCreateModal}
                className={['mt-4 h-11 justify-center', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                Add Bank Account
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl bg-slate-900/75 ring-1 ring-slate-800/80">
              {accounts.map((account, index) => (
                <div key={account.id} className={index === 0 ? '' : 'border-t border-slate-800'}>
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className={['grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-sm font-semibold text-white', getAccountTone(account.account_type)].join(' ')}>
                      {account.bank_name.slice(0, 2).toUpperCase()}
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditModal(account)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-100">{account.bank_name}</div>
                        <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                          {accountTypeLabel(account.account_type)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-[12px] text-slate-400">
                        {account.account_name ? `${account.account_name} · ` : ''}
                        {account.account_number_last4 ? `••${account.account_number_last4}` : 'No last 4'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {account.as_of_date ? `As of ${formatDate(account.as_of_date)}` : `Updated ${formatDateTime(account.updated_at)}`}
                      </div>
                    </button>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-bold text-slate-100">
                        <PrivateValue value={formatINRShort(toNumber(account.balance))} mask="••••" hideColor />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedAccount(account)}
                        className="mt-2 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300"
                        aria-label="Account actions"
                      >
                        <Icon name="more" className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="hidden md:block space-y-6">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
            <Icon name="banks" className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Bank Accounts</span>
            <span className="text-sm text-slate-400 dark:text-slate-600">·</span>
            <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">Manual cash accounts tracked in the database</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">Live</span>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={openCreateModal}
              className={primaryButtonClass}
            >
              <Icon name="add" className="h-4 w-4" />
              Add Bank Account
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{card.label}</div>
                <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', privacyMode ? 'text-slate-400 dark:text-slate-400' : 'text-slate-900 dark:text-white'].join(' ')}>
                  <PrivateValue value={card.value} mask="••••" hideColor />
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.meta}</div>
                <div className="mt-4 grid h-7 w-7 place-items-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Icon name={card.icon} className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                </div>
              </div>
            ))}
          </section>

          <SectionCard>
          <div className="border-b border-slate-200 dark:border-slate-700/50 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Accounts</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Each balance below is now coming from the backend.</div>
              </div>
            </div>
          </div>

          {accountsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Loading bank accounts...</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Fetching account balances from the backend.</div>
              </div>
            </div>
          ) : accountsError ? (
            <div className="px-6 py-10">
              <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-8 text-center">
                <div className="text-sm font-semibold text-rose-800 dark:text-rose-200">Unable to load bank accounts</div>
                <div className="mt-2 text-sm whitespace-pre-wrap text-rose-800 dark:text-rose-200">{accountsError}</div>
              </div>
            </div>
          ) : accounts.length === 0 ? (
            <div className="px-6 py-12">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-10 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                  <Icon name="banks" className="h-5 w-5" />
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">No bank accounts added yet</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Add your first cash account to include bank balances in the dashboard.</div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className={['mt-5', primaryButtonClass].join(' ')}
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
                  className="flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-5 shadow-sm justify-between gap-5 lg:flex-row lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{account.bank_name}</div>
                      <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/15">
                        {accountTypeLabel(account.account_type)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {account.account_name ? `${account.account_name} · ` : ''}
                      {account.account_number_last4 ? `••${account.account_number_last4} · ` : ''}
                      {account.as_of_date ? `As of ${formatDate(account.as_of_date)}` : 'No as-of date'}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(account.balance))} mask="••••" hideColor />
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Updated {formatDateTime(account.updated_at)}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(account)}
                        className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
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
      </div>

      <BottomSheet
        open={Boolean(selectedAccount) && !isModalOpen}
        onClose={() => setSelectedAccount(null)}
        title={selectedAccount?.bank_name ?? 'Bank account'}
        subtitle={selectedAccount ? `${accountTypeLabel(selectedAccount.account_type)}${selectedAccount.account_number_last4 ? ` · ••${selectedAccount.account_number_last4}` : ''}` : ''}
        footer={
          selectedAccount ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccount(null)
                  openEditModal(selectedAccount)
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200"
              >
                <Icon name="edit" className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(selectedAccount)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-sm font-semibold text-rose-300"
              >
                <Icon name="remove" className="h-4 w-4" />
                Delete
              </button>
            </div>
          ) : null
        }
      >
        {selectedAccount ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Balance</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatINR(toNumber(selectedAccount.balance))} mask="••••" hideColor />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">As Of</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedAccount.as_of_date ? formatDate(selectedAccount.as_of_date) : 'Not set'}
                </div>
              </div>
            </div>
            {selectedAccount.notes ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Notes</div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{selectedAccount.notes}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>

      <div className="md:hidden">
        <BottomSheet
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingId === null ? 'Add Bank Account' : 'Edit Bank Account'}
          subtitle="Manual bank balance entry"
          footer={
            <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className={['h-11 justify-center', secondaryButtonClass].join(' ')}
                  disabled={isSaving}
                >
                Cancel
              </button>
                <button
                  type="submit"
                  form="bank-account-form"
                  className={['h-11 justify-center', primaryButtonClass].join(' ')}
                  disabled={isSaving}
                >
                <Icon name="add" className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          }
        >
          <form id="bank-account-form" onSubmit={handleSubmit} className="space-y-4">
            {formErrorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 whitespace-pre-wrap">
                {formErrorMessage}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4">
              <FormField label="Bank Name" error={formErrors.bank_name}>
                <input value={form.bank_name} onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))} placeholder="HDFC Bank" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <FormField label="Account Name" error={formErrors.account_name}>
                <input value={form.account_name} onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))} placeholder="Emergency Fund" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Account Type" error={formErrors.account_type}>
                  <select value={form.account_type} onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value as BankAccountFormState['account_type'] }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150">
                    <option value="savings">Savings</option>
                    <option value="current">Current</option>
                    <option value="salary">Salary</option>
                    <option value="fd">FD</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField label="Last 4 Digits" error={formErrors.account_number_last4}>
                  <input value={form.account_number_last4} onChange={(event) => setForm((current) => ({ ...current, account_number_last4: event.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="4821" inputMode="numeric" maxLength={4} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Balance" error={formErrors.balance}>
                  <input value={form.balance} onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))} placeholder="425000" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
                <FormField label="Currency" error={formErrors.currency}>
                  <input value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="INR" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
              </div>
              <FormField label="As Of Date" error={formErrors.as_of_date}>
                <input type="date" value={form.as_of_date} onChange={(event) => setForm((current) => ({ ...current, as_of_date: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <FormField label="Notes" error={formErrors.notes}>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Optional notes about the account" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150 resize-none" />
              </FormField>
            </div>
          </form>
        </BottomSheet>
      </div>

      {isDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 hidden items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none md:flex',
            isDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsModalOpen(false)}
          aria-hidden={!isDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-130 flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">{editingId === null ? 'Add Bank Account' : 'Edit Bank Account'}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Manual entry for one bank account balance</div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                aria-label="Close"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
                {formErrorMessage ? (
                  <div className="mb-5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 whitespace-pre-wrap">
                    {formErrorMessage}
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Bank Name" error={formErrors.bank_name}>
                    <input
                      value={form.bank_name}
                      onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))}
                      placeholder="HDFC Bank"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Account Name" error={formErrors.account_name}>
                    <input
                      value={form.account_name}
                      onChange={(event) => setForm((current) => ({ ...current, account_name: event.target.value }))}
                      placeholder="Family Savings"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Account Type" error={formErrors.account_type}>
                    <select
                      value={form.account_type}
                      onChange={(event) => setForm((current) => ({ ...current, account_type: event.target.value as BankAccountFormState['account_type'] }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
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
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Balance" error={formErrors.balance}>
                    <input
                      value={form.balance}
                      onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
                      placeholder="425000"
                      inputMode="decimal"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Currency" error={formErrors.currency}>
                    <input
                      value={form.currency}
                      onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                      placeholder="INR"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="As Of Date" error={formErrors.as_of_date}>
                    <input
                      type="date"
                      value={form.as_of_date}
                      onChange={(event) => setForm((current) => ({ ...current, as_of_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
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
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150 resize-none"
                    />
                  </FormField>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
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
                  className={primaryButtonClass}
                  disabled={isSaving}
                >
                  <Icon name="add" className="h-4 w-4 text-white" />
                  {isSaving ? 'Saving...' : editingId === null ? 'Add Bank Account' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
