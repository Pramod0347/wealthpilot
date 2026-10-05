import { useQueryClient } from '@tanstack/react-query'
import React, { Fragment, useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Plus,
  Calendar,
  Wallet,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  Clock,
  Search,
  SlidersHorizontal,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  Sparkles,
  ShieldCheck,
  Receipt,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronDown,
  Dumbbell,
  Home,
  ShoppingCart,
  Utensils,
  Bike,
  Users,
  User,
  Zap,
  Tv,
  MapPin,
  ShoppingBag,
  HeartPulse,
  Plane,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import {
  ApiError,
  createCashflowEntry,
  createGoalEMIPayment,
  createHomeContribution,
  deleteCashflowEntry,
  deleteGoalEMIPayment,
  deleteHomeContribution,
  updateFinancialGoal,
  type EMIPayment,
  type HomeContribution,
  type FinancialGoal,
  type CashflowEntry,
  type CashflowEntryPayload,
  type CashflowSummary,
  type AnalyticsSummary,
  updateCashflowEntry,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import BottomSheet from './ui/BottomSheet'
import {
  useAnalyticsSummaryQuery,
  useCashflowEntriesQuery,
  useCashflowMonthsQuery,
  useCashflowSummaryQuery,
  useFinancialGoalsQuery,
  useGoalEMIPaymentsQuery,
  useHomeContributionsQuery,
} from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'
import { primaryButtonClass, secondaryButtonClass } from '../styles/buttonStyles'

// ─── Design Tokens & Constants ────────────────────────────────────────────────

const CARD_SHELL = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90'
const LABEL_TEXT = 'text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500'

const incomeCategories = ['Salary', 'Freelance', 'Bonus', 'Interest', 'Dividend', 'Other'] as const
const expenseCategories = [
  'Grocery',
  'Food',
  'House Rent',
  'Bike',
  'Social Life',
  'Whey Protein',
  'Personal Exp',
  'Utilities',
  'Subscription',
  'Going Home',
  'Home',
  'Shopping',
  'Healthcare',
  'Travel',
  'Other',
] as const

const chartColors = [
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#eab308', // yellow
]

type EntryType = 'income' | 'expense'

type CashflowFormState = {
  month: string
  entry_type: EntryType
  category: string
  source: string
  amount: string
  notes: string
}

type FormErrors = Partial<Record<keyof CashflowFormState, string>>

function currentMonthString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getPreviousMonthString(monthStr: string) {
  const [yearStr, mStr] = monthStr.split('-')
  let y = Number(yearStr)
  let m = Number(mStr) - 1
  if (m < 1) {
    m = 12
    y -= 1
  }
  return `${y}-${String(m).padStart(2, '0')}`
}

const defaultForm = (month = currentMonthString()): CashflowFormState => ({
  month,
  entry_type: 'expense',
  category: 'Grocery',
  source: '',
  amount: '',
  notes: '',
})

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
  if (error instanceof Error) return error.message
  return 'Request failed'
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split('-')
  if (!year || !month) return value
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(date)
}

function formatMonthShort(value: string) {
  const [year, month] = value.split('-')
  if (!year || !month) return value
  const date = new Date(Number(year), Number(month) - 1, 1)
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(date)
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

function getCategories(entryType: EntryType) {
  return entryType === 'income' ? [...incomeCategories] : [...expenseCategories]
}

function toPayload(form: CashflowFormState): CashflowEntryPayload {
  return {
    month: form.month,
    entry_type: form.entry_type,
    category: form.category,
    source: form.source.trim() || null,
    amount: form.amount.trim() || '0',
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
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {label}
      </div>
      {children}
      {error ? <div className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">{error}</div> : null}
    </label>
  )
}

function getCategoryClassification(category: string): {
  group: 'essentials' | 'health' | 'lifestyle' | 'transit' | 'other'
  label: string
  color: string
} {
  const cat = category.toLowerCase()
  if (
    cat.includes('rent') ||
    cat.includes('grocery') ||
    cat.includes('home') ||
    cat.includes('utilit') ||
    cat.includes('bill')
  ) {
    return { group: 'essentials', label: 'Essential / Fixed', color: 'indigo' }
  }
  if (
    cat.includes('whey') ||
    cat.includes('protein') ||
    cat.includes('health') ||
    cat.includes('gym') ||
    cat.includes('fit') ||
    cat.includes('medical')
  ) {
    return { group: 'health', label: 'Health & Fitness', color: 'emerald' }
  }
  if (
    cat.includes('bike') ||
    cat.includes('travel') ||
    cat.includes('commute') ||
    cat.includes('fuel') ||
    cat.includes('petrol')
  ) {
    return { group: 'transit', label: 'Transit & Commute', color: 'cyan' }
  }
  if (
    cat.includes('food') ||
    cat.includes('social') ||
    cat.includes('shop') ||
    cat.includes('subscript') ||
    cat.includes('dining') ||
    cat.includes('cafe') ||
    cat.includes('entertainment')
  ) {
    return { group: 'lifestyle', label: 'Lifestyle & Leisure', color: 'purple' }
  }
  return { group: 'other', label: 'Personal / Other', color: 'slate' }
}

function getCategoryIcon(category: string) {
  const cat = category.toLowerCase()
  if (cat.includes('whey') || cat.includes('protein') || cat.includes('gym') || cat.includes('fit')) return Dumbbell
  if (cat.includes('rent') || cat.includes('house')) return Home
  if (cat.includes('home')) return Home
  if (cat.includes('grocery')) return ShoppingCart
  if (cat.includes('food') || cat.includes('dining') || cat.includes('cafe')) return Utensils
  if (cat.includes('bike')) return Bike
  if (cat.includes('social')) return Users
  if (cat.includes('personal')) return User
  if (cat.includes('utilit') || cat.includes('electricity') || cat.includes('bill')) return Zap
  if (cat.includes('subscript') || cat.includes('ott')) return Tv
  if (cat.includes('going home')) return MapPin
  if (cat.includes('shop')) return ShoppingBag
  if (cat.includes('health') || cat.includes('medical')) return HeartPulse
  if (cat.includes('travel')) return Plane
  return Layers
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TransactionsHubPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()

  // Active top-level view tab
  const [activeView, setActiveView] = useState<'transactions' | 'emi' | 'home'>('transactions')

  // Current active month (for present month entry & live pacing)
  const currentMonth = useMemo(() => currentMonthString(), [])
  const lastMonth = useMemo(() => getPreviousMonthString(currentMonth), [currentMonth])

  // Selected month for past explorer
  const [historicalExplorerMonth, setHistoricalExplorerMonth] = useState(lastMonth)

  // Drawer / Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CashflowFormState>(defaultForm(currentMonth))
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Feedback notifications
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')

  // Search & Filters for present month's live entries
  const [liveSearchQuery, setLiveSearchQuery] = useState('')
  const [liveTypeFilter, setLiveTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [liveCategoryFilter, setLiveCategoryFilter] = useState<string>('all')

  // Search, Filters & Drilldown for Category Average Spends Intelligence
  const [avgSearchQuery, setAvgSearchQuery] = useState('')
  const [avgGroupFilter, setAvgGroupFilter] = useState<'all' | 'recurring' | 'essentials' | 'health' | 'lifestyle' | 'transit'>('all')
  const [avgSortBy, setAvgSortBy] = useState<'spend_desc' | 'spend_asc' | 'pct_desc' | 'frequency_desc' | 'name_asc'>('spend_desc')
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // ── EMI Tracker States ──────────────────────────────────────────────────────
  const [selectedEMIGoalId, setSelectedEMIGoalId] = useState<number | null>(null)
  const [customPlannedEmiAmount, setCustomPlannedEmiAmount] = useState('')
  const [customPlannedEmiMonths, setCustomPlannedEmiMonths] = useState('')
  const [isEMIPlanSaved, setIsEMIPlanSaved] = useState(false)
  const [isEMISettingsSaving, setIsEMISettingsSaving] = useState(false)

  const createEmptyEMIRow = () => ({
    id: `emi-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payment_month: currentMonthString(),
    payment_date: new Date().toISOString().slice(0, 10),
    principal_amount: '',
    interest_amount: '',
    gst_amount: '',
    amount: '',
    notes: '',
  })

  const [emiPaymentForm, setEmiPaymentForm] = useState({
    processing_fee: '',
    processing_fee_gst: '',
  })

  const [emiPaymentRows, setEmiPaymentRows] = useState<
    Array<{
      id: string
      payment_month: string
      payment_date: string
      principal_amount: string
      interest_amount: string
      gst_amount: string
      amount: string
      notes: string
    }>
  >([createEmptyEMIRow()])

  function createEMIRows(count: number) {
    const today = new Date()
    return Array.from({ length: Math.max(count, 1) }, (_, index) => {
      const monthDate = new Date(today.getFullYear(), today.getMonth() + index, 1)
      const paymentMonth = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
      return { ...createEmptyEMIRow(), payment_month: paymentMonth }
    })
  }

  const updateEMIRow = (
    rowId: string,
    patch: Partial<{
      payment_month: string
      payment_date: string
      principal_amount: string
      interest_amount: string
      gst_amount: string
      amount: string
      notes: string
    }>
  ) => {
    setEmiPaymentRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row
        const nextRow = { ...row, ...patch }
        const principal = Number(nextRow.principal_amount || 0)
        const interest = Number(nextRow.interest_amount || 0)
        const gst = Number(nextRow.gst_amount || 0)
        const total = principal + interest + gst
        return {
          ...nextRow,
          amount: total > 0 ? total.toFixed(2) : '',
        }
      })
    )
  }

  const [emiPaymentError, setEmiPaymentError] = useState<string | null>(null)
  const [isEMIPaymentSaving, setIsEMIPaymentSaving] = useState(false)

  // ── Home Contributions States ───────────────────────────────────────────────
  const [homeContributionForm, setHomeContributionForm] = useState({
    amount: '',
    contribution_date: new Date().toISOString().slice(0, 10),
    reason: '',
    purpose: '',
    notes: '',
  })
  const [isHomeContributionSaving, setIsHomeContributionSaving] = useState(false)

  // ── Queries ─────────────────────────────────────────────────────────────────
  const monthsQuery = useCashflowMonthsQuery()
  const currentMonthEntriesQuery = useCashflowEntriesQuery(currentMonth)
  const currentMonthSummaryQuery = useCashflowSummaryQuery(currentMonth)

  // Last Month Summary for pacing comparison
  const lastMonthSummaryQuery = useCashflowSummaryQuery(lastMonth)

  // All cashflow entries across history for category average intelligence
  const allEntriesQuery = useCashflowEntriesQuery()

  const analyticsQuery = useAnalyticsSummaryQuery()
  const goalsQuery = useFinancialGoalsQuery()
  const homeContributionsQuery = useHomeContributionsQuery()

  const months = monthsQuery.data ?? []
  const currentEntries = (currentMonthEntriesQuery.data as CashflowEntry[] | undefined) ?? []
  const currentSummary = (currentMonthSummaryQuery.data as CashflowSummary | undefined) ?? null
  const lastMonthSummary = (lastMonthSummaryQuery.data as CashflowSummary | undefined) ?? null

  const allHistoricalEntries = useMemo(() => {
    const all = (allEntriesQuery.data as CashflowEntry[] | undefined) ?? []
    return all.filter((entry) => entry.month < currentMonth)
  }, [allEntriesQuery.data, currentMonth])

  const analytics = (analyticsQuery.data as AnalyticsSummary | undefined) ?? null
  const goals = (goalsQuery.data as FinancialGoal[] | undefined) ?? []
  const homeContributions = (homeContributionsQuery.data as HomeContribution[] | undefined) ?? []

  // EMI goal selection
  const selectedEMIGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedEMIGoalId) ?? null,
    [goals, selectedEMIGoalId]
  )
  const emiPaymentsQuery = useGoalEMIPaymentsQuery(selectedEMIGoalId)
  const emiPayments = (emiPaymentsQuery.data as EMIPayment[] | undefined) ?? []

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

  // ── Calculations: Present Month Running Metrics ─────────────────────────────
  const presentIncome = toNumber(currentSummary?.total_income)
  const presentExpense = toNumber(currentSummary?.total_expense)
  const presentNetSavings = toNumber(currentSummary?.net_savings)
  const presentSavingsRate = toNumber(currentSummary?.savings_rate)

  const lastMonthExpense = toNumber(lastMonthSummary?.total_expense)
  const lastMonthIncome = toNumber(lastMonthSummary?.total_income)

  // Pacing %: How much of last month's spend has been spent this month so far
  const spendPacingPct = lastMonthExpense > 0 ? (presentExpense / lastMonthExpense) * 100 : 0

  // ── Calculations: Historical Data Analytics (Till Last Month) ───────────────
  // Filter trend data to only include completed months (strictly < currentMonth)
  const historicalMonthlyTrend = useMemo(() => {
    const rawTrend = analytics?.cashflow_analytics.monthly_trend ?? []
    return rawTrend.filter((item) => item.month < currentMonth)
  }, [analytics, currentMonth])

  // Historical Averages across completed months
  const historicalStats = useMemo(() => {
    if (historicalMonthlyTrend.length === 0) {
      // Fallback to analytics summary if trend array is empty
      const avg = analytics?.cashflow_analytics.average_monthly_summary
      return {
        avgIncome: toNumber(avg?.income),
        avgExpense: toNumber(avg?.expense),
        avgNetSavings: toNumber(avg?.net_savings),
        avgSavingsRate: toNumber(avg?.savings_rate),
        totalAccumulated: 0,
        monthsCount: analytics?.cashflow_analytics.months_count ?? 0,
      }
    }

    const count = historicalMonthlyTrend.length
    const totalInc = historicalMonthlyTrend.reduce((acc, m) => acc + toNumber(m.income), 0)
    const totalExp = historicalMonthlyTrend.reduce((acc, m) => acc + toNumber(m.expense), 0)
    const totalSav = historicalMonthlyTrend.reduce((acc, m) => acc + toNumber(m.net_savings), 0)

    const avgInc = totalInc / count
    const avgExp = totalExp / count
    const avgSav = totalSav / count
    const avgRate = avgInc > 0 ? (avgSav / avgInc) * 100 : 0

    return {
      avgIncome: avgInc,
      avgExpense: avgExp,
      avgNetSavings: avgSav,
      avgSavingsRate: avgRate,
      totalAccumulated: totalSav,
      monthsCount: count,
    }
  }, [historicalMonthlyTrend, analytics])

  // Category spending distribution till last month
  const historicalCategorySpend = useMemo(() => {
    return analytics?.cashflow_analytics.top_spending_categories ?? []
  }, [analytics])

  const historicalPieData = useMemo(() => {
    return historicalCategorySpend.map((item) => ({
      name: item.category,
      value: toNumber(item.average_amount),
      percentage: toNumber(item.percentage_of_avg_spend),
    }))
  }, [historicalCategorySpend])

  // Filtered live entries for present month
  const filteredCurrentEntries = useMemo(() => {
    return currentEntries.filter((entry) => {
      if (liveTypeFilter !== 'all' && entry.entry_type !== liveTypeFilter) return false
      if (liveCategoryFilter !== 'all' && entry.category !== liveCategoryFilter) return false
      if (liveSearchQuery.trim()) {
        const query = liveSearchQuery.toLowerCase()
        const matchCat = entry.category.toLowerCase().includes(query)
        const matchSrc = (entry.source ?? '').toLowerCase().includes(query)
        const matchNotes = (entry.notes ?? '').toLowerCase().includes(query)
        if (!matchCat && !matchSrc && !matchNotes) return false
      }
      return true
    })
  }, [currentEntries, liveTypeFilter, liveCategoryFilter, liveSearchQuery])

  // Completed months list for historical explorer
  const completedMonthsList = useMemo(() => {
    const list = months.filter((m) => m < currentMonth)
    if (!list.includes(lastMonth)) list.push(lastMonth)
    return Array.from(new Set(list)).sort((a, b) => b.localeCompare(a))
  }, [months, currentMonth, lastMonth])

  const totalCompletedMonthsCount = useMemo(() => {
    const backendCount = analytics?.cashflow_analytics.months_count ?? 0
    return Math.max(completedMonthsList.length, backendCount, 1)
  }, [completedMonthsList, analytics])

  // Detailed category breakdown across completed history
  const categoryAnalyticsList = useMemo(() => {
    const backendAverages = analytics?.cashflow_analytics.average_expense_by_category ?? []
    const backendMap = new Map(backendAverages.map((item) => [item.category, item]))

    // Gather all historical expense entries grouped by category
    const entriesByCategory = new Map<string, CashflowEntry[]>()
    for (const entry of allHistoricalEntries) {
      if (entry.entry_type === 'expense') {
        const list = entriesByCategory.get(entry.category) ?? []
        list.push(entry)
        entriesByCategory.set(entry.category, list)
      }
    }

    // All distinct categories from backend analytics + entries
    const allCategoriesSet = new Set<string>()
    backendAverages.forEach((b) => allCategoriesSet.add(b.category))
    entriesByCategory.forEach((_, cat) => allCategoriesSet.add(cat))

    const totalHistoricalAvgExpense = historicalStats.avgExpense > 0
      ? historicalStats.avgExpense
      : Array.from(allCategoriesSet).reduce((sum, cat) => {
          const b = backendMap.get(cat)
          return sum + toNumber(b?.average_amount)
        }, 0)

    const list = Array.from(allCategoriesSet).map((category) => {
      const b = backendMap.get(category)
      const entries = entriesByCategory.get(category) ?? []

      // Calculate total amount spent
      const totalAmount = b
        ? toNumber(b.total_amount)
        : entries.reduce((sum, e) => sum + toNumber(e.amount), 0)

      // Calculate average monthly spend
      const averageAmount = b
        ? toNumber(b.average_amount)
        : totalCompletedMonthsCount > 0
        ? totalAmount / totalCompletedMonthsCount
        : 0

      // Calculate percentage of total average spend
      const percentageOfAvgSpend = totalHistoricalAvgExpense > 0
        ? (averageAmount / totalHistoricalAvgExpense) * 100
        : toNumber(b?.percentage_of_avg_spend)

      // Active months count
      const activeMonths = new Set(entries.map((e) => e.month))
      const monthsPresent = b?.months_present ?? activeMonths.size

      // Monthly spend mapping for completed months
      const monthlySpendMap = new Map<string, number>()
      for (const entry of entries) {
        const prev = monthlySpendMap.get(entry.month) ?? 0
        monthlySpendMap.set(entry.month, prev + toNumber(entry.amount))
      }

      // Min, Max, Peak Month across months where spend occurred
      const monthAmounts = Array.from(monthlySpendMap.entries()).filter(([, val]) => val > 0)
      let minSpend = monthAmounts.length > 0 ? Math.min(...monthAmounts.map(([, val]) => val)) : 0
      let maxSpend = monthAmounts.length > 0 ? Math.max(...monthAmounts.map(([, val]) => val)) : 0
      let peakMonth = ''
      if (monthAmounts.length > 0) {
        const peakEntry = monthAmounts.reduce((prev, curr) => (curr[1] > prev[1] ? curr : prev), monthAmounts[0])
        peakMonth = peakEntry[0]
      }

      // Fallbacks if only aggregate backend data exists
      if (minSpend === 0 && averageAmount > 0) minSpend = averageAmount
      if (maxSpend === 0 && averageAmount > 0) maxSpend = averageAmount

      // Frequency percentage: how often this expense appears across completed months
      const frequencyPct = Math.min(100, Math.round((monthsPresent / totalCompletedMonthsCount) * 100))

      // Spend in the most recent completed month
      const lastMonthSpend = monthlySpendMap.get(lastMonth) ?? 0

      // Trend vs Average
      let trendType: 'higher' | 'lower' | 'steady' = 'steady'
      let trendPct = 0
      if (lastMonthSpend > 0 && averageAmount > 0) {
        const diff = lastMonthSpend - averageAmount
        const pct = Math.abs((diff / averageAmount) * 100)
        if (pct >= 5) {
          trendType = diff > 0 ? 'higher' : 'lower'
          trendPct = Math.round(pct)
        }
      }

      // Recent notes / merchants preview
      const recentDescriptions = Array.from(
        new Set(
          entries
            .map((e) => (e.notes || e.source || '').trim())
            .filter(Boolean)
        )
      ).slice(0, 3)

      // Trend history (last up to 6 completed months chronologically)
      const recentMonthsOrder = [...completedMonthsList].reverse().slice(-6)
      const trendHistory = recentMonthsOrder.map((m) => ({
        month: formatMonthShort(m),
        amount: monthlySpendMap.get(m) ?? 0,
      }))

      const classification = getCategoryClassification(category)
      const IconComponent = getCategoryIcon(category)

      return {
        category,
        averageAmount,
        totalAmount,
        percentageOfAvgSpend,
        monthsPresent,
        frequencyPct,
        minSpend,
        maxSpend,
        peakMonth,
        lastMonthSpend,
        trendType,
        trendPct,
        recentDescriptions,
        trendHistory,
        classification,
        IconComponent,
        entriesCount: entries.length,
      }
    })

    return list
  }, [
    analytics,
    allHistoricalEntries,
    historicalStats.avgExpense,
    totalCompletedMonthsCount,
    completedMonthsList,
    lastMonth,
  ])

  // Filtered and sorted category list
  const filteredCategoryAnalytics = useMemo(() => {
    let result = categoryAnalyticsList.filter((item) => {
      // Group filter
      if (avgGroupFilter === 'recurring' && item.frequencyPct < 80) return false
      if (avgGroupFilter !== 'all' && avgGroupFilter !== 'recurring' && item.classification.group !== avgGroupFilter) return false

      // Search query
      if (avgSearchQuery.trim()) {
        const q = avgSearchQuery.toLowerCase()
        const matchName = item.category.toLowerCase().includes(q)
        const matchDesc = item.recentDescriptions.some((d) => d.toLowerCase().includes(q))
        if (!matchName && !matchDesc) return false
      }
      return true
    })

    // Sort
    result.sort((a, b) => {
      if (avgSortBy === 'spend_desc') return b.averageAmount - a.averageAmount
      if (avgSortBy === 'spend_asc') return a.averageAmount - b.averageAmount
      if (avgSortBy === 'pct_desc') return b.percentageOfAvgSpend - a.percentageOfAvgSpend
      if (avgSortBy === 'frequency_desc') return b.frequencyPct - a.frequencyPct
      if (avgSortBy === 'name_asc') return a.category.localeCompare(b.category)
      return 0
    })

    return result
  }, [categoryAnalyticsList, avgGroupFilter, avgSearchQuery, avgSortBy])

  // Summary Metrics derived from categoryAnalyticsList
  const totalAvgExpense = historicalStats.avgExpense > 0
    ? historicalStats.avgExpense
    : categoryAnalyticsList.reduce((acc, c) => acc + c.averageAmount, 0)

  const topCategory = useMemo(() => {
    if (categoryAnalyticsList.length === 0) return null
    return [...categoryAnalyticsList].sort((a, b) => b.averageAmount - a.averageAmount)[0]
  }, [categoryAnalyticsList])

  const coreRecurringCategories = useMemo(() => {
    return categoryAnalyticsList.filter((c) => c.frequencyPct >= 80)
  }, [categoryAnalyticsList])

  const coreRecurringSpend = useMemo(() => {
    return coreRecurringCategories.reduce((sum, c) => sum + c.averageAmount, 0)
  }, [coreRecurringCategories])

  const coreRecurringPct = totalAvgExpense > 0 ? (coreRecurringSpend / totalAvgExpense) * 100 : 0
  const discretionarySpend = Math.max(0, totalAvgExpense - coreRecurringSpend)
  const discretionaryPct = Math.max(0, 100 - coreRecurringPct)

  const groupTotals = useMemo(() => {
    const totals: Record<string, number> = {
      essentials: 0,
      health: 0,
      lifestyle: 0,
      transit: 0,
      other: 0,
    }
    for (const item of categoryAnalyticsList) {
      const g = item.classification.group
      totals[g] = (totals[g] ?? 0) + item.averageAmount
    }
    return totals
  }, [categoryAnalyticsList])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function refreshData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowMonths }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowEntries(currentMonth) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowSummary(currentMonth) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowSummary(lastMonth) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.cashflowEntries() }),
      queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSummary }),
      queryClient.invalidateQueries({ queryKey: queryKeys.analyticsSummary }),
    ])
  }

  function resetForm(month = currentMonth) {
    setForm(defaultForm(month))
    setFormErrors({})
    setFormErrorMessage(null)
    setEditingId(null)
  }

  function openCreateForCategory(cat: string, type: EntryType = 'expense') {
    setEditingId(null)
    setForm({
      month: currentMonth,
      entry_type: type,
      category: cat,
      source: '',
      amount: '',
      notes: '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function openEdit(entry: CashflowEntry) {
    setEditingId(entry.id)
    setForm({
      month: entry.month,
      entry_type: entry.entry_type,
      category: entry.category,
      source: entry.source ?? '',
      amount: String(entry.amount ?? ''),
      notes: entry.notes ?? '',
    })
    setFormErrors({})
    setFormErrorMessage(null)
    setIsModalOpen(true)
  }

  function validateForm(current: CashflowFormState) {
    const nextErrors: FormErrors = {}
    if (!/^\d{4}-\d{2}$/.test(current.month)) nextErrors.month = 'Use YYYY-MM'
    if (!current.category.trim()) nextErrors.category = 'Category is required'
    if (!current.amount.trim() || Number.isNaN(Number(current.amount))) {
      nextErrors.amount = 'Valid amount is required'
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
        await createCashflowEntry(payload)
        setStatusTone('emerald')
        setStatusMessage(`Logged ₹${payload.amount} in ${payload.category}.`)
      } else {
        await updateCashflowEntry(editingId, payload)
        setStatusTone('emerald')
        setStatusMessage(`Updated ${payload.category} entry.`)
      }

      setIsModalOpen(false)
      await refreshData()
      resetForm(currentMonth)
    } catch (error) {
      setFormErrorMessage(formatApiError(error))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(entry: CashflowEntry) {
    if (!window.confirm(`Delete ${entry.category} entry of ₹${entry.amount}?`)) return
    try {
      await deleteCashflowEntry(entry.id)
      setStatusTone('amber')
      setStatusMessage(`Removed ${entry.category} entry.`)
      await refreshData()
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  // ── Home Contributions Actions ──────────────────────────────────────────────
  const homeContributionsTotal = homeContributions.reduce((t, item) => t + toNumber(item.amount), 0)

  async function addHomeContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!homeContributionForm.amount || !homeContributionForm.contribution_date || !homeContributionForm.reason.trim()) return
    setIsHomeContributionSaving(true)
    try {
      await createHomeContribution({
        amount: homeContributionForm.amount,
        contribution_date: homeContributionForm.contribution_date,
        reason: homeContributionForm.reason.trim(),
        purpose: homeContributionForm.purpose.trim() || 'General',
        notes: homeContributionForm.notes.trim() || null,
      })
      setHomeContributionForm({ amount: '', contribution_date: new Date().toISOString().slice(0, 10), reason: '', purpose: '', notes: '' })
      await queryClient.invalidateQueries({ queryKey: ['homeContributions'] })
      setStatusTone('emerald')
      setStatusMessage('Home contribution recorded.')
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    } finally {
      setIsHomeContributionSaving(false)
    }
  }

  async function removeHomeContribution(item: HomeContribution) {
    if (!window.confirm(`Delete home contribution of ₹${item.amount}?`)) return
    try {
      await deleteHomeContribution(item.id)
      await queryClient.invalidateQueries({ queryKey: ['homeContributions'] })
      setStatusTone('amber')
      setStatusMessage('Home contribution removed.')
    } catch (error) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(error))
    }
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden space-y-6 pb-12">
      {/* ── Status Feedback Banner ────────────────────────────────────── */}
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
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
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
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <ArrowLeftRight className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                Transactions & Cashflow Hub
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live Month: {formatMonthLabel(currentMonth)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <BarChart3 className="h-3 w-3 text-slate-400" />
                {historicalStats.monthsCount} Prior Months Analyzed
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
              Live entry tracking for {formatMonthLabel(currentMonth)} combined with multi-month cashflow intelligence up through last month.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            {/* View switcher tabs */}
            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setActiveView('transactions')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5',
                  activeView === 'transactions'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Transactions & Analytics</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('emi')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5',
                  activeView === 'emi'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                <span>EMI Tracker</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('home')}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5',
                  activeView === 'home'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
                ].join(' ')}
              >
                <span>Home Contributions</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void refreshData()}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition shadow-sm"
              title="Refresh transaction data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {activeView === 'transactions' ? (
              <button
                type="button"
                onClick={() => {
                  resetForm(currentMonth)
                  setIsModalOpen(true)
                }}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 px-3.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Entry</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 1: TRANSACTIONS & CASHFLOW HUB ───────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeView === 'transactions' && (
        <>
          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 1: PRESENT MONTH LIVE IN-PROGRESS HUB                 */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase tracking-wider">
                  Active Month in Progress · {formatMonthLabel(currentMonth)}
                </h2>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Log entries as they happen · Compare against past benchmarks
              </span>
            </div>

            {/* 4 Live Running Bento KPI Cards for Present Month */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* Card 1: Present Outflow / Spending */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-rose-500/30 transition-all`}>
                <div className="flex items-center justify-between">
                  <span className={LABEL_TEXT}>Present Month Spend</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-mono text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    <PrivateValue value={formatINR(presentExpense)} mask="••••••••" hideColor />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{currentSummary?.expense_count ?? 0} expense entries</span>
                    {lastMonthExpense > 0 ? (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {privacyMode ? '••%' : `${spendPacingPct.toFixed(0)}% of last month`}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${Math.min(Math.max(spendPacingPct, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Card 2: Present Inflow / Income */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all`}>
                <div className="flex items-center justify-between">
                  <span className={LABEL_TEXT}>Present Month Income</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="font-mono text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    <PrivateValue value={formatINR(presentIncome)} mask="••••••••" hideColor />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{currentSummary?.income_count ?? 0} income entries</span>
                    <span>Last Mo: {formatINRShort(lastMonthIncome)}</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.min(presentIncome > 0 ? (presentExpense / presentIncome) * 100 : 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Card 3: Running Net Savings */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-teal-500/30 transition-all`}>
                <div className="flex items-center justify-between">
                  <span className={LABEL_TEXT}>Running Surplus / Saved</span>
                  <div className="grid h-8 w-8 place-items-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-500">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className={['font-mono text-2xl font-bold tracking-tight', privacyMode ? 'text-slate-400' : presentNetSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'].join(' ')}>
                    <PrivateValue value={formatINR(presentNetSavings)} mask="••••••••" hideColor />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Inflow minus spend</span>
                    <span className={['font-semibold', presentSavingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'].join(' ')}>
                      {privacyMode ? '••%' : formatPct(presentSavingsRate)} saved
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={['h-full rounded-full transition-all duration-500', presentNetSavings >= 0 ? 'bg-teal-500' : 'bg-rose-500'].join(' ')}
                    style={{ width: `${Math.min(Math.max(presentSavingsRate, 0), 100)}%` }}
                  />
                </div>
              </div>

              {/* Card 4: Burn Rate vs Last Month Benchmark */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
                <div className="flex items-center justify-between">
                  <span className={LABEL_TEXT}>Burn Pace vs Last Month</span>
                  <span className={['inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold', spendPacingPct <= 75 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'].join(' ')}>
                    {spendPacingPct <= 100 ? 'Within Baseline' : 'Exceeded Last Mo'}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {privacyMode ? '••••' : `${spendPacingPct.toFixed(1)}%`}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Last Mo Spend: <PrivateValue value={formatINRShort(lastMonthExpense)} mask="•••" hideColor /></span>
                    <span className="font-medium">
                      {historicalStats.avgExpense > 0 ? `Avg: ${formatINRShort(historicalStats.avgExpense)}` : ''}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.min(spendPacingPct, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick-Add Chips Strip */}
            <div className={`${CARD_SHELL} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Sparkles className="h-4 w-4 text-teal-500" />
                <span>Quick Log for {formatMonthLabel(currentMonth)}:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { label: '+ Grocery', cat: 'Grocery', type: 'expense' as const },
                  { label: '+ Food & Dining', cat: 'Food', type: 'expense' as const },
                  { label: '+ Rent', cat: 'House Rent', type: 'expense' as const },
                  { label: '+ Bike & Fuel', cat: 'Bike', type: 'expense' as const },
                  { label: '+ Whey / Health', cat: 'Whey Protein', type: 'expense' as const },
                  { label: '+ Social Life', cat: 'Social Life', type: 'expense' as const },
                  { label: '+ Salary', cat: 'Salary', type: 'income' as const },
                ].map((item) => (
                  <button
                    key={item.cat}
                    type="button"
                    onClick={() => openCreateForCategory(item.cat, item.type)}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:border-teal-500/30 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 transition active:scale-95"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Present Month Itemized Entries Ledger */}
            <div className={`${CARD_SHELL} p-4 sm:p-5 space-y-4`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-teal-500" />
                    {formatMonthLabel(currentMonth)} Transactions Ledger
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Live recorded entries in the current active billing cycle ({currentEntries.length} total).
                  </p>
                </div>

                {/* Filter and search controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={liveSearchQuery}
                      onChange={(e) => setLiveSearchQuery(e.target.value)}
                      placeholder="Search entries..."
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  {/* Type Filter */}
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 p-0.5">
                    {(['all', 'expense', 'income'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLiveTypeFilter(t)}
                        className={[
                          'rounded-md px-2 py-0.5 text-xs font-semibold capitalize transition',
                          liveTypeFilter === t
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400',
                        ].join(' ')}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      resetForm(currentMonth)
                      setIsModalOpen(true)
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 px-2.5 text-xs font-bold text-white shadow-sm transition active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New</span>
                  </button>
                </div>
              </div>

              {filteredCurrentEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
                  <Receipt className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {currentEntries.length === 0
                      ? `No transactions recorded for ${formatMonthLabel(currentMonth)} yet.`
                      : 'No transactions match your current filters.'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {currentEntries.length === 0
                      ? 'Use "+ Add Entry" or click any quick-add chip above to record your first transaction.'
                      : 'Try clearing your search query or switching filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-2.5 pl-4 pr-3">Category</th>
                        <th className="px-3 py-2.5">Source / Merchant</th>
                        <th className="px-3 py-2.5">Notes</th>
                        <th className="px-3 py-2.5 text-right">Amount</th>
                        <th className="py-2.5 pl-3 pr-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCurrentEntries.map((entry) => {
                        const isIncome = entry.entry_type === 'income'
                        return (
                          <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 pl-4 pr-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={[
                                    'grid h-7 w-7 shrink-0 place-items-center rounded-lg font-bold text-[10px]',
                                    isIncome ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500',
                                  ].join(' ')}
                                >
                                  {entry.category.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {entry.category}
                                </span>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              {entry.source || '—'}
                            </td>

                            <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[200px]">
                              {entry.notes || '—'}
                            </td>

                            <td className="px-3 py-3 text-right font-mono font-bold whitespace-nowrap">
                              <span className={isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {isIncome ? '+' : '-'}
                                <PrivateValue value={formatINR(toNumber(entry.amount))} mask="••••" hideColor />
                              </span>
                            </td>

                            <td className="py-3 pl-3 pr-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(entry)}
                                  className="rounded-md p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDelete(entry)}
                                  className="rounded-md p-1 text-slate-400 hover:text-rose-500 transition"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </section>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* SECTION 2: HISTORICAL DATA ANALYTICS (TILL LAST MONTH)        */}
          {/* ───────────────────────────────────────────────────────────── */}
          <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white uppercase tracking-wider">
                    Historical Analytics & Trends · Till Last Month ({formatMonthLabel(lastMonth)})
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aggregated cashflow performance and category spending patterns across all finalized prior periods.
                </p>
              </div>

              <span className="text-[11px] font-mono text-slate-400">
                {historicalStats.monthsCount} completed months tracked
              </span>
            </div>

            {/* 4 Historical Benchmark Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {/* Benchmark 1: Avg Monthly Income */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all`}>
                <span className={LABEL_TEXT}>Avg Monthly Inflow (Till Last Mo)</span>
                <div className="mt-3 font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  <PrivateValue value={formatINR(historicalStats.avgIncome)} mask="••••••••" hideColor />
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Historical baseline per month
                </div>
              </div>

              {/* Benchmark 2: Avg Monthly Outflow / Burn */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-rose-500/30 transition-all`}>
                <span className={LABEL_TEXT}>Avg Monthly Burn (Till Last Mo)</span>
                <div className="mt-3 font-mono text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  <PrivateValue value={formatINR(historicalStats.avgExpense)} mask="••••••••" hideColor />
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Average outgoings per month
                </div>
              </div>

              {/* Benchmark 3: Avg Net Savings */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-teal-500/30 transition-all`}>
                <span className={LABEL_TEXT}>Avg Net Saved (Till Last Mo)</span>
                <div className={['mt-3 font-mono text-2xl font-bold tracking-tight', privacyMode ? 'text-slate-400' : historicalStats.avgNetSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'].join(' ')}>
                  <PrivateValue value={formatINR(historicalStats.avgNetSavings)} mask="••••••••" hideColor />
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Average monthly surplus retained
                </div>
              </div>

              {/* Benchmark 4: Avg Historical Savings Rate */}
              <div className={`${CARD_SHELL} p-5 relative overflow-hidden group hover:border-indigo-500/30 transition-all`}>
                <div className="flex items-center justify-between">
                  <span className={LABEL_TEXT}>Historical Savings Discipline</span>
                  <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {historicalStats.avgSavingsRate >= 50 ? 'Elite' : historicalStats.avgSavingsRate >= 30 ? 'Strong' : 'Moderate'}
                  </span>
                </div>
                <div className="mt-3 font-mono text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                  {privacyMode ? '••%' : formatPct(historicalStats.avgSavingsRate)}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Total saved: <PrivateValue value={formatINRShort(historicalStats.totalAccumulated)} mask="••••" hideColor />
                </div>
              </div>
            </div>

            {/* Deep Analytics Visual Panels (Multi-month Bar Chart & Category Donut) */}
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              {/* Left Panel: Multi-Month Cashflow Trajectory */}
              <div className={`${CARD_SHELL} p-5 xl:col-span-7 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-teal-500" />
                        Multi-Month Cashflow Trend (Till Last Month)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Historical income vs. spend vs. net savings for all completed cycles.
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded bg-teal-400" />
                        <span className="text-slate-600 dark:text-slate-300">Income</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded bg-rose-400" />
                        <span className="text-slate-600 dark:text-slate-300">Spend</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    {historicalMonthlyTrend.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        Add past months data to view multi-month trajectory.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={historicalMonthlyTrend.map((item) => ({
                            label: formatMonthShort(item.month),
                            income: toNumber(item.income),
                            expense: toNumber(item.expense),
                            savings: toNumber(item.net_savings),
                          }))}
                          margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
                          barGap={4}
                        >
                          <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            width={65}
                            tickFormatter={(v: number) => (privacyMode ? '•••' : formatINRShort(v))}
                            tick={{ fill: '#64748b', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            formatter={(value) =>
                              privacyMode
                                ? '••••'
                                : formatINR(toNumber(Array.isArray(value) ? value[0] : value))
                            }
                            contentStyle={{
                              background: '#0f172a',
                              border: '1px solid #334155',
                              borderRadius: '12px',
                              fontSize: '12px',
                            }}
                          />
                          <Bar dataKey="income" name="Income" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="expense" name="Spend" fill="#fb7185" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Strictly completed months up to {formatMonthLabel(lastMonth)}</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">Verified Cashflow History</span>
                </div>
              </div>

              {/* Right Panel: Where Money Went Historically */}
              <div className={`${CARD_SHELL} p-5 xl:col-span-5 flex flex-col justify-between`}>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <PieIcon className="h-4 w-4 text-rose-500" />
                        Where Money Went (Historical Categories)
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Top expense categories across completed cycles.
                      </p>
                    </div>
                  </div>

                  {historicalCategorySpend.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No category spend data available.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historicalCategorySpend.slice(0, 5).map((item, index) => {
                        const pct = toNumber(item.percentage_of_avg_spend)
                        const color = chartColors[index % chartColors.length]
                        return (
                          <div key={item.category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[130px] sm:max-w-[180px]">
                                  {item.category}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-slate-600 dark:text-slate-300">
                                  <PrivateValue value={formatINRShort(toNumber(item.average_amount))} mask="•••" hideColor />
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  ({pct.toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Based on average spending trends</span>
                  <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                    Top {historicalCategorySpend.length} expense buckets
                  </span>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* CATEGORY AVERAGE SPENDS & ANALYTICS INTELLIGENCE DECK           */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className={`${CARD_SHELL} p-5 space-y-6`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      Historical Average Spends & Category Intelligence
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Aggregated baseline expenditures across all {totalCompletedMonthsCount} finalized prior periods (no month picking required) — showing average monthly burn, recurring consistency, and budget share.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Clock className="h-3.5 w-3.5 text-indigo-500" />
                    Through {formatMonthLabel(lastMonth)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void refreshData()}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    title="Refresh data"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 4 Top Executive Analytics Strip */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_TEXT}>Baseline Monthly Burn</span>
                    <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    <PrivateValue value={formatINR(totalAvgExpense)} mask="••••••••" hideColor />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Average monthly outgoings
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_TEXT}>Top Expense Anchor</span>
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400 truncate">
                    <PrivateValue value={formatINR(topCategory?.averageAmount ?? 0)} mask="••••••••" hideColor />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {topCategory?.category ?? '—'} ({(topCategory?.percentageOfAvgSpend ?? 0).toFixed(1)}% of burn)
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_TEXT}>Core Fixed Commitments</span>
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      ≥80% Recurring
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    <PrivateValue value={formatINR(coreRecurringSpend)} mask="••••••••" hideColor />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {coreRecurringPct.toFixed(0)}% predictable baseline ({coreRecurringCategories.length} categories)
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className={LABEL_TEXT}>Discretionary & Variable</span>
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Flexible Buffer
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-xl sm:text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    <PrivateValue value={formatINR(discretionarySpend)} mask="••••••••" hideColor />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {discretionaryPct.toFixed(0)}% variable / non-mandatory spends
                  </p>
                </div>
              </div>

              {/* Group Outflow Architecture Strip */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-indigo-500" />
                    Expenditure Architecture by Category Group
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 font-normal">
                    Monthly average allocation across {categoryAnalyticsList.length} categories
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {/* Essentials */}
                  <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-white dark:bg-slate-900 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      <span>Essentials & Home</span>
                      <span>{totalAvgExpense > 0 ? ((groupTotals.essentials / totalAvgExpense) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatINR(groupTotals.essentials)} mask="••••••" hideColor />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(totalAvgExpense > 0 ? (groupTotals.essentials / totalAvgExpense) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Health & Fitness */}
                  <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-slate-900 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Health & Fitness</span>
                      <span>{totalAvgExpense > 0 ? ((groupTotals.health / totalAvgExpense) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatINR(groupTotals.health)} mask="••••••" hideColor />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(totalAvgExpense > 0 ? (groupTotals.health / totalAvgExpense) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Lifestyle & Leisure */}
                  <div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-white dark:bg-slate-900 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                      <span>Lifestyle & Leisure</span>
                      <span>{totalAvgExpense > 0 ? ((groupTotals.lifestyle / totalAvgExpense) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatINR(groupTotals.lifestyle)} mask="••••••" hideColor />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min(totalAvgExpense > 0 ? (groupTotals.lifestyle / totalAvgExpense) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Transit & Commute */}
                  <div className="rounded-xl border border-cyan-100 dark:border-cyan-900/40 bg-white dark:bg-slate-900 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold">
                      <span>Transit & Commute</span>
                      <span>{totalAvgExpense > 0 ? ((groupTotals.transit / totalAvgExpense) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatINR(groupTotals.transit)} mask="••••••" hideColor />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${Math.min(totalAvgExpense > 0 ? (groupTotals.transit / totalAvgExpense) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Personal & Other */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                      <span>Personal & Other</span>
                      <span>{totalAvgExpense > 0 ? ((groupTotals.other / totalAvgExpense) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      <PrivateValue value={formatINR(groupTotals.other)} mask="••••••" hideColor />
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-slate-400 rounded-full"
                        style={{ width: `${Math.min(totalAvgExpense > 0 ? (groupTotals.other / totalAvgExpense) * 100 : 0, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Controls: Search, Filters, and Sorting */}
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pt-2">
                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('all')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'all'
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    All Categories ({categoryAnalyticsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('recurring')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'recurring'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Core Fixed (≥80%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('essentials')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'essentials'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Essentials
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('health')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'health'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Health & Fitness
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('lifestyle')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'lifestyle'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Lifestyle
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvgGroupFilter('transit')}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      avgGroupFilter === 'transit'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    Transit
                  </button>
                </div>

                {/* Search & Sort */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search category or note..."
                      value={avgSearchQuery}
                      onChange={(e) => setAvgSearchQuery(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                    />
                    {avgSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAvgSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    <select
                      value={avgSortBy}
                      onChange={(e) => setAvgSortBy(e.target.value as any)}
                      className="h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-900 dark:text-slate-100 shadow-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="spend_desc">Highest Spend First</option>
                      <option value="spend_asc">Lowest Spend First</option>
                      <option value="pct_desc">Largest Budget Share</option>
                      <option value="frequency_desc">Most Consistent First</option>
                      <option value="name_asc">Name (A-Z)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Category Average Spends Table */}
              {filteredCategoryAnalytics.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  No categories match your filter criteria.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/60 font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 pl-4 pr-3">Category</th>
                        <th className="px-3 py-3 text-right">Avg Monthly Spend</th>
                        <th className="px-3 py-3">Budget Share</th>
                        <th className="px-3 py-3">Frequency</th>
                        <th className="px-3 py-3">Historical Range</th>
                        <th className="px-3 py-3 text-right">Total Spent</th>
                        <th className="py-3 pl-2 pr-4 text-center">Drilldown</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {filteredCategoryAnalytics.map((item) => {
                        const Icon = item.IconComponent
                        const isExpanded = expandedCategory === item.category
                        const pct = Math.max(0, item.percentageOfAvgSpend)

                        return (
                          <React.Fragment key={item.category}>
                            <tr
                              onClick={() => setExpandedCategory(isExpanded ? null : item.category)}
                              className={`cursor-pointer transition-colors ${
                                isExpanded
                                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Category Name & Tag */}
                              <td className="py-3 pl-4 pr-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {item.category}
                                    </div>
                                    <span
                                      className={`inline-block text-[10px] font-semibold uppercase tracking-wider rounded-md px-1.5 py-0.2 mt-0.5 ${
                                        item.classification.group === 'essentials'
                                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                                          : item.classification.group === 'health'
                                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                          : item.classification.group === 'lifestyle'
                                          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                          : item.classification.group === 'transit'
                                          ? 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {item.classification.label}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Average Monthly Spend */}
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
                                  <PrivateValue value={formatINR(item.averageAmount)} mask="••••••" hideColor />
                                </div>
                                <div className="text-[10px] text-slate-400">/ month baseline</div>
                              </td>

                              {/* Budget Share */}
                              <td className="px-3 py-3 whitespace-nowrap min-w-[120px]">
                                <div className="flex items-center justify-between text-xs font-mono font-medium mb-1 text-slate-700 dark:text-slate-300">
                                  <span>{pct.toFixed(1)}%</span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.classification.group === 'essentials'
                                        ? 'bg-indigo-500'
                                        : item.classification.group === 'health'
                                        ? 'bg-emerald-500'
                                        : item.classification.group === 'lifestyle'
                                        ? 'bg-purple-500'
                                        : item.classification.group === 'transit'
                                        ? 'bg-cyan-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                              </td>

                              {/* Consistency & Frequency */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      item.frequencyPct >= 80
                                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                        : item.frequencyPct >= 40
                                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {item.frequencyPct >= 80
                                      ? 'Core Fixed (100%)'
                                      : item.frequencyPct >= 40
                                      ? `Regular (${item.frequencyPct}%)`
                                      : `Ad-hoc (${item.frequencyPct}%)`}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Active {item.monthsPresent} of {totalCompletedMonthsCount} months
                                </div>
                              </td>

                              {/* Historical Range */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="font-mono text-xs text-slate-700 dark:text-slate-300">
                                  <PrivateValue value={formatINRShort(item.minSpend)} mask="•••" hideColor /> –{' '}
                                  <PrivateValue value={formatINRShort(item.maxSpend)} mask="•••" hideColor />
                                </div>
                                {item.peakMonth && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Peak: {formatMonthShort(item.peakMonth)}
                                  </div>
                                )}
                              </td>

                              {/* Total Spent */}
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                                  <PrivateValue value={formatINR(item.totalAmount)} mask="••••••" hideColor />
                                </div>
                                <div className="text-[10px] text-slate-400">across cycles</div>
                              </td>

                              {/* Expand Action */}
                              <td className="py-3 pl-2 pr-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedCategory(isExpanded ? null : item.category)
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded Category Deep-Dive Drawer */}
                            {isExpanded && (
                              <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                                <td colSpan={7} className="p-4 sm:p-5">
                                  <div className="space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                                          <Icon className="h-3.5 w-3.5" />
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                          {item.category} · Spending Analytics & Trend
                                        </h4>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => openCreateForCategory(item.category, 'expense')}
                                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition self-start sm:self-auto"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Log {item.category} in Present Month ({formatMonthLabel(currentMonth)})
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                      {/* Mini Trajectory Chart (Last 6 completed months) */}
                                      <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Recent Monthly Spending Trajectory
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-400">
                                            Last {item.trendHistory.length} completed cycles
                                          </span>
                                        </div>

                                        <div className="h-36 w-full pt-2">
                                          {item.trendHistory.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-xs text-slate-400">
                                              No historical trend available.
                                            </div>
                                          ) : (
                                            <ResponsiveContainer width="100%" height="100%">
                                              <BarChart data={item.trendHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                                                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                                                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                                                <YAxis
                                                  width={55}
                                                  tickFormatter={(v: number) => (privacyMode ? '••' : formatINRShort(v))}
                                                  tick={{ fill: '#64748b', fontSize: 10 }}
                                                  tickLine={false}
                                                  axisLine={false}
                                                />
                                                <Tooltip
                                                  formatter={(value) =>
                                                    privacyMode
                                                      ? '••••'
                                                      : formatINR(toNumber(Array.isArray(value) ? value[0] : value))
                                                  }
                                                  contentStyle={{
                                                    background: '#0f172a',
                                                    border: '1px solid #334155',
                                                    borderRadius: '8px',
                                                    fontSize: '11px',
                                                  }}
                                                />
                                                <Bar dataKey="amount" name="Spend" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                              </BarChart>
                                            </ResponsiveContainer>
                                          )}
                                        </div>
                                      </div>

                                      {/* Key Stats & Recent Notes */}
                                      <div className="lg:col-span-5 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                            <div className="text-[10px] font-semibold uppercase text-slate-400">Avg / Active Cycle</div>
                                            <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-1">
                                              <PrivateValue
                                                value={formatINR(
                                                  item.monthsPresent > 0 ? item.totalAmount / item.monthsPresent : item.averageAmount
                                                )}
                                                mask="••••••"
                                                hideColor
                                              />
                                            </div>
                                          </div>

                                          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                                            <div className="text-[10px] font-semibold uppercase text-slate-400">Last Mo Spend</div>
                                            <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-1">
                                              <PrivateValue value={formatINR(item.lastMonthSpend)} mask="••••••" hideColor />
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                              {item.trendType === 'higher' ? (
                                                <span className="text-rose-500 font-semibold">+{item.trendPct}% vs avg</span>
                                              ) : item.trendType === 'lower' ? (
                                                <span className="text-emerald-500 font-semibold">-{item.trendPct}% vs avg</span>
                                              ) : (
                                                <span className="text-slate-400">Steady vs avg</span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Recent Merchant / Notes Preview */}
                                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1.5">
                                          <div className="text-[10px] font-semibold uppercase text-slate-400">
                                            Recent Merchants / Descriptions Tracked
                                          </div>
                                          {item.recentDescriptions.length === 0 ? (
                                            <div className="text-xs text-slate-400">Standard expense entries.</div>
                                          ) : (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                              {item.recentDescriptions.map((desc) => (
                                                <span
                                                  key={desc}
                                                  className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300"
                                                >
                                                  {desc}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 2: EMI TRACKER (PRESERVED FULL FUNCTIONALITY) ────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeView === 'emi' && (
        <div className={`${CARD_SHELL} p-5 space-y-5`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="h-5 w-5 text-indigo-500" />
                EMI Plans & Goal-Linked Payment Schedules
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Track long-term EMIs, processing fees, GST breakdown, and amortization milestones.
              </p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">
              {goals.filter((g) => g.is_emi).length} Active EMI Goals
            </span>
          </div>

          {/* Goal EMI list */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {goals
              .filter((g) => g.is_emi)
              .map((goal) => {
                const target = toNumber(goal.target_amount)
                const paid = toNumber(goal.resolved_current_amount ?? goal.current_amount)
                const remaining = Math.max(target - paid, 0)
                const progressPct = target > 0 ? Math.min((paid / target) * 100, 100) : 0

                return (
                  <div
                    key={goal.id}
                    onClick={() => {
                      setSelectedEMIGoalId(goal.id)
                      setCustomPlannedEmiAmount(goal.emi_monthly_amount == null ? '' : String(goal.emi_monthly_amount))
                      setCustomPlannedEmiMonths(goal.emi_total_months == null ? '' : String(goal.emi_total_months))
                      setIsEMIPlanSaved(goal.emi_monthly_amount != null && goal.emi_total_months != null)
                      setEmiPaymentRows(createEMIRows(goal.emi_total_months ?? goal.months_remaining ?? 1))
                    }}
                    className="cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 transition hover:border-indigo-500/50 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {goal.name}
                      </h4>
                      <span className="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded">
                        {progressPct.toFixed(0)}%
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${progressPct}%` }} />
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>Paid: <PrivateValue value={formatINRShort(paid)} mask="•••" hideColor /></span>
                      <span>Rem: <PrivateValue value={formatINRShort(remaining)} mask="•••" hideColor /></span>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* ── VIEW 3: HOME CONTRIBUTIONS (PRESERVED FULL FUNCTIONALITY) ─────── */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeView === 'home' && (
        <div className={`${CARD_SHELL} p-5 space-y-5`}>
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="h-5 w-5 text-teal-500" />
                Home Contributions & Family Support Ledger
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Global record of money transferred home for support, rent, or utilities separate from monthly cashflow.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Total Given</div>
              <div className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                <PrivateValue value={formatINRShort(homeContributionsTotal)} mask="••••" hideColor />
              </div>
            </div>
          </div>

          {/* Add contribution form */}
          <form onSubmit={addHomeContribution} className="grid gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 sm:grid-cols-2 xl:grid-cols-5">
            <FormField label="Amount (₹)">
              <input
                type="number"
                min="1"
                step="any"
                required
                value={homeContributionForm.amount}
                onChange={(e) => setHomeContributionForm((c) => ({ ...c, amount: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100 font-mono"
              />
            </FormField>

            <FormField label="Date">
              <input
                type="date"
                required
                value={homeContributionForm.contribution_date}
                onChange={(e) => setHomeContributionForm((c) => ({ ...c, contribution_date: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Reason">
              <input
                required
                placeholder="Monthly support"
                value={homeContributionForm.reason}
                onChange={(e) => setHomeContributionForm((c) => ({ ...c, reason: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Purpose / For What">
              <input
                placeholder="Groceries, medicine, etc."
                value={homeContributionForm.purpose}
                onChange={(e) => setHomeContributionForm((c) => ({ ...c, purpose: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isHomeContributionSaving}
                className="h-10 w-full rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
              >
                {isHomeContributionSaving ? 'Saving…' : 'Add Contribution'}
              </button>
            </div>
          </form>

          {/* History list */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="py-2.5 pl-4 pr-3">Reason</th>
                  <th className="px-3 py-2.5">Purpose</th>
                  <th className="px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="py-2.5 pl-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {homeContributions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-4 pr-3 font-semibold text-slate-900 dark:text-white">
                      {item.reason}
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      {item.purpose || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {item.contribution_date}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      <PrivateValue value={formatINR(toNumber(item.amount))} mask="••••" hideColor />
                    </td>
                    <td className="py-3 pl-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => void removeHomeContribution(item)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add & Edit Transaction Drawer / Modal ───────────────────────── */}
      <div className="md:hidden">
        <BottomSheet
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingId === null ? 'Add Transaction Entry' : 'Edit Transaction Entry'}
          subtitle="Record cashflow activity"
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
                form="cashflow-entry-form"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white shadow-sm disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save Entry'}
              </button>
            </div>
          }
        >
          <form id="cashflow-entry-form" onSubmit={handleSubmit} className="space-y-4">
            {formErrorMessage ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10 p-3 text-xs text-rose-700 whitespace-pre-wrap">
                {formErrorMessage}
              </div>
            ) : null}

            <FormField label="Month" error={formErrors.month}>
              <input
                type="month"
                value={form.month}
                onChange={(e) => setForm((c) => ({ ...c, month: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Entry Type" error={formErrors.entry_type}>
              <select
                value={form.entry_type}
                onChange={(e) => {
                  const t = e.target.value as EntryType
                  setForm((c) => ({ ...c, entry_type: t, category: getCategories(t)[0] }))
                }}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="expense">Expense (Outflow)</option>
                <option value="income">Income (Inflow)</option>
              </select>
            </FormField>

            <FormField label="Category" error={formErrors.category}>
              <select
                value={form.category}
                onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              >
                {getCategories(form.entry_type).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Amount (₹)" error={formErrors.amount}>
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                placeholder="2500"
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono text-sm text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Source / Merchant" error={formErrors.source}>
              <input
                value={form.source}
                onChange={(e) => setForm((c) => ({ ...c, source: e.target.value }))}
                placeholder="Swiggy, Zepto, Salary, etc."
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100"
              />
            </FormField>

            <FormField label="Notes (Optional)" error={formErrors.notes}>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
                placeholder="Optional details"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 resize-none"
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
                  {editingId === null ? 'Add Transaction Entry' : 'Edit Transaction Entry'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Record monthly cashflow activity
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

                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Month" error={formErrors.month}>
                    <input
                      type="month"
                      value={form.month}
                      onChange={(e) => setForm((c) => ({ ...c, month: e.target.value }))}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                    />
                  </FormField>

                  <FormField label="Entry Type" error={formErrors.entry_type}>
                    <select
                      value={form.entry_type}
                      onChange={(e) => {
                        const t = e.target.value as EntryType
                        setForm((c) => ({ ...c, entry_type: t, category: getCategories(t)[0] }))
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="expense">Expense (Outflow)</option>
                      <option value="income">Income (Inflow)</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Category" error={formErrors.category}>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                  >
                    {getCategories(form.entry_type).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Amount (₹)" error={formErrors.amount}>
                  <input
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))}
                    placeholder="2500"
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                  />
                </FormField>

                <FormField label="Source / Merchant" error={formErrors.source}>
                  <input
                    value={form.source}
                    onChange={(e) => setForm((c) => ({ ...c, source: e.target.value }))}
                    placeholder="Swiggy, Zepto, Salary, HDFC, etc."
                    className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:border-teal-500 focus:outline-none"
                  />
                </FormField>

                <FormField label="Notes (Optional)" error={formErrors.notes}>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                    rows={2}
                    placeholder="Optional transaction context"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs text-slate-900 dark:text-slate-100 resize-none focus:border-teal-500 focus:outline-none"
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
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-60"
                >
                  {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {isSaving ? 'Saving…' : editingId === null ? 'Add Transaction' : 'Save Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
