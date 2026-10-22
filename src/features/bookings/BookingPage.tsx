import { Alert, Button, Card, DatePicker, Form, Input, Select, Typography, App, Row, Col, InputNumber, Checkbox, Modal, Tag, Space, Steps, Spin, Tooltip } from 'antd'
import { useState, useMemo, useEffect, useRef } from 'react'
import { 
  CheckCircleOutlined, 
  EnvironmentOutlined, 
  TeamOutlined, 
  LeftOutlined, 
  RightOutlined, 
  ReloadOutlined, 
  CheckCircleFilled, 
  HistoryOutlined, 
  PlusCircleOutlined, 
  FileTextOutlined, 
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
import { http, shouldRetryQuery, formatApiError } from '../../api/http'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { Room } from '../../types/room'
import { getOfficialRooms, getRoomAvailableEquipmentList, isRoomRestrictedForStudent } from '../../utils/roomUtils'
import { getStorageImageUrl, handleImageFallback } from '../../utils/storageUtils'
import type { Booking, CreateBookingPayload } from '../../types/booking'
import { getUserRole, getUserEmail } from '../../api/authUtils'
import { type UserProfileData, fetchUserProfile, getCachedUserProfile } from '../../api/userProfile'
import type { EquipmentItem } from '../admin/AdminPage'
import { EquipmentSelector } from './EquipmentSelector'
import { normalizeDepartmentName } from '../../utils/academicPrograms'
import {
  useBookingSettings,
  validateBookingAgainstSettings,
  generateOperatingSlots,
  checkClosedPeriodOverlap,
} from '../../api/bookingSettings'
import { toVN } from '../../utils/dateUtils'



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

async function fetchRooms(signal?: AbortSignal): Promise<Room[]> {
  const res = await http.get<Room[]>('/api/rooms', { signal })
  if (Array.isArray(res.data)) {
    return res.data
  }
  if (res.data && Array.isArray((res.data as any).data)) {
    return (res.data as any).data
  }
  return []
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
  const userRole = (getUserRole() || '').toLowerCase();
  const userEmail = (getUserEmail() || '').toLowerCase();
  const cachedProfile = getCachedUserProfile();

  // 1. Trích xuất thông tin người dùng thực tế từ API GET /api/auth/me với fallback dữ liệu trường
  const { data: userProfile } = useQuery<UserProfileData>({
    queryKey: ['user-profile', userEmail],
    queryFn: fetchUserProfile,
    initialData: cachedProfile || undefined,
  });

  const activeProfile = userProfile || cachedProfile;

  const roleFromProfile = (activeProfile?.role || '').toLowerCase();
  const isManagerOrAdmin = 
    userRole === 'admin' || roleFromProfile === 'admin' || userEmail.includes('admin') ||
    userRole === 'approver' || roleFromProfile === 'approver' ||
    userRole === 'manager' || roleFromProfile === 'manager' ||
    roleFromProfile === 'quanly' || userEmail.includes('quanly') ||
    userRole.includes('approver') || roleFromProfile.includes('approver') ||
    roleFromProfile.includes('quản lý') || roleFromProfile.includes('quan ly');
  const isAdmin = isManagerOrAdmin;
  const isFaculty = userRole === 'faculty' || userRole === 'teacher' || userRole === 'lecturer' || roleFromProfile === 'faculty' || userEmail.includes('giangvien');
  const isStaff = userRole === 'staff' || userRole === 'employee' || roleFromProfile === 'staff' || userEmail.includes('nhanvien');
  const isStaffOrFaculty = isFaculty || isStaff || isAdmin;
  const isStudent = !isStaffOrFaculty;

  // 4. Chế độ Tiếp nhận Đặt phòng trực tiếp tại quầy dành riêng cho Admin
  const [isWalkInBooking, setIsWalkInBooking] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  // Giá trị thông tin tài khoản chuẩn hóa (fallback bảo đảm không bao giờ rỗng)
  const fallbackDept = isFaculty
    ? 'Khoa Công nghệ thông tin và Bán dẫn'
    : isStaff
      ? 'Phòng Quản lý Đào tạo & Cơ sở vật chất TBD'
      : isAdmin
        ? 'Phòng Quản trị thiết bị & Ban Quản trị'
        : 'Khoa Công nghệ thông tin và Bán dẫn';

  const fallbackName = isFaculty
    ? 'TS. Trần Văn Nam'
    : isStaff
      ? 'ThS. Nguyễn Văn Đức'
      : isAdmin
        ? 'Ban Quản trị Cơ sở vật chất'
        : 'Nguyễn Văn Hải';

  const fallbackPhone = isFaculty
    ? '0912345678'
    : isStaff
      ? '02583727148'
      : isAdmin
        ? '02583727147'
        : '0939393939';

  const effectiveDept = normalizeDepartmentName(activeProfile?.department?.trim() || fallbackDept);
  const effectiveName = activeProfile?.fullName?.trim() || fallbackName;
  const effectivePhone = activeProfile?.phoneNumber?.trim() || fallbackPhone;

  // Khóa cố định ô Họ tên & Khoa/Bộ môn nếu là tài khoản Giảng viên, Sinh viên, Cán bộ (không phải Admin chế độ Đặt hộ)
  const isNameLocked = !isAdmin || !isWalkInBooking;
  const isDeptLocked = !isAdmin || !isWalkInBooking;

  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const roomIdParam = searchParams.get('roomId')
  
  const [form] = Form.useForm<SubmitFormValues>()
  const queryClient = useQueryClient()
  const { message, modal } = App.useApp()

  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs().startOf('day'))
  const [startTime, setStartTime] = useState<string | null>(null)
  const [endTime, setEndTime] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // 3. Tự động điền Bước 3 Trang Đặt Phòng từ thông tin tài khoản
  useEffect(() => {
    if (!isWalkInBooking) {
      form.setFieldsValue({
        department: effectiveDept,
        personName: effectiveName,
        phoneNumber: form.getFieldValue('phoneNumber') || effectivePhone,
      });
    }
  }, [effectiveDept, effectiveName, effectivePhone, isWalkInBooking, form]);

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






  const selectedRoomId = Form.useWatch('roomId', form)
  const participantCount = Form.useWatch('participantCount', form)

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: ({ signal }) => fetchRooms(signal),
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
    refetchOnWindowFocus: false,
  })

  const {
    data: bookingSettings,
    isError: isSettingsError,
    refetch: refetchSettings
  } = useBookingSettings()
  
  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async ({ signal }) => {
      const response = await http.get<EquipmentItem[]>('/api/equipments', { signal })
      if (Array.isArray(response.data)) {
        return response.data
      }
      return []
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => shouldRetryQuery(failureCount, error),
  })

  const { startDateUtc, endDateUtc } = useMemo(() => {
    const startVN = toVN(selectedDate).startOf('day')
    const endVN = startVN.add(1, 'day')
    return {
      startDateUtc: startVN.toISOString(),
      endDateUtc: endVN.toISOString(),
    }
  }, [selectedDate])

  const bookingsQueryKey = useMemo(() => [
    'booking-page-schedule',
    userEmail || 'guest',
    userRole || 'student',
    startDateUtc,
    endDateUtc,
    selectedRoomId ?? 'no-room',
  ], [userEmail, userRole, startDateUtc, endDateUtc, selectedRoomId])

  const bookingsQuery = useQuery({ 
    queryKey: bookingsQueryKey, 
    queryFn: async ({ signal }) => {
      const params: Record<string, string | number> = {
        startDate: startDateUtc,
        endDate: endDateUtc,
      }
      if (selectedRoomId) {
        params.roomId = selectedRoomId
      }
      const response = await http.get('/api/bookings', {
        params,
        signal,
      })
      let list: Booking[] = []
      if (Array.isArray(response.data)) {
        list = response.data
      } else if (response.data && Array.isArray((response.data as any).data)) {
        list = (response.data as any).data
      }

      return list.map(b => ({
        ...b,
        department: normalizeDepartmentName(b.department)
      }))
    },
    staleTime: 10 * 1000,
    retry: (failureCount, error: any) => shouldRetryQuery(failureCount, error),
    refetchOnWindowFocus: true,
  })

  const isScheduleFetching = bookingsQuery.isLoading || (bookingsQuery.isFetching && !bookingsQuery.data)

  const isServerDataReady =
    !roomsQuery.isLoading &&
    !roomsQuery.isError &&
    !isScheduleFetching &&
    !bookingsQuery.isError &&
    !equipmentsQuery.isLoading &&
    !equipmentsQuery.isError &&
    !isSettingsError &&
    !!bookingSettings

  const hasServerDataError =
    roomsQuery.isError || bookingsQuery.isError || equipmentsQuery.isError || isSettingsError

  const isSubmittingRef = useRef(false)
  const [isSubmissionUncertain, setIsSubmissionUncertain] = useState(false)

  const rooms = getOfficialRooms(roomsQuery.data || [])
  
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
    if (!bookingSettings || !selectedRoom || !startTime || !endTime) return []
    const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
    if (et.isSameOrBefore(st)) return []

    return validateBookingAgainstSettings({
      bookingDate: selectedDate,
      startTime: st,
      endTime: et,
      roomId: selectedRoom.id,
      roomType: (selectedRoom as any)?._displayType || selectedRoom.roomType,
      settings: bookingSettings,
      userRole: userRole,
      isFaculty: isFaculty || isStaff,
      isAdmin: isAdmin,
    })
  }, [bookingSettings, selectedRoom, selectedDate, startTime, endTime, userRole, isFaculty, isStaff, isAdmin])

  const userMaxAdvanceDays = useMemo(() => {
    if (!bookingSettings) return 7
    if (isFaculty || isStaff || isAdmin) {
      return bookingSettings.facultyMaxAdvanceDays ?? 30
    }
    return bookingSettings.studentMaxAdvanceDays ?? 7
  }, [bookingSettings, isFaculty, isStaff, isAdmin])

  const userMaxHoursPerBooking = useMemo(() => {
    if (!bookingSettings) return 3
    if (isFaculty || isStaff || isAdmin) {
      return bookingSettings.facultyMaxHoursPerBooking ?? 6
    }
    return bookingSettings.studentMaxHoursPerBooking ?? 3
  }, [bookingSettings, isFaculty, isStaff, isAdmin])

  const isDateDisabled = (current: dayjs.Dayjs) => {
    if (!current) return false
    if (!bookingSettings) return false
    const today = toVN().startOf('day')
    const cur = toVN(current).startOf('day')
    if (cur.isBefore(today)) return true
    if (cur.diff(today, 'day') > userMaxAdvanceDays) return true
    if (!bookingSettings.workingDays.includes(cur.day())) return true
    return false
  }

  const department = Form.useWatch('department', form)
  const personName = Form.useWatch('personName', form)
  const phoneNumber = Form.useWatch('phoneNumber', form)
  const purpose = Form.useWatch('purpose', form)
  const requestedEquipments = Form.useWatch('requestedEquipments', form)
  const notes = Form.useWatch('notes', form)
  const agreedToRules = Form.useWatch('agreedToRules', form)
  const specialRequestReason = Form.useWatch('specialRequestReason', form)

  const handleGoToStep2 = async () => {
    if (hasServerDataError || !isServerDataReady) {
      message.error('Không thể kết nối với máy chủ. Vui lòng thử lại sau.')
      return
    }
    try {
      await form.validateFields(['roomId', 'date'])
      if (!selectedRoom) {
        message.warning('Vui lòng chọn phòng học trước khi tiếp tục!')
        return
      }
      if (isStudent && isRoomRestrictedForStudent(selectedRoom)) {
        message.error(`Tài khoản Sinh viên không được phép đặt phòng ${selectedRoom.name} (${(selectedRoom as any)._displayType || selectedRoom.roomType}) theo quy định của Nhà trường.`)
        return
      }
      if (isDateDisabled(selectedDate)) {
        message.error('Ngày đã chọn không hợp lệ theo quy định (ngày nghỉ hoặc vượt quá số ngày đặt trước).')
        return
      }
      setCurrentStep(1)
      scrollToTop()
    } catch {
      message.error('Vui lòng chọn đầy đủ phòng và ngày sử dụng!')
    }
  }

  const handleGoToStep3 = async () => {
    if (hasServerDataError || !isServerDataReady) {
      message.error('Không thể kết nối với máy chủ. Vui lòng thử lại sau.')
      return
    }
    if (!startTime || !endTime) {
      message.warning('Vui lòng chọn đầy đủ giờ bắt đầu và giờ kết thúc trên lưới!')
      return
    }
    const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
    const hours = et.diff(st, 'hour', true)
    if (hours < 1.0) {
      message.error(`Thời lượng mượn phòng tối thiểu là 1 giờ (hiện tại chọn ${Math.round(hours * 60)} phút)!`)
      return
    }
    if (limitViolations.length > 0) {
      message.error('Khung giờ bạn chọn không đáp ứng quy định đặt phòng của Nhà trường. Vui lòng điều chỉnh lại!')
      return
    }
    if (!isWalkInBooking) {
      form.setFieldsValue({
        department: effectiveDept,
        personName: effectiveName,
        phoneNumber: form.getFieldValue('phoneNumber') || effectivePhone,
      });
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

  // Generated slots from dynamic openTime to closeTime from API settings
  const openTime = bookingSettings?.openTime || '07:00'
  const closeTime = bookingSettings?.closeTime || '20:00'

  const slots = useMemo(() => {
    const baseSlots = generateOperatingSlots(openTime, closeTime, 30)
    if (closeTime && !baseSlots.includes(closeTime)) {
      return [...baseSlots, closeTime]
    }
    return baseSlots
  }, [openTime, closeTime])

  const getSlotStatus = (slot: string) => {
    if (!selectedRoom || !isServerDataReady) return 'disabled'
    const now = dayjs()
    const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
    
    // Nếu là ngày hôm nay và thời gian bắt đầu của slot đã qua
    if (selectedDate.isSame(now, 'day') && slotTime.isBefore(now)) return 'past'
    // Hoặc ngày trong quá khứ
    if (selectedDate.isBefore(now.startOf('day'))) return 'past'
    
    if (String(selectedRoom.status) !== '0' && selectedRoom.status !== 'Active') return 'inactive'

    // Check closed / maintenance periods
    if (bookingSettings?.closedPeriods && bookingSettings.closedPeriods.length > 0) {
      const slotStart = slotTime
      const slotEnd = slot === closeTime ? slotTime : slotTime.add(30, 'minute')
      const closedHit = checkClosedPeriodOverlap(selectedRoom.id, slotStart, slotEnd, bookingSettings.closedPeriods)
      if (closedHit) return 'maintenance'
    }

    // 1. Kiểm tra trạng thái đang chọn (Selected range: start, end, in-between)
    if (startTime) {
      if (slot === startTime) {
        return 'start'
      }
      if (endTime) {
        if (slot === endTime) {
          return 'end'
        }
        const st = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`)
        const et = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`)
        if (slotTime.isAfter(st) && slotTime.isBefore(et)) {
          return 'in-between'
        }
      }
    }

    // 2. Ô mốc đóng cửa (closeTime, ví dụ 20:00) nếu chưa chọn làm endTime
    if (slot === closeTime) {
      return 'close-time'
    }

    // 3. Kiểm tra xem ô này có trùng lịch đã đặt hoặc chờ duyệt không
    const bookings = bookingsQuery.data || []
    const roomBookings = bookings.filter(b => b.roomId === selectedRoom.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))

    const blockEnd = slotTime.add(30, 'minute')
    for (const b of roomBookings) {
      const bStart = dayjs(b.startTime)
      const bEnd = dayjs(b.endTime)
      if (slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)) {
        if (String(b.status) === 'Pending' || String(b.status) === 'PendingSpecial' || String(b.status) === '0') {
          return 'pending'
        }
        return 'approved'
      }
    }

    return 'available'
  }

  const handleSlotClick = (slot: string) => {
    if (isScheduleFetching || !isServerDataReady || hasServerDataError || !bookingSettings) {
      message.warning('Dữ liệu lịch phòng hoặc quy định chưa tải xong. Vui lòng đợi trong giây lát.')
      return
    }

    const clickedTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
    const curStart = startTime ? dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`) : null
    const isPickingEndTime = curStart ? clickedTime.isAfter(curStart) : false

    // Helper kiểm tra khoảng thời gian có bị vướng lịch hoặc bảo trì không
    const checkRangeHasConflict = (rangeStart: dayjs.Dayjs, rangeEnd: dayjs.Dayjs) => {
      const bookings = bookingsQuery.data || []
      const roomBookings = bookings.filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))
      for (const b of roomBookings) {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        if (rangeStart.isBefore(bEnd) && rangeEnd.isAfter(bStart)) {
          return true
        }
      }
      if (bookingSettings?.closedPeriods) {
        const closedHit = checkClosedPeriodOverlap(selectedRoom?.id, rangeStart, rangeEnd, bookingSettings.closedPeriods)
        if (closedHit) return true
      }
      return false
    }

    const status = getSlotStatus(slot)
    if (status === 'disabled') {
      return
    }
    if (status === 'past') {
      message.warning('Khung giờ này đã qua, vui lòng chọn khung giờ khác trong tương lai.')
      return
    }
    if (status === 'inactive') {
      message.warning('Phòng hiện đang không hoạt động.')
      return
    }

    // 1. NẾU ĐANG CHỌN / CẬP NHẬT GIỜ KẾT THÚC (bấm một ô sau startTime):
    if (isPickingEndTime && curStart) {
      // Bấm lại chính ô endTime hiện tại -> Hủy endTime để chọn lại
      if (slot === endTime) {
        setEndTime(null)
        form.setFieldsValue({ endTime: undefined })
        message.info('Đã hủy giờ kết thúc. Vui lòng chọn lại giờ kết thúc mới.')
        return
      }

      if (checkRangeHasConflict(curStart, clickedTime)) {
        message.warning('Khung giờ bạn chọn có chứa khoảng thời gian đã có lịch hoặc bảo trì. Vui lòng chọn giờ kết thúc khác!')
        return
      }

      const hours = clickedTime.diff(curStart, 'hour', true)
      if (hours < 1.0) {
        message.warning(`Thời lượng mượn phòng tối thiểu là 1 giờ (hiện tại chọn ${Math.round(hours * 60)} phút). Vui lòng chọn giờ kết thúc từ ${curStart.add(1, 'hour').format('HH:mm')} trở đi!`)
        return
      }
      if (hours > userMaxHoursPerBooking) {
        message.warning(`Thời lượng chọn (${hours.toFixed(1)} giờ) vượt quá giới hạn tối đa cho phép (${userMaxHoursPerBooking} giờ). Vui lòng chọn giờ kết thúc sớm hơn!`)
        return
      }

      setEndTime(slot)
      form.setFieldsValue({ endTime: slot })
      message.success(`Đã chọn khung giờ: ${startTime} - ${slot} (${hours.toFixed(1)} giờ)`)
      return
    }

    // 2. BẤM LẠI CHÍNH Ô START TIME -> Hủy toàn bộ lựa chọn (reset)
    if (startTime && slot === startTime) {
      handleResetTime()
      return
    }

    // 3. CÁC TRƯỜNG HỢP CHỌN HOẶC ĐỔI GIỜ BẮT ĐẦU:
    // Không cho phép bắt đầu vào giờ đóng cửa
    if (slot === closeTime) {
      message.warning({
        content: `Giảng đường đóng cửa lúc ${closeTime}. Không thể chọn giờ này để bắt đầu mượn. Vui lòng chọn khung giờ bắt đầu sớm hơn!`,
        key: 'cannot-start-at-close-time',
        duration: 3.5,
      })
      return
    }

    if (status === 'maintenance') {
      const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
      const slotEnd = slotTime.add(30, 'minute')
      const closedHit = checkClosedPeriodOverlap(selectedRoom?.id, slotTime, slotEnd, bookingSettings?.closedPeriods)
      message.warning({
        content: `Khung giờ ${slot} thuộc khoảng thời gian tạm ngưng hoạt động / bảo trì (${closedHit?.reason || 'Bảo trì'}). Vui lòng chọn khung giờ khác!`,
        duration: 3.5,
      })
      return
    }

    if (status === 'pending' || status === 'approved') {
      const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
      const blockEnd = slotTime.add(30, 'minute')
      const bookings = bookingsQuery.data || []
      const roomBookings = bookings.filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))
      const hit = roomBookings.find(b => {
        const bStart = dayjs(b.startTime)
        const bEnd = dayjs(b.endTime)
        return slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)
      })
      if (hit && (hit.isSchoolOverride || hit.IsSchoolOverride)) {
        message.warning({
          content: `Khung giờ ${slot} - ${blockEnd.format('HH:mm')} đã có Thời khóa biểu chính khóa. Vui lòng chọn khung giờ còn trống.`,
          key: 'school-schedule-time',
          duration: 3,
        })
      } else if (status === 'pending') {
        message.warning({
          content: `Khung giờ ${slot} - ${blockEnd.format('HH:mm')} đang chờ duyệt. Vui lòng chọn khung giờ còn trống.`,
          key: 'slot-pending',
          duration: 3,
        })
      } else {
        message.warning({
          content: `Khung giờ ${slot} - ${blockEnd.format('HH:mm')} đã có lịch mượn trước. Vui lòng chọn khung giờ còn trống.`,
          key: 'slot-booked',
          duration: 3,
        })
      }
      return
    }

    // Chọn làm startTime mới
    setStartTime(slot)
    setEndTime(null)
    form.setFieldsValue({ startTime: slot, endTime: undefined })
    message.info(`Đã chọn giờ bắt đầu: ${slot}. Vui lòng bấm chọn tiếp ô giờ kết thúc.`)
  }

  const handleResetTime = () => {
    setStartTime(null)
    setEndTime(null)
    form.setFieldsValue({ startTime: undefined, endTime: undefined })
  }

  const handlePrevDay = () => {
    const prev = selectedDate.subtract(1, 'day')
    if (isDateDisabled(prev)) {
      message.warning('Ngày trước đó không nằm trong khoảng thời gian hợp lệ hoặc đã qua.')
      return
    }
    setSelectedDate(prev)
    form.setFieldValue('date', prev)
    handleResetTime()
  }

  const handleNextDay = () => {
    const next = selectedDate.add(1, 'day')
    if (isDateDisabled(next)) {
      message.warning('Ngày tiếp theo không nằm trong khoảng thời gian hợp lệ hoặc vượt quá số ngày đặt trước.')
      return
    }
    setSelectedDate(next)
    form.setFieldValue('date', next)
    handleResetTime()
  }

  const renderSelectionBanner = () => {
    if (!startTime) {
      return (
        <Alert
          type="info"
          showIcon={false}
          style={{ borderRadius: 8, background: '#f0f9ff', borderColor: '#bae6fd', marginBottom: 16 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0369a1', fontWeight: 500, fontSize: 13.5 }}>
              <span>Vui lòng bấm chọn một ô khung giờ trống để bắt đầu mượn.</span>
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
          style={{ borderRadius: 8, background: '#fffbeb', borderColor: '#fde68a', marginBottom: 16 }}
          title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ color: '#b45309', fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>Đã chọn giờ bắt đầu:</span>
                <Tag color="orange" style={{ fontSize: 13, fontWeight: 700, margin: 0, padding: '2px 8px' }}>
                  {startTime}
                </Tag>
                <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>
                  👉 Vui lòng bấm chọn tiếp <strong>ô giờ kết thúc</strong> mượn phòng (tối thiểu 1 giờ).
                </span>
              </div>
              <Button 
                size="small" 
                onClick={handleResetTime} 
                icon={<ReloadOutlined />}
                style={{ fontSize: 12, borderColor: '#d97706', color: '#b45309', fontWeight: 600 }}
              >
                Hủy chọn
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button 
                size="small" 
                onClick={handleResetTime} 
                icon={<ReloadOutlined />}
                style={{ fontSize: 12, borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }}
              >
                Bấm để chọn lại
              </Button>
            </div>
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
      const response = await http.post<Booking>('/api/bookings', payload)
      return response.data
    },
    retry: false, // Không tự động thử lại POST tạo đơn đặt phòng
  })

  const submitBooking = (values: SubmitFormValues) => {
    // Chặn gửi khi dữ liệu cần thiết đang tải, tải lỗi hoặc chưa có
    if (isScheduleFetching || !isServerDataReady || hasServerDataError || !selectedRoom || !bookingSettings) {
      message.error('Dữ liệu phòng, lịch hoặc quy định chưa sẵn sàng. Vui lòng kiểm tra lại kết nối.')
      return
    }

    // Chặn gửi lại trong trạng thái chưa xác nhận
    if (isSubmissionUncertain) {
      message.warning('Chưa xác nhận được kết quả đặt phòng. Vui lòng kiểm tra Lịch sử đặt trước khi gửi lại.')
      return
    }

    // Chặn bấm gửi nhiều lần bằng khóa đồng bộ và trạng thái loading
    if (isSubmittingRef.current || createMutation.isPending) {
      return
    }
    isSubmittingRef.current = true

    if (!isStaffOrFaculty && !values.agreedToRules) {
      isSubmittingRef.current = false
      message.error('Vui lòng đồng ý với nội quy sử dụng phòng.');
      return;
    }
    if (!isAdmin && checkLimitQuery.data && !checkLimitQuery.data.canBook) {
      isSubmittingRef.current = false
      message.error('Vượt quá giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }
    if (!isAdmin && checkLimitQuery.error) {
      isSubmittingRef.current = false
      message.error('Không thể kiểm tra giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }

    if (!selectedRoom) {
      isSubmittingRef.current = false
      return
    }
    if (isStudent && isRoomRestrictedForStudent(selectedRoom)) {
      isSubmittingRef.current = false
      message.error(`Tài khoản Sinh viên không được phép đặt phòng ${selectedRoom.name} (${(selectedRoom as any)._displayType || selectedRoom.roomType}) theo quy định của Nhà trường.`)
      return
    }
    if (values.participantCount > selectedRoom.capacity) {
      isSubmittingRef.current = false
      message.error(`Số lượng người (${values.participantCount}) vượt quá sức chứa tối đa của phòng ${selectedRoom.name} (${selectedRoom.capacity} người). Vui lòng điều chỉnh lại.`);
      return;
    }
    if (!startTime || !endTime) {
      isSubmittingRef.current = false
      message.error('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc trên bảng.')
      return
    }

    const st = dayjs(`${values.date.format('YYYY-MM-DD')} ${startTime}`)
    const et = dayjs(`${values.date.format('YYYY-MM-DD')} ${endTime}`)

    if (et.isSameOrBefore(st)) {
      isSubmittingRef.current = false
      message.error('Giờ kết thúc phải lớn hơn giờ bắt đầu.')
      return
    }

    const violations = validateBookingAgainstSettings({
      bookingDate: values.date,
      startTime: st,
      endTime: et,
      roomId: selectedRoom.id,
      roomType: (selectedRoom as any)?._displayType || selectedRoom.roomType,
      settings: bookingSettings,
      userRole: userRole,
      isFaculty: isFaculty || isStaff,
      isAdmin: isAdmin,
    })

    if (violations.length > 0) {
      isSubmittingRef.current = false
      Modal.error({
        title: 'Yêu cầu không thể thực hiện do vi phạm quy định',
        content: (
          <div>
            <p>Khung giờ hoặc phòng bạn chọn không đáp ứng quy định của Nhà trường:</p>
            <ul style={{ paddingLeft: 18, color: '#dc2626' }}>
              {violations.map((v, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>{v}</li>
              ))}
            </ul>
          </div>
        )
      })
      return
    }

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
      department: normalizeDepartmentName(values.department),
      personInCharge: personInChargeFormatted,
      isSpecialRequest: false,
      specialRequestReason: undefined,
      agreedToRules: isStaffOrFaculty ? true : values.agreedToRules,
      notes: finalNotes,
      status: finalStatus,
      approvedBy: finalApprovedBy,
      approvedAt: finalApprovedAt,
    }, {
      onSuccess: (createdBooking: any) => {
        isSubmittingRef.current = false
        setIsSubmissionUncertain(false)
        triggerConfetti()
        const realStatus = createdBooking?.status != null ? String(createdBooking.status) : finalStatus
        setSuccessBookingInfo({
          roomName: createdBooking?.roomName || selectedRoom.name || 'Phòng học',
          dateStr: values.date.format('DD/MM/YYYY'),
          timeRange: `${startTime} - ${endTime}`,
          purpose: createdBooking?.purpose || values.purpose,
          participantCount: createdBooking?.participantCount || values.participantCount,
          status: realStatus
        })
        setSuccessModalVisible(true)
        const isApproved = realStatus === '1' || realStatus === 'Approved'
        if (isAdmin) {
          if (isWalkInBooking) {
            message.success(`Đã tiếp nhận và duyệt đặt phòng trực tiếp tại quầy cho ${values.personName}! Lịch phòng đã được cập nhật.`)
          } else {
            message.success("Đặt phòng và phê duyệt trực tiếp thành công! Lịch phòng đã được cập nhật.")
          }
        } else if (isFaculty) {
          message.success(isApproved ? "Đặt phòng thành công và đã được phê duyệt!" : "Đã gửi yêu cầu đặt phòng giảng dạy! Đơn được ưu tiên xét duyệt.")
        } else if (isStaff) {
          message.success(isApproved ? "Đặt phòng thành công và đã được phê duyệt!" : "Đã gửi yêu cầu đặt phòng làm việc! Đơn được ưu tiên xét duyệt.")
        } else {
          message.success(isApproved ? "Đặt phòng thành công và đã được phê duyệt!" : "Gửi yêu cầu đặt phòng thành công! Vui lòng chờ phê duyệt.")
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
        queryClient.invalidateQueries({ queryKey: ['booking-page-schedule'] })
        queryClient.invalidateQueries({ queryKey: ['calendar-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        queryClient.invalidateQueries({ queryKey: ['rooms'] })
      },
      onError: (err: any) => {
        isSubmittingRef.current = false
        const status = err?.response?.status
        const isTimeoutOrAborted = err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout')
        const isNetworkError = !err?.response || err?.code === 'ERR_NETWORK' || !window.navigator.onLine
        const isServerAmbiguous = status && [500, 502, 503, 504].includes(status)

        // Nếu POST mất kết nối, timeout hoặc lỗi máy chủ khiến kết quả lưu không chắc chắn
        if (isTimeoutOrAborted || isNetworkError || isServerAmbiguous) {
          setIsSubmissionUncertain(true)
          modal.warning({
            title: 'Chưa xác nhận được kết quả đặt phòng. Vui lòng kiểm tra Lịch sử đặt trước khi gửi lại.',
            content: (
              <div>
                <p style={{ color: '#475569', fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
                  Kết nối tới máy chủ bị gián đoạn hoặc phản hồi bị quá thời gian trong lúc xử lý yêu cầu lưu đơn.
                  Hệ thống không thể xác định đơn đặt phòng đã được ghi nhận vào cơ sở dữ liệu hay chưa.
                </p>
                <p style={{ color: '#0f172a', fontWeight: 600, fontSize: 13.5, marginBottom: 4 }}>
                  Để tránh bị trùng lặp đơn:
                </p>
                <ol style={{ paddingLeft: 18, color: '#334155', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                  <li>Vui lòng kiểm tra trang <strong>Lịch sử đặt</strong> để xem đơn đã xuất hiện hay chưa.</li>
                  <li>Nội dung biểu mẫu của bạn vẫn được giữ nguyên đầy đủ.</li>
                  <li>Chức năng gửi lại tạm thời được khóa để bảo vệ dữ liệu.</li>
                </ol>
              </div>
            ),
            okText: 'Kiểm tra Lịch sử đặt',
            cancelText: 'Đóng và giữ đơn',
            okButtonProps: { style: { background: '#0d2e5c' } },
            onOk: () => {
              navigate(isAdmin ? '/admin?tab=bookings' : '/booking-history')
            }
          })
          return
        }

        // Nếu backend từ chối do trùng lịch/quy định (400, 409, 422...)
        setIsSubmissionUncertain(false)
        const backendError =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          (typeof err?.response?.data === 'string' ? err.response.data : null) ||
          err?.message ||
          'Yêu cầu đặt phòng bị từ chối do vi phạm quy định hoặc trùng lịch.'

        message.error('Gửi yêu cầu thất bại: ' + backendError)

        // Tải lại dữ liệu liên quan
        bookingsQuery.refetch()
        checkLimitQuery.refetch()
        refetchSettings()
      }
    })
  }

  const roomEquipments = useMemo(() => {
    if (!selectedRoom) return []
    return getRoomAvailableEquipmentList(selectedRoom, equipmentsQuery.data || [])
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
            <Card style={{ borderRadius: 12, border: '1.5px solid #94a3b8', padding: 24 }}>
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

  if (roomsQuery.isError) {
    const err = roomsQuery.error as any
    const status = err?.response?.status
    const is401 = status === 401
    const is403 = status === 403

    return (
      <main className="app-content" style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <Alert
          type={is403 ? 'warning' : 'error'}
          showIcon
          title={
            is401
              ? 'Hết phiên đăng nhập'
              : is403
                ? 'Không đủ quyền'
                : 'Không thể tải lịch phòng. Vui lòng thử lại.'
          }
          description={
            is401
              ? 'Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục sử dụng hệ thống.'
              : is403
                ? 'Tài khoản của bạn không có đủ quyền xem dữ liệu phòng học.'
                : (err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Không thể kết nối máy chủ để tải danh sách phòng. Vui lòng kiểm tra lại kết nối mạng.')
          }
          action={
            is401 ? (
              <Button danger type="primary" onClick={() => navigate('/login?redirect=/bookings')}>
                Đăng nhập lại
              </Button>
            ) : (
              <Button type="primary" onClick={() => roomsQuery.refetch()} style={{ background: '#0d2e5c' }}>
                Thử lại
              </Button>
            )
          }
          style={{ borderRadius: 12, padding: 24 }}
        />
      </main>
    )
  }

  return (
    <main className="app-content" style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
      <div ref={containerRef} className="page-heading" style={{ marginBottom: 28, textAlign: 'center' }}>
        <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
          Đặt Phòng Học & Thiết Bị
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: 14.5, marginTop: 6, marginBottom: 8 }}>
          Thực hiện đặt phòng học và mượn thiết bị qua quy trình 4 bước chuẩn hóa
        </Typography.Paragraph>
        <Button 
          type="link" 
          onClick={() => setIsPolicyModalOpen(true)}
          style={{ 
            color: '#0369a1', 
            fontWeight: 600,
            fontSize: 13.5,
            padding: 0,
            textDecoration: 'underline'
          }}
        >
          Nội quy & Chính sách Đặt phòng
        </Button>
      </div>

      {/* Modal Nội quy & Chính sách Đặt phòng */}
      <Modal
        title={
          <div style={{ color: '#0d2e5c', fontWeight: 700, fontSize: 16 }}>
            Nội quy & Chính sách Đặt phòng
          </div>
        }
        open={isPolicyModalOpen}
        onOk={() => setIsPolicyModalOpen(false)}
        onCancel={() => setIsPolicyModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsPolicyModalOpen(false)} style={{ background: '#0d2e5c' }}>
            Xác nhận đã đọc
          </Button>
        ]}
        width={760}
        destroyOnClose
      >
        <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#334155' }}>
          {/* Tóm tắt quy chuẩn vận hành */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#f8fafc', border: '1.5px solid #94a3b8', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                Thời gian vận hành giảng đường
              </div>
              <div style={{ color: '#475569' }}><strong>07:00 – 20:00</strong> (Từ Thứ Hai đến Thứ Bảy). Hệ thống tự động khóa đăng ký ngoài khung giờ này.</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1.5px solid #94a3b8', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                Xác nhận hiện diện (Check-in)
              </div>
              <div style={{ color: '#475569' }}>Thực hiện trong vòng <strong>15 phút</strong> đầu buổi. Quá thời hạn, hệ thống tự động giải phóng phòng.</div>
            </div>
            <div style={{ background: '#f8fafc', border: '1.5px solid #94a3b8', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                Thời hạn thông báo hủy lịch
              </div>
              <div style={{ color: '#475569' }}>Sinh viên: trước ít nhất <strong>02 giờ</strong>.<br />Giảng viên: trước ít nhất <strong>01 giờ</strong>.</div>
            </div>
          </div>

          {/* Bảng phân quyền học thuật */}
          <Typography.Title level={5} style={{ margin: '14px 0 8px', color: '#0d2e5c', fontSize: 14 }}>
            1. Định mức và Phân quyền Đăng ký Sử dụng Giảng đường
          </Typography.Title>
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, border: '1.5px solid #94a3b8' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', color: '#0f172a' }}>
                  <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderBottom: '2px solid #64748b', textAlign: 'left' }}>Nội dung quy định</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderBottom: '2px solid #64748b', textAlign: 'left', color: '#0369a1' }}>Sinh viên</th>
                  <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', borderBottom: '2px solid #64748b', textAlign: 'left', color: '#047857' }}>Giảng viên & Cán bộ, Nhân viên</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Thời hạn đăng ký trước tối đa</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Tối đa <strong>07 ngày</strong></td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Tối đa <strong>30 ngày</strong></td>
                </tr>
                <tr style={{ background: '#fcfcfc' }}>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Thời hạn đăng ký trước tối thiểu</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Ít nhất <strong>01 giờ</strong> trước buổi sử dụng</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Ít nhất <strong>30 phút</strong> trước buổi sử dụng</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Thời lượng đăng ký tối đa</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Tối đa <strong>03 giờ / lượt</strong> (định mức 06 giờ / tuần)</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Tối đa <strong>06 giờ / lượt</strong></td>
                </tr>
                <tr style={{ background: '#fcfcfc' }}>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Phạm vi giảng đường áp dụng</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Giảng đường tiêu chuẩn, phòng học nhóm (Không áp dụng đối với Hội trường, Phòng Lab và Cinema)</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Toàn quyền đăng ký giảng đường tiêu chuẩn, phòng thực hành Lab, Cinema; Hội trường cần Ban Quản lý CSVC phê duyệt</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>Quy trình phê duyệt</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Cần Ban Quản lý CSVC phê duyệt trước khi sử dụng (Xét duyệt theo thứ tự tiếp nhận)</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Cần Ban Quản lý CSVC phê duyệt trước khi sử dụng (Ưu tiên xét duyệt)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Quy chế chống giữ chỗ không sử dụng */}
          <Typography.Title level={5} style={{ margin: '14px 0 8px', color: '#0d2e5c', fontSize: 14 }}>
            2. Quy chế Chống giữ chỗ không sử dụng & Xử lý vi phạm
          </Typography.Title>
          <ul style={{ paddingLeft: 20, margin: '0 0 16px', color: '#475569' }}>
            <li><strong>Tự động thu hồi giảng đường:</strong> Người đăng ký có trách nhiệm xác nhận hiện diện (Check-in) trong vòng 15 phút đầu tiên. Quá thời hạn này, hệ thống tự động hủy đơn và chuyển quyền sử dụng cho cá nhân, tập thể khác.</li>
            <li><strong>Xử lý vi phạm vắng mặt:</strong> Trường hợp đăng ký nhưng không sử dụng và không thông báo hủy quá 03 lần trong vòng 30 ngày, hệ thống sẽ tạm đình chỉ quyền đăng ký sử dụng phòng học trong thời hạn 14 ngày.</li>
          </ul>

          {/* Trách nhiệm bảo quản CSVC */}
          <Typography.Title level={5} style={{ margin: '14px 0 8px', color: '#0d2e5c', fontSize: 14 }}>
            3. Trách nhiệm Bảo quản Cơ sở vật chất và An toàn Thiết bị
          </Typography.Title>
          <ul style={{ paddingLeft: 20, margin: 0, color: '#475569' }}>
            <li><strong>Kiểm tra trang thiết bị:</strong> Trong vòng 10 phút đầu khi tiếp nhận phòng, nếu phát hiện hư hại về âm thanh, máy chiếu, điều hòa hoặc thiết bị điện, người sử dụng cần thực hiện Báo cáo sự cố trên hệ thống để Ban Quản lý CSVC ghi nhận và miễn trừ trách nhiệm.</li>
            <li><strong>Bàn giao sau buổi học:</strong> Tắt toàn bộ hệ thống máy chiếu, điều hòa nhiệt độ và thiết bị chiếu sáng; sắp xếp lại bàn ghế theo sơ đồ chuẩn trước khi rời khỏi giảng đường.</li>
          </ul>
        </div>
      </Modal>

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
            initialValues={{ 
              date: selectedDate,
              department: isWalkInBooking ? undefined : effectiveDept,
              personName: isWalkInBooking ? undefined : effectiveName,
              phoneNumber: isWalkInBooking ? undefined : effectivePhone,
            }}
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
                    const roomBookings = (bookingsQuery.data || []).filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))
                    for (const b of roomBookings) {
                      const bStart = dayjs(b.startTime)
                      const bEnd = dayjs(b.endTime)
                      if (st.isBefore(bEnd) && et.isAfter(bStart)) {
                        hasConflict = true
                        break
                      }
                    }
                    if (hasConflict) {
                      message.error('Khung giờ này đã có người khác gửi yêu cầu chờ duyệt hoặc đã đặt, vui lòng chọn lại!')
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
                    const roomBookings = (bookingsQuery.data || []).filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))
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

                {hasServerDataError && (
                  <Alert
                    type="error"
                    showIcon
                    title={
                      (bookingsQuery.error || roomsQuery.error || equipmentsQuery.error)
                        ? formatApiError(bookingsQuery.error || roomsQuery.error || equipmentsQuery.error)
                        : "Không thể kết nối với máy chủ"
                    }
                    description={
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                        <span>Dữ liệu phòng, thiết bị hoặc quy định chưa thể tải từ máy chủ. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau.</span>
                        <Button
                          size="small"
                          danger
                          onClick={() => {
                            roomsQuery.refetch()
                            bookingsQuery.refetch()
                            equipmentsQuery.refetch()
                            refetchSettings()
                          }}
                          icon={<ReloadOutlined />}
                        >
                          Thử lại
                        </Button>
                      </div>
                    }
                    style={{ marginBottom: 20, borderRadius: 8 }}
                  />
                )}

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
                            disabledDate={isDateDisabled}
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
                          const isRestricted = isStudent && isRoomRestrictedForStudent(r)
                          const displayType = r._displayType || 'Phòng học lý thuyết'
                          return {
                            value: r.id,
                            disabled: isRestricted,
                            label: `Phòng ${cleanName} - ${displayType} - ${r.building} (${r.capacity} chỗ)`
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
                      border: '1.5px solid #94a3b8' 
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                      {selectedRoom.imageUrl ? (
                        <img 
                          src={getStorageImageUrl(selectedRoom.imageUrl)} 
                          alt={selectedRoom.name} 
                          onError={(e) => handleImageFallback(e, selectedRoom.imageUrl || undefined)}
                          style={{ width: 88, height: 68, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #94a3b8' }} 
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
                          {isStudent && isRoomRestrictedForStudent(selectedRoom) && (
                            <Tag color="error" style={{ fontWeight: 700 }}>
                              KHÔNG KHẢ DỤNG CHO SINH VIÊN
                            </Tag>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 6, lineHeight: 1.6 }}>
                          <strong style={{ color: '#1e293b' }}>Thiết bị có sẵn tại phòng:</strong>{' '}
                          <span style={{ color: '#334155' }}>
                            {roomEquipments.length > 0
                              ? roomEquipments.join(', ')
                              : 'Máy chiếu, Điều hòa, Micro'}
                          </span>
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

                {/* Cảnh báo phòng bị hạn chế đối với sinh viên */}
                {selectedRoom && isStudent && isRoomRestrictedForStudent(selectedRoom) && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 16, borderRadius: 8 }}
                    title={<strong style={{ color: '#b91c1c' }}>Phòng không dành cho tài khoản Sinh viên</strong>}
                    description={
                      <span>
                        Theo Quy chế của Nhà trường, phòng <strong>{selectedRoom.name} ({(selectedRoom as any)._displayType || selectedRoom.roomType})</strong> chỉ dành riêng cho công tác giảng dạy của Giảng viên và sự kiện chuyên môn của Nhà trường. Sinh viên không được phép đăng ký Hội trường, Phòng Lab hoặc Cinema. Vui lòng chọn phòng học lý thuyết hoặc phòng học nhóm khác.
                      </span>
                    }
                  />
                )}

                {/* Nút chuyển bước */}
                <div className="step-navigation-bar" style={{ justifyContent: 'flex-end' }}>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep2}
                    disabled={!selectedRoom || (isStudent && isRoomRestrictedForStudent(selectedRoom))}
                    style={{ 
                      background: (selectedRoom && (!isStudent || !isRoomRestrictedForStudent(selectedRoom))) ? '#0d2e5c' : undefined, 
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
                      disabledDate={isDateDisabled}
                    />
                    <Button 
                      size="small"
                      icon={<RightOutlined />} 
                      onClick={handleNextDay}
                      title="Ngày sau"
                    />
                  </div>
                </div>

                {hasServerDataError ? (
                  (() => {
                    const activeError = (bookingsQuery.error || roomsQuery.error || equipmentsQuery.error || (isSettingsError ? { response: { status: 500 } } : null)) as any
                    const status = activeError?.response?.status
                    const is401 = status === 401
                    const is403 = status === 403

                    return (
                      <Alert
                        type={is403 ? 'warning' : 'error'}
                        showIcon
                        title={
                          is401
                            ? 'Hết phiên đăng nhập'
                            : is403
                              ? 'Không đủ quyền'
                              : formatApiError(activeError)
                        }
                        description={
                          <div>
                            <div style={{ marginBottom: 6, color: '#1e293b' }}>
                              {is401
                                ? 'Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục tải lịch phòng.'
                                : is403
                                  ? 'Tài khoản của bạn không có đủ quyền xem dữ liệu lịch phòng.'
                                  : formatApiError(activeError)}
                            </div>
                            <span style={{ fontSize: 12.5, color: '#64748b' }}>
                              Bảng khung giờ tạm thời không hiển thị để đảm bảo tính chính xác và tránh chọn nhầm phòng khi dữ liệu chưa được xác thực.
                            </span>
                          </div>
                        }
                        action={
                          is401 ? (
                            <Button danger type="primary" onClick={() => navigate('/login?redirect=/bookings')}>
                              Đăng nhập lại
                            </Button>
                          ) : (
                            <Button
                              type="primary"
                              onClick={() => {
                                bookingsQuery.refetch()
                                refetchSettings()
                                roomsQuery.refetch()
                              }}
                              style={{ background: '#0d2e5c' }}
                            >
                              Thử lại
                            </Button>
                          )
                        }
                        style={{ marginBottom: 20, borderRadius: 10, padding: 16 }}
                      />
                    )
                  })()
                ) : (isScheduleFetching || !bookingSettings) ? (
                  <Card style={{ textAlign: 'center', padding: '48px 24px', borderRadius: 12, border: '1.5px solid #94a3b8', marginBottom: 20 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: '#0d2e5c' }}>
                      Đang tải lịch phòng và quy định...
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                      Vui lòng đợi trong giây lát để hệ thống kiểm tra tình trạng phòng của ngày {selectedDate.format('DD/MM/YYYY')}.
                    </Typography.Text>
                  </Card>
                ) : (
                  <>
                    {/* Hiển thị giờ mở/đóng cửa và cảnh báo ngày nghỉ nếu có */}
                    {bookingSettings && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12, fontSize: 13, color: '#475569' }}>
                        <span>
                          Khung giờ vận hành giảng đường: <strong style={{ color: '#0d2e5c' }}>{openTime} - {closeTime}</strong>
                        </span>
                        <span>Đặt trước tối đa: <strong>{userMaxAdvanceDays} ngày</strong> | Thời lượng: <strong>Tối thiểu 1 giờ - Tối đa {userMaxHoursPerBooking} giờ</strong></span>
                      </div>
                    )}

                    {!bookingSettings?.workingDays?.includes(toVN(selectedDate).day()) && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 14, borderRadius: 8 }}
                        title="Ngày không hoạt động theo quy định"
                        description={`Ngày ${selectedDate.format('DD/MM/YYYY')} là ngày nghỉ theo quy định của nhà trường. Vui lòng chọn ngày làm việc khác.`}
                      />
                    )}


                    {/* Bảng chú thích màu sắc trạng thái */}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, marginBottom: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 8, border: '1.5px solid #94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#f8fafc', border: '1.5px solid #94a3b8', borderRadius: 4 }}></div> Còn trống</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#0d2e5c', borderRadius: 4 }}></div> Đang chọn</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#fef08a', border: '1.5px solid #eab308', borderRadius: 4 }}></div> Chờ duyệt</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#86efac', border: '1.5px solid #16a34a', borderRadius: 4 }}></div> Đã đặt / Lịch học</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#fef3c7', border: '1.5px dashed #d97706', borderRadius: 4 }}></div> Tạm ngưng/Bảo trì</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#f8fafc', border: '1.5px dashed #64748b', borderRadius: 4 }}></div> Giờ đóng cửa (Mốc kết thúc)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 14, height: 14, background: '#e2e8f0', border: '1.5px solid #94a3b8', borderRadius: 4 }}></div> Đã qua/Đóng</div>
                    </div>

                    {/* Banner hướng dẫn và thông báo khung giờ đã chọn */}
                    {renderSelectionBanner()}

                    {/* Lưới chọn khung giờ 30 phút */}
                    <div 
                      className="booking-time-slots-grid"
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', 
                        gap: 8,
                        marginBottom: 20
                      }}
                    >
                      {slots.map(slot => {
                        const isCloseSlot = slot === closeTime
                        const status = getSlotStatus(slot)

                        const slotTime = dayjs(`${selectedDate.format('YYYY-MM-DD')} ${slot}`)
                        const blockEnd = slotTime.add(30, 'minute')
                        const bookings = bookingsQuery.data || []
                        const roomBookings = bookings.filter(b => b.roomId === selectedRoom?.id && ['Pending', 'PendingSpecial', 'Approved', 'Using', '0', '1'].includes(String(b.status)))
                        const hit = roomBookings.find(b => {
                          const bStart = dayjs(b.startTime)
                          const bEnd = dayjs(b.endTime)
                          return slotTime.isBefore(bEnd) && blockEnd.isAfter(bStart)
                        })
                        const closedHit = checkClosedPeriodOverlap(selectedRoom?.id, slotTime, blockEnd, bookingSettings?.closedPeriods)

                        let tooltipContent: React.ReactNode = null
                        if (status === 'approved' && hit && (hit.isSchoolOverride || hit.IsSchoolOverride)) {
                          const bStartStr = dayjs(hit.startTime).format('HH:mm')
                          const bEndStr = dayjs(hit.endTime).format('HH:mm')
                          tooltipContent = (
                            <div style={{ padding: '2px 0', maxWidth: 280, fontSize: 12.5, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', fontSize: 12 }}>
                                Thời khóa biểu chính khóa
                              </div>
                              <div style={{ color: '#cbd5e1', marginBottom: 3 }}>
                                Thời gian: <strong>{bStartStr} - {bEndStr}</strong>
                              </div>
                              {hit.purpose && (
                                <div style={{ color: '#e2e8f0', marginBottom: 3, wordBreak: 'break-word' }}>
                                  Môn học: {hit.purpose}
                                </div>
                              )}
                              <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 }}>
                                Khung giờ đã có lịch học, không thể chọn.
                              </div>
                            </div>
                          )
                        } else if (status === 'approved' && hit) {
                          const bStartStr = dayjs(hit.startTime).format('HH:mm')
                          const bEndStr = dayjs(hit.endTime).format('HH:mm')
                          tooltipContent = (
                            <div style={{ padding: '2px 0', maxWidth: 260, fontSize: 12.5, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', fontSize: 12 }}>
                                Đã có lịch mượn phòng
                              </div>
                              <div style={{ color: '#cbd5e1', marginBottom: 3 }}>
                                Thời gian: <strong>{bStartStr} - {bEndStr}</strong>
                              </div>
                              {hit.purpose && (
                                <div style={{ color: '#e2e8f0', marginBottom: 3, wordBreak: 'break-word' }}>
                                  Mục đích: {hit.purpose}
                                </div>
                              )}
                              <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 }}>
                                Khung giờ đã được duyệt, không thể chọn.
                              </div>
                            </div>
                          )
                        } else if (status === 'pending') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', maxWidth: 240, fontSize: 12.5, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', fontSize: 12 }}>
                                Đang chờ duyệt mượn
                              </div>
                              <div style={{ color: '#cbd5e1', marginBottom: 3 }}>
                                Khung giờ: <strong>{slot} - {blockEnd.format('HH:mm')}</strong>
                              </div>
                              <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 }}>
                                Đã có yêu cầu gửi trước, không thể chọn.
                              </div>
                            </div>
                          )
                        } else if (status === 'maintenance') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', maxWidth: 240, fontSize: 12.5, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4, textTransform: 'uppercase', fontSize: 12 }}>
                                Tạm ngưng / Bảo trì
                              </div>
                              <div style={{ color: '#cbd5e1', marginBottom: 3 }}>
                                Khung giờ: <strong>{slot} - {blockEnd.format('HH:mm')}</strong>
                              </div>
                              {closedHit?.reason && (
                                <div style={{ color: '#e2e8f0', marginBottom: 3 }}>
                                  Lý do: {closedHit.reason}
                                </div>
                              )}
                              <div style={{ color: '#94a3b8', fontSize: 11.5, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 4 }}>
                                Phòng tạm ngưng phục vụ trong thời gian này.
                              </div>
                            </div>
                          )
                        } else if (isCloseSlot) {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', maxWidth: 220, fontSize: 12.5, lineHeight: 1.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 3 }}>
                                Mốc {closeTime} (Giờ đóng cửa)
                              </div>
                              <div style={{ color: '#cbd5e1', fontSize: 11.5 }}>
                                {startTime ? 'Nhấp chọn để làm giờ kết thúc mượn phòng' : 'Chỉ dùng làm mốc kết thúc, không thể bắt đầu'}
                              </div>
                            </div>
                          )
                        } else if (status === 'past' || status === 'inactive' || status === 'disabled') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', fontSize: 12 }}>
                              Khung giờ {slot}: {status === 'past' ? 'Đã qua trong ngày' : 'Không khả dụng'}
                            </div>
                          )
                        } else if (status === 'start') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', fontSize: 12.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                                Giờ bắt đầu: {slot}
                              </div>
                              <div style={{ color: '#93c5fd', fontSize: 11.5, marginTop: 2 }}>
                                Nhấp lại để hủy chọn
                              </div>
                            </div>
                          )
                        } else if (status === 'end') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', fontSize: 12.5 }}>
                              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                                Giờ kết thúc: {slot}
                              </div>
                              <div style={{ color: '#93c5fd', fontSize: 11.5, marginTop: 2 }}>
                                Nhấp lại để hủy chọn giờ kết thúc
                              </div>
                            </div>
                          )
                        } else if (status === 'in-between') {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', fontSize: 12 }}>
                              Trong khoảng thời gian mượn: {startTime} - {endTime}
                            </div>
                          )
                        } else {
                          tooltipContent = (
                            <div style={{ padding: '2px 0', fontSize: 12.5 }}>
                              <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                                Khung giờ {slot} - {blockEnd.format('HH:mm')}
                              </div>
                              <div style={{ color: '#86efac', fontSize: 11.5, marginTop: 2 }}>
                                {startTime ? 'Còn trống, nhấp chọn làm giờ kết thúc' : 'Còn trống, nhấp chọn làm giờ bắt đầu'}
                              </div>
                            </div>
                          )
                        }

                        let bg = '#ffffff'
                        let color = '#1e293b'
                        let border = '1.5px solid #94a3b8'
                        let cursor = 'pointer'

                        if (status === 'past' || status === 'inactive') {
                          bg = '#f1f5f9'
                          color = '#94a3b8'
                          border = '1px solid #e2e8f0'
                          cursor = 'not-allowed'
                        } else if (status === 'maintenance') {
                          bg = '#fef3c7'
                          color = '#92400e'
                          border = '1.5px dashed #d97706'
                          cursor = 'not-allowed'
                        } else if (status === 'pending') {
                          bg = '#fef08a'
                          color = '#854d0e'
                          border = '1.5px solid #eab308'
                          cursor = 'not-allowed'
                        } else if (status === 'approved') {
                          bg = '#86efac'
                          color = '#166534'
                          border = '1.5px solid #16a34a'
                          cursor = 'not-allowed'
                        } else if (status === 'start') {
                          bg = '#0d2e5c'
                          color = '#ffffff'
                          border = '2px solid #2563eb'
                        } else if (status === 'end') {
                          bg = '#0d2e5c'
                          color = '#ffffff'
                          border = '2px solid #f59e0b'
                        } else if (status === 'in-between') {
                          bg = '#e0e7ff'
                          color = '#3730a3'
                          border = '1.5px solid #818cf8'
                        } else if (status === 'close-time') {
                          bg = '#f8fafc'
                          color = '#64748b'
                          border = '1.5px dashed #64748b'
                          cursor = startTime ? 'pointer' : 'not-allowed'
                        } else if (status === 'disabled') {
                          bg = '#f1f5f9'
                          color = '#94a3b8'
                          border = '1px solid #e2e8f0'
                          cursor = 'not-allowed'
                        }

                        const isSelected = status === 'start' || status === 'end' || status === 'in-between'

                        return (
                          <Tooltip
                            key={slot}
                            title={tooltipContent}
                            placement="top"
                            mouseEnterDelay={0.12}
                            overlayInnerStyle={{ borderRadius: 8, padding: '8px 12px' }}
                          >
                            <div 
                              onClick={() => handleSlotClick(slot)}
                              className={`time-slot-btn ${isSelected ? 'selected' : ''}`}
                              style={{ 
                                background: bg,
                                color: color,
                                border: border,
                                borderRadius: 8,
                                padding: '10px 4px',
                                textAlign: 'center',
                                cursor: cursor,
                                userSelect: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                minHeight: 44,
                                transition: 'all 0.15s ease',
                                boxShadow: (status === 'start' || status === 'end') ? '0 2px 8px rgba(13, 46, 92, 0.28)' : undefined
                              }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.2px' }}>{slot}</div>
                            </div>
                          </Tooltip>
                        )
                      })}
                    </div>

                    {/* Cảnh báo vi phạm quy định giờ mượn phòng (nếu có) */}
                    {limitViolations.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <Alert
                          type="error"
                          showIcon
                          title={<strong style={{ color: '#b91c1c' }}>Khung giờ chọn không hợp lệ theo quy định</strong>}
                          description={
                            <div>
                              <div style={{ marginBottom: 6, color: '#b91c1c' }}>Yêu cầu đặt phòng của bạn không thỏa mãn các quy định sau:</div>
                              <ul style={{ margin: 0, paddingLeft: 20, color: '#b91c1c', fontSize: 13 }}>
                                {limitViolations.map((v, i) => <li key={i}>{v}</li>)}
                              </ul>
                              <div style={{ marginTop: 6, fontSize: 12.5, color: '#7f1d1d' }}>
                                Vui lòng chọn lại khung giờ hoặc ngày khác thỏa mãn quy định để tiếp tục.
                              </div>
                            </div>
                          }
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Nút chuyển bước */}
                <div className="step-navigation-bar">
                  <Button 
                    size="large" 
                    onClick={() => { setCurrentStep(0); scrollToTop(); }}
                    style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại: Chọn phòng
                  </Button>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep3}
                    disabled={!startTime || !endTime || limitViolations.length > 0 || isScheduleFetching || hasServerDataError || !isServerDataReady}
                    style={{ 
                      background: (startTime && endTime && limitViolations.length === 0 && !isScheduleFetching && !hasServerDataError && isServerDataReady) ? '#0d2e5c' : undefined, 
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
                      border: `1.5px solid ${isWalkInBooking ? '#16a34a' : '#94a3b8'}`,
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
                        Phiếu sẽ được lưu theo thông tin người mượn thực tế tại quầy và <strong>XÁC NHẬN TRỰC TIẾP VÀO HỆ THỐNG</strong>.
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
                    <Tooltip title={isDeptLocked ? "Thông tin được cố định theo tài khoản" : undefined} placement="topLeft">
                      <div>
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
                            readOnly={isDeptLocked}
                            tabIndex={isDeptLocked ? -1 : 0}
                            value={isDeptLocked ? effectiveDept : undefined}
                            title={isDeptLocked ? "Thông tin được cố định theo tài khoản" : undefined}
                            style={
                              isDeptLocked 
                                ? { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1', cursor: 'not-allowed', fontWeight: 600 } 
                                : undefined
                            }
                            placeholder={
                              isDeptLocked 
                                ? "" 
                                : (isAdmin 
                                    ? (isWalkInBooking ? "Nhập đơn vị / khoa của người mượn..." : "Nhập đơn vị / phòng ban sử dụng...") 
                                    : "Nhập Khoa / Bộ môn...")
                            } 
                            size="large" 
                          />
                        </Form.Item>
                      </div>
                    </Tooltip>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Tooltip title={isNameLocked ? "Thông tin được cố định theo tài khoản" : undefined} placement="topLeft">
                      <div>
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
                            readOnly={isNameLocked}
                            tabIndex={isNameLocked ? -1 : 0}
                            value={isNameLocked ? effectiveName : undefined}
                            title={isNameLocked ? "Thông tin được cố định theo tài khoản" : undefined}
                            style={
                              isNameLocked 
                                ? { backgroundColor: '#f1f5f9', color: '#0f172a', borderColor: '#cbd5e1', cursor: 'not-allowed', fontWeight: 600 } 
                                : undefined
                            }
                            placeholder={
                              isNameLocked 
                                ? "" 
                                : (isAdmin 
                                    ? (isWalkInBooking ? "Nhập họ tên người mượn tại quầy..." : "Nhập người / đơn vị phụ trách...") 
                                    : "Nhập họ và tên người mượn...")
                            } 
                            size="large" 
                          />
                        </Form.Item>
                      </div>
                    </Tooltip>
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
                      <Input placeholder="Nhập số điện thoại liên hệ" size="large" maxLength={10} />
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
                        placeholder={selectedRoom ? `Sức chứa tối đa: ${selectedRoom.capacity} người` : "Nhập số người tham gia"} 
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
                    style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại: Chọn giờ
                  </Button>
                  <Button 
                    type="primary" 
                    size="large" 
                    onClick={handleGoToStep4}
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
                        Xác nhận trực tiếp
                      </Tag>
                    ) : isStaffOrFaculty ? (
                      <Tag color="blue" style={{ fontWeight: 700, margin: 0, padding: '3px 10px', borderRadius: 6, fontSize: 13 }}>
                        Ưu tiên xét duyệt
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
                        {normalizeDepartmentName(department) || '-'}
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
                        [Quản trị viên] Quyền xác nhận trực tiếp
                      </div>
                      <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.5 }}>
                        Lịch phòng sẽ được <strong>XÁC NHẬN TRỰC TIẾP</strong> và cập nhật ngay vào hệ thống.
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
                        Yêu cầu đặt phòng của Thầy/Cô và Cán bộ được xếp thứ tự <strong>ƯU TIÊN XÉT DUYỆT</strong> để phục vụ công tác giảng dạy và hoạt động nhà trường.
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
                    <div style={{ padding: 14, border: '1.5px solid #94a3b8', borderRadius: 10, background: '#f8fafc', marginBottom: 16 }}>
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

                {isSubmissionUncertain && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 10, padding: '16px 20px' }}
                    title={<strong style={{ color: '#92400e', fontSize: 14 }}>Chưa xác nhận được kết quả đặt phòng. Vui lòng kiểm tra Lịch sử đặt trước khi gửi lại.</strong>}
                    description={
                      <div style={{ marginTop: 6 }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                          Yêu cầu trước đó gặp sự cố mạng hoặc máy chủ phản hồi quá thời gian. Để tránh đặt trùng lặp phòng học, vui lòng kiểm tra danh sách đơn trước khi quyết định gửi lại. Biểu mẫu của bạn đã được giữ nguyên.
                        </p>
                        <Space wrap>
                          <Button
                            type="primary"
                            icon={<HistoryOutlined />}
                            onClick={() => navigate(isAdmin ? '/admin?tab=bookings' : '/booking-history')}
                            style={{ background: '#0d2e5c' }}
                          >
                            Mở Lịch sử đặt phòng
                          </Button>
                          <Button
                            onClick={() => setIsSubmissionUncertain(false)}
                          >
                            Tôi đã kiểm tra, cho phép gửi lại
                          </Button>
                        </Space>
                      </div>
                    }
                  />
                )}

                {/* Nút gửi đơn */}
                <div className="step-navigation-bar">
                  <Button 
                    size="large" 
                    onClick={() => { setCurrentStep(2); scrollToTop(); }}
                    style={{ height: 46, borderRadius: 8, fontWeight: 600 }}
                  >
                    Quay lại chỉnh sửa
                  </Button>

                  <Button 
                    type="primary" 
                    htmlType="submit" 
                    size="large" 
                    disabled={
                      createMutation.isPending ||
                      isSubmissionUncertain ||
                      !isServerDataReady ||
                      hasServerDataError ||
                      isScheduleFetching ||
                      (!isStaffOrFaculty 
                        ? (!agreedToRules || (checkLimitQuery.data && !checkLimitQuery.data.canBook) || checkLimitQuery.isFetching)
                        : false)
                    } 
                    loading={createMutation.isPending || checkLimitQuery.isFetching} 
                    icon={<CheckCircleOutlined />} 
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
                        ? 'GỬI YÊU CẦU ĐẶT PHÒNG GIẢNG DẠY' 
                        : isStaff 
                          ? 'GỬI YÊU CẦU ĐẶT PHÒNG LÀM VIỆC' 
                          : 'GỬI YÊU CẦU PHÊ DUYỆT'}
                  </Button>
                </div>

                {!isAdmin && (
                  <div style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: '#64748b' }}>
                    {isStaffOrFaculty 
                      ? 'Yêu cầu của Thầy/Cô và Cán bộ được chuyển trực tiếp vào hàng chờ Ưu tiên xét duyệt.'
                      : 'Yêu cầu của bạn sẽ được chuyển đến Ban Quản lý CSVC để xem xét phê duyệt.'}
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
        width={520}
        className="booking-success-modal"
        destroyOnHidden
      >
        <div style={{ textAlign: 'center' }}>
          <div className="booking-success-badge" style={{ background: isAdmin ? '#ecfdf5' : '#eff6ff', color: isAdmin ? '#10b981' : '#0284c7' }}>
            <CheckCircleFilled />
          </div>

          <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 6px', fontWeight: 800, fontSize: 18.5, lineHeight: 1.35 }}>
            {isAdmin 
              ? 'Đặt phòng và phê duyệt trực tiếp thành công!' 
              : isFaculty 
                ? 'Đã gửi yêu cầu đặt phòng giảng dạy thành công!' 
                : isStaff 
                  ? 'Đã gửi yêu cầu đặt phòng làm việc thành công!' 
                  : 'Gửi yêu cầu đặt phòng thành công!'}
          </Typography.Title>

          <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.45 }}>
            {isAdmin
              ? 'Lịch phòng đã được cập nhật.'
              : isStaffOrFaculty
                ? 'Đơn đặt phòng đã được ghi nhận và được ưu tiên xét duyệt. Thầy/Cô vui lòng đợi Ban Quản lý CSVC phê duyệt trước khi nhận phòng.'
                : 'Yêu cầu của bạn đã được chuyển đến Ban Quản lý CSVC để xem xét phê duyệt. Bạn có thể theo dõi tiến độ xét duyệt tại trang Lịch sử.'}
          </Typography.Paragraph>

          {successBookingInfo && (
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #94a3b8',
                borderRadius: 10,
                padding: '10px 14px',
                textAlign: 'left',
                marginBottom: 16,
                fontSize: 13,
                color: '#334155'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Phòng học:</span>
                <strong style={{ color: '#0d2e5c' }}>{successBookingInfo.roomName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Ngày & Khung giờ:</span>
                <strong style={{ color: '#0d2e5c' }}>{successBookingInfo.timeRange} ({successBookingInfo.dateStr})</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Số người tham gia:</span>
                <span>{successBookingInfo.participantCount} người</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b' }}>Trạng thái đơn:</span>
                <Tag color={isAdmin ? 'green' : isStaffOrFaculty ? 'blue' : 'gold'} style={{ margin: 0, fontWeight: 700, fontSize: 11.5, padding: '0 6px', lineHeight: '20px' }}>
                  {isAdmin ? 'ĐÃ DUYỆT (TRỰC TIẾP)' : isStaffOrFaculty ? 'CHỜ DUYỆT (ƯU TIÊN)' : 'CHỜ DUYỆT'}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Mục đích sử dụng:</span>
                <span style={{ maxWidth: 240, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {successBookingInfo.purpose}
                </span>
              </div>
            </div>
          )}

          {isAdmin ? (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                size="middle"
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
                  height: 38
                }}
              >
                Xem trên Lịch phòng
              </Button>
              <Button
                type="primary"
                size="middle"
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
                  height: 38,
                  boxShadow: '0 4px 12px rgba(13, 46, 92, 0.25)'
                }}
              >
                Về Trang Quản trị
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                size="middle"
                icon={<PlusCircleOutlined />}
                onClick={() => setSuccessModalVisible(false)}
                style={{
                  borderRadius: 8,
                  fontWeight: 600,
                  flex: 1,
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  height: 38
                }}
              >
                Đặt thêm phòng khác
              </Button>
              <Button
                type="primary"
                size="middle"
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
                  height: 38,
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
