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
 * Checks if a booking was pending but its start time has passed now
 */
export function isBookingExpired(b: Partial<Booking>, now = dayjs()): boolean {
  if (!b || !b.startTime) return false
  if (!isPendingBooking(b.status)) {
    // If it's already marked as Expired
    return String(b.status).toLowerCase() === 'expired'
  }
  const start = dayjs(b.startTime)
  return now.isSameOrAfter(start)
}

/**
 * Checks if a booking is pending and starts within 2 hours from now (0 < startTime - now <= 2 hours)
 */
export function isBookingUrgent(b: Partial<Booking>, now = dayjs()): boolean {
  if (!b || !b.startTime) return false
  // Must be pending and NOT expired yet
  if (!isPendingBooking(b.status)) return false
  if (isBookingExpired(b, now)) return false

  const start = dayjs(b.startTime)
  const diffMinutes = start.diff(now, 'minute', true)
  return diffMinutes > 0 && diffMinutes <= 120
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
 * Returns a booking with its effective real-time status computed:
 * - If pending and start time has passed -> 'Expired'
 * - If approved and time passed end time -> 'Completed'
 * - If approved and between start and end -> 'Using'
 */
export function getEffectiveBooking(b: Booking, now = dayjs()): Booking {
  // If pending and current time is at or past startTime -> Expire
  if (isPendingBooking(b.status)) {
    if (isBookingExpired(b, now)) {
      return {
        ...b,
        status: 'Expired',
        rejectReason: b.rejectReason || 'Đơn đặt phòng đã tự động hết hạn do đã quá giờ bắt đầu sử dụng mà chưa được phê duyệt.'
      }
    }
    return b
  }

  const s = String(b.status).toLowerCase()
  if (s === '1' || s === 'approved' || s === 'using') {
    const start = dayjs(b.startTime)
    const end = dayjs(b.endTime)
    if (now.isSameOrAfter(end)) {
      return { ...b, status: 'Completed' }
    } else if (now.isSameOrAfter(start) && now.isBefore(end)) {
      return { ...b, status: 'Using' }
    }
  }

  return b
}

/**
 * Maps a list of bookings to their effective real-time statuses
 */
export function mapEffectiveBookings(bookings: Booking[], now = dayjs()): Booking[] {
  return bookings.map(b => getEffectiveBooking(b, now))
}

/**
 * Sorts pending bookings so urgent (< 2h) bookings appear FIRST,
 * sorted by startTime ascending (the earliest start time first).
 */
export function sortPendingBookingsWithUrgentFirst(bookings: Booking[], now = dayjs()): Booking[] {
  return [...bookings].sort((a, b) => {
    const aUrgent = isBookingUrgent(a, now)
    const bUrgent = isBookingUrgent(b, now)

    if (aUrgent && !bUrgent) return -1
    if (!aUrgent && bUrgent) return 1

    // If both urgent, sort by earliest start time first
    if (aUrgent && bUrgent) {
      return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
    }

    // Default sort: newest created or earliest start time
    return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
  })
}
