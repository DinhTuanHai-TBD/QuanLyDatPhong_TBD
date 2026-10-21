import { http } from './http'
import { getUserEmail, getUserRole } from './authUtils'
import { normalizeDepartmentName } from '../utils/academicPrograms'

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

export const KNOWN_ACCOUNTS: Record<string, Partial<UserProfileData>> = {
  'giangvien@tbd.edu.vn': {
    fullName: 'TS. Trần Văn Nam',
    department: 'Khoa Công nghệ thông tin và Bán dẫn',
    phoneNumber: '0912345678',
    role: 'Faculty',
    userCode: 'GV-CNTT-08',
  },
  'admin@tbd.edu.vn': {
    fullName: 'Ban Quản trị Cơ sở vật chất',
    department: 'Phòng Quản trị thiết bị & Ban Quản trị',
    phoneNumber: '02583727147',
    role: 'Admin',
    userCode: 'AD-TBD-01',
  },
  'quanly@tbd.edu.vn': {
    fullName: 'ThS. Nguyễn Văn Đức',
    department: 'Phòng Quản lý Đào tạo & Cơ sở vật chất TBD',
    phoneNumber: '02583727148',
    role: 'Approver',
    userCode: 'QL-TBD-01',
  },
  'hai.230057@tbd.edu.vn': {
    fullName: 'Nguyễn Văn Hải',
    department: 'Khoa Công nghệ thông tin và Bán dẫn',
    phoneNumber: '0939393939',
    role: 'Student',
    userCode: '230057',
  },
}

export function getCachedUserProfile(): UserProfileData | null {
  const email = (getUserEmail() || '').toLowerCase().trim()
  const tokenRole = getUserRole()
  const storageKey = getStorageKey(email)

  let cachedData: Partial<UserProfileData> = {}
  const cached = localStorage.getItem(storageKey)
  if (cached) {
    try {
      const parsed = JSON.parse(cached)
      if (parsed && typeof parsed === 'object') {
        cachedData = parsed
      }
    } catch {}
  }

  // Lấy dữ liệu mặc định theo tài khoản nếu thiếu
  let defaultData: Partial<UserProfileData> = {}
  if (KNOWN_ACCOUNTS[email]) {
    defaultData = KNOWN_ACCOUNTS[email]
  } else if (email.includes('giangvien') || tokenRole === 'lecturer') {
    defaultData = KNOWN_ACCOUNTS['giangvien@tbd.edu.vn']
  } else if (email.includes('quanly') || email.includes('daotao') || tokenRole === 'approver') {
    defaultData = KNOWN_ACCOUNTS['quanly@tbd.edu.vn']
  } else if (email.includes('admin') || tokenRole === 'admin') {
    defaultData = KNOWN_ACCOUNTS['admin@tbd.edu.vn']
  } else if (email.includes('230057') || email.includes('hai.')) {
    defaultData = KNOWN_ACCOUNTS['hai.230057@tbd.edu.vn']
  }

  const roleDisplay = tokenRole === 'admin' ? 'Admin' : tokenRole === 'lecturer' ? 'Faculty' : tokenRole === 'staff' ? 'Staff' : 'Student'
  const merged: UserProfileData = {
    email: email || cachedData.email || defaultData.email || '',
    fullName: cachedData.fullName?.trim() || defaultData.fullName || '',
    department: normalizeDepartmentName(cachedData.department || defaultData.department || ''),
    phoneNumber: cachedData.phoneNumber?.trim() || defaultData.phoneNumber || '',
    userCode: cachedData.userCode?.trim() || defaultData.userCode || '',
    role: cachedData.role || defaultData.role || roleDisplay,
    isProfileComplete: Boolean(
      (cachedData.fullName?.trim() || defaultData.fullName) &&
      (cachedData.department?.trim() || defaultData.department)
    ),
  }

  return merged
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

  const email = (getUserEmail() || '').toLowerCase().trim()
  const tokenRole = getUserRole()
  const storageKey = getStorageKey(email)
  const cachedFallback = getCachedUserProfile()

  try {
    const res = await http.get<UserProfileData>('/api/auth/me')
    if (res.data && typeof res.data === 'object') {
      const serverData = res.data
      const rawDept = serverData.department || cachedFallback?.department || ''
      const normalizedDept = normalizeDepartmentName(rawDept)
      const fullName = serverData.fullName?.trim() || cachedFallback?.fullName || ''
      const phoneNumber = serverData.phoneNumber?.trim() || cachedFallback?.phoneNumber || ''
      const isComplete = Boolean(fullName && phoneNumber && normalizedDept)
      
      const merged: UserProfileData = {
        ...cachedFallback,
        ...serverData,
        fullName,
        phoneNumber,
        department: normalizedDept,
        email: serverData.email || email,
        isProfileComplete: isComplete,
        role: serverData.role || cachedFallback?.role || (tokenRole === 'admin' ? 'Admin' : tokenRole === 'lecturer' ? 'Faculty' : tokenRole === 'staff' ? 'Staff' : 'Student')
      }
      localStorage.setItem(storageKey, JSON.stringify(merged))
      return merged
    }
  } catch (err) {
    console.warn('Không thể kết nối máy chủ API /api/auth/me, sử dụng dữ liệu cục bộ', err)
  }

  if (cachedFallback) {
    return cachedFallback
  }

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

  const deptToUse = data.department !== undefined ? data.department : current.department
  const normalizedDept = normalizeDepartmentName(deptToUse)

  const isComplete = Boolean(
    (data.fullName ?? current.fullName)?.trim() &&
    (data.phoneNumber ?? current.phoneNumber)?.trim() &&
    normalizedDept?.trim()
  )

  const updatedPayload: UserProfileData = {
    ...current,
    ...data,
    department: normalizedDept,
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
        department: normalizeDepartmentName(res.data.department || updatedPayload.department),
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
