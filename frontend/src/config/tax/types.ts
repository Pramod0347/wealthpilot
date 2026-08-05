export type TaxTone = 'neutral' | 'emerald' | 'rose' | 'sky' | 'amber'

export type TaxMetric = {
  label: string
  value: number
  tone?: TaxTone
  meta?: string
  badge?: string
}

export type TaxInfoRow = {
  label: string
  value: string
}

export type TaxAmountRow = {
  label: string
  value: number
  tone?: TaxTone
}

export type TaxChartSlice = {
  label: string
  value: number
  color: string
}

export type TaxComputationStep = {
  label: string
  value: number
  tone?: TaxTone
  description?: string
}

export type CapitalGainLot = {
  label: string
  saleValue: number
  purchaseValue: number
  transferExpenses: number
  netGain: number
  taxableGain: number
  taxRateLabel?: string
}

export type ForeignCountrySummary = {
  country: string
  income: number
  taxPaid: number
  ftc: number
  dtaaSection: string
  holdingsCount: number
}

export type ForeignAssetRow = {
  entity: string
  type: string
  country: string
  purchaseDate: string
  initialValue: number
  peakValue: number
  closingValue: number
  dividend: number
}

export type InvestmentSummaryRow = {
  country: string
  entity: string
  type: string
  holdingsCount: number
  currentValue: number
  peakValue: number
}

export type ChallanRow = {
  bsrCode: string
  date: string
  serialNumber: string
  amount: number
}

export type DocumentRow = {
  label: string
  value: string
}

export type TaxHistoryRow = {
  financialYear: string
  assessmentYear: string
  grossIncome: number
  taxPaid: number
  capitalGains: number
  regime: string
  status: string
  filedAt: string
}

export type TaxViewModel = {
  header: {
    financialYear: string
    assessmentYear: string
    status: string
    filedAt: string
    form: string
    regime: string
    dueDate: string
  }
  summaryCards: TaxMetric[]
  incomeSources: {
    total: number
    slices: TaxChartSlice[]
  }
  capitalGains?: {
    totals: TaxMetric[]
    lots: CapitalGainLot[]
    timeline: Array<{ label: string; value: number }>
  }
  taxComputation: TaxComputationStep[]
  foreignIncome?: {
    countries: ForeignCountrySummary[]
    assets: ForeignAssetRow[]
  }
  investmentSummary?: InvestmentSummaryRow[]
  taxPayments?: {
    metrics: TaxMetric[]
    challans: ChallanRow[]
  }
  verification?: TaxInfoRow[]
  returnInformation: TaxInfoRow[]
  documents: DocumentRow[]
  analytics: {
    incomeDistribution: TaxChartSlice[]
    taxDistribution: TaxChartSlice[]
    capitalGainBreakdown: TaxChartSlice[]
    assetAllocation: TaxChartSlice[]
    foreignHoldings: TaxChartSlice[]
  }
  history: TaxHistoryRow[]
}

export type TaxDashboardConfig = TaxViewModel
