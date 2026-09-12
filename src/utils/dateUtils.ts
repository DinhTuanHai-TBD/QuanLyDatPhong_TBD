import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

/**
 * Safely parse date and time in Vietnam timezone (UTC+7 - Asia/Ho_Chi_Minh).
 * Handles:
 * - Supabase UTC ISO strings with 'Z' (e.g. 06:15:00Z -> 13:15 GMT+7)
 * - ISO strings with timezone offset (e.g. 13:15:00+07:00 -> 13:15 GMT+7)
 * - Wall-clock date strings without timezone (e.g. 2026-09-10 13:15:00 -> 13:15 GMT+7)
 * - Avoids double-shifting offset (+7h twice, preventing the 20:15 - 22:45 night-time bug)
 */
export function toVN(dateInput?: string | number | Date | dayjs.Dayjs | null): dayjs.Dayjs {
  if (!dateInput) return dayjs().tz(VN_TIMEZONE)
  if (dayjs.isDayjs(dateInput)) return dateInput.tz(VN_TIMEZONE)
  if (typeof dateInput === 'number') return dayjs(dateInput).tz(VN_TIMEZONE)
  if (dateInput instanceof Date) return dayjs(dateInput).tz(VN_TIMEZONE)

  if (typeof dateInput === 'string') {
    const s = dateInput.trim()
    // Explicit UTC with Z or +00:00 / -00:00
    if (s.endsWith('Z') || s.includes('+00:00') || s.includes('-00:00')) {
      return dayjs.utc(s).tz(VN_TIMEZONE)
    }
    // Has explicit offset (e.g. +07:00 or -05:00)
    if (s.includes('+') || (s.includes('T') && s.length > 19 && s.lastIndexOf('-') > 10)) {
      return dayjs.utc(s).tz(VN_TIMEZONE)
    }
    // Wall-clock time without timezone offset: interpret directly as Vietnam time
    return dayjs.tz(s, VN_TIMEZONE)
  }

  return dayjs(dateInput).tz(VN_TIMEZONE)
}

/**
 * Format date in Vietnam timezone
 */
export function formatVNDate(
  dateInput: string | number | Date | dayjs.Dayjs | null | undefined,
  format = 'DD/MM/YYYY'
): string {
  if (!dateInput) return ''
  return toVN(dateInput).format(format)
}

/**
 * Format time in Vietnam timezone: HH:mm
 */
export function formatVNTime(
  dateInput: string | number | Date | dayjs.Dayjs | null | undefined
): string {
  if (!dateInput) return ''
  return toVN(dateInput).format('HH:mm')
}

/**
 * Format date-time range: HH:mm DD/MM/YYYY - HH:mm DD/MM/YYYY
 * (Ví dụ: 13:15 10/09/2026 - 15:45 10/09/2026)
 */
export function formatVNDateTimeRange(
  startInput: string | number | Date | dayjs.Dayjs | null | undefined,
  endInput: string | number | Date | dayjs.Dayjs | null | undefined
): string {
  if (!startInput || !endInput) return ''
  const start = toVN(startInput).format('HH:mm DD/MM/YYYY')
  const end = toVN(endInput).format('HH:mm DD/MM/YYYY')
  return `${start} - ${end}`
}

/**
 * Format time range: HH:mm - HH:mm
 */
export function formatVNTimeRange(
  startInput: string | number | Date | dayjs.Dayjs | null | undefined,
  endInput: string | number | Date | dayjs.Dayjs | null | undefined
): string {
  if (!startInput || !endInput) return ''
  const start = toVN(startInput).format('HH:mm')
  const end = toVN(endInput).format('HH:mm')
  return `${start} - ${end}`
}

/**
 * Checks if a booking is an official school schedule (Thời khóa biểu chính khóa)
 */
export function isSchoolScheduleBooking(b: any): boolean {
  if (!b) return false
  if (b.isSchoolOverride || b.IsSchoolOverride) return true
  const purpose = (b.purpose || '').toLowerCase()
  const notes = (b.notes || '').toLowerCase()
  const adminNotes = (b.adminNotes || '').toLowerCase()

  return (
    purpose.includes('[tkb') ||
    purpose.includes('lịch học:') ||
    purpose.includes('thời khóa biểu') ||
    purpose.includes('tkb chính khóa') ||
    notes.includes('lịch học chính khóa') ||
    adminNotes.includes('thời khóa biểu') ||
    Boolean(b.subjectCode) ||
    Boolean(b.subjectName) ||
    Boolean(b.semester)
  )
}

export default dayjs
