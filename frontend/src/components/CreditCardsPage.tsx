import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CreditCard as CreditCardIcon,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  TrendingDown,
  TrendingUp,
  History,
  Check,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Copy,
  ExternalLink,
  Wallet,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  ArrowRight,
  Info,
  DollarSign,
  Receipt,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import {
  ApiError,
  apiFetch,
  getCreditCardBillHistory,
  markCreditCardPaid,
  type CreditCardBill,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import {
  useCreditCardBillsQuery,
  useCreditCardsQuery,
  useDashboardSummaryQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens & Constants ────────────────────────────────────────────────

const CARD_SHELL = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90'
const LABEL_TEXT = 'text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'

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

const POPULAR_CARD_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'SBI Card',
  'Kotak Mahindra Bank',
  'AU Small Finance Bank',
  'IndusInd Bank',
  'IDFC FIRST Bank',
  'Standard Chartered',
  'OneCard',
]

// ─── Visual Branding & Theme Helpers ──────────────────────────────────────────

type CardBrandTheme = {
  gradient: string
  border: string
  accent: string
  badge: string
  network: string
  logoText: string
  glow: string
  iconColor: string
}

function getCreditCardBrandTheme(bankName: string, cardName: string): CardBrandTheme {
  const normalized = `${bankName} ${cardName}`.toLowerCase()

  if (normalized.includes('hdfc')) {
    return {
      gradient: 'from-[#071328] via-[#0d2242] to-[#17386d]',
      border: 'border-blue-500/30 dark:border-blue-500/40',
      accent: 'text-blue-400',
      badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      network: 'Visa Signature',
      logoText: 'HDFC BANK',
      glow: 'shadow-blue-900/30',
      iconColor: 'text-blue-400',
    }
  }

  if (normalized.includes('icici')) {
    return {
      gradient: 'from-[#220c06] via-[#3c1209] to-[#6d250d]',
      border: 'border-orange-500/30 dark:border-orange-500/40',
      accent: 'text-orange-400',
      badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      network: 'Mastercard Platinum',
      logoText: 'ICICI BANK',
      glow: 'shadow-orange-950/30',
      iconColor: 'text-orange-400',
    }
  }

  if (normalized.includes('axis') || normalized.includes('airtel')) {
    return {
      gradient: 'from-[#210512] via-[#3e0b23] to-[#6e133c]',
      border: 'border-pink-500/30 dark:border-pink-500/40',
      accent: 'text-pink-400',
      badge: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
      network: 'Mastercard World',
      logoText: 'AXIS BANK',
      glow: 'shadow-pink-950/30',
      iconColor: 'text-pink-400',
    }
  }

  if (normalized.includes('au') || normalized.includes('kiwi')) {
    return {
      gradient: 'from-[#031713] via-[#072a23] to-[#0a483d]',
      border: 'border-emerald-500/30 dark:border-emerald-500/40',
      accent: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      network: 'RuPay Select',
      logoText: 'AU BANK',
      glow: 'shadow-emerald-950/30',
      iconColor: 'text-emerald-400',
    }
  }

  if (normalized.includes('sbi')) {
    return {
      gradient: 'from-[#071524] via-[#0d253f] to-[#153e68]',
      border: 'border-sky-500/30 dark:border-sky-500/40',
      accent: 'text-sky-400',
      badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      network: 'Visa / RuPay',
      logoText: 'SBI CARD',
      glow: 'shadow-sky-950/30',
      iconColor: 'text-sky-400',
    }
  }

  if (normalized.includes('kotak')) {
    return {
      gradient: 'from-[#220606] via-[#3d0b0b] to-[#6d1717]',
      border: 'border-red-500/30 dark:border-red-500/40',
      accent: 'text-red-400',
      badge: 'bg-red-500/20 text-red-300 border-red-500/30',
      network: 'Visa Infinite',
      logoText: 'KOTAK',
      glow: 'shadow-red-950/30',
      iconColor: 'text-red-400',
    }
  }

  if (normalized.includes('onecard')) {
    return {
      gradient: 'from-[#09090b] via-[#18181b] to-[#27272a]',
      border: 'border-slate-500/30 dark:border-slate-500/40',
      accent: 'text-slate-200',
      badge: 'bg-slate-500/20 text-slate-200 border-slate-500/30',
      network: 'Visa Signature Metal',
      logoText: 'ONECARD',
      glow: 'shadow-zinc-900/40',
      iconColor: 'text-slate-300',
    }
  }

  // Obsidian Executive Default
  return {
    gradient: 'from-[#0f172a] via-[#1e293b] to-[#334155]',
    border: 'border-slate-500/30 dark:border-slate-500/40',
    accent: 'text-slate-300',
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    network: 'Credit Card',
    logoText: bankName.slice(0, 8).toUpperCase() || 'BANK',
    glow: 'shadow-slate-900/30',
    iconColor: 'text-slate-300',
  }
}

function toNumber(value: string | number | null | undefined): number {
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
  if (!start && !end) return 'Cycle not recorded'
  if (start && end) {
    return `${formatDisplayDate(start)} – ${formatDisplayDate(end)}`
  }
  return formatDisplayDate(start ?? end)
}

function getDueCountdownMeta(daysUntilDue: number) {
  if (daysUntilDue < 0) {
    return {
      label: `${Math.abs(daysUntilDue)}d Overdue`,
      badgeClass: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border border-rose-500/30 font-bold animate-pulse',
      isOverdue: true,
      isDueSoon: false,
    }
  }
  if (daysUntilDue === 0) {
    return {
      label: 'Due Today',
      badgeClass: 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/40 font-bold',
      isOverdue: false,
      isDueSoon: true,
    }
  }
  if (daysUntilDue <= 7) {
    return {
      label: `${daysUntilDue}d left`,
      badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold',
      isOverdue: false,
      isDueSoon: true,
    }
  }
  if (daysUntilDue <= 15) {
    return {
      label: `${daysUntilDue}d left`,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-medium',
      isOverdue: false,
      isDueSoon: true,
    }
  }
  return {
    label: `${daysUntilDue}d left`,
    badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 font-medium',
    isOverdue: false,
    isDueSoon: false,
  }
}

function getUtilizationScale(utilizationPct: number) {
  if (utilizationPct >= 50) {
    return {
      label: 'High (Impacts CIBIL)',
      textTone: 'text-rose-600 dark:text-rose-400',
      badgeTone: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30',
      barColor: 'bg-rose-500',
      gradient: 'from-rose-500 to-red-600',
    }
  }
  if (utilizationPct >= 30) {
    return {
      label: 'Moderate (Watch Limits)',
      textTone: 'text-amber-600 dark:text-amber-400',
      badgeTone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30',
      barColor: 'bg-amber-500',
      gradient: 'from-amber-500 to-yellow-500',
    }
  }
  return {
    label: 'Optimal (< 30% CIBIL Safe)',
    textTone: 'text-emerald-600 dark:text-emerald-400',
    badgeTone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30',
    barColor: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
  }
}

function buildStatusTone(status: ApiCreditCard['status']) {
  if (status === 'paid') {
    return {
      border: 'border-emerald-200 dark:border-emerald-500/30',
      badge: 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
      accent: 'text-emerald-600 dark:text-emerald-400',
      bar: 'bg-emerald-500',
    }
  }
  if (status === 'due_soon') {
    return {
      border: 'border-amber-200 dark:border-amber-500/30',
      badge: 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
      accent: 'text-amber-600 dark:text-amber-400',
      bar: 'bg-amber-500',
    }
  }
  return {
    border: 'border-rose-200 dark:border-rose-500/30',
    badge: 'bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
    accent: 'text-rose-600 dark:text-rose-400',
    bar: 'bg-rose-500',
  }
}

function buildBillStatusTone(status: CreditCardBill['status']) {
  if (status === 'paid') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30'
  }
  if (status === 'partial') {
    return 'bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
  }
  if (status === 'missed') {
    return 'bg-rose-50 text-rose-700 border border-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30'
  }
  return 'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
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
      {error ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreditCardsPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()

  // State
  const [recentBills, setRecentBills] = useState<CreditCardBill[]>([])
  const [billsByCard, setBillsByCard] = useState<Record<number, CreditCardBill[]>>({})
  const [statusFilter, setStatusFilter] = useState<'all' | ApiCreditCard['status']>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'due_date_asc' | 'dues_desc' | 'utilization_desc' | 'limit_desc' | 'name_asc'>('due_date_asc')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Modals & Drawers
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CreditCardFormState>(defaultCreditCardForm)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  // Selected card for history view
  const [selectedCard, setSelectedCard] = useState<ApiCreditCard | null>(null)

  // Fast Mark Paid Modal
  const [markPaidCard, setMarkPaidCard] = useState<ApiCreditCard | null>(null)
  const [markPaidForm, setMarkPaidForm] = useState<MarkPaidFormState>(defaultMarkPaidForm)
  const [markPaidErrors, setMarkPaidErrors] = useState<MarkPaidFormErrors>({})
  const [markPaidErrorMessage, setMarkPaidErrorMessage] = useState<string | null>(null)
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)

  // Queries
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

  // Drawer animation
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

  // Sync selected card
  useEffect(() => {
    if (!selectedCard) return
    const nextCard = cards.find((card) => card.id === selectedCard.id)
    if (nextCard) setSelectedCard(nextCard)
  }, [cards, selectedCard])

  // Sync recent bills
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

  // ─── Filtered and Sorted Cards ──────────────────────────────────────────────

  const filteredAndSortedCards = useMemo(() => {
    let result = cards.filter((card) => {
      if (statusFilter !== 'all' && card.status !== statusFilter) return false
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = card.card_name.toLowerCase().includes(query)
        const matchBank = card.bank_name.toLowerCase().includes(query)
        const matchDigits = card.last4.includes(query)
        if (!matchName && !matchBank && !matchDigits) return false
      }
      return true
    })

    result.sort((a, b) => {
      if (sortBy === 'due_date_asc') return a.days_until_due - b.days_until_due
      if (sortBy === 'dues_desc') return toNumber(b.current_bill_amount) - toNumber(a.current_bill_amount)
      if (sortBy === 'utilization_desc') return toNumber(b.utilization_pct) - toNumber(a.utilization_pct)
      if (sortBy === 'limit_desc') return toNumber(b.total_limit) - toNumber(a.total_limit)
      if (sortBy === 'name_asc') return a.card_name.localeCompare(b.card_name)
      return 0
    })

    return result
  }, [cards, statusFilter, searchQuery, sortBy])

  // Upcoming bills sorted by urgency
  const upcomingBills = useMemo(() => {
    return [...cards]
      .filter((card) => toNumber(card.current_bill_amount) > 0 || card.status !== 'paid')
      .sort((a, b) => a.days_until_due - b.days_until_due)
  }, [cards])

  // Credit limits aggregated
  const totalLimit = useMemo(() => {
    return summary ? toNumber(summary.total_card_limit) : cards.reduce((acc, c) => acc + toNumber(c.total_limit), 0)
  }, [summary, cards])

  const totalUsed = useMemo(() => {
    return summary ? toNumber(summary.total_card_used) : cards.reduce((acc, c) => acc + toNumber(c.used_amount), 0)
  }, [summary, cards])

  const totalDues = useMemo(() => {
    return summary ? toNumber(summary.total_credit_card_dues) : cards.reduce((acc, c) => acc + toNumber(c.current_bill_amount), 0)
  }, [summary, cards])

  const overallUtilization = useMemo(() => {
    if (summary) return toNumber(summary.overall_card_utilization)
    return totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0
  }, [summary, totalLimit, totalUsed])

  const totalAvailable = useMemo(() => {
    return Math.max(totalLimit - totalUsed, 0)
  }, [totalLimit, totalUsed])

  const overdueCount = summary ? summary.overdue_count : cards.filter((c) => c.status === 'overdue').length
  const dueSoonCount = summary ? summary.due_soon_count : cards.filter((c) => c.status === 'due_soon').length
  const paidCount = cards.filter((c) => c.status === 'paid').length

  const utilizationScale = getUtilizationScale(overallUtilization)

  // Bills for selected card in bottom sheet
  const selectedCardBills = useMemo(() => {
    if (!selectedCard) return []
    return billsByCard[selectedCard.id] ?? []
  }, [billsByCard, selectedCard])

  // ─── Actions ────────────────────────────────────────────────────────────────

  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.creditCards }),
      queryClient.invalidateQueries({ queryKey: ['creditCardBills'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.reports('credit-card-bills') }),
    ])
    await queryClient.refetchQueries({ queryKey: queryKeys.dashboardSummary, exact: true, type: 'active' })
  }

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

  async function handleDelete(card: ApiCreditCard) {
    const confirmed = window.confirm(`Delete ${card.card_name}? This cannot be undone.`)
    if (!confirmed) return

    try {
      await apiFetch(`/api/credit-cards/${card.id}`, { method: 'DELETE' })
      if (selectedCard?.id === card.id) setSelectedCard(null)
      if (markPaidCard?.id === card.id) setMarkPaidCard(null)
      setStatusTone('emerald')
      setStatusMessage(`Deleted ${card.card_name}.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
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
    if (!last4 || last4.length !== 4) nextErrors.last4 = 'Enter exactly 4 digits.'
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
        setStatusMessage(`Added card ${cardName}.`)
      } else {
        await apiFetch(`/api/credit-cards/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setStatusMessage(`Updated card ${cardName}.`)
      }

      setStatusTone('emerald')
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
      setStatusMessage(`Payment logged for ${markPaidCard.card_name}.`)
      await refreshData()
    } catch (error) {
      setMarkPaidErrorMessage(formatApiError(error))
    } finally {
      setIsMarkingPaid(false)
    }
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-[1600px] overflow-x-hidden space-y-6 pb-12">
      {/* ── Toast Notification ────────────────────────────────────────── */}
      {statusMessage ? (
        <div
          className={[
            'rounded-2xl border px-4 py-3 text-sm flex items-center justify-between gap-3 shadow-sm transition-all',
            statusTone === 'emerald'
              ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
              : statusTone === 'amber'
                ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-100'
                : statusTone === 'rose'
                  ? 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            {statusTone === 'emerald' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span className="font-medium">{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ── Executive Header Command Bar ───────────────────────────────── */}
      <div className={`${CARD_SHELL} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <CreditCardIcon className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Credit Cards & Dues
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                Active Lines: {cards.length}
              </span>
              {overdueCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueCount} Overdue
                </span>
              ) : dueSoonCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {dueSoonCount} Due Soon
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  All Paid
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Limits, automated billing cycles, real-time utilization analytics, and dues settlement tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={() => void refreshData()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 shadow-sm"
              title="Refresh credit card data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 text-xs font-semibold text-white shadow-sm transition active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Add Credit Card</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 4 Executive Bento KPI Cards ─────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Metric 1: Total Dues */}
        <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_TEXT}>Total Active Dues</span>
            <div className={['grid h-8 w-8 place-items-center rounded-xl border', totalDues > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'].join(' ')}>
              {totalDues > 0 ? <Clock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            </div>
          </div>
          <div className="mt-3">
            <div className={['font-mono text-2xl font-bold tracking-tight', privacyMode ? 'text-slate-400' : totalDues > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'].join(' ')}>
              <PrivateValue value={formatINR(totalDues)} mask="••••••••" hideColor />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{overdueCount} overdue · {dueSoonCount} due soon</span>
              {totalDues > 0 && totalLimit > 0 ? (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {privacyMode ? '••%' : `${((totalDues / totalLimit) * 100).toFixed(1)}% of limit`}
                </span>
              ) : (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Clear</span>
              )}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={['h-full rounded-full transition-all duration-500', totalDues > 0 ? 'bg-amber-500' : 'bg-emerald-500'].join(' ')}
              style={{ width: `${Math.min(totalLimit > 0 ? (totalDues / totalLimit) * 100 : 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Total Card Limit */}
        <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_TEXT}>Total Credit Line</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-500">
              <CreditCardIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <PrivateValue value={formatINR(totalLimit)} mask="••••••••" hideColor />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Available Credit</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                <PrivateValue value={formatINRShort(totalAvailable)} mask="••••" hideColor />
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(totalLimit > 0 ? (totalAvailable / totalLimit) * 100 : 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Total Used Amount */}
        <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_TEXT}>Current Spending / Debt</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              <PrivateValue value={formatINR(totalUsed)} mask="••••••••" hideColor />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Across {cards.length} cards</span>
              <span>Avg {formatINRShort(cards.length > 0 ? totalUsed / cards.length : 0)}/card</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all duration-500"
              style={{ width: `${Math.min(totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 4: Utilization & CIBIL Health */}
        <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
          <div className="flex items-center justify-between">
            <span className={LABEL_TEXT}>Overall Utilization</span>
            <span className={['inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold', utilizationScale.badgeTone].join(' ')}>
              {utilizationScale.label}
            </span>
          </div>
          <div className="mt-3">
            <div className={['font-mono text-2xl font-bold tracking-tight', privacyMode ? 'text-slate-400' : utilizationScale.textTone].join(' ')}>
              {privacyMode ? '••••' : `${overallUtilization.toFixed(2)}%`}
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>CIBIL ceiling: 30%</span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {overallUtilization < 30 ? 'Safe for score' : 'Reduce balance'}
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 relative">
            <div
              className={['h-full rounded-full transition-all duration-500', utilizationScale.barColor].join(' ')}
              style={{ width: `${Math.min(Math.max(overallUtilization, 0), 100)}%` }}
            />
            {/* 30% indicator tick */}
            <div className="absolute top-0 bottom-0 left-[30%] w-0.5 bg-slate-400/60 dark:bg-slate-500/60" title="30% threshold" />
          </div>
        </div>
      </section>

      {/* ── Dual Credit Intelligence Widgets ───────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left: Upcoming Dues Horizon */}
        <div className={`${CARD_SHELL} p-5 lg:col-span-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Payment Horizon & Due Dates
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                Chronological order
              </span>
            </div>

            {upcomingBills.length === 0 ? (
              <div className="my-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500 mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">All dues settled</div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  No upcoming credit card payments currently pending.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {upcomingBills.map((card) => {
                  const countdown = getDueCountdownMeta(card.days_until_due)
                  const brand = getCreditCardBrandTheme(card.bank_name, card.card_name)
                  const billVal = toNumber(card.current_bill_amount)

                  return (
                    <div key={card.id} className="py-2.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${brand.gradient} text-white font-mono text-[10px] font-bold shadow-sm`}>
                          {card.bank_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 truncate">
                            <span className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                              {card.card_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              ••{card.last4}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Due {formatDisplayDate(card.due_date)}</span>
                            <span>•</span>
                            <span className={countdown.badgeClass + ' px-1.5 py-0.2 rounded text-[10px]'}>
                              {countdown.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                            <PrivateValue value={formatINR(billVal)} mask="••••" hideColor />
                          </div>
                          <div className="text-[10px] text-slate-400">Bill Dues</div>
                        </div>
                        {billVal > 0 ? (
                          <button
                            type="button"
                            onClick={() => openMarkPaidModal(card)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition active:scale-95"
                          >
                            <Check className="h-3 w-3" />
                            Pay
                          </button>
                        ) : (
                          <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Log payments immediately after clearing your statement</span>
            <span className="font-semibold text-indigo-500 dark:text-indigo-400">{cards.length} tracked lines</span>
          </div>
        </div>

        {/* Right: Credit Capacity & Card Distribution */}
        <div className={`${CARD_SHELL} p-5 lg:col-span-6 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-500" />
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  Credit Line Allocation & Utilization
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                Limit capacity
              </span>
            </div>

            {cards.length === 0 ? (
              <div className="my-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-500">
                No credit cards to analyze.
              </div>
            ) : (
              <div className="space-y-3">
                {cards.slice(0, 4).map((card) => {
                  const cardLimit = toNumber(card.total_limit)
                  const cardUsed = toNumber(card.used_amount)
                  const utilPct = toNumber(card.utilization_pct)
                  const shareOfLimit = totalLimit > 0 ? (cardLimit / totalLimit) * 100 : 0
                  const scale = getUtilizationScale(utilPct)

                  return (
                    <div key={card.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[140px] sm:max-w-[200px]">
                            {card.card_name}
                          </span>
                          <span className="text-[10px] text-slate-400">({shareOfLimit.toFixed(0)}% of total limit)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            <PrivateValue value={formatINRShort(cardUsed)} mask="•••" hideColor /> / <PrivateValue value={formatINRShort(cardLimit)} mask="•••" hideColor />
                          </span>
                          <span className={['font-mono font-bold text-[11px]', scale.textTone].join(' ')}>
                            {privacyMode ? '••%' : `${utilPct.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={['h-full rounded-full transition-all duration-500', scale.barColor].join(' ')}
                          style={{ width: `${Math.min(Math.max(utilPct, 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Available credit headroom:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <PrivateValue value={formatINR(totalAvailable)} mask="••••••••" hideColor />
            </span>
          </div>
        </div>
      </section>

      {/* ── Interactive Command Deck (Filter & Search) ─────────────────── */}
      <div className={`${CARD_SHELL} p-4 sm:p-5 space-y-4`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cards by name, bank, last 4..."
              className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 pl-9 pr-8 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          {/* Status filter pills & sort & view mode */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 p-0.5">
              {(
                [
                  { id: 'all', label: `All (${cards.length})` },
                  { id: 'due_soon', label: `Due Soon (${dueSoonCount})` },
                  { id: 'paid', label: `Paid (${paidCount})` },
                  { id: 'overdue', label: `Overdue (${overdueCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id as 'all' | ApiCreditCard['status'])}
                  className={[
                    'rounded-lg px-2.5 py-1 text-xs font-semibold transition',
                    statusFilter === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="h-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm focus:border-indigo-500 focus:outline-none"
            >
              <option value="due_date_asc">Soonest Due</option>
              <option value="dues_desc">Highest Dues</option>
              <option value="utilization_desc">Highest Utilization</option>
              <option value="limit_desc">Highest Limit</option>
              <option value="name_asc">Card Name (A-Z)</option>
            </select>

            {/* View Switcher: Cards vs Table */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={[
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1',
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
                title="Fintech Smart Cards View"
              >
                <CreditCardIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={[
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition flex items-center gap-1',
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
                title="Spreadsheet Table View"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Cards Showcase ────────────────────────────────────────── */}
        {cardsLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center text-xs text-slate-500">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin text-indigo-500 mb-2" />
            Loading credit cards portfolio…
          </div>
        ) : cardsError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-6 text-center text-xs text-rose-700 dark:text-rose-300">
            {cardsError}
          </div>
        ) : filteredAndSortedCards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-12 text-center">
            <CreditCardIcon className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No credit cards found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {searchQuery || statusFilter !== 'all' ? 'Try adjusting your search query or filters.' : 'Add your first credit card to start tracking limits and statement dues.'}
            </p>
          </div>
        ) : viewMode === 'cards' ? (
          /* ── Fintech Sleek Compact Smart Cards Grid ────────────────── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filteredAndSortedCards.map((card) => {
              const theme = getCreditCardBrandTheme(card.bank_name, card.card_name)
              const tone = buildStatusTone(card.status)
              const utilization = toNumber(card.utilization_pct)
              const utilScale = getUtilizationScale(utilization)
              const countdown = getDueCountdownMeta(card.days_until_due)
              const billAmount = toNumber(card.current_bill_amount)

              return (
                <div
                  key={card.id}
                  className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.gradient} text-white shadow-md ${theme.glow} transition-all duration-200 hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between`}
                >
                  {/* Subtle decorative glow */}
                  <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/[0.04] blur-lg" />

                  {/* Card Main Body */}
                  <div className="relative p-4 pb-3 space-y-3">
                    {/* Top Row: Bank & Card Title + Countdown Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono tracking-wider text-white/60 uppercase font-semibold">
                            {theme.logoText}
                          </span>
                          <span className="text-[10px] text-white/40">•</span>
                          <span className="text-[10px] font-mono text-white/70">
                            ••{card.last4}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold tracking-tight text-white truncate drop-shadow-sm mt-0.5">
                          {card.card_name}
                        </h3>
                      </div>

                      <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${countdown.badgeClass}`}>
                        {countdown.label}
                      </span>
                    </div>

                    {/* Middle Row: EMV chip + Bill Amount */}
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <div className="flex items-center gap-2">
                        {/* Compact EMV Chip */}
                        <div className="relative h-6 w-8 rounded bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-500 shadow-inner p-0.5 border border-yellow-200/50 flex flex-col justify-between shrink-0">
                          <div className="h-full w-full rounded-sm border border-amber-700/30 flex items-center justify-center">
                            <div className="w-full h-[0.5px] bg-amber-800/40" />
                          </div>
                        </div>
                        {/* Contactless Icon */}
                        <svg className="h-3.5 w-3.5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M8.5 16.5a5 5 0 0 1 0-7" strokeLinecap="round" />
                          <path d="M12 19a8.5 8.5 0 0 0 0-14" strokeLinecap="round" />
                        </svg>
                      </div>

                      <div className="text-right">
                        <div className="text-[9px] uppercase tracking-wider text-white/60 font-medium">
                          Bill Due
                        </div>
                        <div className="font-mono text-base font-bold tracking-tight text-white">
                          <PrivateValue value={formatINR(billAmount)} mask="••••••" hideColor />
                        </div>
                      </div>
                    </div>

                    {/* Utilization Bar & Metrics */}
                    <div className="space-y-1 pt-1">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
                        <div
                          className={`h-full rounded-full ${utilScale.barColor} transition-all duration-500`}
                          style={{ width: `${Math.min(Math.max(utilization, 0), 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-white/65">
                        <span>Used <PrivateValue value={formatINRShort(toNumber(card.used_amount))} mask="•••" hideColor /></span>
                        <span className={`font-semibold ${utilScale.textTone}`}>
                          {privacyMode ? '••%' : `${utilization.toFixed(1)}%`}
                        </span>
                        <span>Avail <PrivateValue value={formatINRShort(toNumber(card.available_limit))} mask="•••" hideColor /></span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Toolbar */}
                  <div className="relative border-t border-white/10 bg-black/30 px-3.5 py-2 flex items-center justify-between gap-1.5 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      {billAmount > 0 ? (
                        <button
                          type="button"
                          onClick={() => openMarkPaidModal(card)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2 py-1 text-[11px] font-bold text-slate-950 transition active:scale-95 shadow-sm"
                        >
                          <Check className="h-3 w-3" />
                          <span>Pay</span>
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-emerald-400/90 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Paid
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => openCardDetail(card)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2 py-1 text-[11px] font-medium text-white/90 transition active:scale-95"
                      >
                        <History className="h-3 w-3" />
                        <span>History</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-white/50 font-mono mr-1">
                        Due {formatDisplayDate(card.due_date)}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEditModal(card)}
                        className="grid h-6 w-6 place-items-center rounded-md bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition active:scale-95"
                        title="Edit Card"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(card)}
                        className="grid h-6 w-6 place-items-center rounded-md bg-white/10 hover:bg-rose-500/30 text-white/80 hover:text-rose-300 transition active:scale-95"
                        title="Delete Card"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ── Broker-Grade Data Grid Table View ─────────────────────── */
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 pl-4 pr-3">Card & Bank</th>
                  <th className="px-3 py-3">Due Date</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Bill Due</th>
                  <th className="px-3 py-3">Used / Limit</th>
                  <th className="px-3 py-3">Utilization</th>
                  <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAndSortedCards.map((card) => {
                  const theme = getCreditCardBrandTheme(card.bank_name, card.card_name)
                  const tone = buildStatusTone(card.status)
                  const countdown = getDueCountdownMeta(card.days_until_due)
                  const util = toNumber(card.utilization_pct)
                  const utilScale = getUtilizationScale(util)
                  const billAmount = toNumber(card.current_bill_amount)

                  return (
                    <tr key={card.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 pl-4 pr-3">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${theme.gradient} text-white font-mono text-[10px] font-bold shadow-sm`}>
                            {card.bank_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{card.card_name}</span>
                              <span className="font-mono text-[10px] text-slate-400">••{card.last4}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {card.bank_name}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {formatDisplayDate(card.due_date)}
                        </div>
                        <span className={`inline-block mt-0.5 rounded px-1.5 py-0.2 text-[10px] font-semibold ${countdown.badgeClass}`}>
                          {countdown.label}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
                          {card.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(billAmount)} mask="••••" hideColor />
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                        <div>
                          <PrivateValue value={formatINR(toNumber(card.used_amount))} mask="••••" hideColor />
                        </div>
                        <div className="text-[10px] text-slate-400">
                          of <PrivateValue value={formatINR(toNumber(card.total_limit))} mask="••••" hideColor />
                        </div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={['font-mono font-bold', utilScale.textTone].join(' ')}>
                            {privacyMode ? '••%' : `${util.toFixed(1)}%`}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={['h-full rounded-full', utilScale.barColor].join(' ')}
                            style={{ width: `${Math.min(Math.max(util, 0), 100)}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {billAmount > 0 ? (
                            <button
                              type="button"
                              onClick={() => openMarkPaidModal(card)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2 py-1 text-[11px] font-semibold text-white shadow-sm transition active:scale-95"
                            >
                              <Check className="h-3 w-3" />
                              Pay
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openCardDetail(card)}
                            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                            title="Statement History"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(card)}
                            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                            title="Edit Card"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(card)}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-500 transition"
                            title="Delete Card"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* ── Recent Bill Payments Audit Trail ───────────────────────────── */}
      <div className={`${CARD_SHELL} p-5 space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="h-4 w-4 text-indigo-500" />
              Recent Bill Settlement Ledger
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audit trail of cleared card statements across all tracked banks.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {recentBills.length} records logged
          </span>
        </div>

        {billsLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
            Loading bill payments…
          </div>
        ) : billsError ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-4 text-center text-xs text-rose-700">
            {billsError}
          </div>
        ) : recentBills.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500">
            No payments logged yet. Use &quot;Mark Paid&quot; on any card to record bill settlements.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 pl-4 pr-3">Card Name</th>
                  <th className="px-3 py-3">Billing Cycle</th>
                  <th className="px-3 py-3">Due / Paid Date</th>
                  <th className="px-3 py-3">Billed</th>
                  <th className="px-3 py-3">Paid Amount</th>
                  <th className="py-3 pl-3 pr-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentBills.map((bill) => {
                  const card = cards.find((c) => c.id === bill.credit_card_id)
                  const brand = card ? getCreditCardBrandTheme(card.bank_name, card.card_name) : null

                  return (
                    <tr
                      key={bill.id}
                      onClick={() => card && openCardDetail(card)}
                      className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3.5 pl-4 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-500 font-bold text-[10px]">
                            {card?.bank_name.slice(0, 2).toUpperCase() ?? 'CC'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {card?.card_name ?? `Card #${bill.credit_card_id}`}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {card ? `${card.bank_name} ••${card.last4}` : 'Card'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300">
                        {formatBillingCycle(bill.billing_cycle_start, bill.billing_cycle_end)}
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        <div>Paid {formatDisplayDate(bill.paid_date)}</div>
                        <div className="text-[10px] text-slate-400">Due {formatDisplayDate(bill.due_date)}</div>
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono font-medium text-slate-900 dark:text-white">
                        <PrivateValue value={formatINR(toNumber(bill.bill_amount))} mask="••••" hideColor />
                      </td>

                      <td className="px-3 py-3.5 whitespace-nowrap font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        <PrivateValue value={formatINR(toNumber(bill.paid_amount))} mask="••••" hideColor />
                      </td>

                      <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${buildBillStatusTone(bill.status)}`}>
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

      {/* ── Fast "Mark Paid" Modal ─────────────────────────────────────── */}
      <BottomSheet
        open={Boolean(markPaidCard)}
        onClose={() => setMarkPaidCard(null)}
        title="Settle Card Statement"
        subtitle={markPaidCard ? `${markPaidCard.card_name} (${markPaidCard.bank_name} ••${markPaidCard.last4})` : 'Log bill payment'}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMarkPaidCard(null)}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
              disabled={isMarkingPaid}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="fast-mark-paid-form"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
              disabled={isMarkingPaid}
            >
              <Check className="h-4 w-4" />
              {isMarkingPaid ? 'Saving…' : 'Confirm Payment'}
            </button>
          </div>
        }
      >
        {markPaidCard ? (
          <form id="fast-mark-paid-form" onSubmit={handleMarkPaidSubmit} className="space-y-4">
            {markPaidErrorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
                {markPaidErrorMessage}
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Statement Dues Outstanding</span>
                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(toNumber(markPaidCard.current_bill_amount))} mask="••••" hideColor />
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setMarkPaidForm((c) => ({ ...c, paid_amount: String(markPaidCard.current_bill_amount) }))}
                  className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400"
                >
                  Full Amount
                </button>
              </div>
            </div>

            <FormField label="Payment Amount (₹)" error={markPaidErrors.paid_amount}>
              <input
                value={markPaidForm.paid_amount}
                onChange={(e) => setMarkPaidForm((c) => ({ ...c, paid_amount: e.target.value }))}
                inputMode="decimal"
                placeholder="24710"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 font-mono font-bold focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="Settlement Date" error={markPaidErrors.paid_date}>
              <input
                type="date"
                value={markPaidForm.paid_date}
                onChange={(e) => setMarkPaidForm((c) => ({ ...c, paid_date: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="Notes (Optional)" error={markPaidErrors.notes}>
              <textarea
                value={markPaidForm.notes}
                onChange={(e) => setMarkPaidForm((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
                placeholder="Paid via Netbanking / UPI"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
              />
            </FormField>
          </form>
        ) : null}
      </BottomSheet>

      {/* ── Card Detail & History Drawer ───────────────────────────────── */}
      <BottomSheet
        open={Boolean(selectedCard) && !isModalOpen}
        onClose={() => setSelectedCard(null)}
        title={selectedCard?.card_name ?? 'Credit Card'}
        subtitle={selectedCard ? `${selectedCard.bank_name} ••${selectedCard.last4}` : ''}
        footer={
          selectedCard ? (
            <div className="grid grid-cols-1 gap-2.5">
              {toNumber(selectedCard.current_bill_amount) > 0 ? (
                <button
                  type="button"
                  onClick={() => openMarkPaidModal(selectedCard)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm transition active:scale-95"
                >
                  <Check className="h-4 w-4" />
                  Mark Statement Paid
                </button>
              ) : null}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const c = selectedCard
                    setSelectedCard(null)
                    openEditModal(c)
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Card
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(selectedCard)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 text-xs font-semibold text-rose-500 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedCard ? (
          <div className="space-y-4">
            {/* Quick Specs Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Current Dues</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(toNumber(selectedCard.current_bill_amount))} mask="••••" hideColor />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Due Date</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  {formatDisplayDate(selectedCard.due_date)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Total Limit</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(toNumber(selectedCard.total_limit))} mask="••••" hideColor />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5">
                <div className="text-[10px] font-semibold uppercase text-slate-400">Used Amount</div>
                <div className="mt-1 font-mono text-sm font-bold text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(toNumber(selectedCard.used_amount))} mask="••••" hideColor />
                </div>
              </div>
            </div>

            {/* Utilization Bar */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Utilization Gauge</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {privacyMode ? '••%' : formatPct(toNumber(selectedCard.utilization_pct))}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.min(toNumber(selectedCard.utilization_pct), 100)}%` }}
                />
              </div>
            </div>

            {/* Statement Payment History */}
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Statement Payment History
                </span>
                <button
                  type="button"
                  onClick={() => void loadCardHistory(selectedCard.id)}
                  className="text-xs font-semibold text-indigo-500 flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>

              {selectedCardBills.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  No payment statements recorded yet for this card.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {selectedCardBills.map((bill) => (
                    <div key={bill.id} className="py-2.5 first:pt-1 last:pb-1 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {formatBillingCycle(bill.billing_cycle_start, bill.billing_cycle_end)}
                        </span>
                        <span className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${buildBillStatusTone(bill.status)}`}>
                          {bill.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Paid on {formatDisplayDate(bill.paid_date)}</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          <PrivateValue value={formatINR(toNumber(bill.paid_amount))} mask="••••" hideColor />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </BottomSheet>

      {/* ── Full Add & Edit Card Modal / Desktop Drawer ─────────────────── */}
      <div className="md:hidden">
        <BottomSheet
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingId === null ? 'Add Credit Card' : 'Edit Credit Card'}
          subtitle="Configure limits, billing dates, and balance"
          footer={
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="credit-card-form"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-sm disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save Card'}
              </button>
            </div>
          }
        >
          <form id="credit-card-form" onSubmit={handleSubmit} className="space-y-4">
            {formErrorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-3 text-xs text-rose-700 whitespace-pre-wrap">
                {formErrorMessage}
              </div>
            ) : null}

            {/* Form Fields */}
            <FormField label="Card Name" error={formErrors.card_name}>
              <input
                value={form.card_name}
                onChange={(e) => setForm((c) => ({ ...c, card_name: e.target.value }))}
                placeholder="Regalia Gold / Swiggy Card"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <FormField label="Bank Name" error={formErrors.bank_name}>
              <input
                value={form.bank_name}
                onChange={(e) => setForm((c) => ({ ...c, bank_name: e.target.value }))}
                placeholder="HDFC Bank"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Last 4 Digits" error={formErrors.last4}>
                <input
                  value={form.last4}
                  onChange={(e) => setForm((c) => ({ ...c, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                  placeholder="3888"
                  maxLength={4}
                  inputMode="numeric"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField label="Status" error={formErrors.status}>
                <select
                  value={form.status}
                  onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as CreditCardFormState['status'] }))}
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="paid">Paid</option>
                  <option value="due_soon">Due Soon</option>
                  <option value="overdue">Overdue</option>
                </select>
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Total Limit (₹)" error={formErrors.total_limit}>
                <input
                  value={form.total_limit}
                  onChange={(e) => setForm((c) => ({ ...c, total_limit: e.target.value }))}
                  placeholder="150000"
                  inputMode="decimal"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>

              <FormField label="Used Amount (₹)" error={formErrors.used_amount}>
                <input
                  value={form.used_amount}
                  onChange={(e) => setForm((c) => ({ ...c, used_amount: e.target.value }))}
                  placeholder="0"
                  inputMode="decimal"
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </FormField>
            </div>

            <FormField label="Current Bill Due (₹)" error={formErrors.current_bill_amount}>
              <input
                value={form.current_bill_amount}
                onChange={(e) => setForm((c) => ({ ...c, current_bill_amount: e.target.value }))}
                placeholder="0"
                inputMode="decimal"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Billing Start" error={formErrors.billing_cycle_start}>
                <input
                  type="date"
                  value={form.billing_cycle_start}
                  onChange={(e) => setForm((c) => ({ ...c, billing_cycle_start: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </FormField>

              <FormField label="Billing End" error={formErrors.billing_cycle_end}>
                <input
                  type="date"
                  value={form.billing_cycle_end}
                  onChange={(e) => setForm((c) => ({ ...c, billing_cycle_end: e.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </FormField>
            </div>

            <FormField label="Due Date" error={formErrors.due_date}>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </FormField>

            <FormField label="Notes" error={formErrors.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
                placeholder="E.g. Primary online spending card"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 resize-none focus:border-indigo-500 focus:outline-none"
              />
            </FormField>
          </form>
        </BottomSheet>
      </div>

      {/* Desktop Slide-out Drawer */}
      {isDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 hidden items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 md:flex',
            isDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setIsModalOpen(false)}
          aria-hidden={!isDrawerVisible}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 ease-out',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingId === null ? 'Add Credit Card' : 'Edit Credit Card'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Configure limits, billing dates, and balance
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {formErrorMessage ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-3 text-xs text-rose-700 whitespace-pre-wrap">
                    {formErrorMessage}
                  </div>
                ) : null}

                {/* Quick Bank Chips */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Quick Select Bank
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_CARD_BANKS.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setForm((c) => ({ ...c, bank_name: b }))}
                        className={[
                          'rounded-lg px-2.5 py-1 text-xs font-semibold border transition',
                          form.bank_name === b
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Card Name" error={formErrors.card_name}>
                    <input
                      value={form.card_name}
                      onChange={(e) => setForm((c) => ({ ...c, card_name: e.target.value }))}
                      placeholder="Regalia Gold / Swiggy Card"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Bank Name" error={formErrors.bank_name}>
                    <input
                      value={form.bank_name}
                      onChange={(e) => setForm((c) => ({ ...c, bank_name: e.target.value }))}
                      placeholder="HDFC Bank"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Last 4 Digits" error={formErrors.last4}>
                    <input
                      value={form.last4}
                      onChange={(e) => setForm((c) => ({ ...c, last4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="3888"
                      maxLength={4}
                      inputMode="numeric"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Status" error={formErrors.status}>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((c) => ({ ...c, status: e.target.value as CreditCardFormState['status'] }))}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="paid">Paid</option>
                      <option value="due_soon">Due Soon</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </FormField>

                  <FormField label="Total Limit (₹)" error={formErrors.total_limit}>
                    <input
                      value={form.total_limit}
                      onChange={(e) => setForm((c) => ({ ...c, total_limit: e.target.value }))}
                      placeholder="150000"
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Used Amount (₹)" error={formErrors.used_amount}>
                    <input
                      value={form.used_amount}
                      onChange={(e) => setForm((c) => ({ ...c, used_amount: e.target.value }))}
                      placeholder="0"
                      inputMode="decimal"
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>
                </div>

                <FormField label="Current Statement Bill Due (₹)" error={formErrors.current_bill_amount}>
                  <input
                    value={form.current_bill_amount}
                    onChange={(e) => setForm((c) => ({ ...c, current_bill_amount: e.target.value }))}
                    placeholder="0"
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Billing Cycle Start" error={formErrors.billing_cycle_start}>
                    <input
                      type="date"
                      value={form.billing_cycle_start}
                      onChange={(e) => setForm((c) => ({ ...c, billing_cycle_start: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Billing Cycle End" error={formErrors.billing_cycle_end}>
                    <input
                      type="date"
                      value={form.billing_cycle_end}
                      onChange={(e) => setForm((c) => ({ ...c, billing_cycle_end: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                    />
                  </FormField>
                </div>

                <FormField label="Payment Due Date" error={formErrors.due_date}>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((c) => ({ ...c, due_date: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </FormField>

                <FormField label="Notes (Optional)" error={formErrors.notes}>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                    rows={2}
                    placeholder="E.g. Primary travel card, 5% cashback on dining"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 resize-none focus:border-indigo-500 focus:outline-none"
                  />
                </FormField>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {isSaving ? 'Saving…' : editingId === null ? 'Create Credit Card' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
