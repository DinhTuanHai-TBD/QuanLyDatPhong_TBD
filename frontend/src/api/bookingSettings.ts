import { useQuery } from '@tanstack/react-query'
import { http } from './http'
import dayjs from 'dayjs'
import { toVN } from '../utils/dateUtils'

export interface ClosedPeriod {
  roomId: number | null // null = campus-wide (Toàn trường), number = specific room
  start: string         // ISO UTC (e.g. "2026-12-31T17:00:00Z")
  end: string           // ISO UTC
  reason: string        // Max 300 chars
}

export interface BookingSettings {
  openTime: string      // "HH:mm" in Vietnam time (e.g. "07:00")
  closeTime: string     // "HH:mm" in Vietnam time (e.g. "20:00")
  workingDays: number[] // 0 = Sun, 1 = Mon, ..., 6 = Sat
  minAdvanceMinutes: number
  maxAdvanceDays: number
  maxHoursPerBooking: number
  minCancelHours: number
  studentMaxAdvanceDays?: number
  studentMaxHoursPerBooking?: number
  facultyMaxAdvanceDays?: number
  facultyMaxHoursPerBooking?: number
  autoApproveForFaculty?: boolean
  maxPendingBookingsPerUser?: number
  maxBookedHoursPerUserPerWeek?: number
  approvalReminderHours?: number
  checkInGraceMinutes?: number
  closedPeriods: ClosedPeriod[]
  revision: number
}

export const BOOKING_SETTINGS_QUERY_KEY = ['booking-settings']

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  openTime: '07:00',
  closeTime: '20:00',
  workingDays: [1, 2, 3, 4, 5, 6],
  minAdvanceMinutes: 30,
  maxAdvanceDays: 14,
  maxHoursPerBooking: 4.0,
  minCancelHours: 2.0,
  studentMaxAdvanceDays: 7,
  studentMaxHoursPerBooking: 3.0,
  facultyMaxAdvanceDays: 30,
  facultyMaxHoursPerBooking: 8.0,
  autoApproveForFaculty: true,
  maxPendingBookingsPerUser: 3,
  maxBookedHoursPerUserPerWeek: 20.0,
  approvalReminderHours: 1.0,
  checkInGraceMinutes: 15,
  closedPeriods: [],
  revision: 0
}

/**
 * Fetch current booking settings from the database
 */
export async function fetchBookingSettings(): Promise<BookingSettings> {
  const res = await http.get<BookingSettings>('/api/booking-settings')
  return res.data
}

/**
 * Update booking settings (Admin only, requires matching revision)
 */
export async function updateBookingSettings(settings: BookingSettings): Promise<BookingSettings> {
  const res = await http.put<BookingSettings>('/api/booking-settings', settings)
  return res.data
}

/**
 * Hook to retrieve booking settings from backend
 */
export function useBookingSettings(options?: { enabled?: boolean; refetchInterval?: number | false }) {
  return useQuery({
    queryKey: BOOKING_SETTINGS_QUERY_KEY,
    queryFn: fetchBookingSettings,
    staleTime: 30 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
    retry: (failureCount, error: any) => {
      // Don't retry on client errors, auth errors, or 404
      const status = error?.response?.status
      if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409) return false
      return failureCount < 1
    }
  })
}

/**
 * Helper: parse "HH:mm" to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0
  const [h, m] = timeStr.split(':').map(n => parseInt(n, 10))
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m)
}

/**
 * Helper: format minutes from midnight to "HH:mm"
 */
export function formatMinutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Generate 30-min time slots from openTime to closeTime
 */
export function generateOperatingSlots(openTime: string, closeTime: string, stepMinutes = 30): string[] {
  const startMin = parseTimeToMinutes(openTime || '07:00')
  const endMin = parseTimeToMinutes(closeTime || '20:00')
  const slots: string[] = []

  for (let m = startMin; m <= endMin; m += stepMinutes) {
    slots.push(formatMinutesToTime(m))
  }
  return slots
}

/**
 * Check if a room and time range overlaps with any closed/maintenance period
 */
