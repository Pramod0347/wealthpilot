const DEFAULT_API_BASE_URL = 'http://localhost:8000'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL

export type BankAccount = {
  id: number
  bank_name: string
  account_name: string | null
  account_type: 'savings' | 'current' | 'salary' | 'fd' | 'other'
  account_number_last4: string | null
  balance: string | number
  currency: string
  notes: string | null
  as_of_date: string | null
  created_at: string
  updated_at: string
}

export type BankAccountsSummary = {
  total_cash: string | number
  accounts_count: number
  currency: string
}

export type BankAccountPayload = {
  bank_name: string
  account_name: string | null
  account_type: 'savings' | 'current' | 'salary' | 'fd' | 'other'
  account_number_last4: string | null
  balance: string
  currency: string
  notes: string | null
  as_of_date: string | null
}

export type FixedSavingsAccount = {
  id: number
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  account_name: string
  provider_name: string | null
  account_number_last4: string | null
  employee_contribution: string | number
  employer_contribution: string | number
  self_contribution: string | number
  interest_earned: string | number
  current_value: string | number
  interest_rate: string | number | null
  start_date: string | null
  maturity_date: string | null
  as_of_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  total_contribution: string | number
  gain_or_interest: string | number
  return_pct: string | number
}

export type FixedSavingsByTypeSummary = {
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  current_value: string | number
  total_contribution: string | number
  interest_earned: string | number
  count: number
}

export type FixedSavingsSummary = {
  total_value: string | number
  total_contribution: string | number
  total_interest: string | number
  accounts_count: number
  by_type: FixedSavingsByTypeSummary[]
}

export type FixedSavingsAccountPayload = {
  account_type: 'epf' | 'ppf' | 'vpf' | 'nps' | 'fd' | 'rd' | 'other'
  account_name: string
  provider_name: string | null
  account_number_last4: string | null
  employee_contribution: string
  employer_contribution: string
  self_contribution: string
  interest_earned: string
  current_value: string
  interest_rate: string | null
  start_date: string | null
  maturity_date: string | null
  as_of_date: string | null
  notes: string | null
}

export type CashflowEntry = {
  id: number
  month: string
  entry_type: 'income' | 'expense'
  category: string
  source: string | null
  amount: string | number
  notes: string | null
  created_at: string
  updated_at: string
}

export type CashflowCategoryBreakdownItem = {
  category: string
  amount: string | number
  percentage: string | number
}

export type CashflowSummary = {
  month: string
  total_income: string | number
  total_expense: string | number
  net_savings: string | number
  savings_rate: string | number
  income_count: number
  expense_count: number
  expenses_by_category: CashflowCategoryBreakdownItem[]
  income_by_category: CashflowCategoryBreakdownItem[]
}

export type CashflowEntryPayload = {
  month: string
  entry_type: 'income' | 'expense'
  category: string
  source: string | null
  amount: string
  notes: string | null
}

export type ApiValidationError = {
  path: string
  message: string
}

export class ApiError extends Error {
  status: number
  validationErrors: ApiValidationError[]

  constructor(message: string, status: number, validationErrors: ApiValidationError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.validationErrors = validationErrors
  }
}

