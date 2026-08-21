import { useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
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
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useDepositsQuery, useDepositsSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

type DepositFormState = {
  name: string
  type: Deposit['type']
  amount: string
  property_name: string
  paid_date: string
  refundable: boolean
  status: Deposit['status']
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

function formatDate(value: string | null | undefined) {
  if (!value) return 'No date'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'No updates yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No updates yet'
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(date)
}

function typeLabel(value: Deposit['type']) {
  switch (value) {
    case 'rent_deposit':
      return 'Rent Deposit'
    case 'security_deposit':
      return 'Security Deposit'
    case 'office_deposit':
      return 'Office Deposit'
    default:
      return 'Other'
  }
}

function statusLabel(value: Deposit['status']) {
  return value === 'returned' ? 'Returned' : 'Active'
}

function statusTone(value: Deposit['status']) {
  return value === 'returned' ? 'amber' : 'emerald'
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

export default function DepositsPage() {
  const queryClient = useQueryClient()
  const { privacyMode } = usePrivacyMode()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<DepositFormState>(defaultDepositForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [bannerTone, setBannerTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const depositsQuery = useDepositsQuery()
  const summaryQuery = useDepositsSummaryQuery()
  const deposits = depositsQuery.data ?? []
  const summary = (summaryQuery.data ?? null) as DepositSummary | null
  const depositsLoading = depositsQuery.isLoading
  const summaryLoading = summaryQuery.isLoading
  const depositsError = depositsQuery.error ? formatApiError(depositsQuery.error) : null
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null

  const latestUpdatedAt = useMemo(() => {
    const timestamps = deposits.map((deposit) => new Date(deposit.updated_at).getTime()).filter((value) => !Number.isNaN(value))
    if (timestamps.length === 0) return null
    return new Date(Math.max(...timestamps)).toISOString()
  }, [deposits])

  const summaryCards = useMemo(() => {
    const totalDeposits = toNumber(summary?.total_deposits)
    const activeDeposits = toNumber(summary?.active_deposits)
    const refundableAmount = toNumber(summary?.refundable_amount)
    return [
      {
        label: 'Held Now',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(totalDeposits),
        meta: summaryLoading ? 'Fetching deposits' : summaryError ? summaryError : 'Active deposits only',
        icon: 'portfolio' as const,
      },
      {
        label: 'Active Deposits',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(activeDeposits),
        meta: summaryLoading ? 'Fetching deposits' : summaryError ? summaryError : `${summary?.active_count ?? 0} active deposit${(summary?.active_count ?? 0) === 1 ? '' : 's'}`,
        icon: 'analytics' as const,
      },
      {
        label: 'Returned To You',
        value: summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(refundableAmount),
        meta: summaryLoading ? 'Fetching deposits' : summaryError ? summaryError : `${summary?.returned_count ?? 0} returned deposit${(summary?.returned_count ?? 0) === 1 ? '' : 's'}`,
        icon: 'paid' as const,
      },
      {
        label: 'Last Updated',
        value: depositsLoading ? 'Loading...' : latestUpdatedAt ? formatDateTime(latestUpdatedAt) : 'No updates yet',
        meta: depositsLoading ? 'Fetching deposits' : latestUpdatedAt ? 'Latest deposit change' : 'Awaiting entries',
        icon: 'calendar' as const,
      },
    ]
  }, [depositsLoading, latestUpdatedAt, summary, summaryError, summaryLoading])

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

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
      queryClient.invalidateQueries({ queryKey: queryKeys.depositsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
    ])
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
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
    if (form.status === 'returned' && form.returned_amount && Number(form.returned_amount) > Number(amount)) nextErrors.returned_amount = 'Returned amount cannot exceed the original amount.'

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
      return_deduction: form.status === 'returned' ? (form.return_deduction || String(Math.max(Number(amount) - Number(form.returned_amount || 0), 0))) : null,
      return_notes: form.status === 'returned' ? form.return_notes.trim() || null : null,
    }

    setIsSaving(true)
    try {
      if (editingId === null) {
        await createDeposit(payload)
        setBannerTone('emerald')
        setStatusMessage(`Added ${name}.`)
      } else {
        await updateDeposit(editingId, payload)
        setBannerTone('emerald')
        setStatusMessage(`Updated ${name}.`)
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
    const confirmed = window.confirm(`Delete ${deposit.name}? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteDeposit(deposit.id)
      setBannerTone('emerald')
      setStatusMessage(`Deleted ${deposit.name}.`)
      await refreshData()
    } catch (error) {
      setBannerTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-6">
        {statusMessage ? (
          <div className={['rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3', bannerTone === 'emerald' ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200' : bannerTone === 'amber' ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100' : bannerTone === 'rose' ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'].join(' ')}>
            <span>{statusMessage}</span>
            <button type="button" onClick={() => setStatusMessage(null)} className="shrink-0 opacity-60 hover:opacity-100">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Icon name="banks" className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Deposits</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Refundable deposits treated as assets and tracked separately from bank balance</div>
            </div>
          </div>
          <button type="button" onClick={openCreateModal} className={primaryButtonClass}>
            <Icon name="add" className="h-4 w-4" />
            Add Deposit
          </button>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm">
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

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Deposits</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Active deposits contribute to net worth and allocation; returned deposits stay in history.</div>
            </div>
            <button type="button" onClick={openCreateModal} className={secondaryButtonClass}>
              <Icon name="add" className="h-4 w-4" />
              Add Deposit
            </button>
          </div>

          {depositsLoading ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading deposits…</div>
          ) : depositsError ? (
            <div className="mt-6 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-8 text-center text-sm text-rose-800 dark:text-rose-200">{depositsError}</div>
          ) : deposits.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                <Icon name="banks" className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">No deposits added yet</div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Track house rent deposits and other refundable amounts separately from your bank cash.</div>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {deposits.map((deposit) => (
                <article key={deposit.id} className="flex flex-col gap-5 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-lg font-semibold tracking-[-0.02em] text-slate-900 dark:text-white">{deposit.name}</div>
                      <span className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 ring-1 ring-inset ring-slate-500/15">{typeLabel(deposit.type)}</span>
                      <span className={['inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', statusTone(deposit.status) === 'emerald' ? 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/25' : 'bg-amber-500/15 text-amber-500 ring-amber-500/25'].join(' ')}>{statusLabel(deposit.status)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
                      {deposit.property_name ? <span>{deposit.property_name}</span> : null}
                      {deposit.paid_date ? <span>• Paid {formatDate(deposit.paid_date)}</span> : null}
                      {deposit.refundable ? <span>• Refundable</span> : null}
                    </div>
                    {deposit.status === 'returned' ? (
                      <div className="mt-4 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                        <div><div className="text-[10px] uppercase tracking-widest text-slate-500">Returned</div><div className="mt-1 font-mono font-semibold text-emerald-400"><PrivateValue value={formatINR(toNumber(deposit.returned_amount))} mask="••••" hideColor /></div></div>
                        <div><div className="text-[10px] uppercase tracking-widest text-slate-500">Deduction</div><div className="mt-1 font-mono font-semibold text-amber-400"><PrivateValue value={formatINR(toNumber(deposit.return_deduction))} mask="••••" hideColor /></div></div>
                        <div><div className="text-[10px] uppercase tracking-widest text-slate-500">Returned on</div><div className="mt-1 text-sm text-slate-300">{formatDate(deposit.returned_date)}</div></div>
                      </div>
                    ) : null}
                    {deposit.description ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{deposit.description}</div> : null}
                  </div>

                  <div className="flex flex-col items-start gap-4 lg:items-end">
                    <div className="text-right">
                      <div className="font-mono text-2xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(deposit.amount))} mask="••••" hideColor />
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Updated {formatDateTime(deposit.updated_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEditModal(deposit)} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95">Edit</button>
                      <button type="button" onClick={() => void handleDelete(deposit)} className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95">Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomSheet
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId === null ? 'Add Deposit' : 'Edit Deposit'}
        subtitle="Track refundable deposits separately from bank cash"
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className={['h-11 justify-center', secondaryButtonClass].join(' ')} disabled={isSaving}>Cancel</button>
            <button type="submit" form="deposit-form" className={['h-11 justify-center', primaryButtonClass].join(' ')} disabled={isSaving}>
              <Icon name="add" className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="deposit-form" onSubmit={handleSubmit} className="space-y-4">
          {formErrorMessage ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 whitespace-pre-wrap">{formErrorMessage}</div> : null}
          <div className="grid grid-cols-1 gap-4">
            <FormField label="Deposit Name" error={formErrors.name}>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="House Rent Deposit" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Type" error={formErrors.type}>
                <select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as Deposit['type'] }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150">
                  <option value="rent_deposit">Rent Deposit</option>
                  <option value="security_deposit">Security Deposit</option>
                  <option value="office_deposit">Office Deposit</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Amount" error={formErrors.amount}>
                <input value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="50000" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
            </div>

            {form.status === 'returned' ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Return details</div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Returned Date" error={formErrors.returned_date}>
                    <input type="date" value={form.returned_date} onChange={(event) => setForm((current) => ({ ...current, returned_date: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Amount Returned" error={formErrors.returned_amount}>
                    <input value={form.returned_amount} onChange={(event) => setForm((current) => ({ ...current, returned_amount: event.target.value }))} placeholder="50000" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Deduction / Charges">
                    <input value={form.return_deduction} onChange={(event) => setForm((current) => ({ ...current, return_deduction: event.target.value }))} placeholder="0" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Return Notes">
                    <input value={form.return_notes} onChange={(event) => setForm((current) => ({ ...current, return_notes: event.target.value }))} placeholder="Cleaning charges deducted" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100" />
                  </FormField>
                </div>
              </div>
            ) : null}

            <FormField label="Property Name" error={formErrors.property_name}>
              <input value={form.property_name} onChange={(event) => setForm((current) => ({ ...current, property_name: event.target.value }))} placeholder="Sunset House" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Paid Date" error={formErrors.paid_date}>
                <input type="date" value={form.paid_date} onChange={(event) => setForm((current) => ({ ...current, paid_date: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <FormField label="Status" error={formErrors.status}>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as Deposit['status'] }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150">
                  <option value="active">Active</option>
                  <option value="returned">Returned</option>
                </select>
              </FormField>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-3 text-sm text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={form.refundable} onChange={(event) => setForm((current) => ({ ...current, refundable: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500" />
              Refundable
            </label>

            <FormField label="Description" error={formErrors.description}>
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Optional notes" className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
            </FormField>
          </div>
        </form>
      </BottomSheet>
    </div>
  )
}
