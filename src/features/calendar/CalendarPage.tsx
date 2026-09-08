import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import 'moment/locale/vi'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useState, useMemo, useEffect } from 'react'
import { Card, Select, Typography, Space, Badge, Segmented, DatePicker, InputNumber, Row, Col, Table, Grid, Modal, Descriptions, Tag, Button } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { CalendarOutlined, UnorderedListOutlined, AppstoreOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'

dayjs.extend(isBetween)
dayjs.extend(isSameOrAfter)
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
async function fetchBookings() {
  return (await http.get<Booking[]>('/api/bookings')).data
}

const isOverlapping = (b1: Booking, b2: Booking) => {
  if (b1.id === b2.id) return false
  if (b1.roomId !== b2.roomId) return false

  const s1 = String(b1.status)
  const s2 = String(b2.status)
  const reason1 = (b1.rejectReason || b1.rejectionReason || b1.adminNotes || '').toLowerCase()
  const reason2 = (b2.rejectReason || b2.rejectionReason || b2.adminNotes || '').toLowerCase()
  const isExp1 = s1 === 'Expired' || s1 === '3' || reason1.includes('hết hạn')
  const isExp2 = s2 === 'Expired' || s2 === '3' || reason2.includes('hết hạn')

  if (s1 === 'Cancelled' || s1 === 'Rejected' || s1 === '-1' || s1 === '2' || isExp1) return false
  if (s2 === 'Cancelled' || s2 === 'Rejected' || s2 === '-1' || s2 === '2' || isExp2) return false

  const start1 = new Date(b1.startTime).getTime()
  const end1 = new Date(b1.endTime).getTime()
  const start2 = new Date(b2.startTime).getTime()
  const end2 = new Date(b2.endTime).getTime()

  return start1 < end2 && start2 < end1
}

const getEventStatusGroup = (booking: Booking, allBookings: Booking[]) => {
  if (booking.isSchoolOverride || booking.IsSchoolOverride) return 'school-schedule'
  const s = String(booking.status)
  const reason = (booking.rejectReason || booking.rejectionReason || booking.adminNotes || '').toLowerCase()
  const isExp = s === 'Expired' || s === '3' || reason.includes('hết hạn')

  if (s === 'Completed' || s === 'Cancelled' || s === '-1' || isExp) return 'completed'
  if (s === 'Rejected' || s === '2') return 'rejected'
  const hasOverlap = allBookings.some(other => isOverlapping(booking, other))
  if (hasOverlap) return 'rejected'
  if (s === 'Approved' || s === '1' || s === 'Using') return 'approved'
  if (s === 'Pending' || s === 'PendingSpecial' || s === '0') return 'pending'
  return 'completed'
}

const statusColors: Record<string, string> = {
  'school-schedule': '#1e3a8a',
  pending: '#f59e0b',
  approved: '#10b981',
  completed: '#94a3b8',
  rejected: '#ef4444'
}

const statusLabels: Record<string, string> = {
  'school-schedule': 'TKB Nhà trường (Đã khóa)',
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt / Đang dùng',
  completed: 'Hoàn thành / Đã hủy / Hết hạn',
  rejected: 'Từ chối / Trùng'
}

export default function CalendarPage() {
  const navigate = useNavigate()
  const screens = useBreakpoint()
  
  const [mode, setMode] = useState<'room' | 'week' | 'list'>('room')
  const [filterDate, setFilterDate] = useState<dayjs.Dayjs>(dayjs())
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

  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })
    
  const bookingsQuery = useQuery({ queryKey: ['admin-bookings'], queryFn: fetchBookings })
  
  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const localStr = localStorage.getItem('tbd_admin_equipments')
      if (localStr) return JSON.parse(localStr)
      return []
    }
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
    localData.forEach(local => {
      const idx = combined.findIndex(b => b.id === local.id)
      if (idx > -1) combined[idx] = local
      else combined.push(local)
    })
    const now = new Date().getTime()
    const updated = combined.map(b => {
      const s = String(b.status)
      if (s === 'Approved' || s === '1' || s === 'Using') {
        const start = new Date(b.startTime).getTime()
        const end = new Date(b.endTime).getTime()
        if (now >= end) return { ...b, status: 'Completed' as Booking['status'] }
        if (now >= start && now < end) return { ...b, status: 'Using' as Booking['status'] }
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
    return Array.from(new Set(getOfficialRooms(roomsQuery.data).map((r: Room) => (r as any)._displayType || r.roomType).filter(Boolean)))
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
        const hasAll = filterEquipments.every(eq => equipmentsQuery.data.some((e: any) => e.type === eq && (e.roomId === r.id || e.roomId === null) && e.status !== 'Maintenance' && e.status !== 'Broken'))
        if (!hasAll) return false
      }
      return true
    })
  }, [roomsQuery.data, filterBuilding, filterRoomType, filterMinCapacity, filterEquipments])

  const filteredBookings = useMemo(() => {
    return localBookings.filter(b => {
      if (filterStatuses.length > 0) {
        const g = getEventStatusGroup(b, localBookings)
        if (!filterStatuses.includes(g)) return false
      }
      return true
    })
  }, [localBookings, filterStatuses])

  const handleSlotClick = (room: Room, startHour: number, startMinute: number) => {
    const start = filterDate.hour(startHour).minute(startMinute).second(0)
    const end = start.add(30, 'minute')
    const sTime = start.toDate().getTime()
    const eTime = end.toDate().getTime()

    // Check if slot overlaps with an existing booking in this room
    const conflictingBooking = filteredBookings.find(b => {
      if (b.roomId !== room.id) return false
      const s = String(b.status)
      if (s === 'Cancelled' || s === 'Rejected' || s === '-1' || s === '2' || s === 'Expired' || s === '3') return false
      const bStart = new Date(b.startTime).getTime()
      const bEnd = new Date(b.endTime).getTime()
      return sTime < bEnd && eTime > bStart
    })

    if (conflictingBooking) {
      if (conflictingBooking.isSchoolOverride || conflictingBooking.IsSchoolOverride) {
        Modal.warning({
          title: 'Khung Giờ Đã Khóa Bởi Nhà Trường',
          content: (
            <div>
              <p>
                Phòng <strong>{room.name}</strong> trong khung giờ{' '}
                <strong>
                  {dayjs(conflictingBooking.startTime).format('HH:mm')} - {dayjs(conflictingBooking.endTime).format('HH:mm')}
                </strong>{' '}
                đã được phân bổ cho <strong>Lịch học / Thời khóa biểu chính khóa của Nhà trường</strong>.
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#0f172a', margin: '8px 0' }}>
                <div>🏛️ <strong>Học phần:</strong> {conflictingBooking.subjectCode ? `${conflictingBooking.subjectCode} - ` : ''}{conflictingBooking.purpose}</div>
                {conflictingBooking.lecturerName && <div>👨‍🏫 <strong>Giảng viên:</strong> {conflictingBooking.lecturerName}</div>}
                {conflictingBooking.semester && <div>📅 <strong>Học kỳ:</strong> {conflictingBooking.semester}</div>}
              </div>
              <p style={{ margin: 0, color: '#ef4444', fontSize: 12, fontWeight: 500 }}>
                ⚠️ Ràng buộc hệ thống: Khung giờ có cờ IsSchoolOverride được ưu tiên tuyệt đối và đã khóa slot cố định. Sinh viên không thể đặt trùng.
              </p>
            </div>
          ),
          okText: 'Đã hiểu',
        })
        return
      }

      Modal.info({
        title: 'Khung Giờ Đã Có Người Đặt',
        content: `Phòng ${room.name} vào khung giờ này đã có người đăng ký (${conflictingBooking.purpose || 'Đã đặt'}). Vui lòng chọn khung giờ hoặc phòng khác.`,
        okText: 'Đóng',
      })
      return
    }

    const defaultEnd = start.add(1, 'hour')
    navigate(`/bookings?roomId=${room.id}&start=${start.toISOString()}&end=${defaultEnd.toISOString()}`)
  }

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking)
  }

  const renderRoomView = () => {
    const startOfDay = filterDate.startOf('day').add(7, 'hour').toDate().getTime()
    const endOfDay = filterDate.startOf('day').add(21, 'hour').toDate().getTime()
    
    const bookingsForDate = filteredBookings.filter(b => {
      const bStart = new Date(b.startTime).getTime()
      const bEnd = new Date(b.endTime).getTime()
      return bStart < endOfDay && bEnd > startOfDay
    })

    return (
      <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fff' }}>
        <div style={{ minWidth: 1000 }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <div style={{ width: 200, flexShrink: 0, position: 'sticky', left: 0, zIndex: 10, background: '#fafafa', padding: '12px 16px', fontWeight: 600, borderRight: '1px solid #f0f0f0' }}>Phòng</div>
            <div style={{ flex: 1, display: 'flex' }}>
              {Array.from({length: 14}).map((_, i) => (
                <div key={i} style={{ flex: 1, padding: '12px 0', textAlign: 'center', borderRight: '1px solid #f0f0f0', fontWeight: 500 }}>
                  {7 + i}:00
                </div>
              ))}
            </div>
          </div>
          {filteredRooms.map(room => {
            const roomBookings = bookingsForDate.filter(b => b.roomId === room.id)
            return (
              <div key={room.id} style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', minHeight: 70 }}>
                <div style={{ width: 200, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: '#fff', padding: '12px 16px', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>{room.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Sức chứa: {room.capacity}</div>
                </div>
                <div style={{ flex: 1, display: 'flex', position: 'relative', background: '#fff' }}>
                    {Array.from({length: 28}).map((_, i) => {
                      const hour = 7 + Math.floor(i / 2)
                      const min = (i % 2) * 30
                      return (
                        <div 
                          key={i} 
                          style={{ flex: 1, borderRight: i % 2 === 1 ? '1px solid #f0f0f0' : '1px dashed #f1f5f9', cursor: 'pointer' }} 
                          className="calendar-slot-hover"
                          onClick={() => handleSlotClick(room, hour, min)}
                        />
                      )
                    })}
                    {roomBookings.map(b => {
                      const bStart = new Date(b.startTime)
                      const bEnd = new Date(b.endTime)
                      
                      const baseTime = filterDate.startOf('day').toDate().getTime()
                      const msFrom7AM = Math.max(0, bStart.getTime() - (baseTime + 7 * 3600000))
                      const msTotal = Math.min((21 - 7) * 3600000, bEnd.getTime() - Math.max(baseTime + 7 * 3600000, bStart.getTime()))
                      
                      const leftPercent = (msFrom7AM / ((21 - 7) * 3600000)) * 100
                      const widthPercent = (msTotal / ((21 - 7) * 3600000)) * 100
                      const color = statusColors[getEventStatusGroup(b, localBookings)]
                      return (
                        <div 
                          key={b.id} 
                          onClick={() => handleBookingClick(b)}
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
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: 500 }}>{b.purpose || 'Đã đặt'}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })}
          {filteredRooms.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#8c8c8c' }}>Không tìm thấy phòng phù hợp với bộ lọc.</div>
          )}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const events = filteredBookings
      .filter(b => selectedRoomId === 'all' || b.roomId === selectedRoomId)
      .map(b => ({
        id: b.id,
        title: `${b.roomName}${b.purpose ? ` - ${b.purpose}` : ''}`,
        start: new Date(b.startTime),
        end: new Date(b.endTime),
        resource: b,
      }))

    return (
      <div style={{ height: '75vh', minHeight: 600, background: '#fff', padding: 16, borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          selectable
          date={filterDate.toDate()}
          onNavigate={(newDate) => setFilterDate(dayjs(newDate))}
          onSelectSlot={(slotInfo) => {
            const roomIdParam = selectedRoomId !== 'all' ? `&roomId=${selectedRoomId}` : ''
            navigate(`/bookings?start=${slotInfo.start.toISOString()}&end=${slotInfo.end.toISOString()}${roomIdParam}`)
          }}
          onSelectEvent={(e) => handleBookingClick(e.resource)}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: statusColors[getEventStatusGroup(event.resource, localBookings)],
              borderRadius: '4px',
              opacity: 0.9,
              color: '#fff',
              border: '0px',
              display: 'block',
              padding: '2px 5px',
            }
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
    const sortedBookings = [...filteredBookings]
      .filter(b => {
        // Only show future/today events
        const isSameOrAfter = dayjs(b.startTime).isSameOrAfter(filterDate, 'day')
        return isSameOrAfter
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    return (
      <Table 
        dataSource={sortedBookings} 
        rowKey="id"
        pagination={{ pageSize: 15 }}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onClick: () => handleBookingClick(record),
          style: { cursor: 'pointer' }
        })}
        columns={[
          { title: 'Ngày', dataIndex: 'startTime', render: (val) => dayjs(val).format('DD/MM/YYYY') },
          { title: 'Thời gian', render: (_, record) => `${dayjs(record.startTime).format('HH:mm')} - ${dayjs(record.endTime).format('HH:mm')}` },
          { title: 'Phòng', dataIndex: 'roomName', render: (val, record) => val || `Phòng ${record.roomId}` },
          { title: 'Mục đích', dataIndex: 'purpose', responsive: ['md'] },
          { title: 'Trạng thái', render: (_, record) => {
            const group = getEventStatusGroup(record, localBookings)
            return <Tag color={statusColors[group]}>{statusLabels[group]}</Tag>
          } },
        ]}
      />
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Lịch phòng</Title>
          <Text type="secondary">Tra cứu lịch và đặt phòng nhanh chóng</Text>
        </div>
        
        <Segmented 
          options={[
            { label: 'Theo phòng', value: 'room', icon: <AppstoreOutlined /> },
            { label: 'Theo tuần', value: 'week', icon: <CalendarOutlined /> },
            { label: 'Danh sách', value: 'list', icon: <UnorderedListOutlined /> },
          ]} 
          value={mode} 
          onChange={(val) => {
            setMode(val as any);
            window.scrollTo({ top: 0, behavior: 'smooth' });
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
                  setFilterDate(prev => prev.subtract(1, 'day'))
                }}
                title="Lùi 1 ngày"
              />
              <DatePicker 
                value={filterDate} 
                onChange={(d) => {
                  if (d) {
                    setSlideDirection(d.isAfter(filterDate) ? 'left' : 'right')
                    setFilterDate(d)
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
                  setFilterDate(prev => prev.add(1, 'day'))
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
                ...buildings.map(b => ({ value: b as string, label: b as string }))
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
                ...roomTypes.map(t => ({ value: t as string, label: t as string }))
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
              options={availableEquipments.map(e => ({ value: e as string, label: e as string }))}
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
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'approved', label: 'Đã duyệt / Đang dùng' },
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
                filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                value={selectedRoomId} 
                onChange={setSelectedRoomId} 
                style={{ width: '100%', marginTop: 8 }}
                options={[
                  { value: 'all', label: 'Tất cả phòng' },
                  ...filteredRooms.map(r => ({ value: r.id as number, label: r.name }))
                ]}
              />
            </Col>
          )}
        </Row>
        
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
          <Space size="middle" align="center" style={{ flexWrap: 'wrap' }}>
            <Badge color="#f59e0b" text="Chờ duyệt" />
            <Badge color="#10b981" text="Đã duyệt/Đang dùng" />
            <Badge color="#94a3b8" text="Hoàn thành/Đã hủy/Hết hạn" />
            <Badge color="#ef4444" text="Từ chối/Trùng" />
          </Space>
        </div>
      </Card>

      <div
        key={`${filterDate.format('YYYY-MM-DD')}-${mode}`}
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

      {/* Booking Details Modal */}
      <Modal
        title={
          selectedBooking?.isSchoolOverride || selectedBooking?.IsSchoolOverride
            ? "🏛️ Lịch Học / Thời Khóa Biểu Nhà Trường"
            : "Thông tin Đặt phòng"
        }
        open={!!selectedBooking}
        onCancel={() => setSelectedBooking(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedBooking(null)}>Đóng</Button>
        ]}
      >
        {selectedBooking && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 16 }}>
            <Descriptions.Item label="Phòng">{selectedBooking.roomName || `Phòng ${selectedBooking.roomId}`}</Descriptions.Item>
            
            {(selectedBooking.isSchoolOverride || selectedBooking.IsSchoolOverride) && (
              <Descriptions.Item label="Phân loại">
                <Tag color="#1e3a8a" style={{ fontWeight: 600 }}>
                  🏛️ LỊCH HỌC CHÍNH KHÓA (KHÓA SLOT)
                </Tag>
              </Descriptions.Item>
            )}

            {selectedBooking.subjectCode && (
              <Descriptions.Item label="Mã học phần">{selectedBooking.subjectCode}</Descriptions.Item>
            )}

            <Descriptions.Item label={selectedBooking.isSchoolOverride ? "Môn học / Mục đích" : "Mục đích"}>
              {selectedBooking.purpose || 'Không có'}
            </Descriptions.Item>

            {selectedBooking.lecturerName && (
              <Descriptions.Item label="Giảng viên phụ trách">{selectedBooking.lecturerName}</Descriptions.Item>
            )}

            {selectedBooking.semester && (
              <Descriptions.Item label="Học kỳ áp dụng">{selectedBooking.semester}</Descriptions.Item>
            )}

            <Descriptions.Item label="Thời gian">
              {dayjs(selectedBooking.startTime).format('HH:mm DD/MM/YYYY')} - {dayjs(selectedBooking.endTime).format('HH:mm DD/MM/YYYY')}
            </Descriptions.Item>

            <Descriptions.Item label="Trạng thái">
              <Tag color={statusColors[getEventStatusGroup(selectedBooking, localBookings)]}>
                {statusLabels[getEventStatusGroup(selectedBooking, localBookings)]}
              </Tag>
            </Descriptions.Item>

            {selectedBooking.department && (
              <Descriptions.Item label="Đơn vị / Khoa">{selectedBooking.department}</Descriptions.Item>
            )}

            {(selectedBooking.rejectReason || selectedBooking.rejectionReason || selectedBooking.adminNotes) && (
              <Descriptions.Item label="Ghi chú / Lý do">
                <span style={{ color: '#b91c1c' }}>
                  {selectedBooking.rejectReason || selectedBooking.rejectionReason || selectedBooking.adminNotes}
                </span>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}