export function checkClosedPeriodOverlap(
  roomId: number | string | null | undefined,
  start: dayjs.Dayjs,
  end: dayjs.Dayjs,
  closedPeriods: ClosedPeriod[] = []
): ClosedPeriod | null {
  if (!closedPeriods || closedPeriods.length === 0) return null

  for (const period of closedPeriods) {
    // Campus-wide (roomId === null) applies to all rooms
    // Specific room applies only when matching roomId
    const appliesToRoom = period.roomId === null || (roomId !== undefined && roomId !== null && String(period.roomId) === String(roomId))
    if (!appliesToRoom) continue

    const pStart = toVN(period.start)
    const pEnd = toVN(period.end)

    // Overlap: start < pEnd && end > pStart
    if (start.isBefore(pEnd) && end.isAfter(pStart)) {
      return period
    }
  }

  return null
}

/**
 * Client-side validation of booking settings payload before submitting PUT
 */
export function validateBookingSettingsPayload(settings: BookingSettings): string[] {
  const errors: string[] = []

  if (!Number.isInteger(settings.maxAdvanceDays) || settings.maxAdvanceDays < 1 || settings.maxAdvanceDays > 365) {
    errors.push('Số ngày được đặt trước tối đa phải là số nguyên từ 1 đến 365 ngày.')
  }

  if (settings.studentMaxAdvanceDays !== undefined) {
    if (!Number.isInteger(settings.studentMaxAdvanceDays) || settings.studentMaxAdvanceDays < 1 || settings.studentMaxAdvanceDays > 365) {
      errors.push('Số ngày đặt trước của Sinh viên phải là số nguyên từ 1 đến 365 ngày.')
    }
  }

  if (settings.facultyMaxAdvanceDays !== undefined) {
    if (!Number.isInteger(settings.facultyMaxAdvanceDays) || settings.facultyMaxAdvanceDays < 1 || settings.facultyMaxAdvanceDays > 365) {
      errors.push('Số ngày đặt trước của Giảng viên phải là số nguyên từ 1 đến 365 ngày.')
    }
  }

  const maxPossibleAdvanceMins = (settings.maxAdvanceDays || 1) * 1440
  if (!Number.isInteger(settings.minAdvanceMinutes) || settings.minAdvanceMinutes < 0) {
    errors.push('Số phút phải đặt trước tối thiểu phải là số nguyên không âm (≥ 0).')
  } else if (settings.minAdvanceMinutes > maxPossibleAdvanceMins) {
    errors.push(`Số phút đặt trước tối thiểu (${settings.minAdvanceMinutes} phút) không được vượt quá số ngày đặt trước tối đa (${maxPossibleAdvanceMins} phút).`)
  }

  const openMins = parseTimeToMinutes(settings.openTime)
  const closeMins = parseTimeToMinutes(settings.closeTime)
  const operatingSpanHours = (closeMins - openMins) / 60

  if (openMins >= closeMins) {
    errors.push('Giờ mở cửa phải trước giờ đóng cửa (Hệ thống chưa hỗ trợ hoạt động qua đêm).')
  }

  if (typeof settings.maxHoursPerBooking !== 'number' || settings.maxHoursPerBooking <= 0) {
    errors.push('Thời lượng đặt phòng tối đa mỗi lượt phải lớn hơn 0 giờ.')
  } else if (openMins < closeMins && settings.maxHoursPerBooking > operatingSpanHours) {
    errors.push(`Thời lượng tối đa mỗi lượt (${settings.maxHoursPerBooking} giờ) không được vượt quá độ dài khung giờ hoạt động (${operatingSpanHours} giờ).`)
  }

  if (settings.studentMaxHoursPerBooking !== undefined && (typeof settings.studentMaxHoursPerBooking !== 'number' || settings.studentMaxHoursPerBooking <= 0)) {
    errors.push('Thời lượng tối đa mỗi lượt của Sinh viên phải lớn hơn 0 giờ.')
  }

  if (settings.facultyMaxHoursPerBooking !== undefined && (typeof settings.facultyMaxHoursPerBooking !== 'number' || settings.facultyMaxHoursPerBooking <= 0)) {
    errors.push('Thời lượng tối đa mỗi lượt của Giảng viên phải lớn hơn 0 giờ.')
  }

  if (settings.maxPendingBookingsPerUser !== undefined && (!Number.isInteger(settings.maxPendingBookingsPerUser) || settings.maxPendingBookingsPerUser < 1)) {
    errors.push('Số đơn chờ duyệt tối đa của mỗi người dùng phải là số nguyên ≥ 1.')
  }

  if (settings.maxBookedHoursPerUserPerWeek !== undefined && (typeof settings.maxBookedHoursPerUserPerWeek !== 'number' || settings.maxBookedHoursPerUserPerWeek <= 0)) {
    errors.push('Số giờ đặt phòng tối đa trong tuần phải lớn hơn 0 giờ.')
  }

  if (settings.approvalReminderHours !== undefined && (typeof settings.approvalReminderHours !== 'number' || settings.approvalReminderHours <= 0)) {
    errors.push('Mốc thời gian nhắc duyệt khẩn cấp phải lớn hơn 0 giờ.')
  }

  if (settings.checkInGraceMinutes !== undefined && (!Number.isInteger(settings.checkInGraceMinutes) || settings.checkInGraceMinutes < 0)) {
    errors.push('Thời gian ân hạn nhận phòng (Check-in grace) phải là số nguyên ≥ 0 phút.')
  }

  if (typeof settings.minCancelHours !== 'number' || settings.minCancelHours < 0 || settings.minCancelHours > 8760) {
    errors.push('Hạn hủy phòng trước giờ sử dụng phải từ 0 đến 8760 giờ.')
  }

  if (!Array.isArray(settings.workingDays) || settings.workingDays.length === 0) {
    errors.push('Vui lòng chọn ít nhất một ngày hoạt động trong tuần.')
  }

  if (Array.isArray(settings.closedPeriods)) {
    settings.closedPeriods.forEach((period, idx) => {
      const pStart = dayjs(period.start)
      const pEnd = dayjs(period.end)
      if (!pStart.isValid() || !pEnd.isValid()) {
        errors.push(`Khoảng nghỉ #${idx + 1}: Thời điểm bắt đầu hoặc kết thúc không hợp lệ.`)
      } else if (!pEnd.isAfter(pStart)) {
        errors.push(`Khoảng nghỉ #${idx + 1}: Thời điểm kết thúc phải sau thời điểm bắt đầu.`)
      }
      if (!period.reason || !period.reason.trim()) {
        errors.push(`Khoảng nghỉ #${idx + 1}: Vui lòng nhập lý do nghỉ/bảo trì.`)
      } else if (period.reason.length > 300) {
        errors.push(`Khoảng nghỉ #${idx + 1}: Lý do nghỉ/bảo trì không được vượt quá 300 ký tự.`)
      }
    })
  }

  return errors
}