type FetchOptions = RequestInit & {
  signal?: AbortSignal
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { headers: optionHeaders, ...requestOptions } = options
  const url = `${API_BASE_URL}${path}`
  const method = (requestOptions.method ?? 'GET').toUpperCase()
  const hasBody = requestOptions.body !== undefined && requestOptions.body !== null

  let response: Response
  try {
    response = await fetch(url, {
      ...requestOptions,
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(optionHeaders ?? {}),
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    const message = error instanceof Error ? error.message : 'Network request failed'
    if (message.includes('Failed to fetch')) {
      throw new ApiError('Network/preflight failed. Check backend terminal for OPTIONS/PATCH logs.', 0)
    }
    throw new ApiError(`${method} ${url} failed: ${message}`, 0)
  }

  if (response.status === 204) {
    return undefined as T
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()

    if (contentType.includes('application/json') && text) {
      try {
        const payload = JSON.parse(text) as unknown
        if (payload && typeof payload === 'object' && 'detail' in payload) {
          const detail = (payload as { detail: unknown }).detail
          if (Array.isArray(detail)) {
            const validationErrors = detail
              .map((item) => {
                if (!item || typeof item !== 'object') {
                  return null
                }
                const path = Array.isArray((item as { loc?: unknown }).loc)
                  ? (item as { loc?: Array<string | number> }).loc?.slice(1).join('.')
                  : ''
                const message = typeof (item as { msg?: unknown }).msg === 'string' ? (item as { msg: string }).msg : 'Invalid value'
                return {
                  path,
                  message,
                }
              })
              .filter((item): item is ApiValidationError => item !== null)

            throw new ApiError('Validation failed', response.status, validationErrors)
          }

          if (typeof detail === 'string') {
            throw new ApiError(detail, response.status)
          }
        }
        throw new ApiError(JSON.stringify(payload, null, 2), response.status)
      } catch (parseError) {
        if (parseError instanceof ApiError) {
          throw parseError
        }
        throw new ApiError(text, response.status)
      }
    }

    throw new ApiError(text || `Request failed with status ${response.status}`, response.status)
  }

  const text = await response.text()
  if (!text) {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return JSON.parse(text) as T
  }

  return text as T
}

export function getBankAccounts(signal?: AbortSignal) {
  return apiFetch<BankAccount[]>('/api/bank-accounts', { signal })
}

export function getBankAccountsSummary(signal?: AbortSignal) {
  return apiFetch<BankAccountsSummary>('/api/bank-accounts/summary', { signal })
}

export function createBankAccount(payload: BankAccountPayload) {
  return apiFetch<BankAccount>('/api/bank-accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateBankAccount(accountId: number, payload: BankAccountPayload) {
  return apiFetch<BankAccount>(`/api/bank-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteBankAccount(accountId: number) {
  return apiFetch<void>(`/api/bank-accounts/${accountId}`, {
    method: 'DELETE',
  })
}

export function getFixedSavingsAccounts(signal?: AbortSignal) {
  return apiFetch<FixedSavingsAccount[]>('/api/fixed-savings', { signal })
}

export function getFixedSavingsSummary(signal?: AbortSignal) {
  return apiFetch<FixedSavingsSummary>('/api/fixed-savings/summary', { signal })
}

export function createFixedSavingsAccount(payload: FixedSavingsAccountPayload) {
  return apiFetch<FixedSavingsAccount>('/api/fixed-savings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateFixedSavingsAccount(accountId: number, payload: FixedSavingsAccountPayload) {
  return apiFetch<FixedSavingsAccount>(`/api/fixed-savings/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteFixedSavingsAccount(accountId: number) {
  return apiFetch<void>(`/api/fixed-savings/${accountId}`, {
    method: 'DELETE',
  })
}

export function getCashflowEntries(month?: string, signal?: AbortSignal) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch<CashflowEntry[]>(`/api/cashflow${query}`, { signal })
}

export function getCashflowSummary(month?: string, signal?: AbortSignal) {
  const query = month ? `?month=${encodeURIComponent(month)}` : ''
  return apiFetch<CashflowSummary>(`/api/cashflow/summary${query}`, { signal })
}

export function getCashflowMonths(signal?: AbortSignal) {
  return apiFetch<string[]>('/api/cashflow/months', { signal })
}

export function createCashflowEntry(payload: CashflowEntryPayload) {
  return apiFetch<CashflowEntry>('/api/cashflow', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateCashflowEntry(entryId: number, payload: CashflowEntryPayload) {
  return apiFetch<CashflowEntry>(`/api/cashflow/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteCashflowEntry(entryId: number) {
  return apiFetch<void>(`/api/cashflow/${entryId}`, {
    method: 'DELETE',
  })
}
