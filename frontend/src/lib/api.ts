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
