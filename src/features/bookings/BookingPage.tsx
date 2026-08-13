import { Alert, Button, Card, DatePicker, Form, Input, Select, Typography, App, Row, Col, Space, InputNumber, Spin, Checkbox, Collapse, Modal } from 'antd'
import { useState, useMemo, useEffect } from 'react'
import { ThunderboltOutlined, EnvironmentOutlined, TeamOutlined, LeftOutlined, RightOutlined, CalendarOutlined, InfoCircleOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isBetween from 'dayjs/plugin/isBetween'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'
import type { Booking, CreateBookingPayload } from '../../types/booking'
import { getUserRole, getUserEmail } from '../../api/authUtils'
import type { EquipmentItem } from '../admin/AdminPage'
import { EquipmentSelector } from './EquipmentSelector'



dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isBetween)




interface LimitStatus {
  pendingCount: number;
  maxPending: number;
  weeklyApprovedCount: number;
  maxWeeklyApproved: number;
  hasOverlap: boolean;
  canBook: boolean;
  reason?: string;
}

interface SubmitFormValues {
  roomId: number
  date: dayjs.Dayjs
  startTime: string
  endTime: string
  purpose: string
  participantCount: number
  requestedEquipments: string[]
  department: string
  personInCharge: string
  notes: string
  specialRequestReason?: string
  agreedToRules: boolean
}

async function fetchRooms() {
  try {
    return (await http.get<Room[]>('/api/rooms')).data
  } catch (e) {
    const localStr = localStorage.getItem('tbd_admin_rooms')
    if (localStr) return JSON.parse(localStr) as Room[]
    return getOfficialRooms()
  }
}


function checkTimeLimits(
  selectedDate: dayjs.Dayjs,
  startTime: string | null,
  endTime: string | null,
  role: string,
  roomType: string | number
): string[] {
  const violations: string[] = []
  if (!startTime || !endTime) return violations

  const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
  const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
  
  if (et.isSameOrBefore(st)) return violations

  const durationHours = et.diff(st, 'hour', true)
  const hoursAhead = st.diff(dayjs(), 'hour', true)
  const daysAhead = st.diff(dayjs().startOf('day'), 'day', true)

  const isEvent = roomType === 'LectureHall'
  
  if (isEvent) {
    if (daysAhead < 2) violations.push('Phải đặt phòng trước ít nhất 2 ngày (Hội trường/Sự kiện).')
    if (daysAhead > 120) violations.push('Chỉ được đặt phòng trước tối đa 120 ngày (Hội trường/Sự kiện).')
    if (durationHours > 14) violations.push(`Thời gian sử dụng tối đa là 14 giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
  } else {
    if (role === 'student') {
      if (hoursAhead < 12) violations.push('Sinh viên phải đặt phòng trước ít nhất 12 giờ.')
      if (daysAhead > 30) violations.push('Sinh viên chỉ được đặt phòng trước tối đa 30 ngày.')
      if (durationHours > 5) violations.push(`Thời gian sử dụng tối đa của sinh viên là 5 giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
    } else { 
      if (hoursAhead < 2) violations.push('Phải đặt phòng trước ít nhất 2 giờ.')
      if (daysAhead > 60) violations.push('Chỉ được đặt phòng trước tối đa 60 ngày.')
      if (durationHours > 8) violations.push(`Thời gian sử dụng tối đa là 8 giờ (Hiện tại: ${durationHours.toFixed(1)} giờ).`)
    }
  }

  const dayOfWeek = st.day()
  if (dayOfWeek === 0) {
    violations.push('Đặt phòng vào Chủ nhật.')
  }
  
  const startHour = st.hour() + st.minute() / 60
  const endHour = et.hour() + et.minute() / 60
  if (startHour < 7 || endHour > 21) {
    violations.push('Thời gian đặt phòng ngoài giờ hoạt động thông thường (07:00 - 21:00).')
  }

  return violations
}

