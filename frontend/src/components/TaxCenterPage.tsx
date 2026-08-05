import { useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, ArrowDown, CheckCircle2, FileText, Landmark, PieChart, Receipt, ShieldCheck, Wallet } from 'lucide-react'
import type {
  ChallanRow,
  DocumentRow,
  ForeignAssetRow,
  ForeignCountrySummary,
  InvestmentSummaryRow,
  TaxAmountRow,
  TaxChartSlice,
  TaxInfoRow,
  TaxMetric,
  TaxViewModel,
} from '../config/tax/types'
import { useTaxDashboard } from '../hooks/useTaxDashboard'
import { useTaxYearsQuery } from '../queries/hooks'
import type { TaxYear } from '../lib/api'
import PrivateValue from './ui/PrivateValue'

const pageCardClass = 'rounded-[28px] border border-slate-800 bg-slate-950/70 shadow-[0_20px_60px_rgba(15,23,42,0.25)] backdrop-blur'
const innerCardClass = 'rounded-2xl border border-slate-800/80 bg-slate-900/80'

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function Money({ value, className = '' }: { value: number; className?: string }) {
  return <PrivateValue value={formatMoney(value)} mask="₹••••••" hideColor className={className} />
}

function toneClasses(tone?: TaxMetric['tone']) {
  switch (tone) {
    case 'emerald':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
    case 'rose':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-200'
    case 'amber':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-200'
    case 'sky':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-200'
    default:
      return 'border-slate-800 bg-slate-900/80 text-slate-100'
  }
}

