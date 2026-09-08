import dayjs from 'dayjs'
import type { Booking } from './booking'

export type SemesterType = 'HK1' | 'HK2' | 'HK3' | 'CUSTOM'

export interface SemesterPreset {
  key: SemesterType
  label: string
  shortLabel: string
  season: string
  weeksDesc: string
  monthsDesc: string
  tagColor: string
  getDates: (year: number) => { startDate: string; endDate: string }
}

export const SEMESTER_PRESETS: Record<SemesterType, SemesterPreset> = {
  HK1: {
    key: 'HK1',
    label: 'Học kỳ 1 (Kỳ Thu)',
    shortLabel: 'HK1 - Kỳ Thu',
    season: 'Kỳ Thu',
    weeksDesc: '~15-18 tuần',
    monthsDesc: 'Tháng 9 đến Tháng 1',
    tagColor: 'blue',
    getDates: (year: number) => ({
      startDate: `${year}-09-01`,
      endDate: `${year + 1}-01-15`
    })
  },
  HK2: {
    key: 'HK2',
    label: 'Học kỳ 2 (Kỳ Xuân)',
    shortLabel: 'HK2 - Kỳ Xuân',
    season: 'Kỳ Xuân',
    weeksDesc: '~15-18 tuần',
    monthsDesc: 'Tháng 2 đến Tháng 6',
    tagColor: 'green',
    getDates: (year: number) => ({
      startDate: `${year + 1}-02-15`,
      endDate: `${year + 1}-06-25`
    })
  },
  HK3: {
    key: 'HK3',
    label: 'Học kỳ 3 (Học kỳ Hè / Summer Semester)',
    shortLabel: 'HK3 - Học kỳ Hè',
    season: 'Học kỳ Hè',
    weeksDesc: '~6-8 tuần',
    monthsDesc: 'Tháng 7 đến Tháng 8',
    tagColor: 'orange',
    getDates: (year: number) => ({
      startDate: `${year + 1}-07-01`,
      endDate: `${year + 1}-08-25`
    })
  },
  CUSTOM: {
    key: 'CUSTOM',
    label: 'Tùy chỉnh (Custom)',
    shortLabel: 'Tùy chỉnh',
    season: 'Linh hoạt',
    weeksDesc: 'Tự chọn theo tuần/tháng',
    monthsDesc: 'Linh hoạt',
    tagColor: 'purple',
    getDates: () => {
      const today = dayjs()
      return {
        startDate: today.format('YYYY-MM-DD'),
        endDate: today.add(8, 'week').format('YYYY-MM-DD')
      }
    }
  }
}

export interface StudyPeriod {
  period: number
  label: string
  shift: 'morning' | 'afternoon'
  startTime: string // '07:00'
  endTime: string   // '07:50'
}

export const TBD_STUDY_PERIODS: StudyPeriod[] = [
  // Ca Sáng (Tiết 1 -> Tiết 6)
  { period: 1, label: 'Tiết 1 (07:00 - 07:50)', shift: 'morning', startTime: '07:00', endTime: '07:50' },
  { period: 2, label: 'Tiết 2 (07:50 - 08:40)', shift: 'morning', startTime: '07:50', endTime: '08:40' },
  { period: 3, label: 'Tiết 3 (08:40 - 09:30)', shift: 'morning', startTime: '08:40', endTime: '09:30' },
  // Giải lao 15 phút: 09:30 - 09:45
  { period: 4, label: 'Tiết 4 (09:45 - 10:35)', shift: 'morning', startTime: '09:45', endTime: '10:35' },
  { period: 5, label: 'Tiết 5 (10:35 - 11:25)', shift: 'morning', startTime: '10:35', endTime: '11:25' },
  { period: 6, label: 'Tiết 6 (11:25 - 12:15)', shift: 'morning', startTime: '11:25', endTime: '12:15' },

  // Ca Chiều (Tiết 7 -> Tiết 12)
  { period: 7, label: 'Tiết 7 (13:15 - 14:05)', shift: 'afternoon', startTime: '13:15', endTime: '14:05' },
  { period: 8, label: 'Tiết 8 (14:05 - 14:55)', shift: 'afternoon', startTime: '14:05', endTime: '14:55' },
  { period: 9, label: 'Tiết 9 (14:55 - 15:45)', shift: 'afternoon', startTime: '14:55', endTime: '15:45' },
  // Giải lao 15 phút: 15:45 - 16:00
  { period: 10, label: 'Tiết 10 (16:00 - 16:50)', shift: 'afternoon', startTime: '16:00', endTime: '16:50' },
  { period: 11, label: 'Tiết 11 (16:50 - 17:40)', shift: 'afternoon', startTime: '16:50', endTime: '17:40' },
  { period: 12, label: 'Tiết 12 (17:40 - 18:30)', shift: 'afternoon', startTime: '17:40', endTime: '18:30' },
]

export interface PeriodBlockPreset {
  key: string
  label: string
  shift: 'morning' | 'afternoon'
  fromPeriod: number
  toPeriod: number
  startTime: string
  endTime: string
}

