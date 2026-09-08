import { useState, useMemo, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Switch,
  InputNumber,
  Row,
  Col,
  Alert,
  Table,
  Tag,
  Button,
  Typography,
  message
} from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  UserOutlined,
  BookOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import type { Booking, CreateBookingPayload } from '../../types/booking'
import type { Room } from '../../types/room'
import type { SemesterType } from '../../types/schedule'
import {
  SEMESTER_PRESETS,
  TBD_STUDY_PERIODS,
  PERIOD_BLOCK_PRESETS,
  DAYS_OF_WEEK_OPTIONS,
  calculateScheduleSessions
} from '../../types/schedule'
import { http } from '../../api/http'
import { useQueryClient } from '@tanstack/react-query'

dayjs.extend(isBetween)

const { Text } = Typography
const { RangePicker } = DatePicker

interface SemesterScheduleModalProps {
  open: boolean
  onClose: () => void
  rooms: Room[]
  allBookings: Booking[]
  currentUserRole: string
  currentUserEmail: string
  currentUserName?: string
  onScheduleCreated?: (createdCount: number) => void
}

export default function SemesterScheduleModal({
  open,
  onClose,
  rooms,
  allBookings,
  currentUserRole,
  currentUserEmail,
  currentUserName = 'Quản lý Đào tạo & CSVC',
  onScheduleCreated
}: SemesterScheduleModalProps) {
  const [form] = Form.useForm()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Academic Year options (current, next, previous)
  const currentYear = dayjs().year()
  const academicYears = useMemo(() => [
    { label: `${currentYear - 1} - ${currentYear}`, value: currentYear - 1 },
    { label: `${currentYear} - ${currentYear + 1}`, value: currentYear },
    { label: `${currentYear + 1} - ${currentYear + 2}`, value: currentYear + 1 },
  ], [currentYear])

  const [selectedAcademicYear, setSelectedAcademicYear] = useState<number>(currentYear)
  const [selectedSemester, setSelectedSemester] = useState<SemesterType>('HK3')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3]) // Mặc định Thứ 2, Thứ 4
  const [selectedRoomId, setSelectedRoomId] = useState<number | undefined>(undefined)

  // Study Periods state
  const [periodMode, setPeriodMode] = useState<'preset' | 'custom'>('preset')
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('M_1_3')
  const [fromPeriod, setFromPeriod] = useState<number>(1)
  const [toPeriod, setToPeriod] = useState<number>(3)

  // School Override switch
  const [isSchoolOverride, setIsSchoolOverride] = useState<boolean>(true)

  // Permission authorization check
  const isAuthorized = useMemo(() => {
    const role = (currentUserRole || '').toLowerCase()
    const email = (currentUserEmail || '').toLowerCase()
    return (
      role === 'admin' ||
      role === 'approver' ||
      role === 'manager' ||
      role === 'staff' ||
      email.includes('admin') ||
      email.includes('quanly')
    )
  }, [currentUserRole, currentUserEmail])

  // Update date range when semester or academic year changes
  useEffect(() => {
    if (open) {
      const preset = SEMESTER_PRESETS[selectedSemester]
      const { startDate, endDate } = preset.getDates(selectedAcademicYear)
      const range: [dayjs.Dayjs, dayjs.Dayjs] = [dayjs(startDate), dayjs(endDate)]
      setDateRange(range)
      form.setFieldsValue({
        dateRange: range,
        semester: selectedSemester,
        academicYear: selectedAcademicYear,
        daysOfWeek: selectedDays,
      })
    }
  }, [open, selectedSemester, selectedAcademicYear])

  // Resolve start & end time strings based on period selection
  const { startTimeStr, endTimeStr, periodDisplayLabel } = useMemo(() => {
    if (periodMode === 'preset') {
      const preset = PERIOD_BLOCK_PRESETS.find(p => p.key === selectedPresetKey) || PERIOD_BLOCK_PRESETS[0]
      return {
        startTimeStr: preset.startTime,
        endTimeStr: preset.endTime,
        periodDisplayLabel: preset.label
      }
    } else {
      const startP = TBD_STUDY_PERIODS.find(p => p.period === fromPeriod) || TBD_STUDY_PERIODS[0]
      const endP = TBD_STUDY_PERIODS.find(p => p.period === toPeriod) || TBD_STUDY_PERIODS[2]
      return {
        startTimeStr: startP.startTime,
        endTimeStr: endP.endTime,
        periodDisplayLabel: `Tiết ${startP.period} -> Tiết ${endP.period} (${startP.startTime} - ${endP.endTime})`
      }
    }
  }, [periodMode, selectedPresetKey, fromPeriod, toPeriod])

  // Live Conflict Detection calculation
  const conflictResult = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1] || selectedDays.length === 0 || !selectedRoomId) {
      return { totalSessions: 0, conflictSessions: 0, sessions: [], allConflictingBookings: [] }
    }

    return calculateScheduleSessions({
      startDate: dateRange[0].format('YYYY-MM-DD'),
      endDate: dateRange[1].format('YYYY-MM-DD'),
      selectedDays,
      startTimeStr,
      endTimeStr,
      roomId: selectedRoomId,
      allBookings
    })
  }, [dateRange, selectedDays, startTimeStr, endTimeStr, selectedRoomId, allBookings])

  const selectedRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId)
  }, [rooms, selectedRoomId])

  // Handle Preset Button Click
  const handlePresetSelect = (preset: typeof PERIOD_BLOCK_PRESETS[0]) => {
    setSelectedPresetKey(preset.key)
    setFromPeriod(preset.fromPeriod)
    setToPeriod(preset.toPeriod)
    setPeriodMode('preset')
  }

  // Handle Submission
  const handleFinish = async (values: any) => {
    if (!isAuthorized) {
      message.error('Bạn không có quyền nhập thời khóa biểu và lịch học định kỳ!')
      return
    }

    if (!selectedRoomId) {
      message.error('Vui lòng chọn phòng học!')
      return
    }

    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      message.error('Vui lòng chọn dải ngày học của học kỳ!')
      return
    }

    if (selectedDays.length === 0) {
      message.error('Vui lòng chọn ít nhất một thứ trong tuần!')
      return
    }

    if (conflictResult.totalSessions === 0) {
      message.warning('Không có buổi học nào được tìm thấy trong dải ngày và các thứ đã chọn!')
      return
    }

    // Determine which sessions will be created
    const sessionsToCreate = isSchoolOverride
      ? conflictResult.sessions
      : conflictResult.sessions.filter(s => !s.hasConflict)

    if (sessionsToCreate.length === 0) {
      message.error('Tất cả các buổi học đều bị trùng và chế độ Ghi đè đang TẮT. Không thể tạo lịch học!')
      return
    }

    setIsSubmitting(true)

    try {
      const semesterPreset = SEMESTER_PRESETS[selectedSemester]
      const semesterLabel = `${semesterPreset.label} (NH ${selectedAcademicYear}-${selectedAcademicYear + 1})`
      const roomName = selectedRoom?.name || `Phòng ${selectedRoomId}`

      // 1. If Override is enabled, cancel/reject conflicting bookings
      const localBookingsStr = localStorage.getItem('tbd_admin_bookings')
      let localBookingsList: Booking[] = localBookingsStr ? JSON.parse(localBookingsStr) : []

      if (isSchoolOverride && conflictResult.allConflictingBookings.length > 0) {
        for (const conflict of conflictResult.allConflictingBookings) {
          const cancelReason = `Ưu tiên Thời khóa biểu chính khóa Nhà trường: ${values.subjectName} (${values.classCode || 'Lớp HP'}) - ${semesterPreset.shortLabel}`
          
          try {
            await http.put(`/api/bookings/${conflict.id}/reject`, {
              reason: cancelReason
            })
          } catch {
            // Fallback for API failure
          }

          // Update in local array
          const idx = localBookingsList.findIndex(b => b.id === conflict.id)
          if (idx > -1) {
            localBookingsList[idx] = {
              ...localBookingsList[idx],
              status: 'Cancelled',
              rejectReason: cancelReason,
              rejectionReason: cancelReason,
              adminNotes: 'Hệ thống tự động hủy do trùng lịch Thời khóa biểu Nhà trường (IsSchoolOverride = true)'
            }
          }
        }
      }

      // 2. Create academic sessions
      const createdBookings: Booking[] = []
      const baseId = Date.now()

      for (let i = 0; i < sessionsToCreate.length; i++) {
        const session = sessionsToCreate[i]
        const bookingId = baseId + i + Math.floor(Math.random() * 1000)

        const payload: CreateBookingPayload = {
          roomId: selectedRoomId,
          startTime: session.startTime,
          endTime: session.endTime,
          purpose: `[TKB ${semesterPreset.shortLabel}] ${values.subjectName} (${values.classCode || 'HP'}) - GV: ${values.lecturerName || 'Bộ môn'}`,
          status: 'Approved',
          participantCount: values.participantCount || selectedRoom?.capacity || 40,
          department: values.department || 'Phòng Quản lý Đào tạo & CSVC',
          personInCharge: values.lecturerName || currentUserName,
          notes: `Lịch học chính khóa | Môn: ${values.subjectName} | Mã HP: ${values.subjectCode || 'N/A'} | Lớp: ${values.classCode || 'N/A'} | ${periodDisplayLabel} | ${session.dayOfWeekLabel}`,
          isSchoolOverride: true,
          IsSchoolOverride: true,
          semester: semesterPreset.shortLabel,
          academicYear: `${selectedAcademicYear}-${selectedAcademicYear + 1}`,
          subjectCode: values.subjectCode,
          subjectName: values.subjectName,
          classCode: values.classCode,
          lecturerName: values.lecturerName,
          periodInfo: periodDisplayLabel,
          approvedBy: currentUserName,
          approvedAt: new Date().toISOString(),
          adminNotes: 'Thời khóa biểu chính khóa trường ĐH Thái Bình Dương (Đã duyệt tự động & Khóa slot).'
        }

        let apiSuccess = false
        try {
          const res = await http.post<Booking>('/api/bookings', payload)
          if (res.data && res.data.id) {
            createdBookings.push(res.data)
            apiSuccess = true
          }
        } catch {
          // Handled below
        }

        if (!apiSuccess) {
          const localItem: Booking = {
            id: bookingId,
            roomId: selectedRoomId,
            roomName: roomName,
            startTime: session.startTime,
            endTime: session.endTime,
            purpose: payload.purpose,
            status: 'Approved',
            participantCount: payload.participantCount,
            department: payload.department,
            personInCharge: payload.personInCharge,
            notes: payload.notes,
            isSchoolOverride: true,
            IsSchoolOverride: true,
            semester: payload.semester,
            academicYear: payload.academicYear,
            subjectCode: payload.subjectCode,
            subjectName: payload.subjectName,
            classCode: payload.classCode,
            lecturerName: payload.lecturerName,
            periodInfo: payload.periodInfo,
            approvedBy: currentUserName,
            approvedAt: new Date().toISOString(),
            adminNotes: payload.adminNotes,
            userEmail: currentUserEmail || 'quanly@tbd.edu.vn'
          }
          createdBookings.push(localItem)
        }
      }

      // Merge newly created bookings into localStorage
      const mergedList = [...createdBookings, ...localBookingsList]
      localStorage.setItem('tbd_admin_bookings', JSON.stringify(mergedList))

      // Refresh react-query caches
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['all-bookings-validation'] })

      message.success({
        content: `Đã nhập thành công Thời khóa biểu: Tạo ${createdBookings.length} buổi học tại ${roomName} (${semesterLabel}) với trạng thái ĐÃ DUYỆT & KHÓA SLOT!`,
        duration: 5
      })

      if (onScheduleCreated) {
        onScheduleCreated(createdBookings.length)
      }

      onClose()
      form.resetFields()
    } catch (err: any) {
      message.error(err?.message || 'Có lỗi xảy ra khi tạo thời khóa biểu.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Table columns for displaying conflict details
  const conflictColumns = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (id: number) => <Tag color="blue">#{id}</Tag>
    },
    {
      title: 'Người đặt',
      dataIndex: 'userEmail',
      key: 'userEmail',
      render: (email: string, row: Booking) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{row.personInCharge || email || 'Sinh viên / Cán bộ'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{email}</div>
        </div>
      )
    },
    {
      title: 'Thời gian bị trùng',
      key: 'time',
      render: (_: any, row: Booking) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {dayjs(row.startTime).format('DD/MM/YYYY')}
          </div>
          <div style={{ fontSize: 12, color: '#0284c7' }}>
            {dayjs(row.startTime).format('HH:mm')} - {dayjs(row.endTime).format('HH:mm')}
          </div>
        </div>
      )
    },
    {
      title: 'Mục đích đặt phòng',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
      render: (text: string) => <Text ellipsis style={{ maxWidth: 200 }}>{text || 'Đăng ký sử dụng'}</Text>
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: any) => (
        <Tag color={String(status) === 'Approved' ? 'green' : 'orange'}>
          {String(status)}
        </Tag>
      )
    }
  ]

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18
          }}>
            <SafetyCertificateOutlined />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
              Nhập Thời Khóa Biểu & Lịch Học Định Kỳ Theo Học Kỳ
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
              Hệ thống Quản lý Đặt phòng Học - Đại học Thái Bình Dương (TBD)
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={920}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isSubmitting}>
          Đóng
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={isSubmitting}
          onClick={() => form.submit()}
          style={{ background: '#0284c7', borderColor: '#0284c7' }}
          disabled={!isAuthorized || conflictResult.totalSessions === 0 || (!isSchoolOverride && conflictResult.conflictSessions === conflictResult.totalSessions)}
        >
          Xác nhận tạo Thời khóa biểu ({isSchoolOverride ? conflictResult.totalSessions : (conflictResult.totalSessions - conflictResult.conflictSessions)} buổi)
        </Button>
      ]}
      destroyOnClose
    >
      {!isAuthorized && (
        <Alert
          type="error"
          showIcon
          message="Không có quyền truy cập chức năng này"
          description="Chỉ tài khoản Quản lý Đào tạo & CSVC (quanly@tbd.edu.vn) và Quản trị viên (admin@tbd.edu.vn) mới có quyền tạo Thời khóa biểu định kỳ và phân bổ phòng học theo học kỳ."
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          semester: 'HK3',
          academicYear: currentYear,
          daysOfWeek: [1, 3],
          periodMode: 'preset',
          presetKey: 'M_1_3',
          fromPeriod: 1,
          toPeriod: 3,
          isSchoolOverride: true,
          participantCount: 45
        }}
      >
        {/* SECTION 1: CHỌN HỌC KỲ & THỜI GIAN ĐỊNH KỲ */}
        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CalendarOutlined style={{ color: '#0284c7', fontSize: 16 }} />
            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
              1. RÀNG BUỘC HỌC KỲ & THỜI GIAN ĐỊNH KỲ (HỌC KỲ 1, 2, HÈ VÀ TÙY CHỈNH)
            </Text>
          </div>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Năm học" name="academicYear" rules={[{ required: true }]}>
                <Select
                  options={academicYears}
                  value={selectedAcademicYear}
                  onChange={(val) => setSelectedAcademicYear(val)}
                />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item label="Chế độ Học kỳ (Bao gồm Học kỳ 3 - Hè)" name="semester" rules={[{ required: true }]}>
                <Radio.Group
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
                >
                  <Radio.Button value="HK1" style={{ height: 'auto', padding: '6px 12px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#1e40af' }}>Học kỳ 1 (Kỳ Thu)</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tháng 9 - Tháng 1 (~18 tuần)</div>
                  </Radio.Button>
                  <Radio.Button value="HK2" style={{ height: 'auto', padding: '6px 12px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#166534' }}>Học kỳ 2 (Kỳ Xuân)</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tháng 2 - Tháng 6 (~18 tuần)</div>
                  </Radio.Button>
                  <Radio.Button value="HK3" style={{ height: 'auto', padding: '6px 12px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#c2410c' }}>Học kỳ 3 (Học kỳ Hè)</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tháng 7 - Tháng 8 (~8 tuần)</div>
                  </Radio.Button>
                  <Radio.Button value="CUSTOM" style={{ height: 'auto', padding: '6px 12px', textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: '#6b21a8' }}>Tùy chỉnh (Custom)</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Tự chọn theo tuần/tháng</div>
                  </Radio.Button>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Dải ngày học của Học kỳ (Từ ngày - Đến ngày)"
                name="dateRange"
                rules={[{ required: true, message: 'Vui lòng chọn dải ngày học!' }]}
                tooltip="Hệ thống tự động đề xuất dải ngày theo chuẩn Học kỳ TBD, bạn có thể tinh chỉnh theo lịch thực tế."
              >
                <RangePicker
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as any)}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Lịch học các thứ trong tuần"
                name="daysOfWeek"
                rules={[{ required: true, message: 'Vui lòng chọn ít nhất một thứ!' }]}
              >
                <Checkbox.Group
                  options={DAYS_OF_WEEK_OPTIONS}
                  value={selectedDays}
                  onChange={(vals) => setSelectedDays(vals as number[])}
                />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* SECTION 2: KHUNG GIỜ TIẾT HỌC CHUẨN TBD & PHÒNG HỌC */}
        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined style={{ color: '#0284c7', fontSize: 16 }} />
              <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                2. KHUNG GIỜ TIẾT HỌC CHUẨN TBD (TBD_STUDY_PERIODS) & PHÒNG HỌC
              </Text>
            </div>
            <Radio.Group
              size="small"
              value={periodMode}
              onChange={(e) => setPeriodMode(e.target.value)}
            >
              <Radio.Button value="preset">Khối tiết chuẩn</Radio.Button>
              <Radio.Button value="custom">Tùy chọn tiết</Radio.Button>
            </Radio.Group>
          </div>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                label="Phòng học giảng dạy"
                name="roomId"
                rules={[{ required: true, message: 'Vui lòng chọn phòng học!' }]}
              >
                <Select
                  placeholder="Chọn phòng học"
                  showSearch
                  optionFilterProp="children"
                  value={selectedRoomId}
                  onChange={(val) => setSelectedRoomId(val)}
                >
                  {rooms.map((r) => (
                    <Select.Option key={r.id} value={r.id}>
                      {r.name} - Sức chứa: {r.capacity} chỗ ({r.building || 'Khu giảng đường'})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={14}>
              {periodMode === 'preset' ? (
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: '#0f172a', fontWeight: 500 }}>
                    Chọn nhanh khối tiết học chuẩn:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {PERIOD_BLOCK_PRESETS.map((p) => {
                      const isSelected = selectedPresetKey === p.key
                      return (
                        <Button
                          key={p.key}
                          size="small"
                          type={isSelected ? 'primary' : 'default'}
                          onClick={() => handlePresetSelect(p)}
                          style={{
                            height: 'auto',
                            padding: '6px 8px',
                            textAlign: 'left',
                            fontSize: 11,
                            background: isSelected ? '#0284c7' : '#fff',
                            borderColor: isSelected ? '#0284c7' : '#cbd5e1'
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{p.label.split(':')[1] || p.label}</div>
                          <div style={{ opacity: 0.85 }}>{p.shift === 'morning' ? 'Ca Sáng' : 'Ca Chiều'}</div>
                        </Button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item label="Từ tiết" required>
                      <Select
                        value={fromPeriod}
                        onChange={(val) => {
                          setFromPeriod(val)
                          if (val > toPeriod) setToPeriod(val)
                        }}
                      >
                        {TBD_STUDY_PERIODS.map((p) => (
                          <Select.Option key={p.period} value={p.period}>
                            {p.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Đến tiết" required>
                      <Select
                        value={toPeriod}
                        onChange={(val) => {
                          setToPeriod(val)
                          if (val < fromPeriod) setFromPeriod(val)
                        }}
                      >
                        {TBD_STUDY_PERIODS.filter((p) => p.period >= fromPeriod).map((p) => (
                          <Select.Option key={p.period} value={p.period}>
                            {p.label}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              )}
            </Col>
          </Row>

          {/* Time Reference Banner */}
          <div style={{
            marginTop: 4,
            padding: '8px 12px',
            borderRadius: 6,
            background: '#e0f2fe',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#0369a1'
          }}>
            <div>
              <strong>Khung giờ áp dụng: </strong>
              <Tag color="blue" style={{ fontSize: 12, fontWeight: 700, margin: '0 4px' }}>
                {startTimeStr} - {endTimeStr}
              </Tag>
              ({periodDisplayLabel})
            </div>
            <div style={{ fontSize: 11, color: '#0284c7' }}>
              Giải lao 15p: 09:30 - 09:45 (Sáng) & 15:45 - 16:00 (Chiều)
            </div>
          </div>
        </div>

        {/* SECTION 3: THÔNG TIN HỌC PHẦN & GIẢNG VIÊN */}
        <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BookOutlined style={{ color: '#0284c7', fontSize: 16 }} />
            <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
              3. THÔNG TIN HỌC PHẦN, LỚP VÀ GIẢNG VIÊN PHỤ TRÁCH
            </Text>
          </div>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item
                label="Tên Học phần / Môn học"
                name="subjectName"
                rules={[{ required: true, message: 'Vui lòng nhập tên học phần!' }]}
              >
                <Input placeholder="VD: Lập trình Web nâng cao" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item label="Mã Học phần" name="subjectCode">
                <Input placeholder="VD: CNTT302" />
              </Form.Item>
            </Col>
            <Col span={7}>
              <Form.Item label="Mã Lớp học phần / Nhóm" name="classCode">
                <Input placeholder="VD: 22CT111" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Form.Item label="Giảng viên phụ trách" name="lecturerName" rules={[{ required: true, message: 'Vui lòng nhập tên giảng viên!' }]}>
                <Input placeholder="VD: TS. Nguyễn Văn A" prefix={<UserOutlined style={{ color: '#94a3b8' }} />} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Khoa / Bộ môn" name="department">
                <Input placeholder="VD: Khoa Công nghệ Thông tin" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Số SV dự kiến" name="participantCount">
                <InputNumber min={1} max={300} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* SECTION 4: KIỂM TRA XUNG ĐỘT (CONFLICT DETECTION & OVERRIDE) */}
        <div style={{
          background: conflictResult.conflictSessions > 0 ? '#fffbeb' : '#f0fdf4',
          padding: '16px 20px',
          borderRadius: 8,
          border: conflictResult.conflictSessions > 0 ? '1px solid #fde68a' : '1px solid #bbf7d0',
          marginBottom: 8
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {conflictResult.conflictSessions > 0 ? (
                <ExclamationCircleOutlined style={{ color: '#d97706', fontSize: 18 }} />
              ) : (
                <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 18 }} />
              )}
              <div>
                <Text strong style={{ fontSize: 14, color: '#0f172a' }}>
                  4. KIỂM TRA XUNG ĐỘT (CONFLICT DETECTION & OVERRIDE)
                </Text>
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  Hệ thống tự động rà soát lịch hiện có tại {selectedRoom?.name || 'phòng học'} trong dải ngày đã chọn
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                background: '#fff',
                padding: '4px 12px',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                fontSize: 13
              }}>
                Tổng buổi dự kiến: <strong style={{ color: '#0284c7' }}>{conflictResult.totalSessions}</strong>
              </div>
              <div style={{
                background: conflictResult.conflictSessions > 0 ? '#fee2e2' : '#dcfce7',
                padding: '4px 12px',
                borderRadius: 20,
                border: conflictResult.conflictSessions > 0 ? '1px solid #fca5a5' : '1px solid #86efac',
                fontSize: 13,
                color: conflictResult.conflictSessions > 0 ? '#b91c1c' : '#15803d',
                fontWeight: 600
              }}>
                {conflictResult.conflictSessions > 0
                  ? `Phát hiện ${conflictResult.conflictSessions} buổi xung đột!`
                  : 'Hoàn toàn không có xung đột'}
              </div>
            </div>
          </div>

          {/* Conflict List & Override Toggle */}
          {conflictResult.conflictSessions > 0 ? (
            <div>
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  <div style={{ fontWeight: 600 }}>
                    Có {conflictResult.conflictSessions} buổi học trùng với {conflictResult.allConflictingBookings.length} đơn đặt phòng của sinh viên / giảng viên khác
                  </div>
                }
                description={
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Dưới đây là danh sách các đơn trùng lịch tại {selectedRoom?.name}. Vui lòng chọn chế độ Ghi đè Nhà trường (Override) để tự động giải tỏa slot phòng.
                  </div>
                }
              />

              <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 14, border: '1px solid #fed7aa', borderRadius: 6 }}>
                <Table
                  size="small"
                  columns={conflictColumns}
                  dataSource={conflictResult.allConflictingBookings}
                  rowKey="id"
                  pagination={false}
                />
              </div>

              <div style={{
                background: isSchoolOverride ? '#eff6ff' : '#f8fafc',
                border: isSchoolOverride ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                padding: '12px 16px',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: isSchoolOverride ? '#1e40af' : '#475569', fontSize: 13 }}>
                    Chế độ Ghi đè Nhà trường (IsSchoolOverride = true): {isSchoolOverride ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {isSchoolOverride
                      ? 'Nhà trường có quyền ưu tiên cao nhất. Hệ thống sẽ tự động HỦY các đơn trùng giờ, và phê duyệt toàn bộ lịch học chính khóa (Approved).'
                      : 'Giữ nguyên các đơn cũ. Hệ thống sẽ BỎ QUA các buổi bị trùng lịch (chỉ tạo các buổi không bị xung đột).'}
                  </div>
                </div>
                <Switch
                  checked={isSchoolOverride}
                  onChange={(checked) => setIsSchoolOverride(checked)}
                  checkedChildren="Ghi đè"
                  unCheckedChildren="Bỏ qua"
                  style={{ background: isSchoolOverride ? '#0284c7' : '#94a3b8' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#166534', padding: '4px 0' }}>
              Toàn bộ {conflictResult.totalSessions} buổi học đều thông suốt, không trùng với bất kỳ lịch đăng ký nào tại phòng học này.
              Các buổi học sẽ được phê duyệt tự động với cờ <strong>IsSchoolOverride = true</strong> và khóa slot trên /calendar.
            </div>
          )}
        </div>
      </Form>
    </Modal>
  )
}
