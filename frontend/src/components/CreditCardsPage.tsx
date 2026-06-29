import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import { ApiError, apiFetch, getCreditCardBillHistory, markCreditCardPaid, type CreditCardBill } from '../lib/api'
import { formatINR, formatINRShort, formatPct } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { useCreditCardBillsQuery, useCreditCardsQuery, useDashboardSummaryQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

type ApiDashboardSummary = {
  total_credit_card_dues: string | number
  total_card_limit: string | number
  total_card_used: string | number
  overall_card_utilization: string | number
  due_soon_count: number
  overdue_count: number
}

type ApiCreditCard = {
  id: number
  card_name: string
  bank_name: string
  last4: string
  total_limit: string | number
  used_amount: string | number
  current_bill_amount: string | number
  billing_cycle_start: string
  billing_cycle_end: string
  due_date: string
  status: 'paid' | 'due_soon' | 'overdue'
  notes: string | null
  created_at: string
  updated_at: string
  available_limit: string | number
  utilization_pct: string | number
  days_until_due: number
}

type CreditCardFormState = {
  card_name: string
  bank_name: string
  last4: string
  total_limit: string
  used_amount: string
  current_bill_amount: string
  billing_cycle_start: string
  billing_cycle_end: string
  due_date: string
  status: 'paid' | 'due_soon' | 'overdue'
  notes: string
}

type FormErrors = Partial<Record<keyof CreditCardFormState, string>>

type MarkPaidFormState = {
  paid_amount: string
  paid_date: string
  notes: string
}

type MarkPaidFormErrors = Partial<Record<keyof MarkPaidFormState, string>>

const defaultCreditCardForm: CreditCardFormState = {
  card_name: '',
  bank_name: '',
  last4: '',
  total_limit: '',
  used_amount: '',
  current_bill_amount: '',
  billing_cycle_start: '',
  billing_cycle_end: '',
  due_date: '',
  status: 'due_soon',
  notes: '',
}

const defaultMarkPaidForm: MarkPaidFormState = {
  paid_amount: '',
  paid_date: '',
  notes: '',
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
    <div className={['bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm', className].join(' ')}>
      {title ? <div className="border-b border-slate-200 dark:border-slate-700/50 px-6 py-4 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{title}</div> : null}
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

function buildStatusTone(status: ApiCreditCard['status']) {
  if (status === 'paid') return {
    border: 'border-emerald-200 dark:border-emerald-500/40',
    badge: 'inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20',
    accent: 'text-emerald-600 dark:text-emerald-400',
    bar: 'bg-emerald-500'
  }
  if (status === 'due_soon') return {
    border: 'border-amber-200 dark:border-amber-500/40',
    badge: 'inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20',
    accent: 'text-amber-600 dark:text-amber-400',
    bar: 'bg-amber-500'
  }
  return {
    border: 'border-rose-200 dark:border-rose-500/40',
    badge: 'inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-500/15 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20',
    accent: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500'
  }
}

function buildBillStatusTone(status: CreditCardBill['status']) {
  if (status === 'paid') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (status === 'partial') {
    return 'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300'
  }
  if (status === 'missed') {
    return 'bg-rose-50 text-rose-700 ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-300'
  }
  return 'bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-700/70 dark:text-slate-200'
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed)
}

function formatBillingCycle(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return 'Billing cycle not recorded'
  if (start && end) {
    return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`
  }
  return formatDisplayDate(start ?? end)
}

function buildSummaryCards(summary: ApiDashboardSummary | null, loading: boolean, error: string | null) {
  if (loading) {
    return [
      { label: 'Total Dues', value: 'Loading...', meta: 'Fetching from backend', iconBg: 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
      { label: 'Card Limit', value: 'Loading...', meta: 'Fetching from backend', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
      { label: 'Used Amount', value: 'Loading...', meta: 'Fetching from backend', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
      { label: 'Utilization', value: 'Loading...', meta: 'Fetching from backend', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
    ]
  }

  if (error || summary === null) {
    return [
      { label: 'Total Dues', value: '—', meta: error ?? 'No data available', iconBg: 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' },
      { label: 'Card Limit', value: '—', meta: error ?? 'No data available', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
      { label: 'Used Amount', value: '—', meta: error ?? 'No data available', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
      { label: 'Utilization', value: '—', meta: error ?? 'No data available', iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
    ]
  }

  const totalDues = toNumber(summary.total_credit_card_dues)
  const totalCardLimit = toNumber(summary.total_card_limit)
  const totalCardUsed = toNumber(summary.total_card_used)
  const utilization = toNumber(summary.overall_card_utilization)

  return [
    {
      label: 'Total Dues',
      value: formatINR(totalDues),
      meta: `${summary.overdue_count} overdue · ${summary.due_soon_count} due soon`,
      iconBg: 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
      valueClass: totalDues > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white',
    },
    {
      label: 'Card Limit',
      value: formatINR(totalCardLimit),
      meta: 'Across all cards',
      iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    },
    {
      label: 'Used Amount',
      value: formatINR(totalCardUsed),
      meta: 'Current spending',
      iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
    },
    {
      label: 'Utilization',
      value: `${utilization.toFixed(2)}%`,
      meta: 'Overall utilization',
      iconBg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
      valueClass: utilization >= 80 ? 'text-rose-600 dark:text-rose-400' : utilization >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400',
    },
  ]
}

export default function CreditCardsPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()
  const [recentBills, setRecentBills] = useState<CreditCardBill[]>([])
  const [billsByCard, setBillsByCard] = useState<Record<number, CreditCardBill[]>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | ApiCreditCard['status']>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CreditCardFormState>(defaultCreditCardForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [selectedCard, setSelectedCard] = useState<ApiCreditCard | null>(null)
  const [markPaidCard, setMarkPaidCard] = useState<ApiCreditCard | null>(null)
  const [markPaidForm, setMarkPaidForm] = useState<MarkPaidFormState>(defaultMarkPaidForm)
  const [markPaidErrors, setMarkPaidErrors] = useState<MarkPaidFormErrors>({})
  const [markPaidErrorMessage, setMarkPaidErrorMessage] = useState<string | null>(null)
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)

  const summaryQuery = useDashboardSummaryQuery()
  const cardsQuery = useCreditCardsQuery()
  const billsQuery = useCreditCardBillsQuery()

  const summary = (summaryQuery.data as ApiDashboardSummary | undefined) ?? null
  const cards = (cardsQuery.data as ApiCreditCard[] | undefined) ?? []
  const summaryLoading = summaryQuery.isLoading
  const cardsLoading = cardsQuery.isLoading
  const billsLoading = billsQuery.isLoading
  const summaryError = summaryQuery.error ? formatApiError(summaryQuery.error) : null
  const cardsError = cardsQuery.error ? formatApiError(cardsQuery.error) : null
  const billsError = billsQuery.error ? formatApiError(billsQuery.error) : null

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

  useEffect(() => {
    if (!selectedCard) return
    const nextCard = cards.find((card) => card.id === selectedCard.id)
    if (nextCard) {
      setSelectedCard(nextCard)
    }
  }, [cards, selectedCard])

  useEffect(() => {
    if (!billsQuery.data) {
      setRecentBills([])
      setBillsByCard({})
      return
    }

    setRecentBills(billsQuery.data.slice(0, 10))
    setBillsByCard(
      billsQuery.data.reduce<Record<number, CreditCardBill[]>>((accumulator, bill) => {
        if (!accumulator[bill.credit_card_id]) accumulator[bill.credit_card_id] = []
        accumulator[bill.credit_card_id].push(bill)
        return accumulator
      }, {})
    )
  }, [billsQuery.data])

  const summaryCards = useMemo(() => buildSummaryCards(summary, summaryLoading, summaryError), [summary, summaryLoading, summaryError])

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesStatus = statusFilter === 'all' || card.status === statusFilter
      return matchesStatus
    })
  }, [cards, statusFilter])

  const latestCardUpdate = useMemo(() => {
    const values = cards.map((card) => new Date(card.updated_at).getTime()).filter((value) => !Number.isNaN(value))
    if (values.length === 0) return null
    return new Date(Math.max(...values)).toISOString()
  }, [cards])

  const cardStatusSummary = useMemo(() => {
    const overdue = cards.filter((card) => card.status === 'overdue').length
    const dueSoon = cards.filter((card) => card.status === 'due_soon').length
    const paid = cards.filter((card) => card.status === 'paid').length
    return { overdue, dueSoon, paid }
  }, [cards])

  const selectedCardBills = useMemo(() => {
    if (!selectedCard) return []
    return billsByCard[selectedCard.id] ?? []
  }, [billsByCard, selectedCard])

  async function loadCardHistory(cardId: number) {
    const bills = await queryClient.fetchQuery({
      queryKey: queryKeys.creditCardBillHistory(cardId),
      queryFn: ({ signal }) => getCreditCardBillHistory(cardId, signal),
    })
    setBillsByCard((current) => ({ ...current, [cardId]: bills }))
    return bills
  }

  function openCardDetail(card: ApiCreditCard) {
    setSelectedCard(card)
    if (!billsByCard[card.id]) {
      void loadCardHistory(card.id).catch(() => {
        setStatusTone('rose')
        setStatusMessage('Unable to load payment history.')
      })
    }
  }

  function openMarkPaidModal(card: ApiCreditCard) {
    setMarkPaidCard(card)
    setMarkPaidForm({
      paid_amount: String(card.current_bill_amount),
      paid_date: new Date().toISOString().slice(0, 10),
      notes: '',
    })
    setMarkPaidErrors({})
    setMarkPaidErrorMessage(null)
  }

  function openCreateModal() {
    setEditingId(null)
    setForm(defaultCreditCardForm)
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEditModal(card: ApiCreditCard) {
    setEditingId(card.id)
    setForm({
      card_name: card.card_name,
      bank_name: card.bank_name,
      last4: card.last4,
      total_limit: String(card.total_limit),
      used_amount: String(card.used_amount),
      current_bill_amount: String(card.current_bill_amount),
      billing_cycle_start: card.billing_cycle_start,
      billing_cycle_end: card.billing_cycle_end,
      due_date: card.due_date,
      status: card.status,
      notes: card.notes ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards }),
      queryClient.invalidateQueries({ queryKey: ['creditCardBills'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports('credit-card-bills') }),
    ])
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormErrors({})
    setFormErrorMessage(null)

    const nextErrors: FormErrors = {}
    const cardName = form.card_name.trim()
    const bankName = form.bank_name.trim()
    const last4 = form.last4.trim()
    const totalLimit = form.total_limit.trim()
    const usedAmount = form.used_amount.trim()
    const currentBillAmount = form.current_bill_amount.trim()
    const billingCycleStart = form.billing_cycle_start.trim()
    const billingCycleEnd = form.billing_cycle_end.trim()
    const dueDate = form.due_date.trim()

    if (!cardName) nextErrors.card_name = 'Card name is required.'
    if (!bankName) nextErrors.bank_name = 'Bank name is required.'
    if (!last4 || last4.length !== 4) nextErrors.last4 = 'Enter the last 4 digits.'
    if (!totalLimit) nextErrors.total_limit = 'Total limit is required.'
    if (!usedAmount) nextErrors.used_amount = 'Used amount is required.'
    if (!currentBillAmount) nextErrors.current_bill_amount = 'Bill amount is required.'
    if (!billingCycleStart) nextErrors.billing_cycle_start = 'Billing start date is required.'
    if (!billingCycleEnd) nextErrors.billing_cycle_end = 'Billing end date is required.'
    if (!dueDate) nextErrors.due_date = 'Due date is required.'

    ;[['total_limit', totalLimit], ['used_amount', usedAmount], ['current_bill_amount', currentBillAmount]].forEach(([field, value]) => {
      if (value && Number.isNaN(Number(value))) {
        nextErrors[field as keyof CreditCardFormState] = 'Enter a valid decimal number.'
      }
    })

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        card_name: cardName,
        bank_name: bankName,
        last4,
        total_limit: totalLimit,
        used_amount: usedAmount,
        current_bill_amount: currentBillAmount,
        billing_cycle_start: billingCycleStart,
        billing_cycle_end: billingCycleEnd,
        due_date: dueDate,
        status: form.status,
        notes: form.notes.trim() || null,
      }

      if (editingId === null) {
        await apiFetch('/api/credit-cards', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch(`/api/credit-cards/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
      }

      setIsModalOpen(false)
      setEditingId(null)
      setForm(defaultCreditCardForm)
      await refreshData()
    } catch (error) {
      if (error instanceof ApiError && error.validationErrors.length > 0) {
        const mappedErrors: FormErrors = {}
        error.validationErrors.forEach((item) => {
          if (item.path in defaultCreditCardForm) {
            mappedErrors[item.path as keyof CreditCardFormState] = item.message
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

  async function handleDelete(card: ApiCreditCard) {
    const confirmed = window.confirm(`Delete ${card.card_name}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await apiFetch(`/api/credit-cards/${card.id}`, { method: 'DELETE' })
      if (selectedCard?.id === card.id) {
        setSelectedCard(null)
      }
      if (markPaidCard?.id === card.id) {
        setMarkPaidCard(null)
      }
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${card.card_name}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  async function handleMarkPaidSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!markPaidCard) return

    setMarkPaidErrors({})
    setMarkPaidErrorMessage(null)

    const nextErrors: MarkPaidFormErrors = {}
    const paidAmount = markPaidForm.paid_amount.trim()
    const paidDate = markPaidForm.paid_date.trim()

    if (!paidAmount) nextErrors.paid_amount = 'Paid amount is required.'
    if (paidAmount && Number.isNaN(Number(paidAmount))) nextErrors.paid_amount = 'Enter a valid decimal number.'
    if (!paidDate) nextErrors.paid_date = 'Paid date is required.'

    if (Object.keys(nextErrors).length > 0) {
      setMarkPaidErrors(nextErrors)
      return
    }

    setIsMarkingPaid(true)
    try {
      const response = await markCreditCardPaid(markPaidCard.id, {
        paid_amount: paidAmount || null,
        paid_date: paidDate || null,
        notes: markPaidForm.notes.trim() || null,
      })
      setSelectedCard(response.credit_card)
      setBillsByCard((current) => ({
        ...current,
        [markPaidCard.id]: [response.bill_record, ...(current[markPaidCard.id] ?? [])],
      }))
      setRecentBills((current) => [response.bill_record, ...current.filter((bill) => bill.id !== response.bill_record.id)].slice(0, 10))
      setMarkPaidCard(null)
      setStatusTone('emerald')
      setStatusMessage('Bill payment logged.')
      await refreshData()
    } catch (error) {
      setMarkPaidErrorMessage(formatApiError(error))
    }
    finally {
      setIsMarkingPaid(false)
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
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Card Dues</div>
                <div className="mt-2 font-mono text-2xl font-bold tracking-[-0.03em] text-slate-100">
                  <PrivateValue
                    value={summaryLoading ? 'Loading...' : summaryError ? '—' : formatINRShort(toNumber(summary?.total_credit_card_dues))}
                    mask="••••"
                    hideColor
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className={['h-10 justify-center px-3.5 py-0 text-[12px]', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                Add
              </button>
            </div>

            <div className="mt-2 text-[12px] text-slate-400">
              {cardStatusSummary.overdue > 0
                ? `${cardStatusSummary.overdue} overdue · ${cardStatusSummary.dueSoon} due soon`
                : cardStatusSummary.dueSoon > 0
                  ? `${cardStatusSummary.dueSoon} due soon`
                  : 'All clear'}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Total utilization</span>
                <span>{privacyMode ? '••••' : `${toNumber(summary?.overall_card_utilization).toFixed(1)}%`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={[
                    'h-full rounded-full',
                    cardStatusSummary.overdue > 0 ? 'bg-rose-500' : cardStatusSummary.dueSoon > 0 ? 'bg-amber-500' : 'bg-emerald-500',
                  ].join(' ')}
                  style={{ width: `${Math.min(toNumber(summary?.overall_card_utilization), 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-900/70 px-4 py-4 ring-1 ring-slate-800/80">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Total Limit</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">
                <PrivateValue value={summaryLoading ? 'Loading...' : formatINRShort(toNumber(summary?.total_card_limit))} mask="••••" hideColor />
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Used: <PrivateValue value={formatINRShort(toNumber(summary?.total_card_used))} mask="••••" hideColor /></div>
            </div>
            <div className="rounded-2xl bg-slate-900/70 px-4 py-4 ring-1 ring-slate-800/80">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</div>
              <div className="mt-2 text-sm font-semibold text-slate-100">
                {cardStatusSummary.overdue > 0 ? 'Overdue' : cardStatusSummary.dueSoon > 0 ? 'Due Soon' : 'All Clear'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {cards.length} cards{latestCardUpdate ? ` · Updated ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(latestCardUpdate))}` : ''}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={openCreateModal}
              className={['h-11 flex-1 justify-center', primaryButtonClass].join(' ')}
            >
              <Icon name="add" className="h-4 w-4" />
              Add Card
            </button>
            <button
              type="button"
              onClick={() => {
                const target = cards.find((card) => card.status !== 'paid')
                if (target) openMarkPaidModal(target)
              }}
              disabled={!cards.some((card) => card.status !== 'paid')}
              className={['h-11 flex-1 justify-center', secondaryButtonClass].join(' ')}
            >
              <Icon name="paid" className="h-4 w-4" />
              Mark Paid
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="grid grid-cols-1 gap-3">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ApiCreditCard['status'])}
                className="h-11 rounded-2xl border border-slate-700 bg-slate-800/80 px-3 text-sm text-slate-200 outline-none"
              >
                <option value="all">All</option>
                <option value="paid">Paid</option>
                <option value="due_soon">Due Soon</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {cardsLoading ? (
            <div className="rounded-2xl bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
              <div className="text-sm text-slate-400">Loading cards…</div>
            </div>
          ) : cardsError ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">{cardsError}</div>
          ) : filteredCards.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/75 px-4 py-8 text-center ring-1 ring-slate-800/80">
              <div className="text-sm font-semibold text-slate-100">No credit cards added yet</div>
              <div className="mt-2 text-[12px] text-slate-500">Add Credit Card to track dues, usage, and due dates.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map((card) => {
                const tone = buildStatusTone(card.status)
                return (
                  <div key={`mobile-card-${card.id}`} className={['rounded-2xl bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80', tone.border].join(' ')}>
                    <div className="flex items-start gap-3">
                      <span className={['mt-1 h-14 w-1 shrink-0 rounded-full', tone.bar].join(' ')} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-100">{card.card_name}</div>
                            <div className="mt-1 text-[12px] text-slate-400">{card.bank_name} ••{card.last4}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openCardDetail(card)}
                            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300"
                          >
                            <Icon name="more" className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className={tone.badge}>{card.status.replace('_', ' ')}</span>
                          <div className="text-right">
                            <div className={['text-sm font-semibold', privacyMode ? 'text-slate-300' : tone.accent].join(' ')}>
                              <PrivateValue value={formatINR(toNumber(card.current_bill_amount))} mask="••••" hideColor />
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500">Due {card.due_date}</div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Used <PrivateValue value={formatINRShort(toNumber(card.used_amount))} mask="••••" hideColor /></span>
                            <span>{privacyMode ? '••••' : `${toNumber(card.utilization_pct).toFixed(1)}%`}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className={['h-full rounded-full', tone.bar].join(' ')} style={{ width: `${Math.min(toNumber(card.utilization_pct), 100)}%` }} />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Limit <PrivateValue value={formatINRShort(toNumber(card.total_limit))} mask="••••" hideColor /></span>
                            <span>{card.days_until_due < 0 ? `${Math.abs(card.days_until_due)} days overdue` : `${card.days_until_due} days left`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="rounded-2xl bg-slate-900/75 px-4 py-4 ring-1 ring-slate-800/80">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Recent Bill Payments</div>
            {billsLoading ? (
              <div className="mt-3 text-sm text-slate-400">Loading payment history...</div>
            ) : billsError ? (
              <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-sm text-rose-200">{billsError}</div>
            ) : recentBills.length === 0 ? (
              <div className="mt-3 text-sm text-slate-400">No bill payments logged yet.</div>
            ) : (
              <div className="mt-3 space-y-3">
                {recentBills.slice(0, 5).map((bill) => {
                  const card = cards.find((item) => item.id === bill.credit_card_id)
                  return (
                    <button
                      key={`mobile-recent-bill-${bill.id}`}
                      type="button"
                      onClick={() => card && openCardDetail(card)}
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-100">{card?.card_name ?? `Card #${bill.credit_card_id}`}</div>
                          <div className="mt-1 text-[11px] text-slate-500">{formatBillingCycle(bill.billing_cycle_start, bill.billing_cycle_end)}</div>
                        </div>
                        <span className={['inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset', buildBillStatusTone(bill.status)].join(' ')}>
                          {bill.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                        <div>
                          <div className="text-slate-500">Bill</div>
                          <div className="mt-1 font-semibold text-slate-100">
                            <PrivateValue value={formatINR(toNumber(bill.bill_amount))} mask="••••" hideColor />
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Paid</div>
                          <div className="mt-1 font-semibold text-slate-100">
                            <PrivateValue value={formatINR(toNumber(bill.paid_amount))} mask="••••" hideColor />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Paid {formatDisplayDate(bill.paid_date)}</span>
                        <span>Due {formatDisplayDate(bill.due_date)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:block space-y-6">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 px-5 py-3 shadow-sm">
            <Icon name="cards" className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="text-sm text-slate-500 dark:text-slate-400">Credit Cards</span>
            <span className="text-sm text-slate-400 dark:text-slate-600">·</span>
            <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">Track limits, dues, utilization, and bill cycles</span>
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
              Add Credit Card
            </button>
          </div>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/80 p-4 shadow-sm"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{card.label}</div>
                <div className={['mt-2.5 font-mono text-lg font-bold tabular-nums', privacyMode ? 'text-slate-400 dark:text-slate-400' : card.valueClass ?? 'text-slate-900 dark:text-white'].join(' ')}>
                  <PrivateValue value={card.value} mask="••••" hideColor />
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.meta}</div>
                <div className={['mt-4 grid h-7 w-7 place-items-center rounded-lg', card.iconBg].join(' ')}>
                  <Icon name="cards" className="h-3.5 w-3.5" />
                </div>
              </div>
            ))}
          </section>

          <SectionCard>
          <div className="border-b border-slate-200 dark:border-slate-700/50 px-4 py-3 sm:px-6 sm:py-4">
            <div className="grid grid-cols-1 gap-4">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | ApiCreditCard['status'])}
                className="h-10 rounded-lg border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800 px-3 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/15"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="due_soon">Due Soon</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>
          </div>

          {cardsLoading ? (
            <div className="px-6 py-10">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-10 text-center">
                <div className="text-base font-semibold text-slate-900 dark:text-white">Loading cards...</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Fetching positions from the backend.</div>
              </div>
            </div>
          ) : cardsError ? (
            <div className="px-6 py-10">
              <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-8 text-center">
                <div className="text-base font-semibold text-rose-800 dark:text-rose-200">Unable to load cards</div>
                <div className="mt-2 text-sm text-rose-600 dark:text-rose-300">{cardsError}</div>
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="px-6 py-10">
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-10 text-center">
                <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  <Icon name="cards" className="h-5 w-5" />
                </div>
                <div className="mt-4 text-base font-semibold text-slate-900 dark:text-white">No cards match the filters</div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Try a different status or search term.</div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 px-4 py-4 sm:px-6 sm:py-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCards.map((card) => {
                const tone = buildStatusTone(card.status)

                return (
                  <div key={card.id} className={['rounded-2xl border bg-white dark:bg-slate-900/80 p-5 shadow-sm', tone.border].join(' ')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate text-slate-900 dark:text-white">{card.card_name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{card.bank_name} ••{card.last4}</div>
                      </div>
                      <span className={tone.badge}>{card.status.replace('_', ' ')}</span>
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Used {privacyMode ? '••••' : formatINRShort(toNumber(card.used_amount))}</span>
                        <span>{privacyMode ? '•••' : `${toNumber(card.utilization_pct).toFixed(1)}%`}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className={['h-2 rounded-full', tone.bar].join(' ')} style={{ width: `${Math.min(toNumber(card.utilization_pct), 100)}%` }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Avail. {privacyMode ? '••••' : formatINRShort(toNumber(card.available_limit))} of {privacyMode ? '••••' : formatINRShort(toNumber(card.total_limit))}</span>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Bill amount</div>
                        <div className={['mt-1 text-sm font-semibold', privacyMode ? 'text-slate-400 dark:text-slate-400' : tone.accent].join(' ')}>
                          <PrivateValue value={formatINR(toNumber(card.current_bill_amount))} mask="••••" hideColor />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Due date</div>
                        <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{card.due_date}</div>
                        <div className={['mt-1 text-xs', card.days_until_due < 0 ? 'text-rose-600 dark:text-rose-400' : card.days_until_due <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'].join(' ')}>
                          {card.days_until_due < 0 ? `${Math.abs(card.days_until_due)} days overdue` : `${card.days_until_due} days left`}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openCardDetail(card)}
                        className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                      >
                        History
                      </button>
                      {toNumber(card.current_bill_amount) > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMarkPaidModal(card)}
                          className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-95"
                        >
                          Mark Paid
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 active:scale-95"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(card)}
                        className="rounded-lg p-2 text-slate-400 dark:text-slate-500 transition-all duration-150 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-rose-600 dark:hover:text-rose-400 active:scale-95"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

          <SectionCard title="Recent Bill Payments">
            <div className="px-4 py-4 sm:px-6">
              {billsLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading payment history...</div>
              ) : billsError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  {billsError}
                </div>
              ) : recentBills.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">No bill payments logged yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
                      <tr>
                        <th className="pb-3 font-medium">Card</th>
                        <th className="pb-3 font-medium">Cycle</th>
                        <th className="pb-3 font-medium">Bill</th>
                        <th className="pb-3 font-medium">Paid</th>
                        <th className="pb-3 font-medium">Due Date</th>
                        <th className="pb-3 font-medium">Paid Date</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {recentBills.map((bill) => {
                        const card = cards.find((item) => item.id === bill.credit_card_id)
                        return (
                          <tr key={bill.id}>
                            <td className="py-3 pr-4">
                              <button type="button" onClick={() => card && openCardDetail(card)} className="text-left">
                                <div className="font-medium text-slate-900 dark:text-slate-100">{card?.card_name ?? `Card #${bill.credit_card_id}`}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{card ? `${card.bank_name} ••${card.last4}` : 'Deleted card'}</div>
                              </button>
                            </td>
                            <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatBillingCycle(bill.billing_cycle_start, bill.billing_cycle_end)}</td>
                            <td className="py-3 pr-4 text-slate-900 dark:text-slate-100">
                              <PrivateValue value={formatINR(toNumber(bill.bill_amount))} mask="••••" hideColor />
                            </td>
                            <td className="py-3 pr-4 text-slate-900 dark:text-slate-100">
                              <PrivateValue value={formatINR(toNumber(bill.paid_amount))} mask="••••" hideColor />
                            </td>
                            <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatDisplayDate(bill.due_date)}</td>
                            <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{formatDisplayDate(bill.paid_date)}</td>
                            <td className="py-3">
                              <span className={['inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset', buildBillStatusTone(bill.status)].join(' ')}>
                                {bill.status}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </SectionCard>
      </div>
      </div>

      <BottomSheet
        open={Boolean(selectedCard) && !isModalOpen}
        onClose={() => setSelectedCard(null)}
        title={selectedCard?.card_name ?? 'Credit card'}
        subtitle={selectedCard ? `${selectedCard.bank_name} ••${selectedCard.last4}` : ''}
        footer={
          selectedCard ? (
            <div className="grid grid-cols-1 gap-3">
              {selectedCard.status !== 'paid' ? (
                <button
                  type="button"
                  onClick={() => openMarkPaidModal(selectedCard)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white"
                >
                  <Icon name="paid" className="h-4 w-4" />
                  Mark Paid
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCard(null)
                    openEditModal(selectedCard)
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200"
                >
                  <Icon name="edit" className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedCard)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-sm font-semibold text-rose-300"
                >
                  <Icon name="remove" className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedCard ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Bill Amount</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatINR(toNumber(selectedCard.current_bill_amount))} mask="••••" hideColor />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Due Date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{selectedCard.due_date}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Used</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatINR(toNumber(selectedCard.used_amount))} mask="••••" hideColor />
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Limit</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <PrivateValue value={formatINR(toNumber(selectedCard.total_limit))} mask="••••" hideColor />
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-500">
                <span>Utilization</span>
                <span>{privacyMode ? '••••' : formatPct(toNumber(selectedCard.utilization_pct))}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={['h-full rounded-full', buildStatusTone(selectedCard.status).bar].join(' ')} style={{ width: `${Math.min(toNumber(selectedCard.utilization_pct), 100)}%` }} />
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {selectedCard.days_until_due < 0 ? `${Math.abs(selectedCard.days_until_due)} days overdue` : `${selectedCard.days_until_due} days left`}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Payment History</div>
                <button
                  type="button"
                  onClick={() => void loadCardHistory(selectedCard.id)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 dark:text-accent-400"
                >
                  <Icon name="refresh" className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>

              {selectedCardBills.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400">No bill payments logged yet.</div>
              ) : (
                <div className="space-y-2">
                  {selectedCardBills.map((bill) => (
                    <div key={bill.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatBillingCycle(bill.billing_cycle_start, bill.billing_cycle_end)}</div>
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            Generated {formatDisplayDate(bill.bill_generated_date)} · Due {formatDisplayDate(bill.due_date)} · Paid {formatDisplayDate(bill.paid_date)}
                          </div>
                        </div>
                        <span className={['inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset', buildBillStatusTone(bill.status)].join(' ')}>
                          {bill.status}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-500 dark:text-slate-500">Bill</div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            <PrivateValue value={formatINR(toNumber(bill.bill_amount))} mask="••••" hideColor />
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500 dark:text-slate-500">Paid</div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            <PrivateValue value={formatINR(toNumber(bill.paid_amount))} mask="••••" hideColor />
                          </div>
                        </div>
                      </div>
                      {bill.notes ? <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{bill.notes}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(markPaidCard)}
        onClose={() => setMarkPaidCard(null)}
        title="Mark Bill Paid"
        subtitle={markPaidCard ? `${markPaidCard.card_name} • ${markPaidCard.bank_name}` : 'Log this bill payment'}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMarkPaidCard(null)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              disabled={isMarkingPaid}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="mark-paid-form"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
              disabled={isMarkingPaid}
            >
              <Icon name="paid" className="h-4 w-4" />
              {isMarkingPaid ? 'Saving...' : 'Mark Paid'}
            </button>
          </div>
        }
      >
        {markPaidCard ? (
          <form id="mark-paid-form" onSubmit={handleMarkPaidSubmit} className="space-y-4">
            {markPaidErrorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {markPaidErrorMessage}
              </div>
            ) : null}

            <div className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">Bill Amount</div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <PrivateValue value={formatINR(toNumber(markPaidCard.current_bill_amount))} mask="••••" hideColor />
              </div>
            </div>

            <FormField label="Paid Amount" error={markPaidErrors.paid_amount}>
              <input
                value={markPaidForm.paid_amount}
                onChange={(event) => setMarkPaidForm((current) => ({ ...current, paid_amount: event.target.value }))}
                inputMode="decimal"
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Paid Date" error={markPaidErrors.paid_date}>
              <input
                type="date"
                value={markPaidForm.paid_date}
                onChange={(event) => setMarkPaidForm((current) => ({ ...current, paid_date: event.target.value }))}
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Notes" error={markPaidErrors.notes}>
              <textarea
                value={markPaidForm.notes}
                onChange={(event) => setMarkPaidForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                placeholder="Optional payment note"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </FormField>
          </form>
        ) : null}
      </BottomSheet>

      <div className="md:hidden">
        <BottomSheet
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingId === null ? 'Add Credit Card' : 'Edit Credit Card'}
          subtitle="Manual credit card tracking"
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
                form="credit-card-form"
                disabled={isSaving}
                className={['h-11 justify-center', primaryButtonClass].join(' ')}
              >
                <Icon name="add" className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          }
        >
          <form id="credit-card-form" onSubmit={handleSubmit} className="space-y-4">
            {formErrorMessage ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200 whitespace-pre-wrap">
                {formErrorMessage}
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4">
              <FormField label="Card Name" error={formErrors.card_name}>
                <input value={form.card_name} onChange={(event) => setForm((current) => ({ ...current, card_name: event.target.value }))} placeholder="HDFC Regalia" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <FormField label="Bank Name" error={formErrors.bank_name}>
                <input value={form.bank_name} onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))} placeholder="HDFC Bank" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Last 4 Digits" error={formErrors.last4}>
                  <input value={form.last4} onChange={(event) => setForm((current) => ({ ...current, last4: event.target.value.replace(/\D/g, '').slice(0, 4) }))} placeholder="4821" inputMode="numeric" maxLength={4} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
                <FormField label="Status" error={formErrors.status}>
                  <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreditCardFormState['status'] }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150">
                    <option value="paid">Paid</option>
                    <option value="due_soon">Due Soon</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Total Limit" error={formErrors.total_limit}>
                  <input value={form.total_limit} onChange={(event) => setForm((current) => ({ ...current, total_limit: event.target.value }))} placeholder="500000" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
                <FormField label="Used Amount" error={formErrors.used_amount}>
                  <input value={form.used_amount} onChange={(event) => setForm((current) => ({ ...current, used_amount: event.target.value }))} placeholder="71420" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
              </div>
              <FormField label="Current Bill Amount" error={formErrors.current_bill_amount}>
                <input value={form.current_bill_amount} onChange={(event) => setForm((current) => ({ ...current, current_bill_amount: event.target.value }))} placeholder="38450" inputMode="decimal" className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Billing Start" error={formErrors.billing_cycle_start}>
                  <input type="date" value={form.billing_cycle_start} onChange={(event) => setForm((current) => ({ ...current, billing_cycle_start: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
                <FormField label="Billing End" error={formErrors.billing_cycle_end}>
                  <input type="date" value={form.billing_cycle_end} onChange={(event) => setForm((current) => ({ ...current, billing_cycle_end: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
                </FormField>
              </div>
              <FormField label="Due Date" error={formErrors.due_date}>
                <input type="date" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150" />
              </FormField>
              <FormField label="Notes" error={formErrors.notes}>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Optional notes about the card" className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150 resize-none" />
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
              'relative z-10 flex h-full w-full max-w-140 flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-out motion-reduce:transition-none',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">{editingId === null ? 'Add Credit Card' : 'Edit Credit Card'}</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Manual entry for one credit card</div>
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

                {editingId !== null ? (
                  <div className="mb-5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    Editing existing card details. Update the fields below and click Save Changes.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Card Name" error={formErrors.card_name}>
                    <input
                      value={form.card_name}
                      onChange={(event) => setForm((current) => ({ ...current, card_name: event.target.value }))}
                      placeholder="HDFC Regalia"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Bank Name" error={formErrors.bank_name}>
                    <input
                      value={form.bank_name}
                      onChange={(event) => setForm((current) => ({ ...current, bank_name: event.target.value }))}
                      placeholder="HDFC Bank"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Last 4 Digits" error={formErrors.last4}>
                    <input
                      value={form.last4}
                      onChange={(event) => setForm((current) => ({ ...current, last4: event.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="4821"
                      inputMode="numeric"
                      maxLength={4}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Status" error={formErrors.status}>
                    <select
                      value={form.status}
                      onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CreditCardFormState['status'] }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    >
                      <option value="paid">Paid</option>
                      <option value="due_soon">Due Soon</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </FormField>

                  <FormField label="Total Limit" error={formErrors.total_limit}>
                    <input
                      value={form.total_limit}
                      onChange={(event) => setForm((current) => ({ ...current, total_limit: event.target.value }))}
                      placeholder="500000"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Used Amount" error={formErrors.used_amount}>
                    <input
                      value={form.used_amount}
                      onChange={(event) => setForm((current) => ({ ...current, used_amount: event.target.value }))}
                      placeholder="71420"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Bill Amount" error={formErrors.current_bill_amount}>
                    <input
                      value={form.current_bill_amount}
                      onChange={(event) => setForm((current) => ({ ...current, current_bill_amount: event.target.value }))}
                      placeholder="38450"
                      inputMode="decimal"
                      step="any"
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Billing Start" error={formErrors.billing_cycle_start}>
                    <input
                      type="date"
                      value={form.billing_cycle_start}
                      onChange={(event) => setForm((current) => ({ ...current, billing_cycle_start: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Billing End" error={formErrors.billing_cycle_end}>
                    <input
                      type="date"
                      value={form.billing_cycle_end}
                      onChange={(event) => setForm((current) => ({ ...current, billing_cycle_end: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>

                  <FormField label="Due Date" error={formErrors.due_date}>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150"
                    />
                  </FormField>
                </div>

                <FormField label="Notes" error={formErrors.notes}>
                  <textarea
                    value={form.notes}
                    onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                    placeholder="Optional notes about the card"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors duration-150 resize-none"
                  />
                </FormField>
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
                  disabled={isSaving}
                  className={primaryButtonClass}
                >
                  {isSaving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                  {isSaving ? 'Saving...' : editingId === null ? 'Create Credit Card' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
