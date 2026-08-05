import type {
  CapitalGainLot,
  ForeignAssetRow,
  ForeignCountrySummary,
  InvestmentSummaryRow,
  TaxChartSlice,
  TaxDashboardConfig,
  TaxHistoryRow,
  TaxMetric,
  TaxViewModel,
} from '../config/tax/types'
import type { TaxYear } from '../lib/api'

type UnknownRecord = Record<string, unknown>

const asRecord = (value: unknown): UnknownRecord => (value && typeof value === 'object' ? (value as UnknownRecord) : {})

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const asObjectArray = (value: unknown): UnknownRecord[] => asArray(value).map((item) => asRecord(item))

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const text = (value: unknown, fallback = '—'): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return fallback
}

const cleanDate = (value: unknown, fallback = '—'): string => {
  const raw = text(value, fallback)
  return raw.includes('T') ? raw.slice(0, 10) : raw
}

const at = (value: unknown, ...keys: Array<string | number>): unknown =>
  keys.reduce<unknown>((current, key) => {
    if (Array.isArray(current)) {
      const index = typeof key === 'number' ? key : Number(key)
      return Number.isInteger(index) ? current[index] : undefined
    }
    return asRecord(current)[String(key)]
  }, value)

const groupBy = <T,>(items: T[], getKey: (item: T) => string) => {
  const groups = new Map<string, T[]>()
  items.forEach((item) => {
    const key = getKey(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  })
  return groups
}

const filterNonZero = <T extends { value: number }>(items: T[]) => items.filter((item) => item.value > 0)

const buildPercentageSlices = (items: Array<{ label: string; value: number; color: string }>): TaxChartSlice[] => {
  const filtered = filterNonZero(items)
  return filtered.length ? filtered : items
}

const moneyMetric = (label: string, value: number, tone?: TaxMetric['tone'], meta?: string, badge?: string): TaxMetric => ({
  label,
  value,
  tone,
  meta,
  badge,
})

const taxRateLabel = (label: string, taxableGain: number) => {
  if (!taxableGain) {
    return 'Nil'
  }
  if (label.includes('Long Term')) {
    return '20%'
  }
  return '15%'
}

const toTimeline = (lots: CapitalGainLot[]) =>
  lots
    .filter((lot) => lot.taxableGain !== 0)
    .map((lot) => ({
      label: lot.label,
      value: lot.taxableGain,
    }))

const toInvestmentSummary = (assets: ForeignAssetRow[]): InvestmentSummaryRow[] => {
  const groups = groupBy(assets, (asset) => `${asset.country}__${asset.entity}__${asset.type}`)
  return Array.from(groups.entries()).map(([key, rows]) => {
    const [country, entity, type] = key.split('__')
    return {
      country,
      entity,
      type,
      holdingsCount: rows.length,
      currentValue: rows.reduce((sum, row) => sum + row.closingValue, 0),
      peakValue: rows.reduce((sum, row) => sum + row.peakValue, 0),
    }
  })
}

export function mapTaxReport(raw: unknown, taxYear: TaxYear): TaxViewModel {
  const itr = at(raw, 'ITR', 'ITR2')
  const filing = asRecord(at(itr, 'PartA_GEN1', 'FilingStatus'))
  const ti = asRecord(at(itr, 'PartB-TI'))
  const tti = asRecord(at(itr, 'PartB_TTI'))
  const liability = asRecord(at(tti, 'ComputationOfTaxLiability'))
  const taxesPaid = asRecord(at(tti, 'TaxPaid', 'TaxesPaid'))
  const refund = asRecord(at(tti, 'Refund'))
  const form = asRecord(at(itr, 'Form_ITR2'))
  const creation = asRecord(at(itr, 'CreationInfo'))
  const verification = asRecord(at(itr, 'Verification'))
  const verificationDeclaration = asRecord(at(verification, 'Declaration'))
  const scheduleOS = asRecord(at(itr, 'ScheduleOS', 'IncOthThanOwnRaceHorse'))
  const scheduleFSI = asObjectArray(at(itr, 'ScheduleFSI', 'ScheduleFSIDtls'))
  const scheduleTR = asObjectArray(at(itr, 'ScheduleTR1', 'ScheduleTR'))
  const scheduleFA = asObjectArray(at(itr, 'ScheduleFA', 'DtlsForeignEquityDebtInterest'))
  const scheduleIT = asObjectArray(at(itr, 'ScheduleIT', 'TaxPayment'))
  const shortTerm = asRecord(at(itr, 'ScheduleCGFor23', 'ShortTermCapGainFor23'))
  const longTerm = asRecord(at(itr, 'ScheduleCGFor23', 'LongTermCapGain23'))

  const grossIncome = num(ti.GrossTotalIncome)
  const taxableIncome = num(ti.TotalIncome)
  const finalTax = num(at(liability, 'NetTaxLiability'))
  const taxPaid = num(taxesPaid.TotalTaxesPaid)
  const refundDue = num(refund.RefundDue)
  const outstanding = num(at(tti, 'TaxPaid', 'BalTaxPayable'))
  const salaryIncome = num(at(itr, 'ScheduleS', 'TotIncUnderHeadSalaries'))
  const shortTermGain = num(shortTerm.TotalSTCG)
  const longTermGain = num(longTerm.TotalLTCG)
  const interestIncome = num(scheduleOS.InterestGross)
  const dividendIncome = num(scheduleOS.DividendGross)
  const foreignIncomeTotal = scheduleFSI.reduce<number>((sum, item) => sum + num(at(item, 'IncOthSrc', 'IncFrmOutsideInd')), 0)
  const otherSourceTotal = num(at(ti, 'IncFromOS', 'OtherSrcThanOwnRaceHorse')) || num(scheduleOS.BalanceNoRaceHorse)
  const otherIncome = Math.max(otherSourceTotal - interestIncome - dividendIncome - foreignIncomeTotal, 0)
  const grossTax = num(at(liability, 'TaxPayableOnTI', 'TaxPayableOnTotInc'))
  const rebate = num(liability.Rebate87A)
  const specialRateTax = num(at(liability, 'TaxPayableOnTI', 'TaxAtSpecialRates')) || num(liability.TaxPayableOnRebate)
  const cess = num(liability.EducationCess)
  const regime = filing.OptOutNewTaxRegime === 'N' ? 'New Regime' : 'Old Regime'
  const filedAt = cleanDate(taxYear.filed_at ?? creation.JSONCreationDate)

  const incomeSlices = buildPercentageSlices([
    { label: 'Salary', value: salaryIncome, color: 'bg-cyan-400' },
    { label: 'Capital Gains', value: shortTermGain + longTermGain, color: 'bg-emerald-400' },
    { label: 'Interest', value: interestIncome, color: 'bg-amber-400' },
    { label: 'Dividend', value: dividendIncome, color: 'bg-violet-400' },
    { label: 'Other Income', value: otherIncome, color: 'bg-rose-400' },
    { label: 'Foreign Income', value: foreignIncomeTotal, color: 'bg-sky-400' },
  ])

  const shortTermLots: CapitalGainLot[] = [
    {
      label: 'Short Term Equity',
      saleValue: num(at(shortTerm, 'EquityMFonSTT', 0, 'EquityMFonSTTDtls', 'FullConsideration')),
      purchaseValue: num(at(shortTerm, 'EquityMFonSTT', 0, 'EquityMFonSTTDtls', 'DeductSec48', 'AquisitCost')),
      transferExpenses: num(at(shortTerm, 'EquityMFonSTT', 0, 'EquityMFonSTTDtls', 'DeductSec48', 'ExpOnTrans')),
      netGain: num(at(shortTerm, 'EquityMFonSTT', 0, 'EquityMFonSTTDtls', 'BalanceCG')),
      taxableGain: num(at(shortTerm, 'EquityMFonSTT', 0, 'EquityMFonSTTDtls', 'CapgainonAssets')) || shortTermGain,
      taxRateLabel: taxRateLabel('Short Term Equity', shortTermGain),
    },
  ].filter((lot) => lot.saleValue || lot.purchaseValue || lot.taxableGain)

  const longTermLots: CapitalGainLot[] = [
    {
      label: 'Long Term Equity',
      saleValue: num(at(longTerm, 'SaleOfEquityShareUs112A', 'FullValueConsideration')),
      purchaseValue: num(at(longTerm, 'SaleOfEquityShareUs112A', 'CostOfAcquisition')),
      transferExpenses: num(at(longTerm, 'SaleOfEquityShareUs112A', 'ExpOnTransfer')),
      netGain: num(at(longTerm, 'SaleOfEquityShareUs112A', 'BalanceCG')),
      taxableGain: num(at(longTerm, 'SaleOfEquityShareUs112A', 'CapgainonAssets')) || longTermGain,
      taxRateLabel: taxRateLabel('Long Term Equity', longTermGain),
    },
  ].filter((lot) => lot.saleValue || lot.purchaseValue || lot.taxableGain)

  const capitalGainLots = [...shortTermLots, ...longTermLots]

  const foreignCountries: ForeignCountrySummary[] = scheduleFSI.map((item, index) => {
    const relatedAssets = scheduleFA.filter((asset) => text(at(asset, 'CountryName')) === text(at(item, 'CountryName')))
    const trRow = asRecord(scheduleTR[index])
    return {
      country: text(at(item, 'CountryName')),
      income: num(at(item, 'IncOthSrc', 'IncFrmOutsideInd')),
      taxPaid: num(at(item, 'IncOthSrc', 'TaxPaidOutsideInd')) || num(at(item, 'TotalCountryWise', 'TaxPaidOutsideInd')),
      ftc: num(trRow.TaxPaidOutsideIndia),
      dtaaSection: trRow.ReliefClaimedUsSection ? `Section ${text(trRow.ReliefClaimedUsSection)}` : `Code ${text(at(item, 'IncOthSrc', 'DTAAReliefUs90or90A'))}`,
      holdingsCount: relatedAssets.length,
    }
  })

  const foreignAssets: ForeignAssetRow[] = scheduleFA.map((asset) => ({
    entity: text(at(asset, 'NameOfEntity')),
    type: text(at(asset, 'NatureOfEntity')),
    country: text(at(asset, 'CountryName')),
    purchaseDate: cleanDate(at(asset, 'InterestAcquiringDate')),
    initialValue: num(at(asset, 'InitialValOfInvstmnt')),
    peakValue: num(at(asset, 'PeakBalanceDuringPeriod')),
    closingValue: num(at(asset, 'ClosingBalance')),
    dividend: num(at(asset, 'TotGrossAmtPaidCredited')),
  }))

  const documents = [
    { label: 'Filename', value: `FY${taxYear.financial_year}_AY${taxYear.assessment_year}.json` },
    { label: 'Form', value: text(form.FormName) },
    { label: 'Created By', value: text(creation.JSONCreatedBy) },
    { label: 'Software', value: text(creation.SWCreatedBy) },
    { label: 'Creation Date', value: cleanDate(creation.JSONCreationDate) },
    { label: 'Digest', value: text(creation.Digest) },
    { label: 'Schema', value: text(form.SchemaVer) },
    { label: 'Version', value: text(form.FormVer) },
  ]

  const history: TaxHistoryRow[] = [
    {
      financialYear: taxYear.financial_year,
      assessmentYear: text(taxYear.assessment_year, text(form.AssessmentYear)),
      grossIncome,
      taxPaid,
      capitalGains: shortTermGain + longTermGain,
      regime,
      status: taxYear.status,
      filedAt,
    },
  ]

  const investmentSummary = toInvestmentSummary(foreignAssets)

  const model: TaxDashboardConfig = {
    header: {
      financialYear: taxYear.financial_year,
      assessmentYear: text(taxYear.assessment_year, text(form.AssessmentYear)),
      status: taxYear.status,
      filedAt,
      form: text(form.FormName),
      regime,
      dueDate: cleanDate(filing.ItrFilingDueDate),
    },
    summaryCards: [
      moneyMetric('Gross Income', grossIncome, 'neutral', 'Across all heads'),
      moneyMetric('Taxable Income', taxableIncome, 'neutral', 'Total income considered for tax'),
      moneyMetric('Final Tax', finalTax, finalTax > taxPaid ? 'amber' : 'neutral', 'Net liability after cess'),
      moneyMetric('Tax Paid', taxPaid, 'emerald', 'Advance tax, TDS, TCS and self-assessment'),
      moneyMetric('Refund', refundDue, refundDue > 0 ? 'emerald' : 'neutral', refundDue > 0 ? 'Receivable' : 'Nil'),
      moneyMetric('Outstanding', outstanding, outstanding > 0 ? 'rose' : 'emerald', outstanding > 0 ? 'Payable' : 'Settled'),
    ],
    incomeSources: {
      total: grossIncome,
      slices: incomeSlices,
    },
    capitalGains:
      shortTermGain || longTermGain || capitalGainLots.length
        ? {
            totals: [
              moneyMetric('Short Term', shortTermGain, shortTermGain > 0 ? 'amber' : 'neutral'),
              moneyMetric('Long Term', longTermGain, longTermGain > 0 ? 'emerald' : 'neutral'),
              moneyMetric('Sale Value', capitalGainLots.reduce((sum, lot) => sum + lot.saleValue, 0)),
              moneyMetric('Purchase Value', capitalGainLots.reduce((sum, lot) => sum + lot.purchaseValue, 0)),
              moneyMetric('Transfer Expenses', capitalGainLots.reduce((sum, lot) => sum + lot.transferExpenses, 0)),
              moneyMetric('Taxable Gain', capitalGainLots.reduce((sum, lot) => sum + lot.taxableGain, 0)),
            ],
            lots: capitalGainLots,
            timeline: toTimeline(capitalGainLots),
          }
        : undefined,
    taxComputation: [
      { label: 'Gross Tax', value: grossTax, tone: 'neutral', description: 'Tax on total income before reliefs' },
      { label: 'Rebate', value: rebate, tone: 'emerald', description: 'Rebate under section 87A' },
      { label: 'Special Rate Tax', value: specialRateTax, tone: 'sky', description: 'Special-rate tax after rebate' },
      { label: 'Education Cess', value: cess, tone: 'amber', description: 'Health and education cess' },
      { label: 'Final Tax', value: finalTax, tone: 'neutral', description: 'Net tax liability' },
      { label: 'Tax Paid', value: taxPaid, tone: 'emerald', description: 'Credits and payments available' },
      {
        label: refundDue > 0 ? 'Refund' : 'Outstanding',
        value: refundDue > 0 ? refundDue : outstanding,
        tone: refundDue > 0 ? 'emerald' : 'rose',
        description: refundDue > 0 ? 'Amount expected back' : 'Amount still payable',
      },
    ],
    foreignIncome:
      foreignCountries.length || foreignAssets.length
        ? {
            countries: foreignCountries,
            assets: foreignAssets,
          }
        : undefined,
    investmentSummary: investmentSummary.length ? investmentSummary : undefined,
    taxPayments: {
      metrics: [
        moneyMetric('Advance Tax', num(taxesPaid.AdvanceTax), 'emerald'),
        moneyMetric('Self Assessment', num(taxesPaid.SelfAssessmentTax), 'amber'),
        moneyMetric('TDS', num(taxesPaid.TDS), 'sky'),
        moneyMetric('TCS', num(taxesPaid.TCS), 'neutral'),
      ],
      challans: scheduleIT.map((entry) => ({
        bsrCode: text(at(entry, 'BSRCode')),
        date: cleanDate(at(entry, 'DateDep')),
        serialNumber: text(at(entry, 'SrlNoOfChaln')),
        amount: num(at(entry, 'Amt')),
      })),
    },
    verification: [
      { label: 'Name', value: text(verificationDeclaration.AssesseeVerName) },
      { label: 'PAN', value: text(verificationDeclaration.AssesseeVerPAN) },
      { label: 'Father Name', value: text(verificationDeclaration.FatherName) },
      { label: 'Place', value: text(verification.Place) },
      { label: 'Date', value: cleanDate(verification.Date) },
      { label: 'Capacity', value: text(verification.Capacity) },
    ].filter((row) => row.value !== '—'),
    returnInformation: [
      { label: 'ITR Form', value: text(form.FormName) },
      { label: 'Assessment Year', value: text(taxYear.assessment_year, text(form.AssessmentYear)) },
      { label: 'Schema Version', value: text(form.SchemaVer) },
      { label: 'Form Version', value: text(form.FormVer) },
      { label: 'Residential Status', value: text(filing.ResidentialStatus) },
      { label: 'Tax Regime', value: regime },
      { label: 'Return Section', value: text(filing.ReturnFileSec) },
      { label: 'Filing Due Date', value: cleanDate(filing.ItrFilingDueDate) },
      { label: 'Return Status', value: taxYear.status },
    ],
    documents,
    analytics: {
      incomeDistribution: incomeSlices,
      taxDistribution: buildPercentageSlices([
        { label: 'Gross Tax', value: grossTax, color: 'bg-slate-300' },
        { label: 'Rebate', value: rebate, color: 'bg-emerald-400' },
        { label: 'Special Rate Tax', value: specialRateTax, color: 'bg-sky-400' },
        { label: 'Cess', value: cess, color: 'bg-amber-400' },
      ]),
      capitalGainBreakdown: buildPercentageSlices([
        { label: 'Short Term', value: shortTermGain, color: 'bg-amber-400' },
        { label: 'Long Term', value: longTermGain, color: 'bg-emerald-400' },
      ]),
      assetAllocation: buildPercentageSlices(
        Array.from(groupBy(foreignAssets, (asset) => asset.type).entries()).map(([label, items], index) => ({
          label,
          value: items.reduce((sum, item) => sum + item.closingValue, 0),
          color: ['bg-cyan-400', 'bg-violet-400', 'bg-emerald-400', 'bg-amber-400'][index % 4],
        })),
      ),
      foreignHoldings: buildPercentageSlices(
        Array.from(groupBy(foreignAssets, (asset) => asset.country).entries()).map(([label, items], index) => ({
          label,
          value: items.reduce((sum, item) => sum + item.closingValue, 0),
          color: ['bg-sky-400', 'bg-rose-400', 'bg-emerald-400', 'bg-cyan-400'][index % 4],
        })),
      ),
    },
    history,
  }

  return model
}

export type SummaryCard = TaxViewModel['summaryCards'][number]

export function formatTaxValue(value: number | string, format?: 'money' | 'text'): string {
  if (format === 'text') {
    return text(value)
  }
  const amount = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(amount)) {
    return text(value)
  }
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}
