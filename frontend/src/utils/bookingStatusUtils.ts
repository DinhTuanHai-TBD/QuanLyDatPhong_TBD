import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import type { Booking } from '../types/booking'

dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)

/**
 * Checks if a booking's raw or original status is pending approval
 */
export function isPendingBooking(status: any): boolean {
  if (status === null || status === undefined) return false
  const s = String(status).toLowerCase().trim()
  return s === '0' || s === 'pending' || s === 'pendingspecial'
}

/**
 * Checks if a booking was pending but its start time has passed now,
 * or if it was Approved but exceeded the check-in grace period (No-show).
 */
export function isBookingExpired(b: Partial<Booking>, now = dayjs(), checkInGraceMinutes = 15): boolean {
  if (!b || !b.startTime) return false
  const s = String(b.status).toLowerCase().trim()
  if (s === '3' || s === 'expired') return true

  if (isPendingBooking(b.status)) {
    const start = dayjs(b.startTime)
    return now.isSameOrAfter(start)
  }

  // Approved booking with no check-in after grace period (No-show)
  if (s === '1' || s === 'approved') {
    if (!b.actualStartTime) {
      const start = dayjs(b.startTime)
      return now.diff(start, 'minute', true) > checkInGraceMinutes
    }
  }

  return false
}

/**
 * Checks if a booking is pending and starts within reminder window (default: 1.0 hour, 0 < startTime - now <= 60 mins)
 */
export function isBookingUrgent(b: Partial<Booking>, now = dayjs(), reminderHours = 1.0): boolean {
  if (!b || !b.startTime) return false
  // Must be pending and NOT expired yet
  if (!isPendingBooking(b.status)) return false
  if (isBookingExpired(b, now)) return false

  const start = dayjs(b.startTime)
  const diffMinutes = start.diff(now, 'minute', true)
  return diffMinutes > 0 && diffMinutes <= reminderHours * 60
}

/**
 * Calculates remaining time until booking starts (in minutes or formatted)
 */
export function getUrgentRemainingText(b: Partial<Booking>, now = dayjs()): string {
  if (!b.startTime) return ''
  const start = dayjs(b.startTime)
  const diffMinutes = Math.max(0, Math.round(start.diff(now, 'minute', true)))
  if (diffMinutes >= 60) {
    const hours = Math.floor(diffMinutes / 60)
    const mins = diffMinutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  return `${diffMinutes} phút`
}

/**
 * Checks if a booking is currently eligible for check-in:
 * - Status is Approved (1)
 * - Has not checked in yet (actualStartTime == null)
 * - Current time is within [startTime - 15m, startTime + checkInGraceMinutes]
 */
export function canCheckInBooking(b: Partial<Booking>, now = dayjs(), checkInGraceMinutes = 15): boolean {
  if (!b || !b.startTime) return false
  const s = String(b.status).toLowerCase().trim()
  if (s !== '1' && s !== 'approved') return false
  if (b.actualStartTime) return false

  const start = dayjs(b.startTime)
  const checkInWindowOpen = start.subtract(15, 'minute')
  const checkInWindowClose = start.add(checkInGraceMinutes, 'minute')

  return now.isSameOrAfter(checkInWindowOpen) && now.isSameOrBefore(checkInWindowClose)
}

/**
 * Returns a booking with its effective real-time status computed:
 * - If pending and start time has passed -> 'Expired'
 * - If approved and past grace period without check-in -> 'Expired' (No-show)
 * - If using or checked in:
 *     - If past end time -> 'Completed'
 *     - Else -> 'Using'
 */
export function getEffectiveBooking(b: Booking, now = dayjs(), checkInGraceMinutes = 15): Booking {
  // If pending and current time is at or past startTime -> Expire
  if (isPendingBooking(b.status)) {
    if (isBookingExpired(b, now, checkInGraceMinutes)) {
      return {
        ...b,
        status: 'Expired',
        rejectReason: b.rejectReason || 'Đơn đặt phòng đã hết hạn xử lý do đã quá giờ bắt đầu sử dụng.'
      }
    }
    return b
  }

  const s = String(b.status).toLowerCase().trim()

  // Approved booking
  if (s === '1' || s === 'approved') {
    const start = dayjs(b.startTime)
    const end = dayjs(b.endTime)

    // No-show auto expiration: 15 minutes after start time with no check-in
    if (!b.actualStartTime && now.diff(start, 'minute', true) > checkInGraceMinutes) {
      return {
        ...b,
        status: 'Expired',
        rejectReason: b.rejectReason || 'Hủy tự động do quá hạn nhận phòng (No-show: không check-in trong vòng 15 phút sau giờ bắt đầu).'
      }
    }

    // Has checked in
    if (b.actualStartTime) {
      if (now.isSameOrAfter(end)) {
        return { ...b, status: 'Completed' }
      }
      return { ...b, status: 'Using' }
    }
  }

  // Currently using
  if (s === '4' || s === 'using') {
    const end = dayjs(b.endTime)
    if (now.isSameOrAfter(end)) {
      return { ...b, status: 'Completed' }
    }
    return { ...b, status: 'Using' }
  }

  return b
}

/**
 * Maps a list of bookings to their effective real-time statuses
 */
export function mapEffectiveBookings(bookings: Booking[], now = dayjs(), checkInGraceMinutes = 15): Booking[] {
  return bookings.map(b => getEffectiveBooking(b, now, checkInGraceMinutes))
}

/**
 * Sorts pending bookings so urgent (< 1h) bookings appear FIRST,
 * sorted by startTime ascending (the earliest start time first).
 */
export function sortPendingBookingsWithUrgentFirst(bookings: Booking[], now = dayjs(), reminderHours = 1.0): Booking[] {
  return [...bookings].sort((a, b) => {
    const aUrgent = isBookingUrgent(a, now, reminderHours)
    const bUrgent = isBookingUrgent(b, now, reminderHours)

    if (aUrgent && !bUrgent) return -1
    if (!aUrgent && bUrgent) return 1

    // If both urgent, sort by earliest start time first
    if (aUrgent && bUrgent) {
      return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
    }

    // Default sort: earliest start time
    return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
  })
}