function Section({
  icon,
  title,
  eyebrow,
  children,
}: {
  icon: ReactNode
  title: string
  eyebrow?: string
  children: ReactNode
}) {
  return (
    <section className={`${pageCardClass} p-5 sm:p-6`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">{eyebrow}</p> : null}
          <div className="mt-2 flex items-center gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-cyan-300">{icon}</div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
          </div>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function SummaryCards({ cards }: { cards: TaxMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <article key={card.label} className={`${innerCardClass} ${toneClasses(card.tone)} p-4`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
              <Money value={card.value} className="mt-3 block text-2xl font-semibold text-white" />
            </div>
            {card.badge ? <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase">{card.badge}</span> : null}
          </div>
          {card.meta ? <p className="mt-2 text-xs text-slate-400">{card.meta}</p> : null}
        </article>
      ))}
    </div>
  )
}

function ChartList({ slices }: { slices: TaxChartSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)

  return (
    <div className="space-y-4">
      {slices.map((slice) => {
        const percent = total > 0 ? (slice.value / total) * 100 : 0
        return (
          <div key={slice.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-200">
                <span className={`h-2.5 w-2.5 rounded-full ${slice.color}`} />
                <span>{slice.label}</span>
              </div>
              <div className="text-right">
                <Money value={slice.value} className="font-medium text-slate-100" />
                <div className="text-xs text-slate-500">{percent.toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800">
              <div className={`h-2 rounded-full ${slice.color}`} style={{ width: `${Math.max(percent, total > 0 ? 4 : 0)}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfoGrid({ rows, columns = 2 }: { rows: TaxInfoRow[] | DocumentRow[]; columns?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${columns === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>
      {rows.map((row) => (
        <div key={row.label} className={`${innerCardClass} p-4`}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
          <p className="mt-2 text-sm font-medium text-slate-100 break-all">{row.value}</p>
        </div>
      ))}
    </div>
  )
}

function MetricGrid({ rows, columns = 3 }: { rows: TaxMetric[]; columns?: 2 | 3 | 4 }) {
  const gridClass =
    columns === 4 ? 'lg:grid-cols-4' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'

  return (
    <div className={`grid gap-4 ${gridClass}`}>
      {rows.map((row) => (
        <div key={row.label} className={`${innerCardClass} ${toneClasses(row.tone)} p-4`}>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
          <Money value={row.value} className="mt-3 block text-xl font-semibold text-white" />
        </div>
      ))}
    </div>
  )
}

function ComputationFlow({ rows }: { rows: TaxAmountRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => (
        <div key={row.label} className="flex items-center gap-3">
          <div className={`flex-1 rounded-2xl border p-4 ${toneClasses(row.tone)}`}>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
            <Money value={row.value} className="mt-3 block text-lg font-semibold text-white" />
          </div>
          {index < rows.length - 1 ? <ArrowDown className="h-4 w-4 shrink-0 text-slate-500" /> : null}
        </div>
      ))}
    </div>
  )
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-900/90 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/30">
          {rows.map((row, index) => (
            <tr key={index} className="align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 text-slate-200">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ForeignCountryCards({ countries }: { countries: ForeignCountrySummary[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {countries.map((country) => (
        <div key={country.country} className={`${innerCardClass} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{country.country}</p>
              <Money value={country.income} className="mt-3 block text-2xl font-semibold text-white" />
              <p className="mt-1 text-xs text-slate-500">Foreign income</p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{country.holdingsCount} holdings</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500">Tax Paid</p>
              <Money value={country.taxPaid} className="mt-2 block text-sm font-medium text-slate-100" />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500">FTC</p>
              <Money value={country.ftc} className="mt-2 block text-sm font-medium text-slate-100" />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs text-slate-500">DTAA</p>
              <p className="mt-2 text-sm font-medium text-slate-100">{country.dtaaSection}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ForeignAssetsTable({ assets }: { assets: ForeignAssetRow[] }) {
  return (
    <SimpleTable
      headers={['Entity', 'Type', 'Country', 'Purchase Date', 'Initial Value', 'Peak Value', 'Closing Value', 'Dividend']}
      rows={assets.map((asset) => [
        asset.entity,
        asset.type,
        asset.country,
        asset.purchaseDate,
        <Money key={`${asset.entity}-initial`} value={asset.initialValue} className="text-slate-100" />,
        <Money key={`${asset.entity}-peak`} value={asset.peakValue} className="text-slate-100" />,
        <Money key={`${asset.entity}-closing`} value={asset.closingValue} className="text-slate-100" />,
        <Money key={`${asset.entity}-dividend`} value={asset.dividend} className="text-slate-100" />,
      ])}
    />
  )
}

function InvestmentTable({ rows }: { rows: InvestmentSummaryRow[] }) {
  return (
    <SimpleTable
      headers={['Country', 'Entity', 'Type', 'Total Holdings', 'Current Value', 'Peak Value']}
      rows={rows.map((row) => [
        row.country,
        row.entity,
        row.type,
        row.holdingsCount,
        <Money key={`${row.entity}-current`} value={row.currentValue} className="text-slate-100" />,
        <Money key={`${row.entity}-peak`} value={row.peakValue} className="text-slate-100" />,
      ])}
    />
  )
}

function ChallanTable({ rows }: { rows: ChallanRow[] }) {
  return (
    <SimpleTable
      headers={['BSR Code', 'Date', 'Serial Number', 'Amount']}
      rows={rows.map((row) => [
        row.bsrCode,
        row.date,
        row.serialNumber,
        <Money key={`${row.bsrCode}-${row.serialNumber}`} value={row.amount} className="text-slate-100" />,
      ])}
    />
  )
}

function HistoryTable({ rows }: { rows: TaxViewModel['history'] }) {
  return (
    <SimpleTable
      headers={['Financial Year', 'Assessment Year', 'Gross Income', 'Tax Paid', 'Capital Gains', 'Regime', 'Status', 'Filed At']}
      rows={rows.map((row) => [
        row.financialYear,
        row.assessmentYear,
        <Money key={`${row.financialYear}-gross`} value={row.grossIncome} className="text-slate-100" />,
        <Money key={`${row.financialYear}-paid`} value={row.taxPaid} className="text-slate-100" />,
        <Money key={`${row.financialYear}-gains`} value={row.capitalGains} className="text-slate-100" />,
        row.regime,
        <span key={`${row.financialYear}-status`} className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{row.status}</span>,
        row.filedAt,
      ])}
    />
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className={`${pageCardClass} flex items-start gap-4 p-6`}>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-slate-400">
        <AlertCircle className="h-5 w-5" />
      </div>
      <div>
        <p className="text-base font-medium text-white">{message}</p>
        <p className="mt-1 text-sm text-slate-400">Select a filed financial year to load the mapped tax report.</p>
      </div>
    </div>
  )
}

function TaxDashboard({ data }: { data: TaxViewModel }) {
  return (
    <div className="space-y-6">
      <section className={`${pageCardClass} overflow-hidden`}>
        <div className="relative px-5 py-6 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.12),transparent_35%)]" />
          <div className="relative">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Tax Center</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">Income Tax Return Analysis</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Filed return snapshot for FY {data.header.financialYear} and AY {data.header.assessmentYear}.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`${innerCardClass} px-4 py-3`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Return Status</p>
                  <p className="mt-2 text-sm font-semibold text-emerald-300">{data.header.status}</p>
                </div>
                <div className={`${innerCardClass} px-4 py-3`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Form</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{data.header.form}</p>
                </div>
                <div className={`${innerCardClass} px-4 py-3`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Regime</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{data.header.regime}</p>
                </div>
                <div className={`${innerCardClass} px-4 py-3`}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Due Date</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{data.header.dueDate}</p>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <SummaryCards cards={data.summaryCards} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Section icon={<PieChart className="h-5 w-5" />} title="Income Sources" eyebrow="Overview">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <ChartList slices={data.incomeSources.slices} />
            <div className={`${innerCardClass} p-5`}>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Gross Income</p>
              <Money value={data.incomeSources.total} className="mt-3 block text-3xl font-semibold text-white" />
              <p className="mt-3 text-sm text-slate-400">
                The distribution is generated directly from salary, capital gains, interest, dividend, other income, and foreign income schedules in the ITR export.
              </p>
            </div>
          </div>
        </Section>

        <Section icon={<Wallet className="h-5 w-5" />} title="Tax Computation" eyebrow="Computation">
          <ComputationFlow rows={data.taxComputation} />
        </Section>
      </div>

      {data.capitalGains ? (
        <Section icon={<Landmark className="h-5 w-5" />} title="Capital Gains" eyebrow="Schedule CG">
          <div className="space-y-6">
            <MetricGrid rows={data.capitalGains.totals} columns={3} />
            <SimpleTable
              headers={['Segment', 'Sale Value', 'Purchase Value', 'Transfer Expenses', 'Net Gain', 'Taxable Gain', 'Special Tax Rate']}
              rows={data.capitalGains.lots.map((lot) => [
                lot.label,
                <Money key={`${lot.label}-sale`} value={lot.saleValue} className="text-slate-100" />,
                <Money key={`${lot.label}-purchase`} value={lot.purchaseValue} className="text-slate-100" />,
                <Money key={`${lot.label}-expense`} value={lot.transferExpenses} className="text-slate-100" />,
                <Money key={`${lot.label}-net`} value={lot.netGain} className="text-slate-100" />,
                <Money key={`${lot.label}-taxable`} value={lot.taxableGain} className="text-slate-100" />,
                lot.taxRateLabel ?? '—',
              ])}
            />
            {data.capitalGains.timeline.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {data.capitalGains.timeline.map((item) => (
                  <div key={item.label} className={`${innerCardClass} p-4`}>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <Money value={item.value} className="mt-3 block text-xl font-semibold text-white" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {data.foreignIncome ? (
        <Section icon={<ShieldCheck className="h-5 w-5" />} title="Foreign Income & Assets" eyebrow="Global Exposure">
          <div className="space-y-6">
            {data.foreignIncome.countries.length ? <ForeignCountryCards countries={data.foreignIncome.countries} /> : null}
            {data.foreignIncome.assets.length ? <ForeignAssetsTable assets={data.foreignIncome.assets} /> : null}
          </div>
        </Section>
      ) : null}

      {data.investmentSummary?.length ? (
        <Section icon={<PieChart className="h-5 w-5" />} title="Investment Summary" eyebrow="Foreign Holdings">
          <InvestmentTable rows={data.investmentSummary} />
        </Section>
      ) : null}

      {data.taxPayments ? (
        <Section icon={<Receipt className="h-5 w-5" />} title="Tax Payments" eyebrow="Schedule IT">
          <div className="space-y-6">
            <MetricGrid rows={data.taxPayments.metrics} columns={4} />
            {data.taxPayments.challans.length ? <ChallanTable rows={data.taxPayments.challans} /> : null}
          </div>
        </Section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {data.verification?.length ? (
          <Section icon={<CheckCircle2 className="h-5 w-5" />} title="Verification" eyebrow="Identity">
            <InfoGrid rows={data.verification} columns={2} />
          </Section>
        ) : null}

        <Section icon={<FileText className="h-5 w-5" />} title="Return Information" eyebrow="Metadata">
          <InfoGrid rows={data.returnInformation} columns={2} />
        </Section>
      </div>

      <Section icon={<FileText className="h-5 w-5" />} title="Documents" eyebrow="Source File">
        <InfoGrid rows={data.documents} columns={3} />
      </Section>

      <Section icon={<PieChart className="h-5 w-5" />} title="Analytics" eyebrow="Derived Views">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className={`${innerCardClass} p-5`}>
            <h3 className="text-sm font-semibold text-white">Income Distribution</h3>
            <div className="mt-4">
              <ChartList slices={data.analytics.incomeDistribution} />
            </div>
          </div>
          <div className={`${innerCardClass} p-5`}>
            <h3 className="text-sm font-semibold text-white">Tax Distribution</h3>
            <div className="mt-4">
              <ChartList slices={data.analytics.taxDistribution} />
            </div>
          </div>
          {data.analytics.capitalGainBreakdown.length ? (
            <div className={`${innerCardClass} p-5`}>
              <h3 className="text-sm font-semibold text-white">Capital Gain Breakdown</h3>
              <div className="mt-4">
                <ChartList slices={data.analytics.capitalGainBreakdown} />
              </div>
            </div>
          ) : null}
          {data.analytics.assetAllocation.length ? (
            <div className={`${innerCardClass} p-5`}>
              <h3 className="text-sm font-semibold text-white">Asset Allocation</h3>
              <div className="mt-4">
                <ChartList slices={data.analytics.assetAllocation} />
              </div>
            </div>
          ) : null}
          {data.analytics.foreignHoldings.length ? (
            <div className={`${innerCardClass} p-5 xl:col-span-2`}>
              <h3 className="text-sm font-semibold text-white">Foreign Holdings</h3>
              <div className="mt-4">
                <ChartList slices={data.analytics.foreignHoldings} />
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      <Section icon={<FileText className="h-5 w-5" />} title="Tax History" eyebrow="Timeline">
        <HistoryTable rows={data.history} />
      </Section>
    </div>
  )
}

export default function TaxCenterPage() {
  const yearsQuery = useTaxYearsQuery()
  const years = (yearsQuery.data ?? []) as TaxYear[]
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    if (selectedId === null && years[0]) {
      setSelectedId(years[0].id)
    }
  }, [years, selectedId])

  const selectedYear = years.find((year) => year.id === selectedId) ?? null
  const dashboardQuery = useTaxDashboard(selectedYear)
  const errorMessage = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : null

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-10">
      <header className={`${pageCardClass} px-5 py-5 sm:px-6`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Filed Returns</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Tax Center</h1>
            <p className="mt-2 text-sm text-slate-400">
              Financial years come from the database, while every report section is mapped from the uploaded ITR JSON.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500" htmlFor="tax-year-select">
              Financial Year
            </label>
            <select
              id="tax-year-select"
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(Number(event.target.value))}
              className="h-11 rounded-2xl border border-slate-700 bg-slate-900 px-4 text-sm text-slate-100 outline-none ring-0"
            >
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  FY {year.financial_year} / AY {year.assessment_year ?? '—'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {yearsQuery.isLoading ? <EmptyState message="Loading filed financial years..." /> : null}
      {!yearsQuery.isLoading && !selectedYear ? <EmptyState message="No return filed for this financial year." /> : null}
      {selectedYear && selectedYear.status !== 'Filed' && selectedYear.status !== 'Verified' ? (
        <EmptyState message="No return filed for this financial year." />
      ) : null}
      {selectedYear && dashboardQuery.isLoading ? <EmptyState message="Loading mapped tax dashboard..." /> : null}
      {selectedYear && errorMessage ? <EmptyState message={errorMessage} /> : null}
      {selectedYear && dashboardQuery.data ? <TaxDashboard data={dashboardQuery.data} /> : null}
    </div>
  )
}
