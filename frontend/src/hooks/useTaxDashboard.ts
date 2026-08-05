import { useQuery } from '@tanstack/react-query'
import type { TaxYear } from '../lib/api'
import { taxConfigService } from '../services/taxConfigService'
import { mapTaxReport } from '../services/taxMapper'

export function useTaxDashboard(taxYear: TaxYear | null) {
  const isFiled = taxYear?.status === 'Filed' || taxYear?.status === 'Verified'
  return useQuery({
    queryKey: ['taxDashboard', taxYear?.id ?? 'none'],
    queryFn: ({ signal }) => taxConfigService.getTaxData(taxYear!.id, signal),
    select: (raw) => mapTaxReport(raw, taxYear!),
    enabled: Boolean(taxYear && isFiled),
  })
}
