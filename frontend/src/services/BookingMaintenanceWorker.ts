import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toVN } from '../utils/dateUtils'
import { isPendingBooking } from '../utils/bookingStatusUtils'
import type { Booking } from '../types/booking'
import { DEFAULT_BOOKING_SETTINGS, type BookingSettings } from '../api/bookingSettings'

/**
 * Background maintenance service for:
 * 1. Scanning Pending bookings nearing start time (< approvalReminderHours, default 1h)
 *    and triggering urgent notifications.
 * 2. Scanning Approved bookings that exceeded the check-in grace period (default 15m) without check-in
 *    and automatically marking them as Expired (No-show), freeing up the room immediately.
 */
export function runBookingMaintenanceCycle(queryClient?: ReturnType<typeof useQueryClient>) {
  try {
    const now = toVN()
    
    // Read current settings from QueryClient cache or default
    const cachedSettings = queryClient?.getQueryData<BookingSettings>(['booking-settings'])
    const settings: BookingSettings = cachedSettings ? { ...DEFAULT_BOOKING_SETTINGS, ...cachedSettings } : DEFAULT_BOOKING_SETTINGS

    const checkInGraceMinutes = settings.checkInGraceMinutes ?? 15
    const approvalReminderHours = settings.approvalReminderHours ?? 1.0

    // Read bookings from QueryClient cache (which comes from /api/bookings)
    const cachedBookings = queryClient?.getQueryData<Booking[]>(['bookings']) || queryClient?.getQueryData<Booking[]>(['admin-bookings'])
    if (!cachedBookings || !Array.isArray(cachedBookings) || cachedBookings.length === 0) return

    const bookings: Booking[] = cachedBookings

    // 1. Check for Approved bookings that exceeded grace period without checking in -> Expired (No-show)
    let hasExpiredAny = false
    bookings.forEach((b) => {
      const s = String(b.status).toLowerCase().trim()
      if (s === '1' || s === 'approved') {
        if (!b.actualStartTime && b.startTime) {
          const start = toVN(b.startTime)
          const diffMinutes = now.diff(start, 'minute', true)
          if (diffMinutes > checkInGraceMinutes) {
            hasExpiredAny = true
            console.log(`[BookingMaintenanceWorker] Đơn #${b.id} quá hạn ${checkInGraceMinutes} phút không check-in.`)
          }
        }
      }
    })

    if (hasExpiredAny && queryClient) {
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
    }

    // 2. Scan Pending bookings within < 1h for Urgent notification logging
    const urgentThresholdMinutes = approvalReminderHours * 60
    const urgentBookings = bookings.filter((b) => {
      if (!isPendingBooking(b.status) || !b.startTime) return false
      const start = toVN(b.startTime)
      const diffMins = start.diff(now, 'minute', true)
      return diffMins > 0 && diffMins <= urgentThresholdMinutes
    })

    if (urgentBookings.length > 0) {
      try {
        const existingUrgentLogs = JSON.parse(localStorage.getItem('tbd_urgent_reminder_logged') || '{}')
        let newLogged = false

        for (const ub of urgentBookings) {
          const logKey = `urgent-${ub.id}-${approvalReminderHours}h`
          if (!existingUrgentLogs[logKey]) {
            existingUrgentLogs[logKey] = true
            newLogged = true

            // Add system notification for admin
            const existingNotifs = JSON.parse(localStorage.getItem('tbd_system_notifications') || '[]')
            existingNotifs.unshift({
              id: `urgent-pending-${ub.id}-${Date.now()}`,
              title: `Khẩn cấp: Đơn đặt phòng #${ub.id} cần duyệt gấp (< ${approvalReminderHours}h)`,
              message: `Đơn đặt phòng #${ub.id} tại ${ub.roomName} sắp diễn ra trong vòng ${approvalReminderHours} giờ, vui lòng xem xét phê duyệt khẩn cấp!`,
              type: 'urgent',
              createdAt: now.toISOString(),
              isUnread: true,
              link: '/approvals'
            })
            localStorage.setItem('tbd_system_notifications', JSON.stringify(existingNotifs.slice(0, 50)))
          }
        }

        if (newLogged) {
          localStorage.setItem('tbd_urgent_reminder_logged', JSON.stringify(existingUrgentLogs))
          if (queryClient) {
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
            queryClient.invalidateQueries({ queryKey: ['admin-urgent-bookings-notifications'] })
          }
        }
      } catch {}
    }

  } catch (err) {
    console.error('[BookingMaintenanceWorker] Lỗi trong chu kỳ bảo trì:', err)
  }
}

/**
 * Hook to automatically run background maintenance worker in the application
 */
export function useBookingMaintenanceWorker() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Run immediately on mount
    runBookingMaintenanceCycle(queryClient)

    // Schedule every 15 seconds
    const interval = setInterval(() => {
      runBookingMaintenanceCycle(queryClient)
    }, 15000)

    return () => clearInterval(interval)
  }, [queryClient])
}
