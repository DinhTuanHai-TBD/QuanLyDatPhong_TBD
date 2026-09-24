import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://skyrocket-humorous-that.ngrok-free.dev',
  timeout: 10000,
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

/**
 * Retry policy for GET requests:
 * - Retry at most 1 time for network errors or HTTP 408, 429, 500, 502, 503, 504.
 * - Do NOT retry canceled requests, 401/403, or data errors (400, 404, 422, etc.).
 */
export function shouldRetryQuery(failureCount: number, error: any): boolean {
  if (failureCount >= 1) return false
  if (
    error?.name === 'CanceledError' ||
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'AbortError' ||
    error?.message === 'canceled'
  ) {
    return false
  }
  const status = error?.response?.status
  if (status) {
    if (status === 401 || status === 403) return false
    if ([408, 429, 500, 502, 503, 504].includes(status)) {
      return true
    }
    return false
  }
  return true
}

