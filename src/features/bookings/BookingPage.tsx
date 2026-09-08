import { Alert, Button, Card, DatePicker, Form, Input, Select, Typography, App, Row, Col, InputNumber, Checkbox, Modal, Tag, Space, Steps } from 'antd'
import { useState, useMemo, useEffect, useRef } from 'react'
import { 
  ThunderboltOutlined, 
  EnvironmentOutlined, 
  TeamOutlined, 
  LeftOutlined, 
  RightOutlined, 
  ReloadOutlined, 
  CheckCircleFilled, 
  HistoryOutlined, 
  PlusCircleOutlined, 
  FileTextOutlined, 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  SafetyCertificateOutlined,
  CalendarOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import confetti from 'canvas-confetti'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isBetween from 'dayjs/plugin/isBetween'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Room } from '../../types/room'
import { getOfficialRooms, cleanupLocalStorageRooms, isFakeOrDisallowedRoom } from '../../utils/roomUtils'
import type { Booking, CreateBookingPayload } from '../../types/booking'
import { getUserRole, getUserEmail } from '../../api/authUtils'
import { fetchUserProfile, type UserProfileData } from '../../api/userProfile'
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
  personName?: string
  phoneNumber?: string
  personInCharge?: string
  notes?: string
  specialRequestReason?: string
  agreedToRules: boolean
}

async function fetchRooms(): Promise<Room[]> {
  cleanupLocalStorageRooms()
  try {
    const res = await http.get<Room[]>('/api/rooms')
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.filter((r) => !isFakeOrDisallowedRoom(r))
    }
  } catch (err) {
    console.warn('GET /api/rooms failed, using fallback/local storage', err)
  }

  const localStr = localStorage.getItem('tbd_admin_rooms')
  if (localStr) {
    try {
      const parsed = JSON.parse(localStr)
      if (Array.isArray(parsed)) {
        return parsed.filter((r: any) => !isFakeOrDisallowedRoom(r))
      }
    } catch {
      // ignore
    }
  }
  return getOfficialRooms()
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

const ADMIN_EVENT_SUGGESTIONS = [
  'Hội nghị / Hội thảo trường',
  'Lịch thi tập trung',
  'Tiếp đoàn đối ngoại / Kiểm định',
  'Bảo trì & Sửa chữa thiết bị',
  'Sinh hoạt chuyên môn'
]

const FACULTY_EVENT_SUGGESTIONS = [
  'Giảng dạy học phần',
  'Dạy bù học kỳ',
  'Thi kết thúc học phần',
  'Bảo vệ khóa luận tốt nghiệp',
  'Họp bộ môn'
]

const STAFF_EVENT_SUGGESTIONS = [
  'Họp phòng ban',
  'Tập huấn chuyên môn',
  'Hội thảo chuyên đề',
  'Tiếp đón đối tác trường'
]