/**
 * Validate a booking request strictly against booking settings
 */
export function validateBookingAgainstSettings({
  bookingDate,
  startTime,
  endTime,
  roomId,
  settings,
  now = toVN(),
  userRole = 'student',
  isFaculty = false,
  isAdmin = false,
  roomType,
  isSpecialRequest = false,
  specialRequestReason,
  existingUserBookings = [],
  excludeBookingId
}: {
  bookingDate: dayjs.Dayjs
  startTime: dayjs.Dayjs
  endTime: dayjs.Dayjs
  roomId: number | string | null | undefined
  settings: BookingSettings
  now?: dayjs.Dayjs
  userRole?: string
  isFaculty?: boolean
  isAdmin?: boolean
  roomType?: string | number
  isSpecialRequest?: boolean
  specialRequestReason?: string
  existingUserBookings?: any[]
  excludeBookingId?: number
}): string[] {
  const violations: string[] = []

  if (!settings) return violations

  const openMins = parseTimeToMinutes(settings.openTime)
  const closeMins = parseTimeToMinutes(settings.closeTime)

  // 1. Check working days
  const dayOfWeek = bookingDate.day() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  if (!settings.workingDays.includes(dayOfWeek)) {
    const dayNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    violations.push(`Nhà trường không hoạt động vào ${dayNames[dayOfWeek]} theo quy định.`)
  }

  // Role detection
  const roleNorm = (userRole || '').toLowerCase()
  const facultyUser = isFaculty || roleNorm.includes('faculty') || roleNorm.includes('giảng viên') || roleNorm.includes('lecturer') || roleNorm.includes('teacher')
  const adminUser = isAdmin || roleNorm === 'admin' || roleNorm === 'approver' || roleNorm === 'superadmin'
  const isStudent = !facultyUser && !adminUser

  // 2. Check advance booking limits (studentMaxAdvanceDays / facultyMaxAdvanceDays)
  const todayStart = now.startOf('day')
  const bookingDayStart = bookingDate.startOf('day')
  const diffDays = bookingDayStart.diff(todayStart, 'day')

  if (diffDays < 0) {
    violations.push('Không thể đặt phòng cho ngày trong quá khứ.')
  } else {
    const maxDays = facultyUser 
      ? (settings.facultyMaxAdvanceDays ?? 30) 
      : adminUser 
        ? (settings.facultyMaxAdvanceDays ?? 30) 
        : (settings.studentMaxAdvanceDays ?? 7)

    if (diffDays > maxDays) {
      if (facultyUser) {
        violations.push(`Giảng viên chỉ được đặt phòng trước tối đa ${maxDays} ngày (Hiện tại chọn trước ${diffDays} ngày).`)
      } else if (isStudent) {
        violations.push(`Sinh viên chỉ được đặt phòng trước tối đa ${maxDays} ngày (Hiện tại chọn trước ${diffDays} ngày).`)
      } else {
        violations.push(`Chỉ được đặt phòng trước tối đa ${maxDays} ngày (Hiện tại chọn trước ${diffDays} ngày).`)
      }
    }
  }

  // 3. Check min advance minutes
  const advanceMinutes = startTime.diff(now, 'minute')
  if (!adminUser && advanceMinutes < settings.minAdvanceMinutes) {
    if (settings.minAdvanceMinutes >= 60) {
      const hours = (settings.minAdvanceMinutes / 60).toFixed(1).replace('.0', '')
      violations.push(`Phải đặt phòng trước giờ sử dụng tối thiểu ${hours} giờ (${settings.minAdvanceMinutes} phút).`)
    } else {
      violations.push(`Phải đặt phòng trước giờ sử dụng tối thiểu ${settings.minAdvanceMinutes} phút.`)
    }
  }

  // 4. Check operating hours (openTime to closeTime)
  const startMins = startTime.hour() * 60 + startTime.minute()
  const endMins = endTime.hour() * 60 + endTime.minute()

  if (startMins < openMins) {
    violations.push(`Giờ bắt đầu (${startTime.format('HH:mm')}) sớm hơn giờ mở cửa quy định (${settings.openTime}).`)
  }
  if (startMins >= closeMins) {
    violations.push(`Không thể bắt đầu tại hoặc sau giờ đóng cửa quy định (${settings.closeTime}).`)
  }
  if (endMins > closeMins) {
    violations.push(`Giờ kết thúc (${endTime.format('HH:mm')}) vượt quá giờ đóng cửa quy định (${settings.closeTime}).`)
  }

  // 5. Check maximum duration (studentMaxHoursPerBooking / facultyMaxHoursPerBooking)
  const durationHours = endTime.diff(startTime, 'hour', true)
  if (durationHours <= 0) {
    violations.push('Giờ kết thúc phải sau giờ bắt đầu.')
  } else {
    const maxHours = facultyUser 
      ? (settings.facultyMaxHoursPerBooking ?? 8.0) 
      : adminUser 
        ? Math.max(settings.facultyMaxHoursPerBooking ?? 8.0, settings.maxHoursPerBooking ?? 4.0) 
        : (settings.studentMaxHoursPerBooking ?? 3.0)

    if (durationHours > maxHours) {
      if (facultyUser) {
        violations.push(`Thời lượng đặt phòng tối đa mỗi lượt đối với Giảng viên là ${maxHours} giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
      } else if (isStudent) {
        violations.push(`Thời lượng đặt phòng tối đa mỗi lượt đối với Sinh viên là ${maxHours} giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
      } else {
        violations.push(`Thời lượng đặt phòng tối đa mỗi lượt là ${maxHours} giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
      }
    }
  }

  // 6. Khóa đặt Hội trường (RoomType.LectureHall) đối với Sinh viên
  const roomTypeStr = String(roomType || '').toLowerCase()
  const isLectureHall = roomType === 'LectureHall' || roomTypeStr === '2' || roomTypeStr.includes('hội trường') || roomTypeStr.includes('lecturehall') || roomTypeStr.includes('hall')

  if (isLectureHall && isStudent) {
    if (!isSpecialRequest) {
      violations.push('Hội trường chỉ dành cho Giảng viên hoặc đơn yêu cầu đặc biệt của Khoa/Trường.')
    } else if (!specialRequestReason || !specialRequestReason.trim()) {
      violations.push('Vui lòng nhập lý do xét duyệt của Khoa/Trường đối với đơn yêu cầu đặc biệt đặt Hội trường.')
    }
  }

  // 7. Hạn mức đơn chờ (maxPendingBookingsPerUser) đối với Sinh viên
  if (isStudent && Array.isArray(existingUserBookings)) {
    const maxPending = settings.maxPendingBookingsPerUser ?? 3
    const pendingCount = existingUserBookings.filter((b) => {
      if (!b) return false
      if (excludeBookingId && b.id === excludeBookingId) return false
      const s = String(b.status).toLowerCase()
      const isPending = s === '0' || s === 'pending' || s === 'pendingspecial'
      if (!isPending) return false
      const bStart = toVN(b.startTime)
      return bStart.isAfter(now)
    }).length

    if (pendingCount >= maxPending) {
      violations.push(`Bạn đã có ${pendingCount} yêu cầu đang chờ duyệt (hạn mức tối đa: ${maxPending}). Vui lòng đợi quản lý phê duyệt trước khi tạo thêm.`)
    }
  }

  // 8. Hạn mức số giờ đặt trong tuần (maxBookedHoursPerUserPerWeek)
  if (!adminUser && Array.isArray(existingUserBookings) && durationHours > 0) {
    const maxWeeklyHours = settings.maxBookedHoursPerUserPerWeek ?? 20.0
    // Monday to Sunday in Vietnam timezone
    const dVN = toVN(bookingDate)
    const dayOfWeekIdx = (dVN.day() + 6) % 7 // 0 = Mon, ..., 6 = Sun
    const startOfWeek = dVN.subtract(dayOfWeekIdx, 'day').startOf('day')
    const endOfWeek = startOfWeek.add(7, 'day')

    const weekBookings = existingUserBookings.filter((b) => {
      if (!b) return false
      if (excludeBookingId && b.id === excludeBookingId) return false
      const s = String(b.status).toLowerCase()
      // Pending, Approved, Using
      const isActive = s === '0' || s === 'pending' || s === 'pendingspecial' || s === '1' || s === 'approved' || s === 'using' || s === '4'
      if (!isActive) return false
      const bStart = toVN(b.startTime)
      return bStart.isSameOrAfter(startOfWeek) && bStart.isBefore(endOfWeek)
    })

    const existingHours = weekBookings.reduce((sum, b) => {
      const bStart = toVN(b.startTime)
      const bEnd = toVN(b.endTime)
      const h = bEnd.diff(bStart, 'hour', true)
      return sum + (h > 0 ? h : 0)
    }, 0)

    if (existingHours + durationHours > maxWeeklyHours) {
      violations.push(`Vượt quá hạn mức số giờ đặt trong tuần (${maxWeeklyHours} giờ/tuần). Bạn đã đặt ${existingHours.toFixed(1)} giờ trong tuần; yêu cầu thêm ${durationHours.toFixed(1)} giờ sẽ nâng tổng số lên ${(existingHours + durationHours).toFixed(1)} giờ.`)
    }
  }

  // 9. Check closed / maintenance periods
  const closedConflict = checkClosedPeriodOverlap(roomId, startTime, endTime, settings.closedPeriods)
  if (closedConflict) {
    const pStartStr = toVN(closedConflict.start).format('HH:mm DD/MM/YYYY')
    const pEndStr = toVN(closedConflict.end).format('HH:mm DD/MM/YYYY')
    const scopeStr = closedConflict.roomId === null ? 'Toàn trường' : 'Phòng học đã chọn'
    violations.push(`${scopeStr} đang trong thời gian nghỉ/bảo trì: "${closedConflict.reason}" (từ ${pStartStr} đến ${pEndStr}).`)
  }

  return violations
}
