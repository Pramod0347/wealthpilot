import { getTaxDashboard } from '../lib/api'

export class TaxConfigService {
  getTaxData(taxYearId: number, signal?: AbortSignal): Promise<unknown> {
    return getTaxDashboard(taxYearId, signal)
  }
}

export const taxConfigService = new TaxConfigService()
