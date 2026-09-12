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
  Spin
} from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'
import {
  toVN,
  formatVNDate,
  formatVNTime,
  formatVNDateTimeRange,
  formatVNTimeRange,
  isSchoolScheduleBooking
} from '../../utils/dateUtils'
import dayjs from 'dayjs'
import {
  CalendarOutlined,
  UnorderedListOutlined,
  AppstoreOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons'

moment.locale('vi')
const localizer = momentLocalizer(moment)

const { Title, Text } = Typography
const { useBreakpoint } = Grid

async function fetchRooms() {
  try {
    return (await http.get<Room[]>('/api/rooms')).data
  } catch {
    const localStr = localStorage.getItem('tbd_admin_rooms')
    if (localStr) return JSON.parse(localStr) as Room[]
    return []
  }
}

async function fetchBookings(): Promise<Booking[]> {
  try {
    const res = await http.get<Booking[]>('/api/bookings')
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      return res.data
    }
  } catch (err) {
    console.warn('Không thể tải /api/bookings, dùng dữ liệu cache local:', err)
  }
  const localStr = localStorage.getItem('tbd_admin_bookings')
  if (localStr) {
    try {
      return JSON.parse(localStr) as Booking[]
    } catch {
      // ignore
    }
  }
  return []
}

export const getEventStatusGroup = (booking: Booking): string => {
  if (isSchoolScheduleBooking(booking)) return 'school-schedule'
  const s = String(booking.status).toLowerCase()
  const reason = (booking.rejectReason || booking.rejectionReason || booking.adminNotes || '').toLowerCase()
  const isExp = s === 'expired' || s === '3' || reason.includes('hết hạn')

  if (s === 'completed' || s === 'cancelled' || s === '-1' || isExp) return 'completed'
  if (s === 'rejected' || s === '2') return 'rejected'
  if (s === 'approved' || s === '1' || s === 'using') return 'approved'
  if (s === 'pending' || s === 'pendingspecial' || s === '0') return 'pending'
  return 'approved'
}

const statusColors: Record<string, string> = {
  'school-schedule': '#1e3a8a',
  pending: '#f59e0b',
  approved: '#10b981',
  completed: '#94a3b8',
  rejected: '#ef4444'
}

const statusLabels: Record<string, string> = {
  'school-schedule': 'Thời khóa biểu chính khóa',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt / Đang dùng',
  completed: 'Hoàn thành / Đã hủy / Hết hạn',
  rejected: 'Từ chối / Trùng'
}

