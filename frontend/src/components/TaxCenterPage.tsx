import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ApiError,
  createTaxDeduction,
  createTaxDocument,
  createTaxIncomeItem,
  createTaxPayment,
  createTaxYear,
  deleteTaxDeduction,
  deleteTaxDocument,
  deleteTaxIncomeItem,
  deleteTaxPayment,
  deleteTaxYear,
  updateTaxDeduction,
  updateTaxDocument,
  updateTaxIncomeItem,
  updateTaxPayment,
  updateTaxYear,
  type TaxDeduction,
  type TaxDeductionPayload,
  type TaxDocument,
  type TaxDocumentPayload,
  type TaxIncomeItem,
  type TaxIncomeItemPayload,
  type TaxPayment,
  type TaxPaymentPayload,
  type TaxYear,
  type TaxYearPayload,
  type TaxYearSummary,
} from '../lib/api'
import { usePrivacyMode } from '../context/PrivacyContext'
import { formatINR, formatINRShort, formatPct, getTrendClass } from '../lib/format'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import { useTaxDeductionsQuery, useTaxDocumentsQuery, useTaxIncomeQuery, useTaxPaymentsQuery, useTaxSummaryQuery, useTaxYearsQuery } from '../queries/hooks'
import { queryKeys } from '../queries/queryKeys'

type ModalKind = 'year' | 'income' | 'deduction' | 'document' | 'payment' | null

type YearFormState = {
  financial_year: string
  assessment_year: string
  filing_status: TaxYear['filing_status']
  filing_date: string
  notes: string
}

type IncomeFormState = {
  income_type: TaxIncomeItem['income_type']
  source: string
  description: string
  gross_amount: string
  exempt_amount: string
  taxable_amount: string
  tds_amount: string
  received_date: string
}

type DeductionFormState = {
  section: TaxDeduction['section']
  description: string
  amount: string
  eligible_amount: string
  proof_status: TaxDeduction['proof_status']
}

type DocumentFormState = {
  document_type: TaxDocument['document_type']
  name: string
  status: TaxDocument['status']
  file_name: string
  file_path: string
  notes: string
  uploaded_at: string
}

type PaymentFormState = {
  payment_type: TaxPayment['payment_type']
  amount: string
  payment_date: string
  challan_or_reference: string
  notes: string
}

const defaultYearForm: YearFormState = {
  financial_year: '2025-26',
  assessment_year: '2026-27',
  filing_status: 'planning',
  filing_date: '',
  notes: '',
}

const defaultIncomeForm: IncomeFormState = {
  income_type: 'salary',
  source: '',
  description: '',
  gross_amount: '',
  exempt_amount: '0',
  taxable_amount: '',
  tds_amount: '0',
  received_date: '',
}

const defaultDeductionForm: DeductionFormState = {
  section: 'STANDARD_DEDUCTION',
  description: '',
  amount: '0',
  eligible_amount: '',
  proof_status: 'missing',
}

const defaultDocumentForm: DocumentFormState = {
  document_type: 'FORM_16',
  name: '',
  status: 'missing',
  file_name: '',
  file_path: '',
  notes: '',
  uploaded_at: '',
}

