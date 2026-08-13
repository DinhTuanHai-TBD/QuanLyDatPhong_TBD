export interface UserProfile {
  email: string
  role: string
  name?: string
}

/**
 * Decodes a JWT token safely in the browser without external dependencies.
 */
export function decodeToken(token: string): any {
  try {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch (error) {
    console.error('Error decoding JWT token:', error)
    return null
  }
}

export type UserRole = 'student' | 'lecturer' | 'staff' | 'approver' | 'admin' | 'unknown';

/**
 * Retrieves the current user's role from the token.
 */
export function getUserRole(): UserRole {
  const token = localStorage.getItem('accessToken')
  if (!token) return 'unknown'

  const payload = decodeToken(token)
  if (!payload) return 'unknown'

  const roleClaim = 
    payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || 
    payload['role'] || 
    payload['roles'] || 
    payload['UserRole']

  if (roleClaim) {
    const roleStr = String(roleClaim).toLowerCase()
    if (roleStr.includes('admin') || roleStr.includes('quản trị')) return 'admin'
    if (roleStr.includes('approver') || roleStr.includes('duyệt')) return 'approver'
    if (roleStr.includes('staff') || roleStr.includes('cán bộ') || roleStr.includes('nhân viên')) return 'staff'
    if (roleStr.includes('lecturer') || roleStr.includes('giảng viên')) return 'lecturer'
    if (roleStr.includes('student') || roleStr.includes('sinh viên')) return 'student'
  }
  
  console.warn("Lưu ý Backend: Token JWT hiện tại chưa có thông tin role (claim role). Cần bổ sung claim role với các giá trị như: student, lecturer, staff, approver, admin để phân quyền chính xác.")

  // Fallback to check email
  const emailClaim = 
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
    payload['email'] || 
    payload['sub']

  if (emailClaim) {
    const emailStr = String(emailClaim).toLowerCase();
    if (emailStr.includes('admin')) return 'admin'
    if (emailStr.includes('approver')) return 'approver'
  }

  return 'student' // Default fallback
}

/**
 * Retrieves the current user's email from the token.
 */
export function getUserEmail(): string {
  const token = localStorage.getItem('accessToken')
  if (!token) return ''
  
  const payload = decodeToken(token)
  if (!payload) return 'user@tbd.edu.vn'
  
  const emailClaim = 
    payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
    payload['email'] || 
    payload['sub']
    
  return emailClaim ? String(emailClaim) : 'user@tbd.edu.vn'
}