function BookingPage() {
  const userRole = (localStorage.getItem('testRole') || localStorage.getItem('userRole') || getUserRole() || '').toLowerCase();
  const userEmail = (localStorage.getItem('userEmail') || getUserEmail() || '').toLowerCase();

  // 1. Trích xuất thông tin người dùng thực tế từ API GET /api/auth/me
  const { data: userProfile } = useQuery<UserProfileData>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      try {
        const res = await http.get('/api/auth/me');
        if (res.data) return res.data;
      } catch (err) {
        console.warn('API /api/auth/me chưa phản hồi, dùng bộ nhớ cache', err);
      }
      return fetchUserProfile();
    }
  });

  const roleFromProfile = (userProfile?.role || '').toLowerCase();
  const isFaculty = userRole === 'faculty' || userRole === 'teacher' || userRole === 'lecturer' || roleFromProfile === 'faculty' || userEmail.includes('giangvien');
  const isStaff = userRole === 'staff' || userRole === 'employee' || roleFromProfile === 'staff' || userEmail.includes('nhanvien');
  const isAdmin = userRole === 'admin' || roleFromProfile === 'admin' || userEmail.includes('admin');
  const isStaffOrFaculty = isFaculty || isStaff || isAdmin;

  // 4. Chế độ Tiếp nhận Đặt phòng trực tiếp tại quầy dành riêng cho Admin
  const [isWalkInBooking, setIsWalkInBooking] = useState<boolean>(false);

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomIdParam = searchParams.get('roomId')
  
  const [form] = Form.useForm<SubmitFormValues>()
  const queryClient = useQueryClient()
  const { message } = App.useApp()

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs().startOf('day'))
  const [startTime, setStartTime] = useState<string | null>(null)
  const [endTime, setEndTime] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // 3. Tự động điền Bước 3 Trang Đặt Phòng từ userProfile
  useEffect(() => {
    if (!userProfile) return;
    if (!isWalkInBooking) {
      const currentDept = form.getFieldValue('department');
      const currentPerson = form.getFieldValue('personName');
      const currentPhone = form.getFieldValue('phoneNumber');

      const nextValues: any = {};
      if (!currentDept) {
        nextValues.department = userProfile.department || (isAdmin ? 'Phòng Quản trị thiết bị & Ban Quản trị' : '');
      }
      if (!currentPerson) {
        nextValues.personName = userProfile.fullName || (isAdmin ? 'Ban Quản trị Cơ sở vật chất' : '');
      }
      if (!currentPhone) {
        nextValues.phoneNumber = userProfile.phoneNumber || (isAdmin ? '02583727147' : '');
      }

      if (Object.keys(nextValues).length > 0) {
        form.setFieldsValue(nextValues);
      }
    }
  }, [userProfile, isWalkInBooking, form, isAdmin]);

  const scrollToTop = () => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const [successModalVisible, setSuccessModalVisible] = useState(false)
  const [successBookingInfo, setSuccessBookingInfo] = useState<{
    roomName: string;
    dateStr: string;
    timeRange: string;
    purpose: string;
    participantCount: number;
    status: string;
  } | null>(null)

  const triggerConfetti = () => {
    try {
      const count = 200
      const defaults = {
        origin: { y: 0.7 }
      }

      const fire = (particleRatio: number, opts: confetti.Options) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio)
        })
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
        colors: ['#0d2e5c', '#fbbf24', '#10b981', '#3b82f6', '#f59e0b']
      })
      fire(0.2, {
        spread: 60,
        colors: ['#0d2e5c', '#fbbf24', '#10b981', '#3b82f6', '#f59e0b']
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
        colors: ['#0d2e5c', '#fbbf24', '#10b981', '#3b82f6', '#f59e0b']
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
        colors: ['#0d2e5c', '#fbbf24', '#10b981', '#3b82f6', '#f59e0b']
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
        colors: ['#0d2e5c', '#fbbf24', '#10b981', '#3b82f6', '#f59e0b']
      })
    } catch (err) {
      console.error('Confetti error:', err)
    }
  }






  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })
  
  const DEFAULT_EQUIPMENTS: EquipmentItem[] = [
    {
      id: 101,
      code: 'EQ-MC-001',
      name: 'Micro không dây Shure (Bộ 2 mic)',
      type: 'Microphone',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 10,
      status: 'Active',
    },
    {
      id: 102,
      code: 'EQ-SP-002',
      name: 'Loa kéo công suất lớn 500W',
      type: 'Sound System',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 5,
      status: 'Active',
    },
    {
      id: 103,
      code: 'EQ-PJ-003',
      name: 'Máy chiếu di động Panasonic PT-LB386',
      type: 'Projector',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 4,
      status: 'Active',
    },
    {
      id: 104,
      code: 'EQ-CAM-004',
      name: 'Webcam/Camera họp & giảng dạy trực tuyến HD',
      type: 'Camera',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 6,
      status: 'Active',
    },
    {
      id: 105,
      code: 'EQ-BO-005',
      name: 'Bảng di động Flipchart / Bảng phụ',
      type: 'Board',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 8,
      status: 'Active',
    },
    {
      id: 106,
      code: 'EQ-EXT-006',
      name: 'Ổ cắm điện kéo dài (Dây 10m)',
      type: 'Extension Cord',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 12,
      status: 'Active',
    },
    {
      id: 107,
      code: 'EQ-PRES-007',
      name: 'Bút trình chiếu Laser (Presenter)',
      type: 'Presenter',
      roomId: null,
      roomName: 'Kho thiết bị dùng chung',
      quantity: 15,
      status: 'Active',
    },
  ];

  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      try {
        const response = await http.get<EquipmentItem[]>('/api/equipments')
        if (Array.isArray(response.data) && response.data.length > 0) {
          return response.data
        }
      } catch {
        // Fallback to default equipments if endpoint error
      }
      return DEFAULT_EQUIPMENTS
    }
  })

  const bookingsQuery = useQuery({ 
     queryKey: ['all-bookings-validation'], 
     queryFn: async () => {
      let list: Booking[] = []
      try {
        const response = await http.get('/api/bookings')
        if (Array.isArray(response.data)) {
          list = response.data
        } else if (response.data && Array.isArray((response.data as any).data)) {
          list = (response.data as any).data
        }
      } catch {
        // network or server error fallback
      }

      const localStr = localStorage.getItem('tbd_admin_bookings')
      if (localStr) {
        try {
          const localList: Booking[] = JSON.parse(localStr)
          localList.forEach((local) => {
            const idx = list.findIndex((b) => b.id === local.id)
            if (idx > -1) {
              list[idx] = { ...list[idx], ...local }
            } else {
              list.push(local)
            }
          })
        } catch {}
      }

      return list
    }
  })

  const rooms = getOfficialRooms(roomsQuery.data || [])
  const selectedRoomId = Form.useWatch('roomId', form)
  const participantCount = Form.useWatch('participantCount', form)
  
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null
    return rooms.find((r: Room) => r.id === selectedRoomId) || null
  }, [selectedRoomId, rooms])

  const isOverCapacity = useMemo(() => {
    if (!selectedRoom || !participantCount) return false
    return Number(participantCount) > Number(selectedRoom.capacity)
  }, [selectedRoom, participantCount])

  const currentDuration = useMemo(() => {
    if (!startTime || !endTime) return null
    const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
    if (et.isSameOrBefore(st)) return null
    return et.diff(st, 'hour', true)
  }, [selectedDate, startTime, endTime])

  const limitViolations = useMemo(() => {
    if (isAdmin || !selectedRoom || !startTime || !endTime) return []
    return checkTimeLimits(selectedDate, startTime, endTime, userRole, selectedRoom!.roomType)
  }, [isAdmin, selectedDate, startTime, endTime, userRole, selectedRoom])

  const department = Form.useWatch('department', form)
  const personName = Form.useWatch('personName', form)
  const phoneNumber = Form.useWatch('phoneNumber', form)
  const purpose = Form.useWatch('purpose', form)
  const requestedEquipments = Form.useWatch('requestedEquipments', form)
  const notes = Form.useWatch('notes', form)
  const agreedToRules = Form.useWatch('agreedToRules', form)
  const specialRequestReason = Form.useWatch('specialRequestReason', form)

  const handleGoToStep2 = async () => {
    try {
      await form.validateFields(['roomId', 'date'])
      if (!selectedRoom) {
        message.warning('Vui lòng chọn phòng học trước khi tiếp tục!')
        return
      }
      setCurrentStep(1)
      scrollToTop()
    } catch {
      message.error('Vui lòng chọn đầy đủ phòng và ngày sử dụng!')
    }
  }

  const handleGoToStep3 = async () => {
    if (!startTime || !endTime) {
      message.warning('Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc trên lưới 30 phút!')
      return
    }
    const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
    if (et.isSameOrBefore(st)) {
      message.error('Giờ kết thúc phải sau giờ bắt đầu!')
      return
    }
    if (limitViolations.length > 0) {
      try {
        await form.validateFields(['specialRequestReason'])
      } catch {
        message.error('Vui lòng nhập lý do phê duyệt đặc biệt!')
        return
      }
    }
    setCurrentStep(2)
    scrollToTop()
  }

  const handleGoToStep4 = async () => {
    try {
      await form.validateFields(['department', 'personName', 'phoneNumber', 'participantCount', 'purpose'])
      if (isOverCapacity) {
        message.error(`Số người tham gia (${participantCount}) vượt quá sức chứa tối đa (${selectedRoom?.capacity} người)!`)
        return
      }
      setCurrentStep(3)
      scrollToTop()
    } catch {
      message.error('Vui lòng điền đầy đủ và chính xác các thông tin bắt buộc!')
    }
  }

  const handleStepChange = (targetStep: number) => {
    if (targetStep < currentStep) {
      setCurrentStep(targetStep)
      scrollToTop()
    } else if (targetStep === currentStep + 1) {
      if (currentStep === 0) handleGoToStep2()
      else if (currentStep === 1) handleGoToStep3()
      else if (currentStep === 2) handleGoToStep4()
    }
  }


  useEffect(() => {
    if (roomIdParam && rooms.length > 0) {
      const id = Number(roomIdParam)
      const found = rooms.find((r: Room) => r.id === id)
      if (found) {
        form.setFieldValue('roomId', id)
      }
    }
  }, [roomIdParam, rooms, form])

  useEffect(() => {
    form.setFieldValue('date', selectedDate)
  }, [selectedDate, form])

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
    if (status === 'past' || status === 'inactive' || status === 'pending' || status === 'approved') {
      const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
      const blockEnd = slotTime.add(30, 'minute')
      const bookings = bookingsQuery.data || []
      const roomBookings = bookings.filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1', '2'].includes(String(b.status)))
      const hit = roomBookings.find(b => {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        return slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)
      })
      if (hit && (hit.isSchoolOverride || hit.IsSchoolOverride)) {
        message.warning({
          content: `Khung giờ ${slot} đã bị khóa bởi Thời khóa biểu Nhà trường (${hit.purpose || 'Lịch học chính khóa'}). Sinh viên không thể đặt phòng vào khung giờ này!`,
          key: 'school-locked-slot',
          duration: 3.5,
        })
      }
      return
    }

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

  const handleResetTime = () => {
    setStartTime(null)
    setEndTime(null)
    form.setFieldsValue({ startTime: undefined, endTime: undefined })
  }

  const handlePrevDay = () => {
    setSelectedDate(prev => prev.subtract(1, 'day'))
    handleResetTime()
  }
  const handleNextDay = () => {
    setSelectedDate(prev => prev.add(1, 'day'))
    handleResetTime()
  }

  const renderSelectionBanner = () => {
    if (!startTime && !endTime) {
      return (
        <Alert
          type="info"
          showIcon={false}
          style={{ borderRadius: 8, background: '#f0f9ff', borderColor: '#bae6fd', marginBottom: 16 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0369a1', fontWeight: 500, fontSize: 13.5 }}>
              <span>Vui lòng bấm chọn một ô khung giờ để làm <strong>Giờ Bắt Đầu</strong>.</span>
            </div>
          }
        />
      )
    }

    if (startTime && !endTime) {
      return (
        <Alert
          type="warning"
          showIcon={false}
          style={{ borderRadius: 8, background: '#fffbebe6', borderColor: '#fde68a', marginBottom: 16 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ color: '#b45309', fontWeight: 500, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>Đã chọn Giờ bắt đầu:</span>
                <Tag color="blue" style={{ fontSize: 13, fontWeight: 700, margin: 0, padding: '2px 8px' }}>{startTime}</Tag>
                <span>. Hãy bấm chọn tiếp ô <strong>Giờ Kết Thúc</strong>.</span>
              </div>
              <Button size="small" onClick={handleResetTime} danger type="text" icon={<ReloadOutlined />} style={{ fontSize: 12, fontWeight: 600 }}>
                Bấm để chọn lại
              </Button>
            </div>
          }
        />
      )
    }

    return (
      <Alert
        type="success"
        showIcon={false}
        style={{ borderRadius: 8, background: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: 16 }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ color: '#15803d', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>Khung giờ đã chọn:</span>
              <Tag color="green" style={{ fontSize: 13, fontWeight: 700, margin: 0, padding: '2px 8px' }}>
                {startTime} - {endTime}
              </Tag>
              <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>
                (Tổng thời lượng: <strong>{currentDuration?.toFixed(1) || '0.0'} giờ</strong> | Ngày: {selectedDate.format('DD/MM/YYYY')})
              </span>
            </div>
            <Button 
              size="small" 
              onClick={handleResetTime} 
              icon={<ReloadOutlined />}
              style={{ fontSize: 12, borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
            >
              Bấm để chọn lại
            </Button>
          </div>
        }
      />
    )
  }

  
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
      let createdBooking: Booking | null = null
      try {
        const response = await http.post<Booking>('/api/bookings', payload)
        createdBooking = response.data
      } catch (err) {
        console.warn("API /api/bookings failed, falling back to local state", err)
      }

      const bookingItem: Booking = createdBooking || {
        id: Date.now(),
        roomId: payload.roomId,
        roomName: selectedRoom?.name || 'Phòng học',
        startTime: payload.startTime,
        endTime: payload.endTime,
        purpose: payload.purpose,
        status: payload.status || 'Pending',
        participantCount: payload.participantCount,
        requestedEquipments: payload.requestedEquipments,
        department: payload.department,
        personInCharge: payload.personInCharge,
        notes: payload.notes,
        isSpecialRequest: payload.isSpecialRequest,
        specialRequestReason: payload.specialRequestReason,
        agreedToRules: payload.agreedToRules,
        userEmail: userEmail || 'user@tbd.edu.vn',
        approvedBy: payload.approvedBy,
        approvedAt: payload.approvedAt
      }

      try {
        const localStr = localStorage.getItem('tbd_admin_bookings')
        const currentList: Booking[] = localStr ? JSON.parse(localStr) : []
        const exists = currentList.some(b => b.id === bookingItem.id)
        if (!exists) {
          localStorage.setItem('tbd_admin_bookings', JSON.stringify([bookingItem, ...currentList]))
        }
      } catch (e) {
        console.warn("Could not save booking to localStorage", e)
      }

      return bookingItem
    }
  })

  const submitBooking = (values: SubmitFormValues) => {
    if (!isStaffOrFaculty && !values.agreedToRules) {
      message.error('Vui lòng đồng ý với nội quy sử dụng phòng.');
      return;
    }
    if (!isAdmin && checkLimitQuery.data && !checkLimitQuery.data.canBook) {
      message.error('Vượt quá giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }
    if (!isAdmin && checkLimitQuery.error) {
      message.error('Không thể kiểm tra giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }

    if (!selectedRoom) return
    if (values.participantCount > selectedRoom.capacity) {
      message.error(`Số lượng người (${values.participantCount}) vượt quá sức chứa tối đa của phòng ${selectedRoom.name} (${selectedRoom.capacity} người). Vui lòng điều chỉnh lại.`);
      return;
    }
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

    const limitViolations = isAdmin ? [] : checkTimeLimits(values.date, startTime, endTime, userRole, selectedRoom.roomType);

    let finalStatus: Booking['status'] = 'Pending';
    let finalNotes = values.notes;
    let finalApprovedBy: string | undefined = undefined;
    let finalApprovedAt: string | undefined = undefined;

    if (isAdmin) {
      finalStatus = 'Approved';
      finalNotes = finalNotes 
        ? finalNotes + (isWalkInBooking ? '\n\n[Hệ thống]: Tiếp nhận đặt trực tiếp tại quầy và phê duyệt bởi Quản trị viên' : '\n\n[Hệ thống]: Đặt và duyệt trực tiếp bởi Quản trị viên') 
        : (isWalkInBooking ? '[Hệ thống]: Tiếp nhận đặt trực tiếp tại quầy và phê duyệt bởi Quản trị viên' : '[Hệ thống]: Đặt và duyệt trực tiếp bởi Quản trị viên');
      finalApprovedBy = userEmail || 'admin@tbd.edu.vn';
      finalApprovedAt = new Date().toISOString();
    } else {
      finalStatus = limitViolations.length > 0 ? 'PendingSpecial' : 'Pending';
    }

    const personInChargeFormatted = values.phoneNumber 
      ? `${values.personName?.trim()} - ${values.phoneNumber?.trim()}` 
      : values.personName?.trim();

    createMutation.mutate({
      roomId: selectedRoom.id,
      startTime: st.toISOString(),
      endTime: et.toISOString(),
      purpose: values.purpose,
      participantCount: values.participantCount,
      requestedEquipments: values.requestedEquipments || [],
      department: values.department,
      personInCharge: personInChargeFormatted,
      isSpecialRequest: !isAdmin && limitViolations.length > 0,
      specialRequestReason: values.specialRequestReason,
      agreedToRules: isStaffOrFaculty ? true : values.agreedToRules,
      notes: finalNotes,
      status: finalStatus,
      approvedBy: finalApprovedBy,
      approvedAt: finalApprovedAt,
    }, {
      onSuccess: () => {
        triggerConfetti()
        setSuccessBookingInfo({
          roomName: selectedRoom.name || 'Phòng học',
          dateStr: values.date.format('DD/MM/YYYY'),
          timeRange: `${startTime} - ${endTime}`,
          purpose: values.purpose,
          participantCount: values.participantCount,
          status: finalStatus
        })
        setSuccessModalVisible(true)
        if (isAdmin) {
          if (isWalkInBooking) {
            message.success(`Đã tiếp nhận và duyệt đặt phòng trực tiếp tại quầy cho ${values.personName}! Lịch phòng đã được cập nhật.`)
          } else {
            message.success("Đặt phòng và phê duyệt trực tiếp thành công! Lịch phòng đã được cập nhật.")
          }
        } else if (isFaculty) {
          message.success("Đã gửi yêu cầu đặt phòng giảng dạy! Đơn được xếp ưu tiên xét duyệt cấp 1.")
        } else if (isStaff) {
          message.success("Đã gửi yêu cầu đặt phòng làm việc! Đơn được xếp ưu tiên xét duyệt cấp 1.")
        } else {
          message.success("Gửi yêu cầu đặt phòng thành công! Vui lòng chờ phê duyệt.")
        }
        form.resetFields(['purpose', 'participantCount', 'requestedEquipments', 'notes', 'agreedToRules', 'specialRequestReason'])
        if (isWalkInBooking) {
          setIsWalkInBooking(false)
        }
        form.setFieldsValue({
          department: userProfile?.department || (isAdmin ? 'Phòng Quản trị thiết bị & Ban Quản trị' : ''),
          personName: userProfile?.fullName || (isAdmin ? 'Ban Quản trị Cơ sở vật chất' : ''),
          phoneNumber: userProfile?.phoneNumber || (isAdmin ? '02583727147' : ''),
        })
        setStartTime(null)
        setEndTime(null)
        setCurrentStep(0)
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['all-bookings-validation'] })
      },
      onError: (err: any) => {
        const backendError = err.response?.data?.error || err.response?.data?.message || err.message || 'Thất bại khi đặt phòng';
        message.error('Gửi yêu cầu thất bại: ' + backendError);
      }
    })
  }

  const roomEquipments = useMemo(() => {
    if (!selectedRoom || !equipmentsQuery.data) return []
    return equipmentsQuery.data.filter(e => e.roomId === selectedRoom.id && e.status !== 'Maintenance' && e.status !== 'Broken').map(e => e.type)
  }, [selectedRoom, equipmentsQuery.data])

  

  useEffect(() => {
    form.setFieldValue('date', selectedDate)
  }, [selectedDate, form])

  if (roomsQuery.isLoading) {
    return (
      <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div className="page-heading" style={{ marginBottom: 32 }}>
          <div className="skeleton-card-loading" style={{ width: 220, height: 36, marginBottom: 12 }} />
          <div className="skeleton-card-loading" style={{ width: 340, height: 18 }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 800 }}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="skeleton-card-loading" style={{ width: 180, height: 24 }} />
                  <div className="skeleton-card-loading" style={{ width: 60, height: 24 }} />
                </div>
                <div className="skeleton-card-loading" style={{ width: '100%', height: 42 }} />
                <div className="skeleton-card-loading" style={{ width: '100%', height: 42 }} />
                <div className="skeleton-card-loading" style={{ width: '100%', height: 120 }} />
                <div style={{ display: 'flex', gap: 16 }}>
                  <div className="skeleton-card-loading" style={{ flex: 1, height: 42 }} />
                  <div className="skeleton-card-loading" style={{ flex: 1, height: 42 }} />
                </div>
                <div className="skeleton-card-loading" style={{ width: '100%', height: 50, marginTop: 16 }} />
              </div>
            </Card>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="app-content" style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <div ref={containerRef} className="page-heading" style={{ marginBottom: 28, textAlign: 'center' }}>
        <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
          Đặt Phòng Học & Thiết Bị
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 14.5, marginTop: 6, marginBottom: 0 }}>
          Thực hiện đặt phòng học và mượn thiết bị qua quy trình 4 bước chuẩn hóa
        </Typography.Paragraph>
      </div>

      <div style={{ width: '100%' }}>
        <Card className="booking-wizard-card" styles={{ body: { padding: 0 } }}>
          {/* 4-Step Progress Steps */}
          <div className="booking-wizard-header">
            <Steps
              current={currentStep}
              onChange={handleStepChange}
              className="booking-wizard-steps"
              responsive={false}
              items={[
                {
                  title: 'Phòng & Ngày',
                  content: 'Chọn phòng & ngày',
                  icon: currentStep > 0 ? <CheckCircleFilled style={{ color: '#10b981' }} /> : undefined
                },
                {
                  title: 'Khung giờ',
                  content: 'Lưới giờ 30 phút',
                  icon: currentStep > 1 ? <CheckCircleFilled style={{ color: '#10b981' }} /> : undefined
                },
                {
                  title: 'Thông tin & Thiết bị',
                  content: 'Mục đích & thiết bị',
                  icon: currentStep > 2 ? <CheckCircleFilled style={{ color: '#10b981' }} /> : undefined
                },
                {
                  title: 'Xác nhận & Gửi đơn',
                  content: 'Tóm tắt & Cam kết'
                }
              ]}
            />
          </div>

          <Form 
            form={form} 
            layout="vertical" 
            onFinish={submitBooking} 
            initialValues={{ date: selectedDate }}
            onValuesChange={(changedValues, allValues) => {
              if (changedValues.startTime !== undefined) {
                setStartTime(changedValues.startTime)
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
            {/* ============================================================
                BƯỚC 1: PHÒNG & NGÀY SỬ DỤNG
                ============================================================ */}
            <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
              <div className="wizard-step-content">
                <div style={{ marginBottom: 20 }}>
                  <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 4px', fontWeight: 700 }}>
                    Bước 1: Chọn Phòng học và Ngày sử dụng
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
                    Lựa chọn ngày dự kiến và phòng học phù hợp với nhu cầu sinh hoạt, giảng dạy hoặc hội thảo.
                  </Typography.Text>
                </div>

                <Row gutter={20}>
                  <Col xs={24} md={12}>
                    <Form.Item 
                      label={<strong style={{ color: '#334155' }}>Ngày sử dụng phòng</strong>} 
                      required
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Button 
                          icon={<LeftOutlined />} 
                          disabled={selectedDate.isSameOrBefore(dayjs().startOf('day'))}
                          onClick={() => {
                            const prev = selectedDate.subtract(1, 'day')
                            setSelectedDate(prev)
                            form.setFieldValue('date', prev)
                            handleResetTime()
                          }}
                          title="Ngày trước"
                        />
                        <Form.Item
                          name="date"
                          noStyle
                          rules={[{ required: true, message: 'Vui lòng chọn ngày sử dụng!' }]}
                        >
                          <DatePicker 
                            format="DD/MM/YYYY" 
                            value={selectedDate}
                            allowClear={false}
                            style={{ flex: 1, textAlign: 'center', fontWeight: 600, height: 40 }} 
                            onChange={(d) => {
                              if (d) {
                                setSelectedDate(d)
                                form.setFieldValue('date', d)
                                handleResetTime()
                              }
                            }}
                            disabledDate={current => current && current < dayjs().startOf('day')}
                          />
                        </Form.Item>
                        <Button 
                          icon={<RightOutlined />} 
                          onClick={() => {
                            const next = selectedDate.add(1, 'day')
                            setSelectedDate(next)
                            form.setFieldValue('date', next)
                            handleResetTime()
                          }}
                          title="Ngày sau"
                        />
                      </div>
                    </Form.Item>
                  </Col>

                  <Col xs={24} md={12}>
                    <Form.Item 
                      label={<strong style={{ color: '#334155' }}>Chọn phòng học</strong>} 
                      name="roomId"
                      rules={[{ required: true, message: 'Vui lòng chọn phòng học!' }]}
                    >
                      <Select 
                        placeholder="-- Bấm chọn phòng học --" 
                        showSearch 
                        size="large"
                        style={{ width: '100%' }}
                        optionFilterProp="children"
                        filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                        options={rooms.map((r: any) => {
                          const cleanName = (r.name || '').replace(/^phòng\s+/i, '')
                          return {
                            value: r.id,
                            label: `Phòng ${cleanName} - ${r._displayType || 'Phòng học'} - ${r.building} (${r.capacity} người)`
                          }
                        })}
                        onChange={(val) => {
                          setSearchParams({ roomId: String(val) })
                          setStartTime(null)
                          setEndTime(null)
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Thẻ tóm tắt thông tin phòng đã chọn */}
                {selectedRoom ? (
                  <div 
                    style={{ 
                      marginTop: 8,
                      marginBottom: 16, 
                      padding: 16, 
                      background: '#f8fafc', 
                      borderRadius: 12, 
                      border: '1.5px solid #e2e8f0' 
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedRoom.imageUrl ? (
                        <img 
                          src={selectedRoom.imageUrl} 
                          alt={selectedRoom.name} 
                          style={{ width: 88, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }} 
                        />
                      ) : (
                        <div style={{ width: 88, height: 68, background: '#e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <EnvironmentOutlined style={{ color: '#0d2e5c', fontSize: 26 }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                          <span style={{ fontWeight: 800, color: '#0d2e5c', fontSize: 17 }}>
                            Phòng {selectedRoom.name}
                          </span>
                          <Tag color="blue" style={{ fontWeight: 600 }}>
                            {(selectedRoom as any)._displayType || selectedRoom.roomType}
                          </Tag>
                          <Tag color="cyan" style={{ fontWeight: 600 }}>
                            {selectedRoom.building}
                          </Tag>
                          <Tag color="geekblue" style={{ fontWeight: 600 }}>
                            <TeamOutlined /> Sức chứa: {selectedRoom.capacity} người
                          </Tag>
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                          <strong>Thiết bị có sẵn tại phòng:</strong>{' '}
                          {roomEquipments.length > 0 ? roomEquipments.join(', ') : 'Đang cập nhật danh mục'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    style={{ borderRadius: 8, background: '#f0f9ff', borderColor: '#bae6fd', marginTop: 8 }}
                    title={<strong style={{ color: '#0369a1' }}>Vui lòng chọn một phòng học</strong>}
                    description="Hãy chọn một phòng học từ danh sách phía trên để xem sức chứa, trang thiết bị và tiếp tục bước chọn khung giờ."
                  />
                )}

                {/* Nút chuyển bước */}
                <div className="step-navigation-bar" style={{ justifyContent: 'flex-end' }}>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep2}
                    disabled={!selectedRoom}
                    icon={<ArrowRightOutlined />}
                    style={{ 
                      background: selectedRoom ? '#0d2e5c' : undefined, 
                      height: 44, 
                      borderRadius: 8, 
                      fontWeight: 600, 
                      padding: '0 28px' 
                    }}
                  >
                    Tiếp tục: Chọn giờ
                  </Button>
                </div>
              </div>
            </div>

            {/* ============================================================
                BƯỚC 2: KHUNG GIỜ SỬ DỤNG
                ============================================================ */}
            <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
              <div className="wizard-step-content">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 4px', fontWeight: 700 }}>
                      Bước 2: Chọn Khung Giờ Trên Lưới 30 Phút
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
                      Phòng đang chọn: <strong style={{ color: '#0d2e5c' }}>{selectedRoom?.name}</strong> ({selectedRoom?.building}) | Ngày: <strong style={{ color: '#0d2e5c' }}>{selectedDate.format('DD/MM/YYYY')}</strong>
                    </Typography.Text>
                  </div>

                  {/* Nút chuyển nhanh ngày */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Button 
                      size="small"
                      icon={<LeftOutlined />} 
                      disabled={selectedDate.isSameOrBefore(dayjs().startOf('day'))}
                      onClick={handlePrevDay}
                      title="Ngày trước"
                    />
                    <DatePicker 
                      size="small"
                      format="DD/MM/YYYY" 
                      value={selectedDate}
                      allowClear={false}
                      style={{ width: 130, textAlign: 'center', fontWeight: 600 }} 
                      onChange={(d) => {
                        if (d) {
                          setSelectedDate(d)
                          form.setFieldValue('date', d)
                          handleResetTime()
                        }
                      }}
                      disabledDate={current => current && current < dayjs().startOf('day')}
                    />
                    <Button 
                      size="small"
                      icon={<RightOutlined />} 
                      onClick={handleNextDay}
                      title="Ngày sau"
                    />
                  </div>
                </div>

                {/* Bảng chú thích màu sắc trạng thái */}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4 }}></div> Còn trống</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#0d2e5c', borderRadius: 4 }}></div> Đang chọn</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#fef08a', border: '1px solid #facc15', borderRadius: 4 }}></div> Chờ duyệt</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#86efac', border: '1px solid #4ade80', borderRadius: 4 }}></div> Đã đặt</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: 4 }}></div> Đã qua/Đóng</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#fee2e2', border: '1px solid #f87171', borderRadius: 4 }}></div> Không thể đặt</div>
                </div>

                {/* Banner hướng dẫn và thông báo khung giờ đã chọn */}
                {renderSelectionBanner()}

                {/* Lưới chọn khung giờ 30 phút */}
                <div 
                  className="booking-time-slots-grid"
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', 
                    gap: 8,
                    marginBottom: 20
                  }}
                >
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

                    const isSelected = status === 'start' || status === 'end'
                    return (
                      <div 
                        key={slot}
                        onClick={() => handleSlotClick(slot)}
                        className={`time-slot-btn ${isSelected ? 'selected' : ''}`}
                        style={{
                          background: bg,
                          color: color,
                          border: border,
                          borderRadius: 8,
                          padding: '6px 4px',
                          textAlign: 'center',
                          cursor: cursor,
                          fontWeight: 600,
                          fontSize: 13,
                          userSelect: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 52,
                        }}
                      >
                        <div>{slot}</div>
                        {status === 'start' && (
                          <span style={{ fontSize: 9.5, background: '#3b82f6', color: '#fff', borderRadius: 3, padding: '1px 4px', marginTop: 2, fontWeight: 700 }}>
                            Bắt đầu
                          </span>
                        )}
                        {status === 'end' && (
                          <span style={{ fontSize: 9.5, background: '#f59e0b', color: '#fff', borderRadius: 3, padding: '1px 4px', marginTop: 2, fontWeight: 700 }}>
                            Kết thúc
                          </span>
                        )}
                        {status === 'in-between' && (
                          <span style={{ fontSize: 10, color: '#4338ca', marginTop: 2, fontWeight: 700 }}>
                            •••
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Cảnh báo vi phạm quy định giờ mượn phòng (nếu có) */}
                {limitViolations.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <Alert
                      type="warning"
                      showIcon
                      title={<strong style={{ color: '#9a3412' }}>Yêu cầu phê duyệt đặc biệt</strong>}
                      description={
                        <div>
                          <div style={{ marginBottom: 6, color: '#9a3412' }}>Thời gian bạn chọn đã vượt quy định chuẩn:</div>
                          <ul style={{ margin: 0, paddingLeft: 20, color: '#9a3412', fontSize: 13 }}>
                            {limitViolations.map((v, i) => <li key={i}>{v}</li>)}
                          </ul>
                        </div>
                      }
                    />
                    <Form.Item
                      label={<strong style={{ color: '#334155' }}>Lý do đề xuất phê duyệt đặc biệt (Bắt buộc)</strong>}
                      name="specialRequestReason"
                      rules={[{ required: true, message: 'Vui lòng nhập lý do phê duyệt đặc biệt!' }]}
                      style={{ marginTop: 14, marginBottom: 0 }}
                    >
                      <Input.TextArea rows={2} placeholder="Trình bày lý do cần đặt phòng vượt khung quy định thông thường..." />
                    </Form.Item>
                  </div>
                )}

                {/* Nút chuyển bước */}
                <div className="step-navigation-bar">
                  <Button 
                    size="large" 
                    onClick={() => { setCurrentStep(0); scrollToTop(); }}
                    icon={<ArrowLeftOutlined />}
                    style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại: Chọn phòng
                  </Button>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep3}
                    disabled={!startTime || !endTime}
                    icon={<ArrowRightOutlined />}
                    style={{ 
                      background: (startTime && endTime) ? '#0d2e5c' : undefined, 
                      height: 44, 
                      borderRadius: 8, 
                      fontWeight: 600, 
                      padding: '0 28px' 
                    }}
                  >
                    Tiếp tục: Thông tin & Thiết bị
                  </Button>
                </div>
              </div>
            </div>

            {/* ============================================================
                BƯỚC 3: THÔNG TIN SỬ DỤNG & THIẾT BỊ
                ============================================================ */}
            <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
              <div className="wizard-step-content">
                <div style={{ marginBottom: 20 }}>
                  <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 4px', fontWeight: 700 }}>
                    Bước 3: Thông Tin Người Mượn & Thiết Bị
                  </Typography.Title>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13, color: '#475569', marginTop: 4 }}>
                    <span>Phòng: <strong style={{ color: '#0d2e5c' }}>{selectedRoom?.name}</strong></span>
                    <span>•</span>
                    <span>Ngày: <strong style={{ color: '#0d2e5c' }}>{selectedDate.format('DD/MM/YYYY')}</strong></span>
                    <span>•</span>
                    <span>Khung giờ: <strong style={{ color: '#0d2e5c' }}>{startTime} - {endTime}</strong> ({currentDuration?.toFixed(1)} giờ)</span>
                  </div>
                </div>

                {/* 4. Chế độ Admin Tiếp nhận Đặt phòng trực tiếp tại quầy */}
                {isAdmin && (
                  <div 
                    id="admin-walk-in-panel"
                    style={{
                      background: isWalkInBooking ? '#f0fdf4' : '#f8fafc',
                      border: `1.5px solid ${isWalkInBooking ? '#86efac' : '#cbd5e1'}`,
                      borderRadius: 8,
                      padding: '12px 16px',
                      marginBottom: 18,
                      transition: 'all 0.25s ease',
                      boxShadow: isWalkInBooking ? '0 2px 8px rgba(34, 197, 94, 0.12)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <Checkbox
                        id="admin-walk-in-checkbox"
                        checked={isWalkInBooking}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsWalkInBooking(checked);
                          if (checked) {
                            form.setFieldsValue({
                              department: '',
                              personName: '',
                              phoneNumber: '',
                            });
                            message.info('Đã kích hoạt chế độ Đặt hộ tại quầy. Các ô thông tin đã được làm trống để nhập người mượn.');
                          } else {
                            form.setFieldsValue({
                              department: userProfile?.department || 'Phòng Quản trị thiết bị & Ban Quản trị',
                              personName: userProfile?.fullName || 'Ban Quản trị Cơ sở vật chất',
                              phoneNumber: userProfile?.phoneNumber || '02583727147',
                            });
                            message.info('Đã chuyển về chế độ Đặt phòng Quản trị mặc định.');
                          }
                        }}
                        style={{ fontSize: 13.5, fontWeight: 700, color: '#0d2e5c' }}
                      >
                        Tiếp nhận đặt phòng trực tiếp tại quầy (Đặt hộ cho Giảng viên / Sinh viên)
                      </Checkbox>

                      <Tag color={isWalkInBooking ? 'success' : 'blue'} style={{ margin: 0, fontWeight: 600, padding: '2px 8px' }}>
                        {isWalkInBooking ? 'Chế độ: Đặt hộ tại quầy' : 'Chế độ: Ban Quản trị'}
                      </Tag>
                    </div>

                    {isWalkInBooking ? (
                      <div style={{ marginTop: 6, fontSize: 12.5, color: '#15803d', paddingLeft: 24, lineHeight: 1.5 }}>
                        Hệ thống sẽ lưu phiếu theo thông tin người mượn thực tế tại quầy và <strong>TỰ ĐỘNG PHÊ DUYỆT NGAY LẬP TỨC</strong>.
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b', paddingLeft: 24 }}>
                        Mặc định dùng thông tin Ban Quản trị. Tích chọn ô trên nếu có Giảng viên hoặc Sinh viên đến làm thủ tục mượn phòng tại văn phòng.
                      </div>
                    )}
                  </div>
                )}

                {/* Lưới 2x2: Hàng 1 (Đơn vị & Họ tên), Hàng 2 (Số điện thoại & Số người tham gia) */}
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item 
                      label={
                        <strong style={{ color: '#334155' }}>
                          {isAdmin 
                            ? (isWalkInBooking ? 'Khoa / Đơn vị của người đến mượn tại quầy' : 'Đơn vị / Phòng ban sử dụng') 
                            : isFaculty 
                              ? 'Khoa / Bộ môn' 
                              : isStaff 
                                ? 'Phòng / Ban / Trung tâm' 
                                : 'Lớp, khoa, ban, CLB'}
                        </strong>
                      } 
                      name="department"
                      rules={[
                        { 
                          required: true, 
                          message: isAdmin 
                            ? (isWalkInBooking ? 'Vui lòng nhập đơn vị/khoa của người đến quầy!' : 'Vui lòng nhập đơn vị/phòng ban sử dụng!') 
                            : isFaculty 
                              ? 'Vui lòng nhập Khoa / Bộ môn!' 
                              : isStaff 
                                ? 'Vui lòng nhập Phòng / Ban / Trung tâm!' 
                                : 'Vui lòng nhập đơn vị/khoa/ban/CLB!' 
                        }
                      ]}
                    >
                      <Input 
                        placeholder={
                          isAdmin 
                            ? (isWalkInBooking ? "Ví dụ: Lớp 21CNTT, Khoa Công nghệ, CLB Tiếng Anh..." : "Ví dụ: Phòng Đào tạo, Khoa CNTT, Phòng QTTB...") 
                            : isFaculty 
                              ? "Ví dụ: Khoa Công nghệ & Kỹ thuật, Khoa Kinh tế - Quản trị..." 
                              : isStaff 
                                ? "Ví dụ: Phòng Đào tạo, Phòng Quản trị thiết bị, Ban CTSV..." 
                                : "Ví dụ: Khoa CNTT, CLB Lập trình..."
                        } 
                        size="large" 
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item 
                      label={
                        <strong style={{ color: '#334155' }}>
                          {isAdmin 
                            ? (isWalkInBooking ? 'Họ và tên người mượn thực tế tại quầy' : 'Người / Đơn vị phụ trách') 
                            : isFaculty 
                              ? 'Họ và tên Giảng viên' 
                              : isStaff 
                                ? 'Họ và tên Cán bộ phụ trách' 
                                : 'Họ và tên người phụ trách'}
                        </strong>
                      } 
                      name="personName"
                      rules={[{ required: true, message: 'Vui lòng nhập người/đơn vị phụ trách!' }]}
                      extra={
                        isAdmin ? (
                          <div style={{ fontSize: 12, color: isWalkInBooking ? '#15803d' : '#0284c7', marginTop: 3 }}>
                            {isWalkInBooking 
                              ? 'Ghi rõ họ tên Giảng viên hoặc Sinh viên đang có mặt tại quầy (VD: ThS. Lê Văn Nam hoặc Nguyễn Thị Lan - 21CNTT)' 
                              : 'Ghi rõ ai hoặc đơn vị nào sẽ sử dụng phòng (VD: TS. Nguyễn Văn A - Khoa CNTT hoặc Phòng Đào tạo)'}
                          </div>
                        ) : null
                      }
                    >
                      <Input 
                        placeholder={
                          isAdmin 
                            ? (isWalkInBooking ? "Ví dụ: ThS. Lê Văn Nam hoặc Nguyễn Thị Lan (SV)" : "Ví dụ: Ban Quản trị Cơ sở vật chất hoặc TS. Nguyễn Văn A") 
                            : isFaculty 
                              ? "Ví dụ: ThS. Nguyễn Văn A, TS. Trần Thị B..." 
                              : isStaff 
                                ? "Ví dụ: Nguyễn Văn A (Phòng Đào tạo)..." 
                                : "Ví dụ: Nguyễn Văn A"
                        } 
                        size="large" 
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item 
                      label={<strong style={{ color: '#334155' }}>Số điện thoại liên hệ</strong>} 
                      name="phoneNumber"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số điện thoại!' },
                        {
                          pattern: /^(0[3|5|7|8|9])[0-9]{8}$/,
                          message: 'Số điện thoại không hợp lệ!'
                        }
                      ]}
                    >
                      <Input placeholder="Ví dụ: 0912345678" size="large" maxLength={10} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item 
                      label={
                        <Space size={6}>
                          <strong style={{ color: '#334155' }}>Số lượng người tham gia</strong>
                          {selectedRoom && (
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 'normal' }}>
                              (Tối đa: {selectedRoom.capacity} người)
                            </span>
                          )}
                        </Space>
                      } 
                      name="participantCount"
                      validateTrigger={['onChange', 'onBlur']}
                      rules={[
                        { required: true, message: 'Vui lòng nhập số người tham gia!' },
                        {
                          validator: (_, value) => {
                            if (selectedRoom && value && Number(value) > Number(selectedRoom.capacity)) {
                              return Promise.reject(new Error(`Vượt quá sức chứa tối đa (${selectedRoom.capacity} người)`));
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                      extra={
                        selectedRoom ? (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                            Sức chứa phòng: <strong style={{ color: '#0d2e5c' }}>{selectedRoom.capacity} chỗ ngồi</strong>
                          </div>
                        ) : null
                      }
                    >
                      <InputNumber 
                        min={1} 
                        size="large"
                        style={{ width: '100%' }} 
                        placeholder={selectedRoom ? `Sức chứa tối đa: ${selectedRoom.capacity} người` : "Ví dụ: 40"} 
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {isOverCapacity && (
                  <div style={{ marginBottom: 16 }}>
                    <Alert
                      type="error"
                      showIcon
                      style={{ borderRadius: 8, background: '#fef2f2', borderColor: '#fca5a5' }}
                      title={<strong style={{ color: '#dc2626' }}>Vượt quá sức chứa tối đa của phòng</strong>}
                      description={
                        <div style={{ color: '#991b1b', fontSize: 13, lineHeight: 1.5 }}>
                          Số lượng người đăng ký ({participantCount} người) vượt quá sức chứa tối đa của phòng {selectedRoom?.name} ({selectedRoom?.capacity} chỗ). Vui lòng giảm số người tham gia hoặc chọn phòng khác có sức chứa lớn hơn.
                        </div>
                      }
                    />
                  </div>
                )}

                {/* Khối gợi ý sự kiện / mục đích nhanh */}
                {isAdmin && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      Gợi ý sự kiện nhà trường (Nhấp để chọn nhanh):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {ADMIN_EVENT_SUGGESTIONS.map((item) => (
                        <Button
                          key={item}
                          size="small"
                          onClick={() => form.setFieldValue('purpose', item)}
                          style={{
                            borderRadius: 4,
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: 12.5,
                            fontWeight: 500,
                            height: 30,
                            padding: '0 10px',
                            boxShadow: 'none'
                          }}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {!isAdmin && isFaculty && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      Gợi ý mục đích giảng dạy (Nhấn chọn để điền nhanh):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {FACULTY_EVENT_SUGGESTIONS.map((item) => (
                        <Button
                          key={item}
                          size="small"
                          onClick={() => form.setFieldValue('purpose', item)}
                          style={{
                            borderRadius: 4,
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: 12.5,
                            fontWeight: 500,
                            height: 30,
                            padding: '0 10px',
                            boxShadow: 'none'
                          }}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {!isAdmin && !isFaculty && isStaff && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
                      Gợi ý mục đích công tác (Nhấn chọn để điền nhanh):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {STAFF_EVENT_SUGGESTIONS.map((item) => (
                        <Button
                          key={item}
                          size="small"
                          onClick={() => form.setFieldValue('purpose', item)}
                          style={{
                            borderRadius: 4,
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontSize: 12.5,
                            fontWeight: 500,
                            height: 30,
                            padding: '0 10px',
                            boxShadow: 'none'
                          }}
                        >
                          {item}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <Form.Item 
                  label={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <strong style={{ color: '#334155' }}>Mục đích sử dụng phòng</strong>
                      {isAdmin && (
                        <span style={{ fontSize: 12, color: '#0d2e5c', fontWeight: 600 }}>
                          [Quản trị viên]
                        </span>
                      )}
                      {!isAdmin && isFaculty && (
                        <span style={{ fontSize: 12, color: '#0d2e5c', fontWeight: 600 }}>
                          [Giảng viên]
                        </span>
                      )}
                      {!isAdmin && !isFaculty && isStaff && (
                        <span style={{ fontSize: 12, color: '#0d2e5c', fontWeight: 600 }}>
                          [Cán bộ - Nhân viên]
                        </span>
                      )}
                    </div>
                  } 
                  name="purpose"
                  rules={[{ required: true, message: 'Vui lòng nhập mục đích sử dụng!' }]}
                >
                  <Input.TextArea 
                    rows={2} 
                    placeholder={
                      isAdmin 
                        ? "Nhập mục đích sử dụng hoặc chọn từ các gợi ý sự kiện phía trên..." 
                        : isFaculty 
                          ? "Nhập mục đích giảng dạy hoặc chọn từ các gợi ý phía trên..." 
                          : isStaff 
                            ? "Nhập mục đích làm việc hoặc chọn từ các gợi ý phía trên..." 
                            : "VD: Sinh hoạt câu lạc bộ, họp thảo luận đề tài nghiên cứu khoa học..."
                    } 
                  />
                </Form.Item>

                <Form.Item label={<strong style={{ color: '#334155' }}>Mượn thêm thiết bị dùng chung</strong>} name="requestedEquipments">
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
                  label={
                    <Space size={4}>
                      <strong style={{ color: '#334155' }}>Ghi chú</strong>
                      <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 'normal' }}>(Không bắt buộc)</Typography.Text>
                    </Space>
                  } 
                  name="notes"
                >
                  <Input.TextArea rows={2} placeholder="Nhập yêu cầu khác nếu có ..." />
                </Form.Item>

                {/* Nút chuyển bước */}
                <div className="step-navigation-bar">
                  <Button 
                    size="large" 
                    onClick={() => { setCurrentStep(1); scrollToTop(); }}
                    icon={<ArrowLeftOutlined />}
                    style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại: Chọn giờ
                  </Button>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep4}
                    icon={<ArrowRightOutlined />}
                    style={{ 
                      background: '#0d2e5c', 
                      height: 44, 
                      borderRadius: 8, 
                      fontWeight: 600, 
                      padding: '0 28px' 
                    }}
                  >
                    Tiếp tục: Xem lại & Xác nhận
                  </Button>
                </div>
              </div>
            </div>

            {/* ============================================================
                BƯỚC 4: XÁC NHẬN & GỬI ĐƠN
                ============================================================ */}
            <div style={{ display: currentStep === 3 ? 'block' : 'none' }}>
              <div className="wizard-step-content">
                <div style={{ marginBottom: 20 }}>
                  <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 4px', fontWeight: 700 }}>
                    Bước 4: Xác Nhận & Gửi Phiếu Đặt Phòng
                  </Typography.Title>
                  <Typography.Text type="secondary" style={{ fontSize: 13.5 }}>
                    Kiểm tra lại toàn bộ chi tiết đơn đặt phòng và cam kết thực hiện đúng nội quy giảng đường.
                  </Typography.Text>
                </div>

                {/* Phiếu Tóm Tắt Đặt Phòng (Booking Summary Card) */}
                <div className="booking-summary-box" style={{ marginBottom: 24 }}>
                  <div className="booking-summary-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileTextOutlined style={{ fontSize: 20, color: '#fbbf24' }} />
                      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '0.2px' }}>
                        PHIẾU TÓM TẮT ĐẶT PHÒNG HỌC (TBD)
                      </span>
                    </div>
                    {isAdmin ? (
                      <Tag color="success" style={{ fontWeight: 700, margin: 0, padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>
                        Tự động phê duyệt
                      </Tag>
                    ) : isStaffOrFaculty ? (
                      <Tag color="blue" style={{ fontWeight: 700, margin: 0, padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>
                        Ưu tiên xét duyệt Cấp 1
                      </Tag>
                    ) : (
                      <Tag color="gold" style={{ fontWeight: 700, margin: 0 }}>
                        Chờ gửi duyệt
                      </Tag>
                    )}
                  </div>

                  <div className="booking-summary-body">
                    {isAdmin && isWalkInBooking && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Tag color="success" style={{ fontWeight: 700, margin: 0 }}>TIẾP NHẬN TẠI QUẦY</Tag>
                        <span style={{ fontSize: 13, color: '#166534', fontWeight: 500 }}>
                          Đặt hộ và phê duyệt trực tiếp cho người mượn: <strong>{personName || '-'}</strong> ({department || '-'})
                        </span>
                      </div>
                    )}
                    <div className="summary-data-row">
                      <span className="summary-data-label">Phòng học:</span>
                      <span className="summary-data-value" style={{ color: '#0d2e5c', fontSize: 14.5 }}>
                        Phòng {selectedRoom?.name} ({selectedRoom?.building} - {(selectedRoom as any)?._displayType})
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Sức chứa phòng:</span>
                      <span className="summary-data-value">
                        {selectedRoom?.capacity} người
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Ngày sử dụng:</span>
                      <span className="summary-data-value" style={{ color: '#0284c7' }}>
                        {selectedDate.format('dddd, DD/MM/YYYY')}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Khung giờ mượn:</span>
                      <span className="summary-data-value" style={{ color: '#0d2e5c' }}>
                        {startTime} - {endTime} (Tổng: {currentDuration?.toFixed(1)} giờ)
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Tài khoản người đặt:</span>
                      <span className="summary-data-value">
                        {userEmail}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">
                        {isAdmin 
                          ? 'Đơn vị / Phòng ban:' 
                          : isFaculty 
                            ? 'Khoa / Bộ môn:' 
                            : isStaff 
                              ? 'Phòng / Ban / Trung tâm:' 
                              : 'Khoa / Đơn vị / Lớp:'}
                      </span>
                      <span className="summary-data-value">
                        {department || '-'}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">
                        {isAdmin 
                          ? 'Người / Đơn vị phụ trách:' 
                          : isFaculty 
                            ? 'Giảng viên phụ trách:' 
                            : isStaff 
                              ? 'Cán bộ phụ trách:' 
                              : 'Người / Đơn vị phụ trách:'}
                      </span>
                      <span className="summary-data-value">
                        {personName || '-'}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Số điện thoại:</span>
                      <span className="summary-data-value" style={{ color: '#0284c7', fontWeight: 600 }}>
                        {phoneNumber || '-'}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Số người tham gia:</span>
                      <span className="summary-data-value">
                        {participantCount || 0} người
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Mục đích sử dụng:</span>
                      <span className="summary-data-value">
                        {purpose || '-'}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Thiết bị mượn thêm:</span>
                      <span className="summary-data-value">
                        {requestedEquipments && requestedEquipments.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {requestedEquipments.map((eqName: string, idx: number) => (
                              <Tag key={idx} color="blue" style={{ margin: 0 }}>
                                {eqName}
                              </Tag>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không mượn thêm</span>
                        )}
                      </span>
                    </div>

                    <div className="summary-data-row">
                      <span className="summary-data-label">Ghi chú bổ sung:</span>
                      <span className="summary-data-value">
                        {notes ? notes : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có</span>}
                      </span>
                    </div>

                    {limitViolations.length > 0 && (
                      <div className="summary-data-row" style={{ background: '#fffbeb', padding: '10px', borderRadius: 6, marginTop: 6 }}>
                        <span className="summary-data-label" style={{ color: '#b45309', fontWeight: 600 }}>Phê duyệt đặc biệt:</span>
                        <span className="summary-data-value" style={{ color: '#b45309' }}>
                          {specialRequestReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Đặc quyền Quản trị viên (Admin Privilege) */}
                {isAdmin && (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0d2e5c', fontSize: 14, marginBottom: 2 }}>
                        [Quản trị viên] Quyền duyệt tự động
                      </div>
                      <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
                        Yêu cầu sẽ được <strong>TỰ ĐỘNG PHÊ DUYỆT</strong> và khóa lịch phòng ngay lập tức.
                      </div>
                    </div>
                  </div>
                )}

                {/* Khung thông báo ưu tiên màu xanh dương nhạt cho Giảng viên và Cán bộ Nhân viên */}
                {!isAdmin && isStaffOrFaculty && (
                  <div style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: 8,
                    padding: '14px 18px',
                    marginBottom: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#0369a1', fontSize: 14, marginBottom: 3 }}>
                        {isFaculty ? '[Giảng viên] Chế độ ưu tiên xét duyệt' : '[Cán bộ - Nhân viên] Chế độ ưu tiên xét duyệt'}
                      </div>
                      <div style={{ color: '#0c4a6e', fontSize: 13, lineHeight: 1.5 }}>
                        Yêu cầu đặt phòng của Thầy/Cô và Cán bộ được xếp thứ tự <strong>ƯU TIÊN XÉT DUYỆT CẤP 1</strong> để phục vụ công tác giảng dạy và hoạt động nhà trường.
                      </div>
                    </div>
                  </div>
                )}

                {/* Kiểm tra giới hạn hệ thống (chỉ hiển thị cho người dùng thông thường) */}
                {!isAdmin && checkLimitQuery.error && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                    title={<strong style={{ color: '#9a3412', fontSize: 13 }}>Lỗi kiểm tra giới hạn đặt phòng</strong>}
                    description={<div style={{ fontSize: 12 }}>{(checkLimitQuery.error as any).message}</div>}
                  />
                )}

                {!isAdmin && checkLimitQuery.data && (
                  <Alert
                    type={checkLimitQuery.data.canBook ? 'success' : 'error'}
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                    title={<strong style={{ fontSize: 13 }}>{checkLimitQuery.data.canBook ? 'Đủ điều kiện đặt phòng theo quy chế' : 'Vượt quá giới hạn quy chế'}</strong>}
                    description={
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
                        <li>Số yêu cầu đang chờ duyệt: {checkLimitQuery.data.pendingCount}/{checkLimitQuery.data.maxPending}</li>
                        <li>Lượt sử dụng trong tuần: {checkLimitQuery.data.weeklyApprovedCount}/{checkLimitQuery.data.maxWeeklyApproved}</li>
                        {checkLimitQuery.data.hasOverlap && <li style={{ color: '#b91c1c' }}><strong>Trùng lịch với lịch đặt khác!</strong></li>}
                        {!checkLimitQuery.data.canBook && checkLimitQuery.data.reason && <li>Lý do: {checkLimitQuery.data.reason}</li>}
                      </ul>
                    }
                  />
                )}

                {/* Cam kết nội quy phòng học (chỉ hiển thị cho Sinh viên / Khách, tự động miễn cho Giảng viên & Nhân viên) */}
                {!isStaffOrFaculty && (
                  <>
                    <div style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc', marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, color: '#0d2e5c', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5 }}>
                        <SafetyCertificateOutlined style={{ color: '#0284c7' }} />
                        Nội quy sử dụng phòng học Trường Đại Học Thái Bình Dương:
                      </div>
                      <ul style={{ paddingLeft: 20, margin: 0, fontSize: 12.5, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <li>Sử dụng đúng mục đích, thời gian và số lượng người đã đăng ký trong phiếu.</li>
                        <li>Không tự ý chuyển phòng hoặc chuyển quyền sử dụng cho người khác.</li>
                        <li>Giữ gìn vệ sinh chung, trật tự và không mang đồ ăn thức uống có mùi vào phòng.</li>
                        <li>Không tự ý di chuyển thiết bị cố định ra khỏi vị trí ban đầu.</li>
                        <li>Tắt toàn bộ hệ thống đèn, điều hòa, máy chiếu và khóa cửa sau khi kết thúc sử dụng.</li>
                        <li>Báo cáo ngay cho Ban Quản lý Giảng đường khi phát hiện hư hỏng hoặc sự cố kỹ thuật.</li>
                        <li>Cá nhân và đơn vị đăng ký chịu hoàn toàn trách nhiệm đối với mất mát, hư hỏng do sử dụng sai quy định.</li>
                      </ul>
                    </div>

                    <Form.Item 
                      name="agreedToRules" 
                      valuePropName="checked"
                      rules={[
                        { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Vui lòng tích chọn cam kết tuân thủ nội quy!')) }
                      ]}
                      style={{ marginBottom: 16 }}
                    >
                      <Checkbox>
                        <strong style={{ color: '#0d2e5c', fontSize: 13.5 }}>
                          Tôi cam kết tuân thủ nội quy giảng đường và bảo quản trang thiết bị.
                        </strong>
                      </Checkbox>
                    </Form.Item>
                  </>
                )}

                {/* Nút gửi đơn */}
                <div className="step-navigation-bar">
                  <Button 
                    size="large" 
                    onClick={() => { setCurrentStep(2); scrollToTop(); }}
                    icon={<ArrowLeftOutlined />}
                    style={{ height: 46, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại chỉnh sửa
                  </Button>

                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    size="large" 
                    disabled={
                      !isStaffOrFaculty 
                        ? (!agreedToRules || (checkLimitQuery.data && !checkLimitQuery.data.canBook) || checkLimitQuery.isFetching)
                        : false
                    } 
                    loading={createMutation.isPending || checkLimitQuery.isFetching} 
                    icon={<ThunderboltOutlined />} 
                    style={{ 
                      minWidth: 260,
                      height: 48, 
                      borderRadius: 8, 
                      fontWeight: 700, 
                      fontSize: 15,
                      background: '#0d2e5c',
                      borderColor: '#0d2e5c',
                      color: '#ffffff',
                      textTransform: isStaffOrFaculty ? 'uppercase' : 'none',
                      letterSpacing: isStaffOrFaculty ? '0.5px' : 'normal',
                      boxShadow: '0 4px 14px rgba(13, 46, 92, 0.28)'
                    }}
                  >
                    {isAdmin 
                      ? 'ĐẶT PHÒNG & DUYỆT TRỰC TIẾP' 
                      : isFaculty 
                        ? 'XÁC NHẬN ĐẶT PHÒNG GIẢNG DẠY' 
                        : isStaff 
                          ? 'XÁC NHẬN ĐẶT PHÒNG LÀM VIỆC' 
                          : 'GỬI YÊU CẦU PHÊ DUYỆT'}
                  </Button>
                </div>

                {!isAdmin && (
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#64748b' }}>
                    {isStaffOrFaculty 
                      ? 'Yêu cầu của Thầy/Cô và Cán bộ được chuyển trực tiếp vào hàng chờ Ưu tiên xét duyệt Cấp 1.'
                      : 'Yêu cầu của bạn sẽ được chuyển đến Ban Quản trị để xem xét.'}
                  </div>
                )}
              </div>
            </div>
          </Form>
        </Card>
      </div>

      {/* Booking Success Modal */}
      <Modal
        open={successModalVisible}
        footer={null}
        onCancel={() => {
          setSuccessModalVisible(false);
          if (!isAdmin) navigate('/booking-history');
        }}
        centered
        width={500}
        className="booking-success-modal"
        destroyOnHidden
      >
        <div style={{ textAlign: 'center' }}>
          <div className="booking-success-badge" style={{ background: isAdmin ? '#ecfdf5' : '#eff6ff', color: isAdmin ? '#10b981' : '#0284c7' }}>
            <CheckCircleFilled />
          </div>

          <Typography.Title level={3} style={{ color: '#0d2e5c', margin: '0 0 8px', fontWeight: 800 }}>
            {isAdmin 
              ? 'Đặt phòng và phê duyệt trực tiếp thành công!' 
              : isFaculty 
                ? 'Đã gửi phiếu đặt phòng giảng dạy thành công!' 
                : isStaff 
                  ? 'Đã gửi phiếu đặt phòng làm việc thành công!' 
                  : 'Gửi Yêu Cầu Đặt Phòng Thành Công!'}
          </Typography.Title>

          <Typography.Paragraph type="secondary" style={{ fontSize: 14.5, marginBottom: 20, lineHeight: 1.5 }}>
            {isAdmin
              ? 'Lịch phòng đã được cập nhật.'
              : isStaffOrFaculty
                ? 'Đơn đặt phòng đã được ghi nhận và xếp mức Ưu tiên xét duyệt Cấp 1. Bạn có thể theo dõi tiến độ tại trang Lịch sử.'
                : 'Yêu cầu của bạn sẽ được chuyển đến Ban Quản trị để xem xét. Bạn có thể theo dõi tiến độ xét duyệt tại trang Lịch sử.'}
          </Typography.Paragraph>

          {successBookingInfo && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '14px 16px',
                textAlign: 'left',
                marginBottom: 24,
                fontSize: 13.5,
                color: '#334155'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Phòng học:</span>
                <strong style={{ color: '#0d2e5c' }}>{successBookingInfo.roomName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Ngày & Khung giờ:</span>
                <strong style={{ color: '#0d2e5c' }}>{successBookingInfo.timeRange} ({successBookingInfo.dateStr})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Số người tham gia:</span>
                <span>{successBookingInfo.participantCount} người</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Trạng thái đơn:</span>
                <Tag color={isAdmin ? 'green' : isStaffOrFaculty ? 'blue' : 'gold'} style={{ margin: 0, fontWeight: 700 }}>
                  {isAdmin ? 'ĐÃ DUYỆT (TRỰC TIẾP)' : isStaffOrFaculty ? 'CHỜ DUYỆT (ƯU TIÊN CẤP 1)' : 'CHỜ DUYỆT'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Mục đích sử dụng:</span>
                <span style={{ maxWidth: 220, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {successBookingInfo.purpose}
                </span>
              </div>
            </div>
          )}

          {isAdmin ? (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button
                size="large"
                icon={<CalendarOutlined />}
                onClick={() => {
                  setSuccessModalVisible(false)
                  navigate('/calendar')
                }}
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  flex: 1,
                  borderColor: '#0284c7',
                  color: '#0284c7',
                  height: 44
                }}
              >
                Xem trên Lịch phòng
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<DashboardOutlined />}
                onClick={() => {
                  setSuccessModalVisible(false)
                  navigate('/admin')
                }}
                style={{
                  borderRadius: 8,
                  fontWeight: 700,
                  background: '#0d2e5c',
                  borderColor: '#0d2e5c',
                  color: '#ffffff',
                  flex: 1,
                  height: 44,
                  boxShadow: '0 4px 12px rgba(13, 46, 92, 0.25)'
                }}
              >
                Về Trang Quản trị
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <Button
                size="large"
                icon={<PlusCircleOutlined />}
                onClick={() => setSuccessModalVisible(false)}
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  flex: 1,
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  height: 44
                }}
              >
                Đặt thêm phòng khác
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<HistoryOutlined />}
                onClick={() => {
                  setSuccessModalVisible(false)
                  navigate('/booking-history')
                }}
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  background: '#0d2e5c',
                  borderColor: '#0d2e5c',
                  flex: 1,
                  height: 44,
                  boxShadow: '0 4px 12px rgba(13, 46, 92, 0.25)'
                }}
              >
                Về Lịch sử đặt phòng
              </Button>
            </div>
          )}
        </div>
      </Modal>

    </main>
  )
}

export default BookingPage