export default function CalendarPage() {
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

  // React Query with 5 minutes stale time and no refetch on window focus
  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const bookingsQuery = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: fetchBookings,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const localStr = localStorage.getItem('tbd_admin_equipments')
      if (localStr) return JSON.parse(localStr)
      return []
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const [localBookings, setLocalBookings] = useState<Booking[]>([])

  useEffect(() => {
    const localStr = localStorage.getItem('tbd_admin_bookings')
    let localData: Booking[] = []
    if (localStr) {
      try {
        localData = JSON.parse(localStr)
      } catch {
        // ignore parse error
      }
    }
    const apiData = bookingsQuery.data ?? []
    const combined = [...apiData]
    localData.forEach((local) => {
      const idx = combined.findIndex((b) => b.id === local.id)
      if (idx > -1) combined[idx] = local
      else combined.push(local)
    })

    const nowVN = toVN().valueOf()
    const updated = combined.map((b) => {
      // Official school schedule sessions always maintain active timetable status
      if (isSchoolScheduleBooking(b)) {
        return b
      }
      const s = String(b.status)
      if (s === 'Approved' || s === '1' || s === 'Using') {
        const start = toVN(b.startTime).valueOf()
        const end = toVN(b.endTime).valueOf()
        if (nowVN >= end) return { ...b, status: 'Completed' as Booking['status'] }
        if (nowVN >= start && nowVN < end) return { ...b, status: 'Using' as Booking['status'] }
      }
      return b
    })
    setLocalBookings(updated)
  }, [bookingsQuery.data])

  const buildings = useMemo(() => {
    if (!roomsQuery.data) return []
    return Array.from(new Set(getOfficialRooms(roomsQuery.data).map((r: Room) => r.building).filter(Boolean)))
  }, [roomsQuery.data])

  const roomTypes = useMemo(() => {
    if (!roomsQuery.data) return []
    return Array.from(
      new Set(
        getOfficialRooms(roomsQuery.data)
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

  // Filter all bookings by user-selected status filter
  const filteredBookings = useMemo(() => {
    return localBookings.filter((b) => {
      if (filterStatuses.length > 0) {
        const g = getEventStatusGroup(b)
        if (!filterStatuses.includes(g)) return false
      }
      return true
    })
  }, [localBookings, filterStatuses])

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
        Modal.warning({
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

      Modal.info({
        title: 'Khung Giờ Đã Có Người Đặt',
        content: `Phòng ${room.name} vào khung giờ này đã có người đăng ký (${
          conflictingBooking.purpose || 'Đã đặt'
        }). Vui lòng chọn khung giờ hoặc phòng khác.`,
        okText: 'Đóng',
      })
      return
    }

    const dayStr = toVN(filterDate).format('YYYY-MM-DD')
    const startIso = toVN(
      `${dayStr} ${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
    ).toISOString()
    const endIso = toVN(
      `${dayStr} ${String(startHour + 1).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}:00`
    ).toISOString()

    navigate(`/bookings?roomId=${room.id}&start=${startIso}&end=${endIso}`)
  }

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking)
  }

  const renderRoomView = () => {
    return (
      <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
        <div style={{ minWidth: 1000 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div
              style={{
                width: 200,
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 10,
                background: '#fafafa',
                padding: '12px 16px',
                fontWeight: 600,
                borderRight: '1px solid #f0f0f0',
              }}
            >
              Phòng
            </div>
            <div style={{ flex: 1, display: 'flex' }}>
              {Array.from({ length: 14 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: '12px 0',
                    textAlign: 'center',
                    borderRight: '1px solid #f0f0f0',
                    fontWeight: 500,
                    fontSize: 13,
                    color: '#334155'
                  }}
                >
                  {7 + i}:00
                </div>
              ))}
            </div>
          </div>
          {filteredRooms.map((room) => {
            const roomBookings = dayBookingsByRoom.get(room.id) || []
            return (
              <div key={room.id} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', minHeight: 70 }}>
                <div
                  style={{
                    width: 200,
                    flexShrink: 0,
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                    background: '#fff',
                    padding: '12px 16px',
                    borderRight: '1px solid #f0f0f0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{room.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Sức chứa: {room.capacity}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative', background: '#fff' }}>
                  {Array.from({ length: 28 }).map((_, i) => {
                    const hour = 7 + Math.floor(i / 2)
                    const min = (i % 2) * 30
                    return (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          borderRight: i % 2 === 1 ? '1px solid #f0f0f0' : '1px dashed #f1f5f9',
                          cursor: 'pointer',
                        }}
                        className="calendar-slot-hover"
                        onClick={() => handleSlotClick(room, hour, min)}
                      />
                    )
                  })}
                  {roomBookings.map((b) => {
                    const bStart = toVN(b.startTime)
                    const bEnd = toVN(b.endTime)

                    // Position within the 07:00 - 21:00 timeline (14 hours = 840 minutes)
                    const startMins = Math.max(0, (bStart.hour() - 7) * 60 + bStart.minute())
                    const endMins = Math.min(14 * 60, (bEnd.hour() - 7) * 60 + bEnd.minute())
                    const durationMins = Math.max(15, endMins - startMins)

                    const leftPercent = (startMins / (14 * 60)) * 100
                    const widthPercent = (durationMins / (14 * 60)) * 100
                    const group = getEventStatusGroup(b)
                    const color = statusColors[group] || '#1e3a8a'
                    const isSchool = isSchoolScheduleBooking(b)

                    return (
                      <div
                        key={b.id}
                        onClick={() => handleBookingClick(b)}
                        title={`${formatVNTime(b.startTime)} - ${formatVNTime(b.endTime)}: ${b.purpose || 'Đã đặt'}`}
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
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          date={currentDate}
          onNavigate={(newDate) => setFilterDate(toVN(newDate))}
          onSelectSlot={(slotInfo) => {
            const roomIdParam = selectedRoomId !== 'all' ? `&roomId=${selectedRoomId}` : ''
            navigate(`/bookings?start=${slotInfo.start.toISOString()}&end=${slotInfo.end.toISOString()}${roomIdParam}`)
          }}
          onSelectEvent={(e) => handleBookingClick(e.resource)}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: statusColors[getEventStatusGroup(event.resource)],
              borderRadius: '4px',
              opacity: 0.9,
              color: '#fff',
              border: '0px',
              display: 'block',
              padding: '2px 5px',
            },
          })}
          min={new Date(2025, 0, 1, 7, 0)}
          max={new Date(2025, 0, 1, 21, 0)}
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
    const targetDay = toVN(filterDate).startOf('day')
    const sortedBookings = [...filteredBookings]
      .filter((b) => {
        if (!b || !b.startTime) return false
        return toVN(b.startTime).isSameOrAfter(targetDay, 'day')
      })
      .sort((a, b) => toVN(a.startTime).valueOf() - toVN(b.startTime).valueOf())

    return (
      <Table
        dataSource={sortedBookings}
        rowKey="id"
        pagination={{ pageSize: 15 }}
        scroll={{ x: 'max-content' }}
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
              const group = getEventStatusGroup(record)
              return <Tag color={statusColors[group]}>{statusLabels[group]}</Tag>
            },
          },
        ]}
      />
    )
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
                  setFilterDate((prev) => toVN(prev).subtract(1, 'day'))
                }}
                title="Lùi 1 ngày"
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
                  setFilterDate((prev) => toVN(prev).add(1, 'day'))
                }}
                title="Tiến 1 ngày"
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
                { value: 'approved', label: 'Đã duyệt / Đang dùng' },
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'completed', label: 'Hoàn thành / Đã hủy / Hết hạn' },
                { value: 'rejected', label: 'Từ chối / Trùng' },
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
            <Badge color="#10b981" text="Đã duyệt / Đang dùng" />
            <Badge color="#f59e0b" text="Chờ duyệt" />
            <Badge color="#94a3b8" text="Hoàn thành / Đã hủy / Hết hạn" />
            <Badge color="#ef4444" text="Từ chối / Trùng" />
          </Space>
        </div>
      </Card>

      {bookingsQuery.isLoading || roomsQuery.isLoading ? (
        <Card style={{ borderRadius: 12, padding: '48px 24px', textAlign: 'center', background: '#fff' }}>
          <Spin size="large" description="Đang tải lịch phòng và thời khóa biểu toàn trường..." />
        </Card>
      ) : (
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
                  {isSchool ? (
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
                  ) : (
                    <Tag color={statusColors[getEventStatusGroup(selectedBooking)]}>
                      {statusLabels[getEventStatusGroup(selectedBooking)]}
                    </Tag>
                  )}
                </Descriptions.Item>

                {selectedBooking.department && (
                  <Descriptions.Item label="Đơn vị / Khoa">{selectedBooking.department}</Descriptions.Item>
                )}

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