export const PERIOD_BLOCK_PRESETS: PeriodBlockPreset[] = [
  { key: 'M_1_3', label: 'Ca Sáng: Tiết 1 - 3 (07:00 - 09:30)', shift: 'morning', fromPeriod: 1, toPeriod: 3, startTime: '07:00', endTime: '09:30' },
  { key: 'M_1_5', label: 'Ca Sáng: Tiết 1 - 5 (07:00 - 11:25)', shift: 'morning', fromPeriod: 1, toPeriod: 5, startTime: '07:00', endTime: '11:25' },
  { key: 'M_4_6', label: 'Ca Sáng: Tiết 4 - 6 (09:45 - 12:15)', shift: 'morning', fromPeriod: 4, toPeriod: 6, startTime: '09:45', endTime: '12:15' },
  { key: 'A_7_9', label: 'Ca Chiều: Tiết 7 - 9 (13:15 - 15:45)', shift: 'afternoon', fromPeriod: 7, toPeriod: 9, startTime: '13:15', endTime: '15:45' },
  { key: 'A_7_11', label: 'Ca Chiều: Tiết 7 - 11 (13:15 - 17:40)', shift: 'afternoon', fromPeriod: 7, toPeriod: 11, startTime: '13:15', endTime: '17:40' },
  { key: 'A_10_12', label: 'Ca Chiều: Tiết 10 - 12 (16:00 - 18:30)', shift: 'afternoon', fromPeriod: 10, toPeriod: 12, startTime: '16:00', endTime: '18:30' },
]

export const DAYS_OF_WEEK_OPTIONS = [
  { value: 1, label: 'Thứ 2', short: 'T2' },
  { value: 2, label: 'Thứ 3', short: 'T3' },
  { value: 3, label: 'Thứ 4', short: 'T4' },
  { value: 4, label: 'Thứ 5', short: 'T5' },
  { value: 5, label: 'Thứ 6', short: 'T6' },
  { value: 6, label: 'Thứ 7', short: 'T7' },
  { value: 0, label: 'Chủ nhật', short: 'CN' },
]

export interface CalculatedSession {
  id: string
  date: string // YYYY-MM-DD
  dayOfWeek: number
  dayOfWeekLabel: string
  startTime: string // ISO
  endTime: string   // ISO
  startTimeDisplay: string // HH:mm
  endTimeDisplay: string   // HH:mm
  hasConflict: boolean
  conflictingBookings: Booking[]
}

export interface ConflictCheckResult {
  totalSessions: number
  conflictSessions: number
  sessions: CalculatedSession[]
  allConflictingBookings: Booking[]
}

/**
 * Calculates planned academic sessions and checks for conflicts with existing bookings.
 */
export function calculateScheduleSessions(params: {
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  selectedDays: number[] // [1, 3] = Thứ 2, Thứ 4
  startTimeStr: string   // '07:00'
  endTimeStr: string     // '09:30'
  roomId: number
  allBookings: Booking[]
}): ConflictCheckResult {
  const { startDate, endDate, selectedDays, startTimeStr, endTimeStr, roomId, allBookings } = params
  const sessions: CalculatedSession[] = []
  const conflictingMap = new Map<number, Booking>()

  let cur = dayjs(startDate).startOf('day')
  const end = dayjs(endDate).endOf('day')

  while (cur.isBefore(end) || cur.isSame(end, 'day')) {
    const dayOfWeek = cur.day()
    if (selectedDays.includes(dayOfWeek)) {
      const dateStr = cur.format('YYYY-MM-DD')
      const startDateTime = dayjs(`${dateStr} ${startTimeStr}`)
      const endDateTime = dayjs(`${dateStr} ${endTimeStr}`)
      const startMs = startDateTime.toDate().getTime()
      const endMs = endDateTime.toDate().getTime()

      // Find any conflicting bookings in the same room
      const conflicts = allBookings.filter((b) => {
        if (b.roomId !== roomId) return false

        const status = String(b.status).toLowerCase()
        const isCancelledOrRejected =
          status === 'cancelled' ||
          status === 'rejected' ||
          status === '-1' ||
          status === '2' ||
          status === 'expired' ||
          status === '3'
        if (isCancelledOrRejected) return false

        const bStartMs = new Date(b.startTime).getTime()
        const bEndMs = new Date(b.endTime).getTime()

        // Overlap condition: startA < endB && startB < endA
        return startMs < bEndMs && bStartMs < endMs
      })

      conflicts.forEach((c) => conflictingMap.set(c.id, c))

      const dayObj = DAYS_OF_WEEK_OPTIONS.find((d) => d.value === dayOfWeek)

      sessions.push({
        id: `${dateStr}-${startTimeStr}`,
        date: dateStr,
        dayOfWeek,
        dayOfWeekLabel: dayObj ? dayObj.label : `Thứ ${dayOfWeek + 1}`,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        startTimeDisplay: startTimeStr,
        endTimeDisplay: endTimeStr,
        hasConflict: conflicts.length > 0,
        conflictingBookings: conflicts
      })
    }
    cur = cur.add(1, 'day')
  }

  return {
    totalSessions: sessions.length,
    conflictSessions: sessions.filter((s) => s.hasConflict).length,
    sessions,
    allConflictingBookings: Array.from(conflictingMap.values())
  }
}