const defaultPaymentForm: PaymentFormState = {
  payment_type: 'tds',
  amount: '',
  payment_date: '',
  challan_or_reference: '',
  notes: '',
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

function formatMoney(value: number) {
  return Math.abs(value) >= 100000 ? formatINRShort(value) : formatINR(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function IncomeTypeLabel(value: TaxIncomeItem['income_type']) {
  return value.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700/50 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
          {subtitle ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function MetricCard({ label, value, meta, tone = 'slate' }: { label: string; value: ReactNode; meta: string; tone?: 'slate' | 'emerald' | 'rose' | 'amber' }) {
  const toneClass =
    tone === 'emerald'
      ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
      : tone === 'rose'
        ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
        : tone === 'amber'
          ? 'text-amber-300 bg-amber-500/10 border-amber-500/20'
          : 'text-slate-100 bg-slate-900/50 border-slate-700/60'
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{meta}</div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</div>
      {children}
    </label>
  )
}

function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-slate-700">
      <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text}</div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function StatusPill({ label, tone }: { label: string; tone: 'emerald' | 'rose' | 'amber' | 'slate' | 'sky' }) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-500/15 text-emerald-300'
      : tone === 'rose'
        ? 'bg-rose-500/15 text-rose-300'
        : tone === 'amber'
          ? 'bg-amber-500/15 text-amber-300'
          : tone === 'sky'
            ? 'bg-sky-500/15 text-sky-300'
            : 'bg-slate-700/70 text-slate-300'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>
}

export default function TaxCenterPage() {
  const { privacyMode } = usePrivacyMode()
  const queryClient = useQueryClient()
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusTone, setStatusTone] = useState<'emerald' | 'rose' | 'amber' | 'slate'>('emerald')
  const [modalKind, setModalKind] = useState<ModalKind>(null)
  const [isDrawerMounted, setIsDrawerMounted] = useState(false)
  const [isDrawerVisible, setIsDrawerVisible] = useState(false)
  const [editingYear, setEditingYear] = useState<TaxYear | null>(null)
  const [editingIncome, setEditingIncome] = useState<TaxIncomeItem | null>(null)
  const [editingDeduction, setEditingDeduction] = useState<TaxDeduction | null>(null)
  const [editingDocument, setEditingDocument] = useState<TaxDocument | null>(null)
  const [editingPayment, setEditingPayment] = useState<TaxPayment | null>(null)
  const [yearForm, setYearForm] = useState<YearFormState>(defaultYearForm)
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeForm)
  const [deductionForm, setDeductionForm] = useState<DeductionFormState>(defaultDeductionForm)
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(defaultDocumentForm)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(defaultPaymentForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const yearsQuery = useTaxYearsQuery()
  const summaryQuery = useTaxSummaryQuery(selectedYearId, selectedYearId !== null)
  const incomeQuery = useTaxIncomeQuery(selectedYearId, selectedYearId !== null)
  const deductionsQuery = useTaxDeductionsQuery(selectedYearId, selectedYearId !== null)
  const documentsQuery = useTaxDocumentsQuery(selectedYearId, selectedYearId !== null)
  const paymentsQuery = useTaxPaymentsQuery(selectedYearId, selectedYearId !== null)

  const years = (yearsQuery.data as TaxYear[] | undefined) ?? []
  const summary = (summaryQuery.data as TaxYearSummary | undefined) ?? null
  const incomeItems = (incomeQuery.data as TaxIncomeItem[] | undefined) ?? []
  const deductions = (deductionsQuery.data as TaxDeduction[] | undefined) ?? []
  const documents = (documentsQuery.data as TaxDocument[] | undefined) ?? []
  const payments = (paymentsQuery.data as TaxPayment[] | undefined) ?? []
  const yearsLoading = yearsQuery.isLoading
  const detailsLoading =
    selectedYearId !== null &&
    (summaryQuery.isLoading || incomeQuery.isLoading || deductionsQuery.isLoading || documentsQuery.isLoading || paymentsQuery.isLoading)
  const error = yearsQuery.error
    ? formatApiError(yearsQuery.error)
    : summaryQuery.error
      ? formatApiError(summaryQuery.error)
      : incomeQuery.error
        ? formatApiError(incomeQuery.error)
        : deductionsQuery.error
          ? formatApiError(deductionsQuery.error)
          : documentsQuery.error
            ? formatApiError(documentsQuery.error)
            : paymentsQuery.error
              ? formatApiError(paymentsQuery.error)
              : null

  const selectedYear = useMemo(() => years.find((item) => item.id === selectedYearId) ?? null, [years, selectedYearId])

  useEffect(() => {
    if (selectedYearId === null && years.length > 0) {
      setSelectedYearId(years[0]?.id ?? null)
    }
  }, [years, selectedYearId])

  async function refreshYears(selectId?: number | null) {
    await queryClient.invalidateQueries({ queryKey: queryKeys.taxYears })
    if (selectId !== undefined) {
      setSelectedYearId(selectId)
    }
  }

  async function refreshSelectedYearData(taxYearId: number) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.taxSummary(taxYearId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.taxIncome(taxYearId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.taxDeductions(taxYearId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.taxDocuments(taxYearId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.taxPayments(taxYearId) }),
    ])
  }

  useEffect(() => {
    if (modalKind) {
      setIsDrawerMounted(true)
      const frame = window.requestAnimationFrame(() => setIsDrawerVisible(true))
      return () => window.cancelAnimationFrame(frame)
    }
    setIsDrawerVisible(false)
    const timeout = window.setTimeout(() => setIsDrawerMounted(false), 250)
    return () => window.clearTimeout(timeout)
  }, [modalKind])
  function openYearModal(year?: TaxYear) {
    setEditingYear(year ?? null)
    setYearForm(
      year
        ? {
            financial_year: year.financial_year,
            assessment_year: year.assessment_year ?? '',
            filing_status: year.filing_status,
            filing_date: year.filing_date ?? '',
            notes: year.notes ?? '',
          }
        : defaultYearForm,
    )
    setFormError(null)
    setModalKind('year')
  }

  function openIncomeModal(item?: TaxIncomeItem) {
    setEditingIncome(item ?? null)
    setIncomeForm(
      item
        ? {
            income_type: item.income_type,
            source: item.source ?? '',
            description: item.description ?? '',
            gross_amount: String(item.gross_amount),
            exempt_amount: String(item.exempt_amount),
            taxable_amount: item.taxable_amount == null ? '' : String(item.taxable_amount),
            tds_amount: String(item.tds_amount),
            received_date: item.received_date ?? '',
          }
        : defaultIncomeForm,
    )
    setFormError(null)
    setModalKind('income')
  }

  function openDeductionModal(item?: TaxDeduction) {
    setEditingDeduction(item ?? null)
    setDeductionForm(
      item
        ? {
            section: item.section,
            description: item.description ?? '',
            amount: String(item.amount),
            eligible_amount: item.eligible_amount == null ? '' : String(item.eligible_amount),
            proof_status: item.proof_status,
          }
        : defaultDeductionForm,
    )
    setFormError(null)
    setModalKind('deduction')
  }

  function openDocumentModal(item?: TaxDocument) {
    setEditingDocument(item ?? null)
    setDocumentForm(
      item
        ? {
            document_type: item.document_type,
            name: item.name,
            status: item.status,
            file_name: item.file_name ?? '',
            file_path: item.file_path ?? '',
            notes: item.notes ?? '',
            uploaded_at: item.uploaded_at ?? '',
          }
        : defaultDocumentForm,
    )
    setFormError(null)
    setModalKind('document')
  }

  function openPaymentModal(item?: TaxPayment) {
    setEditingPayment(item ?? null)
    setPaymentForm(
      item
        ? {
            payment_type: item.payment_type,
            amount: String(item.amount),
            payment_date: item.payment_date ?? '',
            challan_or_reference: item.challan_or_reference ?? '',
            notes: item.notes ?? '',
          }
        : defaultPaymentForm,
    )
    setFormError(null)
    setModalKind('payment')
  }

  async function handleSave() {
    setIsSaving(true)
    setFormError(null)
    try {
      if (modalKind === 'year') {
        const payload: TaxYearPayload = {
          financial_year: yearForm.financial_year.trim(),
          assessment_year: yearForm.assessment_year.trim() || null,
          filing_status: yearForm.filing_status,
          filing_date: yearForm.filing_date || null,
          notes: yearForm.notes.trim() || null,
        }
        const result = editingYear ? await updateTaxYear(editingYear.id, payload) : await createTaxYear(payload)
        await refreshYears(result.id)
        await refreshSelectedYearData(result.id)
      } else if (modalKind === 'income' && selectedYearId !== null) {
        const payload: TaxIncomeItemPayload = {
          income_type: incomeForm.income_type,
          source: incomeForm.source.trim() || null,
          description: incomeForm.description.trim() || null,
          gross_amount: incomeForm.gross_amount || '0',
          exempt_amount: incomeForm.exempt_amount || '0',
          taxable_amount: incomeForm.taxable_amount.trim() || null,
          tds_amount: incomeForm.tds_amount || '0',
          received_date: incomeForm.received_date || null,
        }
        if (editingIncome) await updateTaxIncomeItem(editingIncome.id, payload)
        else await createTaxIncomeItem(selectedYearId, payload)
        await refreshSelectedYearData(selectedYearId)
      } else if (modalKind === 'deduction' && selectedYearId !== null) {
        const payload: TaxDeductionPayload = {
          section: deductionForm.section,
          description: deductionForm.description.trim() || null,
          amount: deductionForm.amount || '0',
          eligible_amount: deductionForm.eligible_amount.trim() || null,
          proof_status: deductionForm.proof_status,
        }
        if (editingDeduction) await updateTaxDeduction(editingDeduction.id, payload)
        else await createTaxDeduction(selectedYearId, payload)
        await refreshSelectedYearData(selectedYearId)
      } else if (modalKind === 'document' && selectedYearId !== null) {
        const payload: TaxDocumentPayload = {
          document_type: documentForm.document_type,
          name: documentForm.name.trim(),
          status: documentForm.status,
          file_name: documentForm.file_name.trim() || null,
          file_path: documentForm.file_path.trim() || null,
          notes: documentForm.notes.trim() || null,
          uploaded_at: documentForm.uploaded_at || null,
        }
        if (editingDocument) await updateTaxDocument(editingDocument.id, payload)
        else await createTaxDocument(selectedYearId, payload)
        await refreshSelectedYearData(selectedYearId)
      } else if (modalKind === 'payment' && selectedYearId !== null) {
        const payload: TaxPaymentPayload = {
          payment_type: paymentForm.payment_type,
          amount: paymentForm.amount || '0',
          payment_date: paymentForm.payment_date || null,
          challan_or_reference: paymentForm.challan_or_reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
        }
        if (editingPayment) await updateTaxPayment(editingPayment.id, payload)
        else await createTaxPayment(selectedYearId, payload)
        await refreshSelectedYearData(selectedYearId)
      }

      setStatusTone('emerald')
      setStatusMessage('Tax Center updated.')
      setModalKind(null)
      await refreshYears(selectedYearId)
    } catch (err) {
      setFormError(formatApiError(err))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(kind: 'year' | 'income' | 'deduction' | 'document' | 'payment', id: number, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    try {
      if (kind === 'year') {
        await deleteTaxYear(id)
        const nextId = selectedYearId === id ? null : selectedYearId
        await refreshYears(nextId)
        if (nextId) {
          await refreshSelectedYearData(nextId)
        }
      } else if (kind === 'income') {
        await deleteTaxIncomeItem(id)
        await refreshYears(selectedYearId)
        if (selectedYearId !== null) await refreshSelectedYearData(selectedYearId)
      } else if (kind === 'deduction') {
        await deleteTaxDeduction(id)
        await refreshYears(selectedYearId)
        if (selectedYearId !== null) await refreshSelectedYearData(selectedYearId)
      } else if (kind === 'document') {
        await deleteTaxDocument(id)
        await refreshYears(selectedYearId)
        if (selectedYearId !== null) await refreshSelectedYearData(selectedYearId)
      } else {
        await deleteTaxPayment(id)
        await refreshYears(selectedYearId)
        if (selectedYearId !== null) await refreshSelectedYearData(selectedYearId)
      }
      setStatusTone('emerald')
      setStatusMessage(`${label} deleted.`)
    } catch (err) {
      setStatusTone('rose')
      setStatusMessage(formatApiError(err))
    }
  }

  const balanceValue = toNumber(summary?.payable_summary.net_tax_balance)
  const balanceTone = balanceValue > 0 ? 'rose' : balanceValue < 0 ? 'emerald' : 'slate'

  return (
    <div className="space-y-5">
      {statusMessage ? (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          statusTone === 'emerald'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            : statusTone === 'rose'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
              : 'border-slate-700 bg-slate-800 text-slate-200'
        }`}>
          {statusMessage}
        </div>
      ) : null}

      <SectionCard
        title="Tax Center"
        subtitle="New Regime only for FY 2025-26 / AY 2026-27. Estimated only. Verify before filing."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedYearId ?? ''}
              onChange={(event) => setSelectedYearId(event.target.value ? Number(event.target.value) : null)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Select FY</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.financial_year} {year.assessment_year ? `· AY ${year.assessment_year}` : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => openYearModal()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white"
            >
              <Icon name="add" className="h-4 w-4" />
              Add FY
            </button>
          </div>
        }
      >
        {yearsLoading ? (
          <EmptyState title="Loading tax years" text="Fetching saved tax years and estimates." />
        ) : years.length === 0 ? (
          <EmptyState
            title="No tax year added yet"
            text="Create FY 2025-26 to start tracking tax income, documents, and filing readiness."
            action={
              <button type="button" onClick={() => openYearModal()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white">
                <Icon name="add" className="h-4 w-4" />
                Add Tax Year
              </button>
            }
          />
        ) : detailsLoading || summary === null ? (
          <EmptyState title="Loading tax details" text="Fetching tax summary, income items, documents, and payments." />
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label="Gross Income"
                value={<PrivateValue value={formatMoney(toNumber(summary.income_summary.gross_income))} mask="₹••••" hideColor />}
                meta={`${summary.tax_year.financial_year} tracked income`}
              />
              <MetricCard
                label="Taxable Income"
                value={<PrivateValue value={formatMoney(toNumber(summary.new_regime_estimate.taxable_income))} mask="₹••••" hideColor />}
                meta="After standard deduction and allowed adjustments"
              />
              <MetricCard
                label="Estimated Tax"
                value={<PrivateValue value={formatMoney(toNumber(summary.new_regime_estimate.total_tax))} mask="₹••••" hideColor />}
                meta="New regime estimate with cess"
                tone="amber"
              />
              <MetricCard
                label={balanceValue > 0 ? 'Estimated Payable' : balanceValue < 0 ? 'Estimated Refund' : 'Tax Balance'}
                value={
                  balanceValue > 0 ? (
                    <PrivateValue value={formatMoney(toNumber(summary.payable_summary.estimated_payable))} mask="₹••••" hideColor />
                  ) : balanceValue < 0 ? (
                    <PrivateValue value={formatMoney(toNumber(summary.payable_summary.estimated_refund))} mask="₹••••" hideColor />
                  ) : (
                    'Settled'
                  )
                }
                meta={`Credits vs tax ${summary.payable_summary.balance_label}`}
                tone={balanceTone as 'slate' | 'emerald' | 'rose' | 'amber'}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
              <SectionCard title="New Regime Estimate" subtitle="Config-driven estimate. Review before filing.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Standard deduction</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(summary.new_regime_estimate.standard_deduction))} mask="₹••••" hideColor />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Allowed adjustments</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(summary.new_regime_estimate.allowed_adjustments))} mask="₹••••" hideColor />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Tax before rebate</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      <PrivateValue value={formatMoney(toNumber(summary.new_regime_estimate.tax_before_rebate))} mask="₹••••" hideColor />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Rebate + cess</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      <PrivateValue
                        value={`${formatMoney(toNumber(summary.new_regime_estimate.rebate))} / ${formatMoney(toNumber(summary.new_regime_estimate.cess))}`}
                        mask="₹•••• / ₹••••"
                        hideColor
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Effective tax rate:{' '}
                  <span className={privacyMode ? 'text-slate-400' : getTrendClass(toNumber(summary.new_regime_estimate.effective_tax_rate ?? 0))}>
                    <PrivateValue value={formatPct(toNumber(summary.new_regime_estimate.effective_tax_rate ?? 0))} mask="••••" hideColor />
                  </span>
                </div>
              </SectionCard>

              <SectionCard title="Filing Readiness" subtitle={summary.filing_readiness.disclaimer}>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={summary.filing_readiness.status.replace('_', ' ')}
                    tone={summary.filing_readiness.status === 'ready' ? 'emerald' : summary.filing_readiness.status === 'in_progress' ? 'amber' : 'rose'}
                  />
                  <StatusPill
                    label={selectedYear?.filing_status.replace('_', ' ') ?? 'planning'}
                    tone={selectedYear?.filing_status === 'filed' ? 'sky' : 'slate'}
                  />
                </div>
                <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{summary.filing_readiness.message}</div>
                <div className="mt-4 space-y-2">
                  {summary.filing_readiness.checklist.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700">
                      <span className="text-sm text-slate-700 dark:text-slate-200">{item.label}</span>
                      <span className={item.done ? 'text-emerald-300' : 'text-slate-500'}>
                        <Icon name={item.done ? 'paid' : 'warning'} className="h-4 w-4" />
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => openYearModal(selectedYear ?? undefined)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Icon name="edit" className="h-4 w-4" />
                    Edit FY
                  </button>
                  {selectedYear ? (
                    <button type="button" onClick={() => void handleDelete('year', selectedYear.id, selectedYear.financial_year)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 text-sm font-semibold text-rose-300">
                      <Icon name="remove" className="h-4 w-4" />
                      Delete FY
                    </button>
                  ) : null}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Income Items"
              subtitle="Track salary, interest, dividends, capital gains, freelance, and other taxable income."
              action={<button type="button" onClick={() => openIncomeModal()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white"><Icon name="add" className="h-4 w-4" />Add Income</button>}
            >
              {incomeItems.length === 0 ? (
                <EmptyState title="No tax income added" text="Add tax-relevant income to start the estimate." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {incomeItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.source || IncomeTypeLabel(item.income_type)}</div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{IncomeTypeLabel(item.income_type)}{item.received_date ? ` · ${formatDate(item.received_date)}` : ''}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            <PrivateValue value={formatMoney(toNumber(item.gross_amount))} mask="₹••••" hideColor />
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            TDS <PrivateValue value={formatMoney(toNumber(item.tds_amount))} mask="₹••••" hideColor />
                          </div>
                        </div>
                      </div>
                      {item.description ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.description}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => openIncomeModal(item)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                          <Icon name="edit" className="h-4 w-4" />
                          Edit
                        </button>
                        <button type="button" onClick={() => void handleDelete('income', item.id, item.source || IncomeTypeLabel(item.income_type))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-sm font-medium text-rose-300">
                          <Icon name="remove" className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <div className="grid gap-5 xl:grid-cols-2">
              <SectionCard
                title="Allowed Adjustments"
                subtitle="New regime keeps this narrow. Standard deduction is auto-applied when salary exists."
                action={<button type="button" onClick={() => openDeductionModal()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon name="add" className="h-4 w-4" />Add Adjustment</button>}
              >
                {deductions.length === 0 ? (
                  <EmptyState title="No adjustments added" text="Add NPS employer or other allowed records if applicable." />
                ) : (
                  <div className="space-y-3">
                    {deductions.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.section.replaceAll('_', ' ')}</div>
                            {item.description ? <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</div> : null}
                          </div>
                          <StatusPill label={item.proof_status} tone={item.proof_status === 'verified' ? 'emerald' : item.proof_status === 'available' ? 'amber' : 'slate'} />
                        </div>
                        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                          Amount <PrivateValue value={formatMoney(toNumber(item.amount))} mask="₹••••" hideColor /> · Eligible <PrivateValue value={formatMoney(toNumber(item.eligible_amount ?? item.amount))} mask="₹••••" hideColor />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => openDeductionModal(item)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"><Icon name="edit" className="h-4 w-4" />Edit</button>
                          <button type="button" onClick={() => void handleDelete('deduction', item.id, item.section)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-sm font-medium text-rose-300"><Icon name="remove" className="h-4 w-4" />Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="TDS and Tax Payments"
                subtitle="Track advance tax, self-assessment, refunds, and extra TDS entries."
                action={<button type="button" onClick={() => openPaymentModal()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon name="add" className="h-4 w-4" />Add Payment</button>}
              >
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Total credited</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white"><PrivateValue value={formatMoney(toNumber(summary.tds_summary.total_tax_paid_or_credited))} mask="₹••••" hideColor /></div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="text-xs text-slate-500">Advance + self assessment</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white"><PrivateValue value={formatMoney(toNumber(summary.tds_summary.total_advance_tax) + toNumber(summary.tds_summary.total_self_assessment_tax))} mask="₹••••" hideColor /></div>
                  </div>
                </div>
                {payments.length === 0 ? (
                  <EmptyState title="No tax payments added" text="Payment rows are optional, but useful for refund/payable tracking." />
                ) : (
                  <div className="space-y-3">
                    {payments.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700/50">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.payment_type.replaceAll('_', ' ')}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.payment_date ? formatDate(item.payment_date) : 'No date'}{item.challan_or_reference ? ` · ${item.challan_or_reference}` : ''}</div>
                          </div>
                          <div className={getTrendClass(item.payment_type === 'refund' ? -toNumber(item.amount) : toNumber(item.amount))}>
                            <PrivateValue value={formatMoney(toNumber(item.amount))} mask="₹••••" hideColor />
                          </div>
                        </div>
                        {item.notes ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.notes}</div> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => openPaymentModal(item)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"><Icon name="edit" className="h-4 w-4" />Edit</button>
                          <button type="button" onClick={() => void handleDelete('payment', item.id, item.payment_type)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-sm font-medium text-rose-300"><Icon name="remove" className="h-4 w-4" />Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>

            <SectionCard
              title="Document Checklist"
              subtitle={`${summary.documents_summary.total_required} required documents · readiness ${privacyMode ? '••••' : formatPct(toNumber(summary.documents_summary.readiness_score))}`}
              action={<button type="button" onClick={() => openDocumentModal()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon name="add" className="h-4 w-4" />Add Document</button>}
            >
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label="Available" value={String(summary.documents_summary.available_count)} meta="Uploaded or verified" tone="slate" />
                <MetricCard label="Verified" value={String(summary.documents_summary.verified_count)} meta="Fully verified" tone="emerald" />
                <MetricCard label="Missing" value={String(summary.documents_summary.missing_count)} meta="Still needed" tone={summary.documents_summary.missing_count > 0 ? 'rose' : 'emerald'} />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {documents.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.document_type.replaceAll('_', ' ')}</div>
                      </div>
                      <StatusPill label={item.status} tone={item.status === 'verified' ? 'emerald' : item.status === 'uploaded' ? 'amber' : 'slate'} />
                    </div>
                    {item.notes ? <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{item.notes}</div> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => openDocumentModal(item)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"><Icon name="edit" className="h-4 w-4" />Edit</button>
                      <button type="button" onClick={() => void handleDelete('document', item.id, item.name)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 text-sm font-medium text-rose-300"><Icon name="remove" className="h-4 w-4" />Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {summary.documents_summary.missing_documents.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Missing: {summary.documents_summary.missing_documents.join(', ')}
                </div>
              ) : null}
            </SectionCard>
          </div>
        )}
      </SectionCard>

      {isDrawerMounted ? (
        <div
          className={[
            'fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200',
            isDrawerVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          onClick={() => setModalKind(null)}
        >
          <section
            className={[
              'relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900',
              isDrawerVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ].join(' ')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  {modalKind === 'year' ? (editingYear ? 'Edit Tax Year' : 'Add Tax Year') : modalKind === 'income' ? (editingIncome ? 'Edit Income Item' : 'Add Income Item') : modalKind === 'deduction' ? (editingDeduction ? 'Edit Adjustment' : 'Add Adjustment') : modalKind === 'document' ? (editingDocument ? 'Edit Document' : 'Add Document') : editingPayment ? 'Edit Payment' : 'Add Payment'}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">New regime only. Estimated and read-only for filing preparation.</div>
              </div>
              <button type="button" onClick={() => setModalKind(null)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {formError ? <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 whitespace-pre-wrap">{formError}</div> : null}

              {modalKind === 'year' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Financial Year">
                    <input value={yearForm.financial_year} onChange={(event) => setYearForm((current) => ({ ...current, financial_year: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Assessment Year">
                    <input value={yearForm.assessment_year} onChange={(event) => setYearForm((current) => ({ ...current, assessment_year: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Filing Status">
                    <select value={yearForm.filing_status} onChange={(event) => setYearForm((current) => ({ ...current, filing_status: event.target.value as TaxYear['filing_status'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="planning">Planning</option>
                      <option value="ready">Ready</option>
                      <option value="filed">Filed</option>
                    </select>
                  </FormField>
                  <FormField label="Filing Date">
                    <input type="date" value={yearForm.filing_date} onChange={(event) => setYearForm((current) => ({ ...current, filing_date: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Notes">
                      <textarea value={yearForm.notes} onChange={(event) => setYearForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                </div>
              ) : null}

              {modalKind === 'income' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Income Type">
                    <select value={incomeForm.income_type} onChange={(event) => setIncomeForm((current) => ({ ...current, income_type: event.target.value as TaxIncomeItem['income_type'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="salary">Salary</option>
                      <option value="interest">Interest</option>
                      <option value="dividend">Dividend</option>
                      <option value="capital_gains">Capital Gains</option>
                      <option value="freelance">Freelance</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>
                  <FormField label="Source">
                    <input value={incomeForm.source} onChange={(event) => setIncomeForm((current) => ({ ...current, source: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Gross Amount">
                    <input value={incomeForm.gross_amount} onChange={(event) => setIncomeForm((current) => ({ ...current, gross_amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Exempt Amount">
                    <input value={incomeForm.exempt_amount} onChange={(event) => setIncomeForm((current) => ({ ...current, exempt_amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Taxable Amount Override">
                    <input value={incomeForm.taxable_amount} onChange={(event) => setIncomeForm((current) => ({ ...current, taxable_amount: event.target.value }))} inputMode="decimal" placeholder="Optional" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="TDS Amount">
                    <input value={incomeForm.tds_amount} onChange={(event) => setIncomeForm((current) => ({ ...current, tds_amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Received Date">
                    <input type="date" value={incomeForm.received_date} onChange={(event) => setIncomeForm((current) => ({ ...current, received_date: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Description">
                      <textarea value={incomeForm.description} onChange={(event) => setIncomeForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                </div>
              ) : null}

              {modalKind === 'deduction' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Section">
                    <select value={deductionForm.section} onChange={(event) => setDeductionForm((current) => ({ ...current, section: event.target.value as TaxDeduction['section'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="STANDARD_DEDUCTION">STANDARD_DEDUCTION</option>
                      <option value="NPS_EMPLOYER">NPS_EMPLOYER</option>
                      <option value="OTHER_ALLOWED">OTHER_ALLOWED</option>
                      <option value="INFO_ONLY">INFO_ONLY</option>
                    </select>
                  </FormField>
                  <FormField label="Proof Status">
                    <select value={deductionForm.proof_status} onChange={(event) => setDeductionForm((current) => ({ ...current, proof_status: event.target.value as TaxDeduction['proof_status'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="missing">Missing</option>
                      <option value="available">Available</option>
                      <option value="verified">Verified</option>
                    </select>
                  </FormField>
                  <FormField label="Amount">
                    <input value={deductionForm.amount} onChange={(event) => setDeductionForm((current) => ({ ...current, amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Eligible Amount">
                    <input value={deductionForm.eligible_amount} onChange={(event) => setDeductionForm((current) => ({ ...current, eligible_amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Description">
                      <textarea value={deductionForm.description} onChange={(event) => setDeductionForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                </div>
              ) : null}

              {modalKind === 'document' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Document Type">
                    <select value={documentForm.document_type} onChange={(event) => setDocumentForm((current) => ({ ...current, document_type: event.target.value as TaxDocument['document_type'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="FORM_16">FORM_16</option>
                      <option value="AIS">AIS</option>
                      <option value="TIS">TIS</option>
                      <option value="FORM_26AS">FORM_26AS</option>
                      <option value="CAPITAL_GAINS_STATEMENT">CAPITAL_GAINS_STATEMENT</option>
                      <option value="BANK_INTEREST_CERTIFICATE">BANK_INTEREST_CERTIFICATE</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </FormField>
                  <FormField label="Status">
                    <select value={documentForm.status} onChange={(event) => setDocumentForm((current) => ({ ...current, status: event.target.value as TaxDocument['status'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="missing">Missing</option>
                      <option value="uploaded">Uploaded</option>
                      <option value="verified">Verified</option>
                    </select>
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Name">
                      <input value={documentForm.name} onChange={(event) => setDocumentForm((current) => ({ ...current, name: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                  <FormField label="File Name">
                    <input value={documentForm.file_name} onChange={(event) => setDocumentForm((current) => ({ ...current, file_name: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="File Path">
                    <input value={documentForm.file_path} onChange={(event) => setDocumentForm((current) => ({ ...current, file_path: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Uploaded At (ISO)">
                    <input value={documentForm.uploaded_at} onChange={(event) => setDocumentForm((current) => ({ ...current, uploaded_at: event.target.value }))} placeholder="2026-06-26T10:00:00+05:30" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Notes">
                      <textarea value={documentForm.notes} onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                </div>
              ) : null}

              {modalKind === 'payment' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Payment Type">
                    <select value={paymentForm.payment_type} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_type: event.target.value as TaxPayment['payment_type'] }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                      <option value="tds">TDS</option>
                      <option value="advance_tax">Advance Tax</option>
                      <option value="self_assessment_tax">Self Assessment Tax</option>
                      <option value="refund">Refund</option>
                    </select>
                  </FormField>
                  <FormField label="Amount">
                    <input value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Payment Date">
                    <input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <FormField label="Challan / Reference">
                    <input value={paymentForm.challan_or_reference} onChange={(event) => setPaymentForm((current) => ({ ...current, challan_or_reference: event.target.value }))} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                  </FormField>
                  <div className="sm:col-span-2">
                    <FormField label="Notes">
                      <textarea value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
                    </FormField>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <button type="button" onClick={() => setModalKind(null)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Cancel
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={isSaving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent-600 px-4 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? <Icon name="refresh" className="h-4 w-4 animate-spin" /> : <Icon name="add" className="h-4 w-4" />}
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