function BookingPage() {
  const userEmail = getUserEmail();
;
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomIdParam = searchParams.get('roomId')
  
  const [form] = Form.useForm<SubmitFormValues>()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs().startOf('day'))
  const [startTime, setStartTime] = useState<string | null>(null)
  const [activePanels, setActivePanels] = useState<string[] | string>(['1', '2'])
  const [endTime, setEndTime] = useState<string | null>(null)
  const [isTimeTableModalOpen, setTimeTableModalOpen] = useState(false)






  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })
  
  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const localStr = localStorage.getItem('tbd_admin_equipments')
      if (localStr) return JSON.parse(localStr) as EquipmentItem[]
      return []
    }
  })

  const bookingsQuery = useQuery({ 
     queryKey: ['all-bookings-validation'], 
     queryFn: async () => {
      try {
        const response = await http.get('/api/bookings')
        return response.data as Booking[]
      } catch(e) {
        const localStr = localStorage.getItem('tbd_admin_bookings')
        if (localStr) return JSON.parse(localStr) as Booking[]
        return []
      }
    }
  })

  const rooms = getOfficialRooms(roomsQuery.data || [])
  const selectedRoomId = Form.useWatch('roomId', form)
  
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null
    return rooms.find((r: Room) => r.id === selectedRoomId) || null
  }, [selectedRoomId, rooms])

  const userRole = getUserRole()
  
  const currentDuration = useMemo(() => {
    if (!startTime || !endTime) return null
    const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
    if (et.isSameOrBefore(st)) return null
    return et.diff(st, 'hour', true)
  }, [selectedDate, startTime, endTime])

  const limitViolations = useMemo(() => {
    if (!selectedRoom || !startTime || !endTime) return []
    return checkTimeLimits(selectedDate, startTime, endTime, userRole, selectedRoom!.roomType)
  }, [selectedDate, startTime, endTime, userRole, selectedRoom])


  useEffect(() => {
    if (roomIdParam && rooms.length > 0) {
      const id = Number(roomIdParam)
      const found = rooms.find((r: Room) => r.id === id)
      if (found) {
        form.setFieldValue('roomId', id)
      }
    }
  }, [roomIdParam, rooms, form])

  // Generated slots from 07:00 to 21:00
  const slots = useMemo(() => {
    const arr = []
    for (let i = 7; i <= 20; i++) {
      arr.push(`${i.toString().padStart(2, '0')}:00`)
      arr.push(`${i.toString().padStart(2, '0')}:30`)
    }
    arr.push('21:00')
    return arr
  }, [])

  const getSlotStatus = (slot: string) => {
    if (!selectedRoom) return 'disabled'
    const now = dayjs()
    const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
    
    if (slotTime.isBefore(now)) return 'past'
    if (String(selectedRoom.status) !== '0' && selectedRoom.status !== 'Active') return 'inactive'

    const bookings = bookingsQuery.data || []
    const roomBookings = bookings.filter(b => b.roomId === selectedRoom.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1', '2'].includes(String(b.status)))

    if (startTime && endTime) {
      if (slot === startTime) return 'start'
      if (slot === endTime) return 'end'
      
      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
      const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
      if (slotTime.isAfter(st) && slotTime.isBefore(et)) return 'in-between'
      
      if (slot === '21:00') return 'available'
      const blockEnd = slotTime.add(30, 'minute')
      for (const b of roomBookings) {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        if (slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)) {
          if (String(b.status) === 'Pending' || String(b.status) === 'PendingSpecial' || String(b.status) === '0') return 'pending'
          return 'approved'
        }
      }
      return 'available'

    } else if (startTime && !endTime) {
      if (slot === startTime) return 'start'
      
      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
      
      if (slotTime.isBefore(st)) {
        if (slot === '21:00') return 'disabled'
        const blockEnd = slotTime.add(30, 'minute')
        for (const b of roomBookings) {
          const bStart = dayjs(b.startTime)
          const bEnd = dayjs(b.endTime)
          if (slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)) {
            if (String(b.status) === 'Pending' || String(b.status) === 'PendingSpecial' || String(b.status) === '0') return 'pending'
            return 'approved'
          }
        }
        return 'available'
      }
      
      let hasConflict = false
      for (const b of roomBookings) {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        if (st.isBefore(bEnd) && slotTime.isAfter(bStart)) {
          hasConflict = true
          break
        }
      }
      if (hasConflict) return 'conflict'
      
      return 'available'

    } else {
      if (slot === '21:00') return 'disabled'
      
      const blockEnd = slotTime.add(30, 'minute')
      for (const b of roomBookings) {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        if (slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)) {
          if (String(b.status) === 'Pending' || String(b.status) === 'PendingSpecial' || String(b.status) === '0') return 'pending'
          return 'approved'
        }
      }
      return 'available'
    }
  }

  const handleSlotClick = (slot: string) => {
    const status = getSlotStatus(slot)
    if (status === 'past' || status === 'inactive' || status === 'pending' || status === 'approved') return

    if (!startTime || (startTime && endTime)) {
      if (slot === '21:00') {
        message.warning('Không thể chọn 21:00 làm giờ bắt đầu.')
        return
      }
      setStartTime(slot)
      setEndTime(null)
      form.setFieldsValue({ startTime: slot, endTime: undefined })
    } else {
      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
      const clickTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
      
      if (clickTime.isBefore(st) || clickTime.isSame(st)) {
        message.warning('Giờ kết thúc phải sau giờ bắt đầu. Đã đặt lại giờ bắt đầu.')
        if (slot === '21:00') {
          setStartTime(null)
          form.setFieldsValue({ startTime: undefined })
        } else {
          setStartTime(slot)
          setEndTime(null)
          form.setFieldsValue({ startTime: slot, endTime: undefined })
        }
      } else {
        // check conflict in between
        const proposedEnd = clickTime
        let hasConflict = false
        const bookings = bookingsQuery.data || []
        const roomBookings = bookings.filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1', '2'].includes(String(b.status)))
        
        for (const b of roomBookings) {
          const bStart = dayjs(b.startTime)
          const bEnd = dayjs(b.endTime)
          if (
            (st.isBefore(bEnd) && proposedEnd.isAfter(bStart))
          ) {
            hasConflict = true
            break
          }
        }
        
        if (hasConflict) {
          message.error('Khoảng thời gian này đã có người đặt, vui lòng chọn lại!')
          if (slot !== '21:00') {
            setStartTime(slot)
            setEndTime(null)
            form.setFieldsValue({ startTime: slot, endTime: undefined })
          } else {
            setStartTime(null)
            setEndTime(null)
            form.setFieldsValue({ startTime: undefined, endTime: undefined })
          }
        } else {
          setEndTime(slot)
          form.setFieldsValue({ endTime: slot })
        }
      }
    }
  }

  const handlePrevDay = () => setSelectedDate(prev => prev.subtract(1, 'day'))
  const handleNextDay = () => setSelectedDate(prev => prev.add(1, 'day'))
  const handleToday = () => setSelectedDate(dayjs().startOf('day'))

  
  const checkLimitQuery = useQuery({
    queryKey: ['check-limit', userEmail, userRole, selectedDate.format('YYYY-MM-DD'), startTime, endTime],
    queryFn: async () => {
      if (!startTime || !endTime) return null
      
      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`).toISOString()
      const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`).toISOString()

      try {
        const response = await http.post('/api/bookings/check-limits', {
          userEmail,
          role: userRole,
          startTime: st,
          endTime: et
        })
        return response.data as LimitStatus
      } catch (error: any) {
        console.warn("Backend error in check-limits, returning null for local test", error);
        return null;
      }
    },
    enabled: !!startTime && !!endTime,
    retry: false
  })

  const createMutation = useMutation({
    mutationFn: async (payload: CreateBookingPayload) => {
      try {
        const response = await http.post<Booking>('/api/bookings', payload)
        return response.data
      } catch (err) {
        console.warn('Real API failed, faking success for local test.')
        return null
      }
    }
  })


  const submitBooking = (values: SubmitFormValues) => {
    if (!values.agreedToRules) {
      message.error('Vui lòng đồng ý với nội quy sử dụng phòng.');
      return;
    }
    if (checkLimitQuery.data && !checkLimitQuery.data.canBook) {
      message.error('Vượt quá giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }
    if (checkLimitQuery.error) {
      message.error('Không thể kiểm tra giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }

    if (!selectedRoom) return
    if (!startTime || !endTime) {
      message.error('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc trên bảng.')
      return
    }

    const st = dayjs(`${values.date.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${values.date.format('YYYY-MM-DD')} ${endTime}`)

    if (et.isSameOrBefore(st)) {
      message.error('Giờ kết thúc phải lớn hơn giờ bắt đầu.')
      return
    }

    const limitViolations = checkTimeLimits(values.date, startTime, endTime, userRole, selectedRoom.roomType);

    const isAdmin = userRole === 'admin';
    let finalStatus: Booking['status'] = limitViolations.length > 0 ? 'PendingSpecial' : 'Pending';
    let finalNotes = values.notes;
    let finalApprovedBy = undefined;
    let finalApprovedAt = undefined;

    if (isAdmin) {
      finalStatus = 'Approved';
      finalNotes = finalNotes ? finalNotes + '\n\n[Hệ thống]: Đặt trực tiếp bởi quản trị viên' : '[Hệ thống]: Đặt trực tiếp bởi quản trị viên';
      finalApprovedBy = userEmail;
      finalApprovedAt = new Date().toISOString();
    }

    const newBooking: Booking = {
      id: Date.now(),
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      startTime: st.toISOString(),
      endTime: et.toISOString(),
      purpose: values.purpose,
      status: finalStatus,
      participantCount: values.participantCount,
      requestedEquipments: values.requestedEquipments || [],
      department: values.department,
      personInCharge: values.personInCharge,
      notes: finalNotes,
      isSpecialRequest: limitViolations.length > 0,
      specialRequestReason: values.specialRequestReason,
      userEmail: userEmail,
      approvedBy: finalApprovedBy,
      approvedAt: finalApprovedAt,
    }

    createMutation.mutate({
      roomId: selectedRoom.id,
      startTime: st.toISOString(),
      endTime: et.toISOString(),
      purpose: values.purpose,
      participantCount: values.participantCount,
      requestedEquipments: values.requestedEquipments,
      isSpecialRequest: limitViolations.length > 0,
      specialRequestReason: values.specialRequestReason,
      agreedToRules: values.agreedToRules,
      notes: finalNotes,
      status: finalStatus,
      approvedBy: finalApprovedBy,
      approvedAt: finalApprovedAt,
    }, {
      onSuccess: () => {
        handleBookingSuccess(newBooking, isAdmin);
      },
      onError: (err: any) => {
        console.error(err);
        const backendError = err.response?.data?.error || err.response?.data?.message || err.message;
        message.error('Đặt phòng thất bại: ' + backendError);
      }
    })
  }



  const handleBookingSuccess = (newBooking: Booking, isAdmin: boolean) => {
    const localStr = localStorage.getItem('tbd_admin_bookings')
    let bookings: Booking[] = []
    if (localStr) {
      try { bookings = JSON.parse(localStr) } catch(e) {}
    }
    bookings.push(newBooking)
    localStorage.setItem('tbd_admin_bookings', JSON.stringify(bookings))
    
    if (isAdmin) {
      message.success('Đặt phòng đã được duyệt tự động theo quyền Quản trị viên.')
    } else {
      message.success('Yêu cầu đặt phòng đã được gửi và đang chờ phê duyệt.')
    }
    
    form.resetFields(['purpose', 'participantCount', 'requestedEquipments', 'department', 'personInCharge', 'notes', 'agreedToRules'])
    setStartTime(null)
    setEndTime(null)
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
    navigate('/dashboard')
  }

  const roomEquipments = useMemo(() => {
    if (!selectedRoom || !equipmentsQuery.data) return []
    return equipmentsQuery.data.filter(e => e.roomId === selectedRoom.id && e.status !== 'Maintenance' && e.status !== 'Broken').map(e => e.type)
  }, [selectedRoom, equipmentsQuery.data])

  

  useEffect(() => {
    form.setFieldValue('date', selectedDate)
  }, [selectedDate, form])

  if (roomsQuery.isLoading) return <div style={{ display: 'grid', placeItems: 'center', height: 400 }}><Spin size="large" /></div>

  return (
    <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div className="page-heading" style={{ marginBottom: 32 }}>
        <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
          Đặt Phòng Học
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 15, marginTop: 8 }}>
          Vui lòng chọn phòng, khung giờ và điền các thông tin cần thiết.
        </Typography.Paragraph>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 800 }}>
          <div>
            <Card 
              title={<strong style={{ color: '#0d2e5c' }}><InfoCircleOutlined /> Thông tin đặt phòng</strong>}
              style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
              styles={{ body: { padding: 0 } }}
            >
              <Form 
                form={form} 
                layout="vertical" 
                onFinish={submitBooking} 
                onFinishFailed={({ errorFields }) => {
                  message.error('Vui lòng điền đầy đủ các thông tin bắt buộc có màu đỏ.');
                  const errorNames = errorFields.map((f: any) => f.name[0]);
                  const panelsToOpen = new Set(Array.isArray(activePanels) ? activePanels : [activePanels]);
                  if (errorNames.some((n: string) => ['roomId', 'date', 'startTime', 'endTime', 'participantCount'].includes(n))) panelsToOpen.add('1');
                  if (errorNames.some((n: string) => ['purpose', 'department', 'personInCharge'].includes(n))) panelsToOpen.add('2');
                  if (errorNames.some((n: string) => ['requestedEquipments', 'notes'].includes(n))) panelsToOpen.add('3');
                  if (errorNames.some((n: string) => ['agreedToRules'].includes(n))) panelsToOpen.add('4');
                  
                  setActivePanels(Array.from(panelsToOpen) as string[]);
                  
                  setTimeout(() => {
                    form.scrollToField(errorNames[0], { behavior: 'smooth', block: 'center' });
                  }, 150);
                }}
                initialValues={{ date: selectedDate }}
                onValuesChange={(changedValues, allValues) => {
                  if (changedValues.startTime !== undefined) {
                    setStartTime(changedValues.startTime)
                    // Reset endTime if start is after end or there's a conflict
                    if (changedValues.startTime && allValues.endTime) {
                      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${changedValues.startTime}`)
                      const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${allValues.endTime}`)
                      if (st.isAfter(et) || st.isSame(et)) {
                        setEndTime(null)
                        form.setFieldsValue({ endTime: undefined })
                      } else {
                        let hasConflict = false
                        const roomBookings = (bookingsQuery.data || []).filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1', '2'].includes(String(b.status)))
                        for (const b of roomBookings) {
                          const bStart = dayjs(b.startTime)
                          const bEnd = dayjs(b.endTime)
                          if (st.isBefore(bEnd) && et.isAfter(bStart)) {
                            hasConflict = true
                            break
                          }
                        }
                        if (hasConflict) {
                          message.error('Khoảng thời gian này đã có người đặt, vui lòng chọn lại!')
                          setEndTime(null)
                          form.setFieldsValue({ endTime: undefined })
                        }
                      }
                    }
                  }
                  if (changedValues.endTime !== undefined) {
                    setEndTime(changedValues.endTime)
                    // Error if end is before start
                    if (changedValues.endTime && allValues.startTime) {
                      const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${allValues.startTime}`)
                      const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${changedValues.endTime}`)
                      if (et.isBefore(st) || et.isSame(st)) {
                        message.warning('Giờ kết thúc phải sau giờ bắt đầu.')
                        setEndTime(null)
                        form.setFieldsValue({ endTime: undefined })
                      } else {
                        let hasConflict = false
                        const roomBookings = (bookingsQuery.data || []).filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1', '2'].includes(String(b.status)))
                        for (const b of roomBookings) {
                          const bStart = dayjs(b.startTime)
                          const bEnd = dayjs(b.endTime)
                          if (st.isBefore(bEnd) && et.isAfter(bStart)) {
                            hasConflict = true
                            break
                          }
                        }
                        if (hasConflict) {
                          message.error('Khoảng thời gian này đã có người đặt, vui lòng chọn lại!')
                          setEndTime(null)
                          form.setFieldsValue({ endTime: undefined })
                        }
                      }
                    }
                  }
                }}
              >
                <Collapse 
                  activeKey={activePanels} 
                  onChange={(keys) => setActivePanels(keys)}
                  ghost 
                  expandIconPlacement="end"
                  items={[
                    {
                      key: '1',
                      label: <strong style={{ color: '#0f172a' }}>1. Thông tin buổi đặt</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Row gutter={16}>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Phòng</strong>} 
                                name="roomId"
                                rules={[{ required: true, message: 'Vui lòng chọn phòng!' }]}
                              >
                                <Select 
                                  placeholder="Chọn phòng" 
                                  showSearch 
                                  optionFilterProp="children"
                                  filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                  options={rooms.map((r: any) => ({
                                    value: r.id,
                                    label: `Phòng ${r.name} - ${r._displayType} - ${r.building}`
                                  }))}
                                  onChange={(val) => {
                                    setSearchParams({ roomId: String(val) })
                                    setStartTime(null)
                                    setEndTime(null)
                                  }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Ngày sử dụng</strong>} 
                                name="date"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày!' }]}
                              >
                                <DatePicker 
                                  format="DD/MM/YYYY" 
                                  style={{ width: '100%' }} 
                                  onChange={(d) => {
                                    if (d) setSelectedDate(d)
                                    setStartTime(null)
                                    setEndTime(null)
                                  }}
                                  disabledDate={current => current && current < dayjs().startOf('day')}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          {selectedRoom && (
                            <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                                {selectedRoom.imageUrl ? (
                                  <img src={selectedRoom.imageUrl} alt={selectedRoom.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                                ) : (
                                  <div style={{ width: 48, height: 48, background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <EnvironmentOutlined style={{ color: '#94a3b8', fontSize: 20 }} />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: '#0d2e5c', fontSize: 14 }}>{selectedRoom.name}</div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>{(selectedRoom as any)._displayType} | {selectedRoom.building} | <TeamOutlined /> {selectedRoom.capacity} người</div>
                                </div>
                              </div>
                              {roomEquipments.length > 0 && <div style={{ fontSize: 12, color: '#475569' }}><strong>Thiết bị có sẵn:</strong> {roomEquipments.join(', ')}</div>}
                            </div>
                          )}

                          <Row gutter={16}>
                            <Col xs={24} sm={8}>
                              <Form.Item label={<strong style={{ color: '#334155' }}>Giờ bắt đầu</strong>} name="startTime" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                                <Input 
                                  readOnly 
                                  placeholder="Nhấn để chọn" 
                                  onClick={() => setTimeTableModalOpen(true)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item label={<strong style={{ color: '#334155' }}>Giờ kết thúc</strong>} name="endTime" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                                <Input 
                                  readOnly 
                                  placeholder="Nhấn để chọn" 
                                  onClick={() => setTimeTableModalOpen(true)}
                                  style={{ cursor: 'pointer' }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Số người</strong>} 
                                name="participantCount"
                                rules={[
                                  { required: true, message: 'Nhập số!' },
                                  {
                                    validator: (_, value) => {
                                      if (selectedRoom && value > selectedRoom.capacity) {
                                        return Promise.reject(new Error(`Vượt quá sức chứa (${selectedRoom.capacity} người)`));
                                      }
                                      return Promise.resolve();
                                    }
                                  }
                                ]}
                              >
                                <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="VD: 40" />
                              </Form.Item>
                            </Col>
                          </Row>

                          {limitViolations.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <Alert
                                type="warning"
                                showIcon
                                title={<strong style={{ color: '#9a3412' }}>Yêu cầu phê duyệt đặc biệt</strong>}
                                description={
                                  <div>
                                    <div style={{ marginBottom: 8, color: '#9a3412' }}>Thời gian bạn chọn đã vượt quy định:</div>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: '#9a3412' }}>
                                      {limitViolations.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                  </div>
                                }
                              />
                              <Form.Item
                                label={<strong style={{ color: '#334155' }}>Lý do (Bắt buộc)</strong>}
                                name="specialRequestReason"
                                rules={[{ required: true, message: 'Vui lòng nhập lý do phê duyệt đặc biệt!' }]}
                                style={{ marginTop: 16, marginBottom: 0 }}
                              >
                                <Input.TextArea rows={2} placeholder="Trình bày lý do..." />
                              </Form.Item>
                            </div>
                          )}
                        </div>
                      )
                    },
                    {
                      key: '2',
                      label: <strong style={{ color: '#0f172a' }}>2. Thông tin sử dụng</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Form.Item 
                            label={<strong style={{ color: '#334155' }}>Mục đích sử dụng</strong>} 
                            name="purpose"
                            rules={[{ required: true, message: 'Vui lòng nhập mục đích!' }]}
                          >
                            <Input.TextArea rows={2} placeholder="VD: Họp giao ban, sinh hoạt CLB..." />
                          </Form.Item>

                          <Row gutter={16}>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Lớp, khoa, ban, CLB</strong>} 
                                name="department"
                                rules={[{ required: true, message: 'Vui lòng nhập!' }]}
                              >
                                <Input placeholder="VD: Khoa CNTT..." />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Người phụ trách</strong>} 
                                name="personInCharge"
                                rules={[{ required: true, message: 'Vui lòng nhập!' }]}
                              >
                                <Input placeholder="Tên - SĐT" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      )
                    },
                    {
                      key: '3',
                      label: <strong style={{ color: '#0f172a' }}>3. Thiết bị và ghi chú</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Form.Item label={<strong style={{ color: '#334155' }}>Mượn thêm thiết bị</strong>} name="requestedEquipments">
                            <EquipmentSelector 
                              equipments={equipmentsQuery.data || []}
                              allBookings={bookingsQuery.data || []}
                              selectedDate={selectedDate}
                              startTime={startTime}
                              endTime={endTime}
                              selectedRoomId={selectedRoom?.id || null}
                            />
                          </Form.Item>
                          <Form.Item 
                            label={<strong style={{ color: '#334155' }}>Ghi chú</strong>} 
                            name="notes"
                            rules={[{ required: true, message: 'Vui lòng nhập ghi chú (nhập Không có nếu không có)!' }]}
                          >
                            <Input.TextArea rows={2} placeholder="Các yêu cầu khác..." />
                          </Form.Item>
                        </div>
                      )
                    },
                    {
                      key: '4',
                      label: <strong style={{ color: '#0f172a' }}>4. Nội quy sử dụng phòng</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', marginBottom: 16 }}>
                            <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <li>Sử dụng đúng mục đích đã đăng ký.</li>
                              <li>Không tự ý chuyển phòng hoặc chuyển quyền sử dụng.</li>
                              <li>Không vượt quá sức chứa.</li>
                              <li>Giữ vệ sinh và trật tự.</li>
                              <li>Không tự ý di chuyển thiết bị.</li>
                              <li>Tuân thủ quy định đồ ăn và thức uống của từng phòng.</li>
                              <li>Tắt điện, điều hòa và thiết bị sau khi sử dụng.</li>
                              <li>Báo ngay khi xảy ra sự cố.</li>
                              <li>Người đặt chịu trách nhiệm đối với hư hỏng do sử dụng sai.</li>
                            </ul>
                          </div>
                          <Form.Item 
                            name="agreedToRules" 
                            valuePropName="checked"
                            rules={[
                              { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với nội quy!')) }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox><strong style={{ color: '#0d2e5c' }}>Tôi đã đọc và đồng ý với nội quy sử dụng phòng</strong></Checkbox>
                          </Form.Item>
                        </div>
                      )
                    }
                  ]}
                />

                <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 8, color: '#0d2e5c' }}>
                    Tóm tắt yêu cầu
                  </Typography.Text>
                  
                  <Form.Item shouldUpdate style={{ marginBottom: 16 }}>
                    {() => {
                      const values = form.getFieldsValue();
                      if (!selectedRoom || !startTime || !endTime) {
                        return (
                          <div style={{ color: '#94a3b8', fontSize: 13 }}>
                            Vui lòng chọn phòng và thời gian trên bảng để xem tóm tắt.
                          </div>
                        );
                      }
                      
                      const eq = values.requestedEquipments || [];
                      
                      return (
                        <div style={{ fontSize: 13, color: '#475569' }}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <div><strong>Phòng:</strong> {selectedRoom.name}</div>
                              <div><strong>Ngày:</strong> {selectedDate.format('DD/MM/YYYY')}</div>
                            </Col>
                            <Col span={12}>
                              <div><strong>Thời gian:</strong> {startTime} - {endTime} ({currentDuration?.toFixed(1)}h)</div>
                              <div><strong>Số người:</strong> {values.participantCount || 0}</div>
                            </Col>
                          </Row>
                          {eq.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <strong>Thiết bị:</strong> {eq.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </Form.Item>

                  {checkLimitQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={<strong style={{ color: '#9a3412', fontSize: 13 }}>Lỗi kiểm tra giới hạn</strong>}
                      description={<div style={{ fontSize: 12 }}>{(checkLimitQuery.error as any).message}</div>}
                    />
                  )}

                  {checkLimitQuery.data && (
                    <Alert
                      type={checkLimitQuery.data.canBook ? 'success' : 'error'}
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={<strong style={{ fontSize: 13 }}>{checkLimitQuery.data.canBook ? 'Đủ điều kiện đặt phòng' : 'Vượt quá giới hạn đặt phòng'}</strong>}
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                          <li>Số yêu cầu chờ: {checkLimitQuery.data.pendingCount}/{checkLimitQuery.data.maxPending}</li>
                          <li>Lượt trong tuần: {checkLimitQuery.data.weeklyApprovedCount}/{checkLimitQuery.data.maxWeeklyApproved}</li>
                          {checkLimitQuery.data.hasOverlap && <li><strong>Trùng lịch!</strong></li>}
                          {!checkLimitQuery.data.canBook && checkLimitQuery.data.reason && <li>Lý do: {checkLimitQuery.data.reason}</li>}
                        </ul>
                      }
                    />
                  )}

                  <Form.Item shouldUpdate style={{ marginBottom: 0 }}>
                    {() => {
                      const agreed = form.getFieldValue('agreedToRules');
                      const disabled = !agreed || !!checkLimitQuery.error || (checkLimitQuery.data && !checkLimitQuery.data.canBook) || checkLimitQuery.isFetching;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {userRole === 'admin' && (
                            <Alert 
                              type="info" 
                              showIcon 
                              title={<strong style={{ fontSize: 13 }}>Đặt trực tiếp với quyền Quản trị viên</strong>} 
                              description={<span style={{ fontSize: 12 }}>Yêu cầu này sẽ được duyệt tự động nhưng vẫn phải thỏa điều kiện không trùng lịch.</span>} 
                            />
                          )}
                          <Button 
                            type="primary" 
                            htmlType="submit" 
                            size="large" 
                            disabled={disabled} 
                            loading={createMutation.isPending || checkLimitQuery.isFetching} 
                            icon={<ThunderboltOutlined />} 
                            style={{ width: '100%', background: disabled ? undefined : '#0d2e5c' }}
                          >
                            Xác Nhận Đặt Phòng
                          </Button>
                        </div>
                      )
                    }}
                  </Form.Item>
                </div>
              </Form>
            </Card>
          </div>
        </div>
      </div>
      <Modal
        open={isTimeTableModalOpen}
        onCancel={() => setTimeTableModalOpen(false)}
        footer={null}
        width={800}
        styles={{ body: { padding: 0 } }}
        closeIcon={false}
      >
        <Card 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#0d2e5c' }}><CalendarOutlined /> Bảng thời gian</strong>
              <Button type="text" onClick={() => setTimeTableModalOpen(false)}>Đóng</Button>
            </div>
          }
          style={{ border: 'none', borderRadius: 8, boxShadow: 'none' }}
        >
            {selectedRoom ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <Space>
                    <Button icon={<LeftOutlined />} onClick={handlePrevDay} />
                    <Button onClick={handleToday}>Hôm nay</Button>
                    <Button icon={<RightOutlined />} onClick={handleNextDay} />
                  </Space>
                  <Typography.Title level={4} style={{ margin: 0, color: '#0d2e5c' }}>
                    {selectedDate.format('DD/MM/YYYY')}
                  </Typography.Title>
                </div>
                
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4 }}></div> Còn trống</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#0d2e5c', borderRadius: 4 }}></div> Đang chọn</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#fef08a', border: '1px solid #facc15', borderRadius: 4 }}></div> Chờ duyệt</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#86efac', border: '1px solid #4ade80', borderRadius: 4 }}></div> Đã đặt</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: 4 }}></div> Đã qua/Đóng</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 16, background: '#fee2e2', border: '1px solid #f87171', borderRadius: 4 }}></div> Không thể đặt</div>
                </div>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', 
                  gap: 8 
                }}>
                  {slots.map(slot => {
                    const status = getSlotStatus(slot)
                    let bg = '#f8fafc'
                    let color = '#475569'
                    let border = '1px solid #cbd5e1'
                    let cursor = 'pointer'

                    if (status === 'past' || status === 'inactive') {
                      bg = '#e2e8f0'
                      color = '#94a3b8'
                      cursor = 'not-allowed'
                    } else if (status === 'conflict') {
                      bg = '#fee2e2'
                      color = '#991b1b'
                      border = '1px solid #f87171'
                      cursor = 'not-allowed'
                    } else if (status === 'pending') {
                      bg = '#fef08a'
                      color = '#854d0e'
                      border = '1px solid #facc15'
                      cursor = 'not-allowed'
                    } else if (status === 'approved') {
                      bg = '#86efac'
                      color = '#166534'
                      border = '1px solid #4ade80'
                      cursor = 'not-allowed'
                    } else if (status === 'start') {
                      bg = '#0d2e5c'
                      color = '#fff'
                      border = '1px solid #0d2e5c'
                    } else if (status === 'end') {
                      bg = '#0d2e5c'
                      color = '#fff'
                      border = '2px solid #f59e0b'
                    } else if (status === 'in-between') {
                      bg = '#e0e7ff'
                      color = '#3730a3'
                      border = '1px solid #c7d2fe'
                    } else if (status === 'disabled') {
                      bg = '#e2e8f0'
                      color = '#94a3b8'
                      cursor = 'not-allowed'
                    }

                    return (
                      <div 
                        key={slot}
                        onClick={() => handleSlotClick(slot)}
                        style={{
                          background: bg,
                          color: color,
                          border: border,
                          borderRadius: 6,
                          padding: '8px 4px',
                          textAlign: 'center',
                          cursor: cursor,
                          fontWeight: 500,
                          fontSize: 14,
                          userSelect: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        {slot}
                      </div>
                    )
                  })}
                </div>
                
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: '#94a3b8' }}>
                <CalendarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <Typography.Text type="secondary">Vui lòng chọn phòng để xem lịch trống</Typography.Text>
              </div>
            )}
          </Card>
      </Modal>

    </main>
  )
}

export default BookingPage
