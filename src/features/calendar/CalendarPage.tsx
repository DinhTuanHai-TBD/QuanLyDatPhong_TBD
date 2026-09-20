import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/vi'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useMemo, useEffect } from 'react'
import {
  Card,
  Select,
  Typography,
  Space,
  Badge,
  Segmented,
  DatePicker,
  InputNumber,
  Row,
  Col,
  Table,
  Grid,
  Modal,
  Descriptions,
  Tag,
  Button,
  Spin,
  Alert,
  App
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import { getUserId, getUserRole, getUserEmail, isAuthenticated } from '../../api/authUtils'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'
import {
  toVN,
  formatVNDate,
  formatVNTime,
  formatVNDateTimeRange,
  formatVNTimeRange,
  isSchoolScheduleBooking,
  getCalendarQueryRange
} from '../../utils/dateUtils'
import { extractMajorFromNotes, normalizeDepartmentName } from '../../utils/academicPrograms'
import { useBookingSettings, checkClosedPeriodOverlap } from '../../api/bookingSettings'
import dayjs from 'dayjs'
import {
  CalendarOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'

moment.locale('vi')
const localizer = momentLocalizer(moment)

const { Title, Text } = Typography
const { useBreakpoint } = Grid

async function fetchRooms(): Promise<Room[]> {
  try {
    const res = await http.get<Room[]>('/api/rooms')
    return res.data || []
  } catch (err) {
    console.error('Không thể tải danh sách phòng từ /api/rooms:', err)
    return []
  }
}

export type EventStatusGroup =
  | 'school-schedule'
  | 'approved'
  | 'using'
  | 'completed'
  | 'pending'
  | 'rejected'

export const statusColors: Record<EventStatusGroup, string> = {
  'school-schedule': '#1e3a8a',
  approved: '#10b981',
  using: '#0284c7',
  completed: '#64748b',
  pending: '#f59e0b',
  rejected: '#ef4444',
}

export const statusLabels: Record<EventStatusGroup, string> = {
  'school-schedule': 'Thời khóa biểu chính khóa',
  approved: 'Đã duyệt',
  using: 'Đang sử dụng',
  completed: 'Hoàn thành',
  pending: 'Chờ duyệt',
  rejected: 'Từ chối / Đã hủy',
}

export function getBookingStatusInfo(booking: Booking): {
  group: EventStatusGroup
  label: string
  color: string
} {
  const isSchool = isSchoolScheduleBooking(booking)
  const s = String(booking.status ?? '').toLowerCase().trim()

  // 1. Hoàn thành: status 5 hoặc Completed
  if (s === '5' || s === 'completed') {
    return {
      group: 'completed',
      label: 'Hoàn thành',
      color: isSchool ? '#475569' : '#64748b',
    }
  }

  // 2. Đang sử dụng: status 4 hoặc Using
  if (s === '4' || s === 'using') {
    return {
      group: 'using',
      label: 'Đang sử dụng',
      color: '#0284c7',
    }
  }

  // 3. Đã duyệt: status 1 hoặc Approved
  if (s === '1' || s === 'approved') {
    return {
      group: isSchool ? 'school-schedule' : 'approved',
      label: 'Đã duyệt',
      color: isSchool ? '#1e3a8a' : '#10b981',
    }
  }

  // 4. Chờ duyệt: status 0 hoặc Pending / PendingSpecial
  if (s === '0' || s === 'pending' || s === 'pendingspecial') {
    return {
      group: 'pending',
      label: 'Chờ duyệt',
      color: '#f59e0b',
    }
  }

  // 5. Đã hủy / Hết hạn: status 3 hoặc Cancelled / Expired
  if (s === '3' || s === 'cancelled' || s === 'expired' || s === '-1') {
    return {
      group: 'completed',
      label: 'Đã hủy / Hết hạn',
      color: '#94a3b8',
    }
  }

  // 6. Từ chối: status 2 hoặc Rejected
  if (s === '2' || s === 'rejected') {
    return {
      group: 'rejected',
      label: 'Từ chối',
      color: '#ef4444',
    }
  }

  if (isSchool) {
    return {
      group: 'school-schedule',
      label: 'Thời khóa biểu chính khóa',
      color: '#1e3a8a',
    }
  }

  return {
    group: 'approved',
    label: 'Đã duyệt',
    color: '#10b981',
  }
}

export const getEventStatusGroup = (booking: Booking): EventStatusGroup => {
  return getBookingStatusInfo(booking).group
}

const isOnlineRoom = (r: { name?: string | null } | null | undefined): boolean => {
  if (!r || !r.name) return false
  return r.name.toLowerCase().trim().includes('online')
}

export default function CalendarPage() {
  const { message, modal } = App.useApp()
  const navigate = useNavigate()
  const screens = useBreakpoint()

  const [mode, setMode] = useState<'room' | 'week' | 'list'>('room')
  const [filterDate, setFilterDate] = useState<dayjs.Dayjs>(() => toVN())
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left')
  const [filterBuilding, setFilterBuilding] = useState<string>('all')
  const [filterRoomType, setFilterRoomType] = useState<string>('all')
  const [filterMinCapacity, setFilterMinCapacity] = useState<number | null>(null)
  const [filterEquipments, setFilterEquipments] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | string | 'all'>('all')

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  useEffect(() => {
    if (screens.md === false) {
      setMode('list')
    } else {
      setMode('room')
    }
  }, [screens.md])

  // User auth details
  const userId = getUserId()
  const userRole = getUserRole()
  const userEmail = getUserEmail()
  const isAuthed = isAuthenticated()

  useEffect(() => {
    if (!isAuthed) {
      navigate('/login?redirect=/calendar', { replace: true })
    }
  }, [isAuthed, navigate])

  // Calculate strict Vietnam timezone boundaries and ISO UTC for API query
  const { startDateUtc, endDateUtc, displayRangeLabel } = useMemo(() => {
    return getCalendarQueryRange(mode, filterDate)
  }, [mode, filterDate])

  const { data: bookingSettings } = useBookingSettings()

  const openTime = bookingSettings?.openTime || '07:00'
  const closeTime = bookingSettings?.closeTime || '20:00'

  const { openHour, openMinute, closeHour, closeMinute, timelineStartMin, totalTimelineMinutes, totalHalfHours, totalHourHeaders } = useMemo(() => {
    const oH = parseInt(openTime.split(':')[0], 10) || 7
    const oM = parseInt(openTime.split(':')[1], 10) || 0
    const cH = parseInt(closeTime.split(':')[0], 10) || 20
    const cM = parseInt(closeTime.split(':')[1], 10) || 0

    const tStartMin = oH * 60 + oM
    // Thêm đúng một cột hiển thị mốc 20:00 ngay sau cột 19:00 (mốc 20:00 là giờ đóng cửa)
    const displayEndHour = Math.max(21, cH + (cM > 0 ? 1 : 0))
    const tEndMin = displayEndHour * 60
    const totalMins = Math.max(60, tEndMin - tStartMin)
    const halfHours = Math.ceil(totalMins / 30)
    const hourHeaders = Math.ceil(totalMins / 60)

    return {
      openHour: oH,
      openMinute: oM,
      closeHour: cH,
      closeMinute: cM,
      timelineStartMin: tStartMin,
      totalTimelineMinutes: totalMins,
      totalHalfHours: halfHours,
      totalHourHeaders: hourHeaders,
    }
  }, [openTime, closeTime])

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Query key: incorporates userEmail and userRole to prevent cache leaking across user accounts, and time range
  const bookingsQueryKey = useMemo(() => [
    'calendar-bookings',
    userEmail || userId || 'guest',
    userRole,
    mode,
    startDateUtc,
    endDateUtc,
  ], [userEmail, userId, userRole, mode, startDateUtc, endDateUtc])

  const bookingsQuery = useQuery({
    queryKey: bookingsQueryKey,
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {
        startDate: startDateUtc,
        endDate: endDateUtc,
      }
      const res = await http.get<Booking[]>('/api/bookings', {
        params,
        signal,
      })
      if (!res.data || !Array.isArray(res.data)) {
        return []
      }
      return res.data.map((b) => ({
        ...b,
        department: normalizeDepartmentName(b.department)
      }))
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 60 * 1000, // 60 seconds auto-refresh
    refetchIntervalInBackground: false, // Do not poll when tab is hidden
    retry: (failureCount, error: any) => {
      const status = error?.response?.status
      if (status === 401 || status === 403) return false
      return failureCount < 1 // Retry at most once for transient network errors
    },
    enabled: isAuthed,
    refetchOnWindowFocus: true,
  })

  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const res = await http.get<any[]>('/api/equipments')
      return Array.isArray(res.data) ? res.data : []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Dữ liệu booking thực từ GET /api/bookings: không tự lọc hay ép loại bỏ lịch cũ
  const apiBookings = useMemo(() => {
    return bookingsQuery.data ?? []
  }, [bookingsQuery.data])

  const buildings = useMemo(() => {
    if (!roomsQuery.data) return []
    return Array.from(
      new Set(
        getOfficialRooms(roomsQuery.data)
          .filter((r: Room) => !isOnlineRoom(r))
          .map((r: Room) => r.building)
          .filter(Boolean)
      )
    )
  }, [roomsQuery.data])

  const roomTypes = useMemo(() => {
    if (!roomsQuery.data) return []
    return Array.from(
      new Set(
        getOfficialRooms(roomsQuery.data)
          .filter((r: any) => !isOnlineRoom(r))
          .map((r: Room) => (r as any)._displayType || r.roomType)
          .filter(Boolean)
      )
    )
  }, [roomsQuery.data])

  const availableEquipments = useMemo(() => {
    if (!equipmentsQuery.data) return []
    return Array.from(new Set(equipmentsQuery.data.map((e: any) => e.type).filter(Boolean)))
  }, [equipmentsQuery.data])

  const filteredRooms = useMemo(() => {
    if (!roomsQuery.data) return []
    return getOfficialRooms(roomsQuery.data).filter((r: any) => {
      // Requirement 5: Ẩn các phòng có tên "Online" khỏi bảng lịch phòng
      if (isOnlineRoom(r)) return false
      if (filterBuilding !== 'all' && r.building !== filterBuilding) return false
      if (filterRoomType !== 'all' && r._displayType !== filterRoomType) return false
      if (filterMinCapacity && r.capacity < filterMinCapacity) return false
      if (filterEquipments.length > 0) {
        if (!equipmentsQuery.data) return false
        const hasAll = filterEquipments.every((eq) =>
          equipmentsQuery.data.some(
            (e: any) =>
              e.type === eq &&
              (e.roomId === r.id || e.roomId === null) &&
              e.status !== 'Maintenance' &&
              e.status !== 'Broken'
          )
        )
        if (!hasAll) return false
      }
      return true
    })
  }, [roomsQuery.data, filterBuilding, filterRoomType, filterMinCapacity, filterEquipments])

  // Filter all bookings by user-selected status filter and exclude online rooms
  const filteredBookings = useMemo(() => {
    return apiBookings.filter((b) => {
      if (isOnlineRoom({ name: b.roomName })) return false

      if (filterStatuses.length > 0) {
        const info = getBookingStatusInfo(b)
        const isSchool = isSchoolScheduleBooking(b)
        const matchesGroup = filterStatuses.includes(info.group)
        const matchesSchool = isSchool && filterStatuses.includes('school-schedule')
        if (!matchesGroup && !matchesSchool) return false
      }
      return true
    })
  }, [apiBookings, filterStatuses])

  // PRE-FILTER: Only select bookings for the active filterDate (dayjs(b.startTime).isSame(filterDate, 'day'))
  const dayBookings = useMemo(() => {
    const targetDate = toVN(filterDate)
    return filteredBookings.filter((b) => {
      if (!b || !b.startTime) return false
      return toVN(b.startTime).isSame(targetDate, 'day')
    })
  }, [filteredBookings, filterDate])

  // Group day's bookings by room ID for instant O(1) rendering without nested loops
  const dayBookingsByRoom = useMemo(() => {
    const map = new Map<number | string, Booking[]>()
    for (const b of dayBookings) {
      const list = map.get(b.roomId) || []
      list.push(b)
      map.set(b.roomId, list)
    }
    return map
  }, [dayBookings])

  const handleSlotClick = (room: Room, startHour: number, startMinute: number) => {
    if (bookingsQuery.isLoading || bookingsQuery.isFetching) {
      message.warning('Dữ liệu lịch đang được tải hoặc cập nhật, vui lòng đợi trong giây lát trước khi chọn đặt phòng.')
      return
    }
    if (bookingsQuery.isError) {
      message.error('Không thể chọn đặt phòng do dữ liệu lịch chưa được tải thành công. Vui lòng bấm "Thử lại".')
      return
    }

    // Lịch quá khứ chỉ được xem lại; không mở quyền đặt mới vào thời gian đã qua
    const dayStr = toVN(filterDate).format('YYYY-MM-DD')
    const slotStart = toVN(
      `${dayStr} ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
    )
    if (slotStart.isBefore(toVN())) {
      message.warning('Không thể đặt phòng cho thời gian đã qua. Lịch quá khứ chỉ dùng để xem lại.')
      return
    }

    // Mốc 20:00 là giờ đóng cửa, không cho đặt phòng sau giờ này
    if (startHour >= closeHour) {
      message.warning('Mốc 20:00 là giờ đóng cửa. Không thể đặt phòng sau giờ này.')
      return
    }

    // Kiểm tra khung giờ có rơi vào giai đoạn tạm ngưng hoạt động / bảo trì của phòng theo quy định không
    if (bookingSettings?.closedPeriods && bookingSettings.closedPeriods.length > 0) {
      const slotStart = toVN(`${dayStr} ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`)
      const slotEnd = slotStart.add(30, 'minute')
      const hitClosed = checkClosedPeriodOverlap(room.id, slotStart, slotEnd, bookingSettings.closedPeriods)
      if (hitClosed) {
        modal.warning({
          title: 'Khung Giờ Đang Tạm Ngưng / Bảo Trì',
          content: (
            <div>
              <p>Phòng <strong>{room.name}</strong> trong khung giờ này đang trong thời gian tạm ngưng hoạt động theo quy định.</p>
              <div style={{ background: '#fef3c7', border: '1px dashed #f59e0b', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#92400e', margin: '8px 0' }}>
                <strong>Lý do:</strong> {hitClosed.reason}
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Thời gian: {formatVNDateTimeRange(hitClosed.start, hitClosed.end)}
                </div>
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: 12 }}>
                Vui lòng chọn khung giờ hoặc phòng học khác.
              </p>
            </div>
          ),
          okText: 'Đã hiểu'
        })
        return
      }
    }

    const roomEvents = dayBookingsByRoom.get(room.id) || []
    const slotStartMin = startHour * 60 + startMinute
    const slotEndMin = slotStartMin + 30

    // Check if slot overlaps with an existing booking in this room on this day
    const conflictingBooking = roomEvents.find((b) => {
      const s = String(b.status).toLowerCase()
      if (s === 'cancelled' || s === 'rejected' || s === '-1' || s === '2' || s === 'expired' || s === '3') return false
      const bSt = toVN(b.startTime)
      const bEt = toVN(b.endTime)
      const bStartMin = bSt.hour() * 60 + bSt.minute()
      const bEndMin = bEt.hour() * 60 + bEt.minute()
      return slotStartMin < bEndMin && slotEndMin > bStartMin
    })

    if (conflictingBooking) {
      const isSchool = isSchoolScheduleBooking(conflictingBooking)
      if (isSchool) {
        modal.warning({
          title: 'Khung Giờ Đã Có Lịch Học Chính Khóa',
          content: (
            <div>
              <p>
                Phòng <strong>{room.name}</strong> trong khung giờ{' '}
                <strong>
                  {formatVNTime(conflictingBooking.startTime)} - {formatVNTime(conflictingBooking.endTime)}
                </strong>{' '}
                đã được bố trí cho <strong>Thời khóa biểu chính khóa của Nhà trường</strong>.
              </p>
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: '#0f172a',
                  margin: '8px 0',
                }}
              >
                <div>
                  🏛️ <strong>Học phần:</strong>{' '}
                  {conflictingBooking.subjectCode ? `${conflictingBooking.subjectCode} - ` : ''}
                  {conflictingBooking.purpose}
                </div>
                {conflictingBooking.lecturerName && (
                  <div>
                    👨‍🏫 <strong>Giảng viên:</strong> {conflictingBooking.lecturerName}
                  </div>
                )}
                {conflictingBooking.semester && (
                  <div>
                    📅 <strong>Học kỳ:</strong> {conflictingBooking.semester}
                  </div>
                )}
              </div>
              <p style={{ margin: 0, color: '#475569', fontSize: 12, fontWeight: 500 }}>
                Thời khóa biểu chính khóa do Phòng Quản lý Đào tạo sắp xếp và được ưu tiên theo kế hoạch giảng dạy. Vui
                lòng chọn khung giờ hoặc phòng học khác.
              </p>
            </div>
          ),
          okText: 'Đã hiểu',
        })
        return
      }

      modal.info({
        title: 'Khung Giờ Đã Có Người Đặt',
        content: `Phòng ${room.name} vào khung giờ này đã có người đăng ký (${
          conflictingBooking.purpose || 'Đã đặt'
        }). Vui lòng chọn khung giờ hoặc phòng khác.`,
        okText: 'Đóng',
      })
      return
    }

    const startIso = toVN(
      `${dayStr} ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
    ).toISOString()
    const maxEndMinutes = closeHour * 60 + closeMinute
    const requestedEndMinutes = Math.min(maxEndMinutes, (startHour + 1) * 60 + startMinute)
    const endH = Math.floor(requestedEndMinutes / 60)
    const endM = requestedEndMinutes % 60
    const endIso = toVN(
      `${dayStr} ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
    ).toISOString()

    navigate(`/bookings?roomId=${room.id}&start=${startIso}&end=${endIso}`)
  }

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking)
  }

  const renderRoomView = () => {
    return (
      <div 
        className="calendar-timeline-table"
        style={{ 
          overflowX: 'auto', 
          border: '1.5px solid #94A3B8', 
          borderRadius: 8, 
          background: '#fff' 
        }}
      >
        <div style={{ minWidth: 1000 }}>
          <div 
            style={{ 
              display: 'flex', 
              borderBottom: '2px solid #94A3B8', 
              background: '#F1F5F9' 
            }}
          >
            <div
              style={{
                width: 200,
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 10,
                background: '#F1F5F9',
                padding: '12px 16px',
                fontWeight: 600,
                borderRight: '2px solid #94A3B8',
                color: '#1e293b',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Phòng
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {Array.from({ length: totalHourHeaders }).map((_, i) => {
                const hourVal = openHour + i
                const isClosingCol = hourVal >= closeHour
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: '12px 0',
                      textAlign: 'center',
                      borderRight: i === totalHourHeaders - 1 ? 'none' : '1px solid #CBD5E1',
                      fontWeight: 600,
                      fontSize: 13,
                      color: isClosingCol ? '#64748b' : '#334155',
                      background: isClosingCol ? '#f8fafc' : undefined,
                    }}
                    title={isClosingCol ? `${String(hourVal).padStart(2, '0')}:00 - Giờ đóng cửa (không cho đặt phòng)` : undefined}
                  >
                    {String(hourVal).padStart(2, '0')}:00
                  </div>
                )
              })}
            </div>
          </div>
          {filteredRooms.map((room, roomIndex) => {
            const roomBookings = dayBookingsByRoom.get(room.id) || []
            const isLastRoom = roomIndex === filteredRooms.length - 1

            // Check if any closed periods apply to this room on this day
            const roomClosedPeriods = (bookingSettings?.closedPeriods || []).filter((cp) => {
              if (cp.roomId !== null && cp.roomId !== room.id) return false
              const targetDayStr = toVN(filterDate).format('YYYY-MM-DD')
              const cpStartDayStr = toVN(cp.start).format('YYYY-MM-DD')
              const cpEndDayStr = toVN(cp.end).format('YYYY-MM-DD')
              return targetDayStr >= cpStartDayStr && targetDayStr <= cpEndDayStr
            })

            return (
              <div 
                key={room.id} 
                style={{ 
                  display: 'flex', 
                  borderBottom: isLastRoom ? 'none' : '1px solid #CBD5E1', 
                  minHeight: 70 
                }}
              >
                <div
                  style={{
                    width: 200,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    background: '#fff',
                    padding: '12px 16px',
                    borderRight: '2px solid #94A3B8',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{room.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Sức chứa: {room.capacity}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative', background: '#fff' }}>
                  {Array.from({ length: totalHalfHours }).map((_, i) => {
                    const slotMinutes = timelineStartMin + i * 30
                    const hour = Math.floor(slotMinutes / 60)
                    const min = slotMinutes % 60
                    const isMainHour = min === 30
                    const isLastSlot = i === totalHalfHours - 1
                    const isClosedAfterHours = slotMinutes >= (closeHour * 60 + closeMinute)

                    const slotDay = toVN(filterDate).format('YYYY-MM-DD')
                    const slotStartTime = toVN(
                      `${slotDay} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`
                    )
                    const isPastSlot = slotStartTime.isBefore(toVN())
                    const isSlotDisabled = isClosedAfterHours || isPastSlot

                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          borderRight: isLastSlot
                            ? 'none'
                            : isMainHour
                              ? '1px solid #CBD5E1'
                              : '1px dashed #E2E8F0',
                          cursor: isSlotDisabled ? 'not-allowed' : 'pointer',
                          background: isClosedAfterHours ? '#f8fafc' : isPastSlot ? '#fbfcfe' : undefined,
                        }}
                        className={isSlotDisabled ? undefined : 'calendar-slot-hover'}
                        title={
                          isClosedAfterHours
                            ? 'Mốc 20:00 là giờ đóng cửa. Không thể đặt phòng sau giờ này.'
                            : isPastSlot
                              ? 'Thời gian này đã qua. Lịch quá khứ chỉ dùng để xem lại.'
                              : undefined
                        }
                        onClick={() => {
                          if (isClosedAfterHours) {
                            message.warning('Mốc 20:00 là giờ đóng cửa. Không thể đặt phòng sau giờ này.')
                            return
                          }
                          if (isPastSlot) {
                            message.warning('Không thể đặt phòng cho thời gian đã qua. Lịch quá khứ chỉ dùng để xem lại.')
                            return
                          }
                          handleSlotClick(room, hour, min)
                        }}
                      />
                    )
                  })}

                  {/* Closed / Maintenance periods indicator */}
                  {roomClosedPeriods.map((cp, cpIdx) => {
                    const cpStart = toVN(cp.start)
                    const cpEnd = toVN(cp.end)
                    const targetDay = toVN(filterDate)

                    let mStart = 0
                    let mEnd = totalTimelineMinutes
                    if (cpStart.isSame(targetDay, 'day')) {
                      mStart = Math.max(0, (cpStart.hour() * 60 + cpStart.minute()) - timelineStartMin)
                    }
                    if (cpEnd.isSame(targetDay, 'day')) {
                      mEnd = Math.min(totalTimelineMinutes, (cpEnd.hour() * 60 + cpEnd.minute()) - timelineStartMin)
                    }
                    const mDuration = Math.max(15, mEnd - mStart)
                    const leftP = (mStart / totalTimelineMinutes) * 100
                    const widthP = (mDuration / totalTimelineMinutes) * 100

                    return (
                      <div
                        key={`maint-${cpIdx}-${cp.start}`}
                        title={`Tạm ngưng/Bảo trì: ${cp.reason}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          modal.info({
                            title: 'Khung Giờ Tạm Ngưng Hoạt Động / Bảo Trì',
                            content: `Phòng ${room.name} tạm ngưng: ${cp.reason}. Thời gian từ ${formatVNDateTimeRange(cp.start, cp.end)}.`,
                            okText: 'Đã hiểu'
                          })
                        }}
                        style={{
                          position: 'absolute',
                          top: 8,
                          bottom: 8,
                          left: `calc(${leftP}% + 1px)`,
                          width: `calc(${widthP}% - 2px)`,
                          background: 'repeating-linear-gradient(45deg, #fef3c7, #fef3c7 8px, #fde68a 8px, #fde68a 16px)',
                          border: '1px dashed #d97706',
                          borderRadius: 6,
                          padding: '4px 6px',
                          color: '#92400e',
                          fontSize: 11,
                          fontWeight: 600,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          zIndex: 3,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          ⚠️ Bảo trì: {cp.reason}
                        </span>
                      </div>
                    )
                  })}

                  {/* Room Bookings */}
                  {roomBookings.map((b) => {
                    const bStart = toVN(b.startTime)
                    const bEnd = toVN(b.endTime)

                    // Position within dynamic openTime - closeTime timeline
                    const bStartMinRaw = bStart.hour() * 60 + bStart.minute()
                    const bEndMinRaw = bEnd.hour() * 60 + bEnd.minute()

                    const startMins = Math.max(0, bStartMinRaw - timelineStartMin)
                    const endMins = Math.min(totalTimelineMinutes, Math.max(0, bEndMinRaw - timelineStartMin))
                    const durationMins = Math.max(15, endMins - startMins)

                    const leftPercent = (startMins / totalTimelineMinutes) * 100
                    const widthPercent = (durationMins / totalTimelineMinutes) * 100
                    const statusInfo = getBookingStatusInfo(b)
                    const color = statusInfo.color
                    const isSchool = isSchoolScheduleBooking(b)

                    return (
                      <div
                        key={b.id}
                        onClick={() => handleBookingClick(b)}
                        title={`${formatVNTime(b.startTime)} - ${formatVNTime(b.endTime)}: ${b.purpose || 'Đã đặt'} (${statusInfo.label})`}
                        style={{
                          position: 'absolute',
                          top: 8,
                          bottom: 8,
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          background: color,
                          borderRadius: 6,
                          padding: '4px 8px',
                          color: '#fff',
                          fontSize: 12,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          zIndex: 2,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 500 }}>
                          {isSchool ? '🏛 ' : ''}
                          {formatVNTime(b.startTime)}: {b.purpose || 'Đã đặt'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {filteredRooms.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>
              Không tìm thấy phòng phù hợp với bộ lọc.
            </div>
          )}
          {filteredRooms.length > 0 && dayBookings.length === 0 && (
            <div
              style={{
                margin: '12px 16px',
                padding: '10px 16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#475569',
                fontSize: 13,
              }}
            >
              <InfoCircleOutlined style={{ color: '#0284c7' }} />
              <span>
                Không có lịch đặt phòng hoặc thời khóa biểu nào trong ngày này ({displayRangeLabel}). Tất cả các phòng học đang sẵn sàng.
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const events = filteredBookings
      .filter((b) => selectedRoomId === 'all' || b.roomId === selectedRoomId)
      .map((b) => {
        const st = toVN(b.startTime)
        const et = toVN(b.endTime)
        const startDate = new Date(st.year(), st.month(), st.date(), st.hour(), st.minute())
        const endDate = new Date(et.year(), et.month(), et.date(), et.hour(), et.minute())

        return {
          id: b.id,
          title: `${b.roomName || `Phòng ${b.roomId}`}${b.purpose ? ` - ${b.purpose}` : ''}`,
          start: startDate,
          end: endDate,
          resource: b,
        }
      })

    const currentDateVN = toVN(filterDate)
    const currentDate = new Date(currentDateVN.year(), currentDateVN.month(), currentDateVN.date())

    return (
      <div
        style={{
          height: '75vh',
          minHeight: 600,
          background: '#fff',
          padding: 16,
          borderRadius: 8,
          border: '1px solid #f0f0f0',
        }}
      >
        {events.length === 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#475569',
              fontSize: 13,
            }}
          >
            <InfoCircleOutlined style={{ color: '#0284c7' }} />
            <span>
              Không có lịch đặt phòng hoặc thời khóa biểu nào trong {displayRangeLabel}{selectedRoomId !== 'all' ? ' đối với phòng đã chọn' : ''}.
            </span>
          </div>
        )}
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          date={currentDate}
          onNavigate={(newDate) => setFilterDate(toVN(newDate))}
          onSelectSlot={(slotInfo) => {
            if (bookingsQuery.isLoading || bookingsQuery.isFetching) {
              message.warning('Dữ liệu lịch đang được tải hoặc cập nhật, vui lòng đợi trong giây lát trước khi chọn đặt phòng.')
              return
            }
            if (bookingsQuery.isError) {
              message.error('Không thể chọn đặt phòng do dữ liệu lịch chưa được tải thành công. Vui lòng bấm "Thử lại".')
              return
            }
            if (dayjs(slotInfo.start).isBefore(toVN())) {
              message.warning('Không thể đặt phòng cho thời gian đã qua. Lịch quá khứ chỉ dùng để xem lại.')
              return
            }
            const roomIdParam = selectedRoomId !== 'all' ? `&roomId=${selectedRoomId}` : ''
            navigate(`/bookings?start=${slotInfo.start.toISOString()}&end=${slotInfo.end.toISOString()}${roomIdParam}`)
          }}
          onSelectEvent={(e) => handleBookingClick(e.resource)}
          eventPropGetter={(event) => {
            const statusInfo = getBookingStatusInfo(event.resource)
            return {
              style: {
                backgroundColor: statusInfo.color,
                borderRadius: '4px',
                opacity: 0.95,
                color: '#fff',
                border: '0px',
                display: 'block',
                padding: '2px 5px',
                cursor: 'pointer',
              },
            }
          }}
          min={new Date(2025, 0, 1, openHour, openMinute)}
          max={new Date(2025, 0, 1, closeHour, closeMinute)}
          messages={{
            today: 'Hôm nay',
            previous: 'Trước',
            next: 'Sau',
            month: 'Tháng',
            week: 'Tuần',
            day: 'Ngày',
            agenda: 'Lịch trình',
            date: 'Ngày',
            time: 'Thời gian',
            event: 'Sự kiện',
            noEventsInRange: 'Không có sự kiện nào.',
          }}
          defaultView="week"
          views={['week']}
        />
      </div>
    )
  }

  const renderListView = () => {
    const sortedBookings = [...filteredBookings]
      .sort((a, b) => toVN(a.startTime).valueOf() - toVN(b.startTime).valueOf())

    return (
      <div>
        <div
          style={{
            padding: '14px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <Text strong style={{ color: '#0d2e5c', fontSize: 14 }}>
              Danh sách lịch đặt phòng & thời khóa biểu
            </Text>
            <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>
              Phạm vi hiển thị 30 ngày: <strong style={{ color: '#0f172a' }}>{displayRangeLabel}</strong>
            </div>
          </div>
          <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 500, padding: '2px 10px', fontSize: 13 }}>
            Tổng số: {sortedBookings.length} lịch
          </Tag>
        </div>
        <Table
          dataSource={sortedBookings}
          rowKey="id"
          pagination={{ pageSize: 15, showSizeChanger: true }}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: (
              <div style={{ padding: '48px 16px', textAlign: 'center' }}>
                <InfoCircleOutlined style={{ fontSize: 24, color: '#94a3b8', marginBottom: 8 }} />
                <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
                  Không có lịch đặt phòng hoặc thời khóa biểu nào trong phạm vi {displayRangeLabel}.
                </p>
              </div>
            ),
          }}
          onRow={(record) => ({
            onClick: () => handleBookingClick(record),
            style: { cursor: 'pointer' },
          })}
          columns={[
          {
            title: 'Ngày',
            dataIndex: 'startTime',
            render: (val) => formatVNDate(val, 'DD/MM/YYYY'),
          },
          {
            title: 'Thời gian',
            render: (_, record) => formatVNTimeRange(record.startTime, record.endTime),
          },
          {
            title: 'Phòng',
            dataIndex: 'roomName',
            render: (val, record) => val || `Phòng ${record.roomId}`,
          },
          {
            title: 'Mục đích / Học phần',
            dataIndex: 'purpose',
            responsive: ['md'],
            render: (val, record) => (
              <span>
                {isSchoolScheduleBooking(record) && <span style={{ marginRight: 6 }}>🏛️</span>}
                {val || 'Chưa ghi mục đích'}
              </span>
            ),
          },
          {
            title: 'Trạng thái',
            render: (_, record) => {
              const statusInfo = getBookingStatusInfo(record)
              return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
            },
          },
        ]}
      />
    </div>
  )
}

  if (!isAuthed) {
    return null
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: '#0d2e5c' }}>
            Lịch phòng
          </Title>
          <Text type="secondary">Tra cứu thời khóa biểu toàn trường và lịch đặt phòng</Text>
        </div>

        <Space size="middle" wrap>
          <Button
            icon={<ReloadOutlined spin={bookingsQuery.isFetching || roomsQuery.isFetching} />}
            loading={bookingsQuery.isFetching || roomsQuery.isFetching}
            onClick={() => {
              bookingsQuery.refetch()
              roomsQuery.refetch()
              message.success('Đang làm mới dữ liệu lịch phòng và phòng học...')
            }}
            style={{ fontWeight: 500, borderRadius: 8 }}
          >
            Tải lại lịch
          </Button>

          <Segmented
            options={[
              { label: 'Theo phòng', value: 'room', icon: <AppstoreOutlined /> },
              { label: 'Theo tuần', value: 'week', icon: <CalendarOutlined /> },
              { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
            ]}
            value={mode}
            onChange={(val) => {
              setMode(val as any)
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            size="large"
          />
        </Space>
      </div>

      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={12} lg={6}>
            <Text strong>Ngày</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Button
                icon={<LeftOutlined />}
                onClick={() => {
                  setSlideDirection('right')
                  const step = mode === 'week' ? 7 : mode === 'list' ? 30 : 1
                  setFilterDate((prev) => toVN(prev).subtract(step, 'day'))
                }}
                title={mode === 'week' ? 'Lùi 1 tuần' : mode === 'list' ? 'Lùi 30 ngày' : 'Lùi 1 ngày'}
              />
              <DatePicker
                value={filterDate}
                onChange={(d) => {
                  if (d) {
                    const vnD = toVN(d)
                    setSlideDirection(vnD.isAfter(filterDate) ? 'left' : 'right')
                    setFilterDate(vnD)
                  }
                }}
                format="DD/MM/YYYY"
                style={{ flex: 1 }}
                allowClear={false}
              />
              <Button
                icon={<RightOutlined />}
                onClick={() => {
                  setSlideDirection('left')
                  const step = mode === 'week' ? 7 : mode === 'list' ? 30 : 1
                  setFilterDate((prev) => toVN(prev).add(step, 'day'))
                }}
                title={mode === 'week' ? 'Tiến 1 tuần' : mode === 'list' ? 'Tiến 30 ngày' : 'Tiến 1 ngày'}
              />
            </div>
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Text strong>Tòa nhà</Text>
            <Select
              value={filterBuilding}
              onChange={setFilterBuilding}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { value: 'all', label: 'Tất cả tòa nhà' },
                ...buildings.map((b) => ({ value: b as string, label: b as string })),
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Text strong>Loại phòng</Text>
            <Select
              value={filterRoomType}
              onChange={setFilterRoomType}
              style={{ width: '100%', marginTop: 8 }}
              options={[
                { value: 'all', label: 'Tất cả loại phòng' },
                ...roomTypes.map((t) => ({ value: t as string, label: t as string })),
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={4}>
            <Text strong>Sức chứa (≥)</Text>
            <InputNumber
              value={filterMinCapacity}
              onChange={setFilterMinCapacity}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Nhập số người"
              min={1}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Text strong>Thiết bị</Text>
            <Select
              mode="multiple"
              value={filterEquipments}
              onChange={setFilterEquipments}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Chọn thiết bị"
              options={availableEquipments.map((e) => ({ value: e as string, label: e as string }))}
              maxTagCount="responsive"
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Text strong>Trạng thái</Text>
            <Select
              mode="multiple"
              value={filterStatuses}
              onChange={setFilterStatuses}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Chọn trạng thái"
              options={[
                { value: 'school-schedule', label: 'Thời khóa biểu chính khóa' },
                { value: 'approved', label: 'Đã duyệt' },
                { value: 'using', label: 'Đang sử dụng' },
                { value: 'completed', label: 'Hoàn thành' },
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'rejected', label: 'Từ chối / Đã hủy' },
              ]}
              maxTagCount="responsive"
            />
          </Col>
          {mode === 'week' && (
            <Col xs={24} sm={12} md={8} lg={4}>
              <Text strong>Phòng (Cho lịch tuần)</Text>
              <Select
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                }
                value={selectedRoomId}
                onChange={setSelectedRoomId}
                style={{ width: '100%', marginTop: 8 }}
                options={[
                  { value: 'all', label: 'Tất cả phòng' },
                  ...filteredRooms.map((r) => ({ value: r.id as number, label: r.name })),
                ]}
              />
            </Col>
          )}
        </Row>

        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Space size="middle" align="center" style={{ flexWrap: 'wrap' }}>
            <Badge color="#1e3a8a" text="Thời khóa biểu chính khóa" />
            <Badge color="#10b981" text="Đã duyệt" />
            <Badge color="#0284c7" text="Đang sử dụng" />
            <Badge color="#64748b" text="Hoàn thành" />
            <Badge color="#f59e0b" text="Chờ duyệt" />
            <Badge color="#ef4444" text="Từ chối / Đã hủy" />
          </Space>
        </div>
      </Card>

      {bookingsQuery.isError ? (
        (() => {
          const err = bookingsQuery.error as any
          const status = err?.response?.status

          if (status === 401) {
            return (
              <Alert
                type="error"
                showIcon
                title="Phiên đăng nhập đã hết hạn (Lỗi 401)"
                description="Phiên làm việc của bạn đã hết hạn hoặc chưa được xác thực. Vui lòng đăng nhập lại để tiếp tục xem lịch phòng."
                action={
                  <Button type="primary" danger onClick={() => navigate('/login?redirect=/calendar')}>
                    Đăng nhập lại
                  </Button>
                }
                style={{ borderRadius: 12, padding: 20, marginBottom: 24 }}
              />
            )
          }

          if (status === 403) {
            return (
              <Alert
                type="warning"
                showIcon
                title="Không có quyền truy cập (Lỗi 403)"
                description="Tài khoản của bạn không có quyền truy cập vào dữ liệu lịch phòng này."
                action={
                  <Button onClick={() => bookingsQuery.refetch()}>
                    Thử lại
                  </Button>
                }
                style={{ borderRadius: 12, padding: 20, marginBottom: 24 }}
              />
            )
          }

          const errorMsg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            'Không thể kết nối tới máy chủ để tải lịch.'

          return (
            <Alert
              type="error"
              showIcon
              title="Không thể tải lịch phòng từ máy chủ"
              description={
                <div>
                  <div style={{ marginBottom: 8, color: '#1e293b' }}>{errorMsg}</div>
                  <Text type="secondary" style={{ fontSize: 12.5 }}>
                    Bảng lịch tạm thời không hiển thị để tránh hiểu lầm rằng tất cả phòng học đang trống. Vui lòng bấm &quot;Thử lại&quot; bên dưới.
                  </Text>
                </div>
              }
              action={
                <Button
                  type="primary"
                  onClick={() => {
                    bookingsQuery.refetch()
                    roomsQuery.refetch()
                  }}
                  style={{ background: '#0d2e5c' }}
                >
                  Thử lại
                </Button>
              }
              style={{ borderRadius: 12, padding: 20, marginBottom: 24 }}
            />
          )
        })()
      ) : bookingsQuery.isLoading || roomsQuery.isLoading ? (
        <Card style={{ borderRadius: 12, padding: '64px 24px', textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#0d2e5c' }}>
            Đang tải lịch phòng và thời khóa biểu...
          </div>
          <Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
            Đang tải dữ liệu {displayRangeLabel}. Bảng lịch sẽ hiển thị ngay khi dữ liệu hoàn tất.
          </Text>
        </Card>
      ) : (
        <>
          {bookingsQuery.isFetching && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag icon={<SyncOutlined spin />} color="processing" style={{ padding: '4px 10px', fontSize: 12.5, borderRadius: 6 }}>
                Đang cập nhật lịch mới nhất...
              </Tag>
            </div>
          )}
          <div
            key={`${toVN(filterDate).format('YYYY-MM-DD')}-${mode}`}
            className={slideDirection === 'left' ? 'calendar-slide-left' : 'calendar-slide-right'}
          >
            {mode === 'room' && renderRoomView()}
            {mode === 'week' && renderWeekView()}
            {mode === 'list' && (
              <Card style={{ borderRadius: 12, padding: 0 }} styles={{ body: { padding: 0 } }}>
                {renderListView()}
              </Card>
            )}
          </div>
        </>
      )}

      {/* Standardized Booking & Schedule Details Modal */}
      <Modal
        title={
          selectedBooking && isSchoolScheduleBooking(selectedBooking)
            ? 'Thông tin Lịch học & Thời khóa biểu'
            : 'Thông tin Đặt phòng'
        }
        open={!!selectedBooking}
        onCancel={() => setSelectedBooking(null)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setSelectedBooking(null)}
            style={{ background: '#0d2e5c' }}
          >
            Đóng
          </Button>,
        ]}
      >
        {selectedBooking &&
          (() => {
            const isSchool = isSchoolScheduleBooking(selectedBooking)
            return (
              <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
                <Descriptions.Item label="Phòng">
                  <strong>{selectedBooking.roomName || `Phòng ${selectedBooking.roomId}`}</strong>
                </Descriptions.Item>

                {isSchool && (
                  <Descriptions.Item label="Phân loại">
                    <Tag
                      style={{
                        backgroundColor: '#f3e8ff',
                        color: '#6b21a8',
                        borderColor: '#e9d5ff',
                        fontWeight: 600,
                        padding: '2px 10px',
                        borderRadius: 4,
                      }}
                    >
                      🏛 Lịch học chính khóa
                    </Tag>
                  </Descriptions.Item>
                )}

                {selectedBooking.subjectCode && (
                  <Descriptions.Item label="Mã học phần">{selectedBooking.subjectCode}</Descriptions.Item>
                )}

                <Descriptions.Item label={isSchool ? 'Môn học / Nội dung' : 'Mục đích sử dụng'}>
                  {selectedBooking.purpose || 'Không có'}
                </Descriptions.Item>

                {selectedBooking.lecturerName && (
                  <Descriptions.Item label="Giảng viên phụ trách">{selectedBooking.lecturerName}</Descriptions.Item>
                )}

                {selectedBooking.semester && (
                  <Descriptions.Item label="Học kỳ áp dụng">{selectedBooking.semester}</Descriptions.Item>
                )}

                <Descriptions.Item label="Thời gian">
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>
                    {formatVNDateTimeRange(selectedBooking.startTime, selectedBooking.endTime)}
                  </span>
                </Descriptions.Item>

                <Descriptions.Item label="Trạng thái">
                  {(() => {
                    const statusInfo = getBookingStatusInfo(selectedBooking)
                    return (
                      <Space wrap>
                        {isSchool && (
                          <Tag
                            style={{
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              borderColor: '#bae6fd',
                              fontWeight: 600,
                              padding: '2px 10px',
                              borderRadius: 4,
                            }}
                          >
                            Thời khóa biểu chính khóa
                          </Tag>
                        )}
                        <Tag
                          color={statusInfo.color}
                          style={{
                            fontWeight: 600,
                            padding: '2px 10px',
                            borderRadius: 4,
                          }}
                        >
                          {statusInfo.label}
                        </Tag>
                      </Space>
                    )
                  })()}
                </Descriptions.Item>

                {selectedBooking.department && (
                  <Descriptions.Item label="Đơn vị / Khoa">{normalizeDepartmentName(selectedBooking.department)}</Descriptions.Item>
                )}

                {(() => {
                  const majorInfo = extractMajorFromNotes(selectedBooking.notes)
                  const displayMajor = selectedBooking.major || majorInfo.major
                  return displayMajor ? (
                    <Descriptions.Item label="Ngành học">
                      <Tag color="purple" style={{ fontWeight: 600 }}>{displayMajor}</Tag>
                    </Descriptions.Item>
                  ) : null
                })()}

                {isSchool ? (
                  <Descriptions.Item label="Ghi chú">
                    <span style={{ color: '#475569', fontSize: 13 }}>
                      Thời khóa biểu chính khóa do Phòng Quản lý Đào tạo sắp xếp.
                    </span>
                  </Descriptions.Item>
                ) : (
                  (selectedBooking.rejectReason ||
                    selectedBooking.rejectionReason ||
                    selectedBooking.adminNotes) && (
                    <Descriptions.Item label="Ghi chú / Lý do">
                      <span style={{ color: '#475569', fontSize: 13 }}>
                        {selectedBooking.rejectReason ||
                          selectedBooking.rejectionReason ||
                          selectedBooking.adminNotes}
                      </span>
                    </Descriptions.Item>
                  )
                )}
              </Descriptions>
            )
          })()}
      </Modal>
    </div>
  )
}
