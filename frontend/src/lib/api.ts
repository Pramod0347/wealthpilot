const DEFAULT_API_BASE_URL = 'http://localhost:8000'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null)
      if (payload && typeof payload === 'object' && 'detail' in payload) {
        const detail = payload.detail
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

        const message = typeof detail === 'string' ? detail : 'Request failed'
        throw new ApiError(message, response.status)
      }
    }

    const message = await response.text()
    throw new ApiError(message || `Request failed with status ${response.status}`, response.status)
  }

  return response.json() as Promise<T>
}
