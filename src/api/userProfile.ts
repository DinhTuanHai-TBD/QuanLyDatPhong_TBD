import { http } from './http'
import { getUserEmail, getUserRole } from './authUtils'

export interface UserProfileData {
  id?: string | number
  email?: string
  fullName?: string
  phoneNumber?: string
  department?: string
  userCode?: string
  isProfileComplete?: boolean
  role?: string
}

export const getStorageKey = (email?: string) => {
  const targetEmail = email || getUserEmail() || 'default'
  return `tbd_user_profile_${targetEmail.toLowerCase().trim()}`
}

/**
 * Lấy thông tin hồ sơ người dùng thực tế từ API GET /api/auth/me
 * Kèm cơ chế fallback bộ nhớ cache nếu backend offline.
 */
export async function fetchUserProfile(): Promise<UserProfileData> {
  const token = localStorage.getItem('accessToken')
  if (!token) {
    throw new Error('Chưa đăng nhập')
  }

  const email = getUserEmail()
  const tokenRole = getUserRole()
  const storageKey = getStorageKey(email)

  try {
    const res = await http.get<UserProfileData>('/api/auth/me')
    if (res.data && typeof res.data === 'object') {
      const serverData = res.data
      const isComplete = Boolean(
        serverData.fullName?.trim() &&
        serverData.phoneNumber?.trim() &&
        serverData.department?.trim()
      )
      
      const merged: UserProfileData = {
        ...serverData,
        email: serverData.email || email,
        isProfileComplete: isComplete,
        role: serverData.role || (tokenRole === 'admin' ? 'Admin' : tokenRole === 'lecturer' ? 'Faculty' : tokenRole === 'staff' ? 'Staff' : 'Student')
      }
      localStorage.setItem(storageKey, JSON.stringify(merged))
      return merged
    }
  } catch (err) {
    console.warn('Không thể kết nối máy chủ API /api/auth/me, sử dụng dữ liệu cục bộ', err)
  }

  // Fallback đọc từ localStorage
  const cached = localStorage.getItem(storageKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  }

  // Khởi tạo hồ sơ mặc định nếu chưa từng cập nhật
  const roleDisplay = tokenRole === 'admin' ? 'Admin' : tokenRole === 'lecturer' ? 'Faculty' : tokenRole === 'staff' ? 'Staff' : 'Student'
  const initialProfile: UserProfileData = {
    email: email || '',
    fullName: '',
    phoneNumber: '',
    department: '',
    userCode: '',
    isProfileComplete: false,
    role: roleDisplay
  }
  return initialProfile
}

/**
 * Cập nhật hồ sơ người dùng vĩnh viễn vào Database qua API PUT /api/auth/profile
 */
export async function updateUserProfile(data: Partial<UserProfileData>): Promise<UserProfileData> {
  const email = getUserEmail()
  const storageKey = getStorageKey(email)

  let current: Partial<UserProfileData> = {}
  const cached = localStorage.getItem(storageKey)
  if (cached) {
    try {
      current = JSON.parse(cached)
    } catch {
      // Bỏ qua
    }
  }

  const isComplete = Boolean(
    (data.fullName ?? current.fullName)?.trim() &&
    (data.phoneNumber ?? current.phoneNumber)?.trim() &&
    (data.department ?? current.department)?.trim()
  )

  const updatedPayload: UserProfileData = {
    ...current,
    ...data,
    email: email || current.email || '',
    isProfileComplete: isComplete,
    role: data.role || current.role || (getUserRole() === 'admin' ? 'Admin' : 'Student')
  }

  try {
    const res = await http.put<UserProfileData>('/api/auth/profile', updatedPayload)
    if (res.data && typeof res.data === 'object') {
      const merged: UserProfileData = {
        ...updatedPayload,
        ...res.data,
        isProfileComplete: isComplete
      }
      localStorage.setItem(storageKey, JSON.stringify(merged))
      return merged
    }
  } catch (err) {
    console.warn('Lỗi khi gọi API PUT /api/auth/profile, lưu trữ cục bộ:', err)
  }

  localStorage.setItem(storageKey, JSON.stringify(updatedPayload))
  return updatedPayload
}
