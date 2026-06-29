import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ApiError,
  type CreditCard,
  type CreditCardBill,
  type CreditCardBillPaymentsReportRow,
  type InvestmentHoldingsReportRow,
  type MonthlyCashflowReportRow,
  type NetWorthSnapshotReportRow,
} from '../lib/api'
import { formatINR, formatINRShort, formatPct, formatSignedPct, getTrendClass } from '../lib/format'
import { usePrivacyMode } from '../context/PrivacyContext'
import { Icon } from './Icon'
import PrivateValue from './ui/PrivateValue'
import {
  useCashflowMonthsQuery,
  useCreditCardBillPaymentsReportQuery,
  useCreditCardsQuery,
  useInvestmentHoldingsReportQuery,
  useMonthlyCashflowReportQuery,
  useNetWorthSnapshotsReportQuery,
} from '../queries/hooks'
import { secondaryButtonClass } from '../styles/buttonStyles'

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

function formatMonthLabel(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(`${value}-01T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date)
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(parsed)
}

function formatBillingCycle(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) return '—'
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`
}

function csvEscape(value: unknown) {
  const text = value == null ? '' : String(value)
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers.map(csvEscape).join(','), ...rows.map((row) => row.map(csvEscape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function SectionCard({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700/50 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-500">{label}</div>
      {children}
    </label>
  )
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700/50">{children}</div>
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">{text}</div>
}

function StatusBadge({ status }: { status: CreditCardBill['status'] }) {
  const cls =
    status === 'paid'
      ? 'bg-emerald-500/15 text-emerald-300'
      : status === 'partial'
        ? 'bg-amber-500/15 text-amber-300'
        : status === 'missed'
          ? 'bg-rose-500/15 text-rose-300'
          : 'bg-slate-700/70 text-slate-300'
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{status.replace('_', ' ')}</span>
}

export default function ReportsPage() {
  const { privacyMode } = usePrivacyMode()
  const [cashflowFromMonth, setCashflowFromMonth] = useState('')
  const [cashflowToMonth, setCashflowToMonth] = useState('')
  const [billCardId, setBillCardId] = useState('all')
  const [billStatus, setBillStatus] = useState<'all' | CreditCardBill['status']>('all')
  const [billFromDate, setBillFromDate] = useState('')
  const [billToDate, setBillToDate] = useState('')
  const cashflowMonthsQuery = useCashflowMonthsQuery()
  const creditCardsQuery = useCreditCardsQuery()
  const cashflowReportQuery = useMonthlyCashflowReportQuery({
    fromMonth: cashflowFromMonth || undefined,
    toMonth: cashflowToMonth || undefined,
  })
  const billPaymentsQuery = useCreditCardBillPaymentsReportQuery({
    cardId: billCardId === 'all' ? undefined : Number(billCardId),
    status: billStatus === 'all' ? undefined : billStatus,
    fromDate: billFromDate || undefined,
    toDate: billToDate || undefined,
  })
  const snapshotsReportQuery = useNetWorthSnapshotsReportQuery()
  const holdingsReportQuery = useInvestmentHoldingsReportQuery()

  const availableMonths = cashflowMonthsQuery.data ?? []
  const creditCards = (creditCardsQuery.data as CreditCard[] | undefined) ?? []
  const cashflowRows = (cashflowReportQuery.data?.rows as MonthlyCashflowReportRow[] | undefined) ?? []
  const billRows = (billPaymentsQuery.data?.rows as CreditCardBillPaymentsReportRow[] | undefined) ?? []
  const snapshotRows = (snapshotsReportQuery.data?.rows as NetWorthSnapshotReportRow[] | undefined) ?? []
  const holdingRows = (holdingsReportQuery.data?.rows as InvestmentHoldingsReportRow[] | undefined) ?? []

  const cashflowLoading = cashflowReportQuery.isLoading
  const billsLoading = billPaymentsQuery.isLoading
  const snapshotsLoading = snapshotsReportQuery.isLoading
  const holdingsLoading = holdingsReportQuery.isLoading
  const metaLoading = cashflowMonthsQuery.isLoading || creditCardsQuery.isLoading

  const cashflowError = cashflowReportQuery.error ? formatApiError(cashflowReportQuery.error) : null
  const billsError = billPaymentsQuery.error ? formatApiError(billPaymentsQuery.error) : null
  const snapshotsError = snapshotsReportQuery.error ? formatApiError(snapshotsReportQuery.error) : null
  const holdingsError = holdingsReportQuery.error ? formatApiError(holdingsReportQuery.error) : null
  const metaError = cashflowMonthsQuery.error
    ? formatApiError(cashflowMonthsQuery.error)
    : creditCardsQuery.error
      ? formatApiError(creditCardsQuery.error)
      : null

  useEffect(() => {
    if (!cashflowFromMonth && availableMonths.length > 0) {
      setCashflowFromMonth(availableMonths[availableMonths.length - 1] ?? '')
    }
    if (!cashflowToMonth && availableMonths.length > 0) {
      setCashflowToMonth(availableMonths[0] ?? '')
    }
  }, [availableMonths, cashflowFromMonth, cashflowToMonth])

  const cashflowCsvRows = useMemo(
    () =>
      cashflowRows.map((row) => [
        row.month,
        row.total_income,
        row.total_expense,
        row.net_savings,
        row.savings_rate,
        row.top_expense_category,
        row.top_income_source,
      ]),
    [cashflowRows],
  )

  const billCsvRows = useMemo(
    () =>
      billRows.map((row) => [
        row.card_name,
        formatBillingCycle(row.billing_cycle_start, row.billing_cycle_end),
        row.bill_generated_date,
        row.due_date,
        row.bill_amount,
        row.paid_amount,
        row.paid_date,
        row.status,
        row.notes,
      ]),
    [billRows],
  )

  const snapshotCsvRows = useMemo(
    () => snapshotRows.map((row) => [row.date, row.portfolio_value, row.change_amount, row.change_pct]),
    [snapshotRows],
  )

  const holdingCsvRows = useMemo(
    () =>
      holdingRows.map((row) => [
        row.symbol,
        row.company_name,
        row.asset_type,
        row.country,
        row.invested_value,
        row.current_value,
        row.pnl,
        row.return_pct,
        row.quantity,
        row.avg_buy_price,
        row.current_price,
        row.last_updated,
      ]),
    [holdingRows],
  )

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700/50 dark:bg-slate-900/80">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-300">
            <Icon name="reports" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-slate-900 dark:text-white">Reports</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Read-only exports for cashflow, credit cards, net worth snapshots, and investment holdings.</div>
            <div className="mt-3 inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
              Exports include unmasked values.
            </div>
            {metaError ? <div className="mt-3 text-sm text-rose-400">{metaError}</div> : null}
          </div>
        </div>
      </div>

      <SectionCard
        title="Monthly Cashflow Report"
        subtitle="Monthly income, expense, savings, and top categories"
        action={
          <button
            type="button"
            onClick={() => downloadCsv('monthly_cashflow_report.csv', ['Month', 'Total Income', 'Total Expense', 'Net Savings', 'Savings Rate', 'Top Expense Category', 'Top Income Source'], cashflowCsvRows)}
            className={secondaryButtonClass}
          >
            <Icon name="download" className="h-4 w-4" />
            Export CSV
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label="From Month">
            <select value={cashflowFromMonth} onChange={(event) => setCashflowFromMonth(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All</option>
              {availableMonths.map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}
            </select>
          </FilterField>
          <FilterField label="To Month">
            <select value={cashflowToMonth} onChange={(event) => setCashflowToMonth(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="">All</option>
              {availableMonths.map((month) => <option key={month} value={month}>{formatMonthLabel(month)}</option>)}
            </select>
          </FilterField>
        </div>
        <div className="mt-4">
          {cashflowError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{cashflowError}</div> : cashflowLoading || metaLoading ? <EmptyState text="Loading monthly cashflow report..." /> : cashflowRows.length === 0 ? <EmptyState text="No cashflow report data for the selected months." /> : (
            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    {['Month', 'Income', 'Expense', 'Net Savings', 'Savings Rate', 'Top Expense', 'Top Income'].map((label) => <th key={label} className="px-4 py-3 text-left font-semibold">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {cashflowRows.map((row) => (
                    <tr key={row.month} className="border-t border-slate-200 dark:border-slate-700/50">
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{formatMonthLabel(row.month)}</td>
                      <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.total_income))} mask="••••" hideColor /></td>
                      <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.total_expense))} mask="••••" hideColor /></td>
                      <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.net_savings))].join(' ')}><PrivateValue value={formatMoney(toNumber(row.net_savings))} mask="••••" hideColor /></td>
                      <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.savings_rate))].join(' ')}>{row.savings_rate == null ? '—' : <PrivateValue value={formatPct(toNumber(row.savings_rate))} mask="••••" hideColor />}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.top_expense_category ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.top_income_source ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Credit Card Bill Payments Report"
        subtitle="Bill history, payment status, and settlement tracking"
        action={
          <button
            type="button"
            onClick={() => downloadCsv('credit_card_bill_payments.csv', ['Card Name', 'Billing Cycle', 'Bill Generated Date', 'Due Date', 'Bill Amount', 'Paid Amount', 'Paid Date', 'Status', 'Notes'], billCsvRows)}
            className={secondaryButtonClass}
          >
            <Icon name="download" className="h-4 w-4" />
            Export CSV
          </button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FilterField label="Card">
            <select value={billCardId} onChange={(event) => setBillCardId(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="all">All cards</option>
              {creditCards.map((card) => <option key={card.id} value={String(card.id)}>{card.card_name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Status">
            <select value={billStatus} onChange={(event) => setBillStatus(event.target.value as 'all' | CreditCardBill['status'])} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <option value="all">All statuses</option>
              <option value="generated">generated</option>
              <option value="paid">paid</option>
              <option value="partial">partial</option>
              <option value="waived">waived</option>
              <option value="missed">missed</option>
            </select>
          </FilterField>
          <FilterField label="From Date">
            <input type="date" value={billFromDate} onChange={(event) => setBillFromDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </FilterField>
          <FilterField label="To Date">
            <input type="date" value={billToDate} onChange={(event) => setBillToDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </FilterField>
        </div>
        <div className="mt-4">
          {billsError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{billsError}</div> : billsLoading || metaLoading ? <EmptyState text="Loading credit card bill payments report..." /> : billRows.length === 0 ? <EmptyState text="No credit card bill payment records for the selected filters." /> : (
            <TableShell>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                  <tr>
                    {['Card', 'Billing Cycle', 'Generated', 'Due', 'Bill Amount', 'Paid Amount', 'Paid Date', 'Status', 'Notes'].map((label) => <th key={label} className="px-4 py-3 text-left font-semibold">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {billRows.map((row) => (
                    <tr key={row.bill_id} className="border-t border-slate-200 dark:border-slate-700/50">
                      <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{row.card_name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatBillingCycle(row.billing_cycle_start, row.billing_cycle_end)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateLabel(row.bill_generated_date)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateLabel(row.due_date)}</td>
                      <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.bill_amount))} mask="••••" hideColor /></td>
                      <td className="px-4 py-3">{row.paid_amount == null ? '—' : <PrivateValue value={formatMoney(toNumber(row.paid_amount))} mask="••••" hideColor />}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateLabel(row.paid_date)}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Net Worth Snapshot Report"
        subtitle="Saved portfolio snapshots and change versus previous snapshot"
        action={
          <button
            type="button"
            onClick={() => downloadCsv('networth_snapshots.csv', ['Date', 'Portfolio Value', 'Change Amount', 'Change %'], snapshotCsvRows)}
            className={secondaryButtonClass}
          >
            <Icon name="download" className="h-4 w-4" />
            Export CSV
          </button>
        }
      >
        {snapshotsError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{snapshotsError}</div> : snapshotsLoading ? <EmptyState text="Loading net worth snapshots report..." /> : snapshotRows.length === 0 ? <EmptyState text="No portfolio snapshots saved yet." /> : (
          <TableShell>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  {['Date', 'Portfolio Value', 'Change', 'Change %', 'Saved At'].map((label) => <th key={label} className="px-4 py-3 text-left font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {snapshotRows.map((row) => (
                  <tr key={`${row.date}-${row.updated_at}`} className="border-t border-slate-200 dark:border-slate-700/50">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{formatDateLabel(row.date)}</td>
                    <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.portfolio_value))} mask="••••" hideColor /></td>
                    <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.change_amount))].join(' ')}>{row.change_amount == null ? '—' : <PrivateValue value={formatMoney(toNumber(row.change_amount))} mask="••••" hideColor />}</td>
                    <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.change_pct))].join(' ')}>{row.change_pct == null ? '—' : <PrivateValue value={formatSignedPct(toNumber(row.change_pct))} mask="••••" hideColor />}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTimeLabel(row.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>

      <SectionCard
        title="Investment Holdings Report"
        subtitle="Current holdings, valuation, and return breakdown"
        action={
          <button
            type="button"
            onClick={() => downloadCsv('investment_holdings.csv', ['Symbol', 'Name', 'Asset Type', 'Country', 'Invested Value', 'Current Value', 'P&L', 'Return %', 'Quantity/Units', 'Avg Buy', 'Current Price', 'Last Updated'], holdingCsvRows)}
            className={secondaryButtonClass}
          >
            <Icon name="download" className="h-4 w-4" />
            Export CSV
          </button>
        }
      >
        {holdingsError ? <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{holdingsError}</div> : holdingsLoading ? <EmptyState text="Loading investment holdings report..." /> : holdingRows.length === 0 ? <EmptyState text="No investment holdings added yet." /> : (
          <TableShell>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
                <tr>
                  {['Symbol', 'Name', 'Type', 'Country', 'Invested', 'Current', 'P&L', 'Return %', 'Qty/Units', 'Avg Buy', 'Current Price', 'Last Updated'].map((label) => <th key={label} className="px-4 py-3 text-left font-semibold">{label}</th>)}
                </tr>
              </thead>
              <tbody>
                {holdingRows.map((row) => (
                  <tr key={row.holding_id} className="border-t border-slate-200 dark:border-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{row.symbol}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.company_name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.asset_type}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.country}</td>
                    <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.invested_value))} mask="••••" hideColor /></td>
                    <td className="px-4 py-3"><PrivateValue value={formatMoney(toNumber(row.current_value))} mask="••••" hideColor /></td>
                    <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.pnl))].join(' ')}><PrivateValue value={formatMoney(toNumber(row.pnl))} mask="••••" hideColor /></td>
                    <td className={['px-4 py-3', privacyMode ? 'text-slate-300 dark:text-slate-300' : getTrendClass(toNumber(row.return_pct))].join(' ')}><PrivateValue value={formatSignedPct(toNumber(row.return_pct))} mask="••••" hideColor /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{toNumber(row.quantity)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatMoney(toNumber(row.avg_buy_price))}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatMoney(toNumber(row.current_price))}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDateTimeLabel(row.last_updated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </SectionCard>
    </div>
  )
}
