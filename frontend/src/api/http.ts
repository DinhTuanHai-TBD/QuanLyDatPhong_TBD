import axios from 'axios'

const envUrl = import.meta.env.VITE_API_URL?.trim()
const targetBaseUrl =
  envUrl &&
  !envUrl.includes('tartness') &&
  !envUrl.includes('subsector') &&
  !envUrl.includes('skyrocket-humorous-that')
    ? envUrl
    : 'https://cos-arrangement-sperm-magnitude.trycloudflare.com'

export const http = axios.create({
  baseURL: targetBaseUrl,
  timeout: 15000,
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
 * - Do NOT retry canceled requests, 401/403/404, or client data errors (400, 422, etc.).
 * - POST / PUT / DELETE mutations must NOT auto-retry.
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
    if (status === 401 || status === 403 || status === 404) return false
    if ([408, 429, 500, 502, 503, 504].includes(status)) {
      return true
    }
    return false
  }
  return true
}

/**
 * Formats API errors with clear, distinct messages:
 * - Timeout: "Máy chủ phản hồi quá lâu. Vui lòng thử lại."
 * - Network error / no response: "Không thể kết nối với máy chủ. Vui lòng thử lại sau."
 * - HTTP 503: "Máy chủ tạm thời không thể tải dữ liệu. Vui lòng thử lại sau."
 * - HTTP 404: "Không tìm thấy địa chỉ API trên máy chủ (HTTP 404). Vui lòng kiểm tra lại cấu hình kết nối." (không kết luận sai tài khoản/mật khẩu)
 * - HTTP 401 on login: displays backend auth error message.
 */
export function formatApiError(error: any, options?: { context?: 'login' | 'general' }): string {
  if (!error) return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại.'

  // 1. Timeout
  if (
    error.code === 'ECONNABORTED' ||
    error.code === 'ETIMEDOUT' ||
    String(error.message).toLowerCase().includes('timeout')
  ) {
    return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.'
  }

  // 2. Lỗi mạng / Không nhận được phản hồi từ máy chủ
  if (
    error.code === 'ERR_NETWORK' ||
    (!error.response && Boolean(error.request)) ||
    String(error.message).toLowerCase().includes('network error')
  ) {
    return 'Không thể kết nối với máy chủ. Vui lòng thử lại sau.'
  }

  const status = error.response?.status
  const ngrokCode = error.response?.headers?.['ngrok-error-code']
  if (ngrokCode === 'ERR_NGROK_3200') {
    return 'Máy chủ ngrok đang ngoại tuyến (ERR_NGROK_3200). Vui lòng khởi động lại tunnel ngrok trên máy chủ backend.'
  }
  if (ngrokCode) {
    return `Lỗi đường truyền ngrok (${ngrokCode}). Vui lòng kiểm tra lại trạng thái máy chủ ngrok.`
  }

  const serverData = error.response?.data
  const serverMsg =
    (typeof serverData === 'string' && !serverData.trim().startsWith('<') ? serverData : null) ||
    serverData?.message ||
    serverData?.title ||
    serverData?.error

  // 3. HTTP 503
  if (status === 503) {
    return 'Máy chủ tạm thời không thể tải dữ liệu. Vui lòng thử lại sau.'
  }

  // 4. HTTP 404 (Không kết luận sai tài khoản hoặc mật khẩu)
  if (status === 404) {
    return 'Không tìm thấy địa chỉ API trên máy chủ (HTTP 404). Vui lòng kiểm tra lại cấu hình kết nối.'
  }

  // 5. HTTP 401 khi đăng nhập hoặc gọi API
  if (status === 401) {
    if (options?.context === 'login') {
      return serverMsg || 'Tài khoản hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
    }
    return serverMsg || 'Phiên làm việc đã hết hạn hoặc chưa được xác thực. Vui lòng đăng nhập lại.'
  }

  // 6. Thông báo từ backend cho các mã lỗi khác (như 400, 409, 422,...)
  if (serverMsg) {
    return String(serverMsg)
  }

  if (status === 403) {
    return 'Bạn không có quyền thực hiện thao tác này.'
  }

  if (status && status >= 500) {
    return `Lỗi máy chủ nội bộ (HTTP ${status}). Vui lòng thử lại sau.`
  }

  return error.message || 'Đã có lỗi xảy ra khi xử lý dữ liệu. Vui lòng thử lại sau.'
}

