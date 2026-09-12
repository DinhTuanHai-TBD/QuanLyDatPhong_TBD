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
  Tooltip,
  Tag,
  Button,
  Typography,
  Tabs,
  Badge,
  message
} from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  BookOutlined,
  SafetyCertificateOutlined,
  FileExcelOutlined
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
import SemesterScheduleExcelImport from './SemesterScheduleExcelImport'

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
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual')

  // Study Periods state
  const [periodMode, setPeriodMode] = useState<'preset' | 'custom'>('preset')
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('M_1_3')
  const [fromPeriod, setFromPeriod] = useState<number>(1)
  const [toPeriod, setToPeriod] = useState<number>(3)

  // School Override switch
  const [isSchoolOverride, setIsSchoolOverride] = useState<boolean>(true)
  const [isSubmitHovered, setIsSubmitHovered] = useState<boolean>(false)

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
      message.error('Tất cả các buổi học đều bị trùng giờ với lịch đã có. Vui lòng kiểm tra lại phòng học hoặc khung giờ!')
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
              adminNotes: 'Điều chỉnh ưu tiên theo Thời khóa biểu chính khóa của Nhà trường'
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
          adminNotes: 'Thời khóa biểu chính khóa do Phòng Quản lý Đào tạo sắp xếp.'
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
        content: `Đã lưu thành công Thời khóa biểu chính khóa: ${createdBookings.length} buổi học tại ${roomName} (${semesterLabel}).`,
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
      width={activeTab === 'excel' ? 1040 : 980}
      footer={
        activeTab === 'manual' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: 12
            }}
          >
            {/* Góc trái Footer (Dùng Ant Design Badge trạng thái chuẩn mực) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', flexWrap: 'wrap' }}>
              {conflictResult.totalSessions === 0 ? (
                <Badge
                  status="default"
                  text={<span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Chưa chọn lịch hoặc ngày học</span>}
                />
              ) : conflictResult.conflictSessions === 0 ? (
                <Badge
                  status="success"
                  text={
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                      Dự kiến: {conflictResult.totalSessions} buổi học | Trạng thái: Hợp lệ
                    </span>
                  }
                />
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Tooltip
                    title={
                      conflictResult.allConflictingBookings.length > 0
                        ? `Trùng với ${conflictResult.allConflictingBookings.length} đơn đặt phòng: ${conflictResult.allConflictingBookings
                            .map((b) => `#${b.id} (${dayjs(b.startTime).format('DD/MM HH:mm')})`)
                            .join(', ')}`
                        : undefined
                    }
                  >
                    <span style={{ cursor: 'help' }}>
                      <Badge
                        status="warning"
                        text={
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309' }}>
                            Phát hiện trùng {conflictResult.conflictSessions} buổi
                          </span>
                        }
                      />
                    </span>
                  </Tooltip>

                  <Tooltip
                    title={
                      isSchoolOverride
                        ? 'Đang bật ưu tiên: Ưu tiên Thời khóa biểu chính khóa khi phát hiện lịch trùng'
                        : 'Đang tắt ưu tiên: Giữ các lịch đã có, chỉ tạo các buổi học không bị trùng giờ'
                    }
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: isSchoolOverride ? '#0284c7' : '#475569',
                        fontWeight: 500,
                        background: isSchoolOverride ? '#eff6ff' : '#f8fafc',
                        padding: '3px 8px',
                        borderRadius: 6,
                        border: isSchoolOverride ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                      }}
                    >
                      <span>Ưu tiên lịch chính khóa:</span>
                      <Switch
                        size="small"
                        checked={isSchoolOverride}
                        onChange={(checked) => setIsSchoolOverride(checked)}
                        style={{ background: isSchoolOverride ? '#0284c7' : '#cbd5e1' }}
                      />
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Góc phải Footer: Các nút thao tác */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Button key="cancel" onClick={onClose} disabled={isSubmitting}>
                Đóng
              </Button>
              <Button
                id="btn-confirm-semester-schedule"
                key="submit"
                type="primary"
                loading={isSubmitting}
                onClick={() => form.submit()}
                style={{
                  background: isSubmitHovered ? '#0369a1' : '#0284c7',
                  borderColor: isSubmitHovered ? '#0369a1' : '#0284c7',
                  fontWeight: 600,
                  color: '#ffffff',
                  boxShadow: isSubmitHovered
                    ? '0 4px 10px rgba(3, 105, 161, 0.35)'
                    : '0 2px 4px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={() => setIsSubmitHovered(true)}
                onMouseLeave={() => setIsSubmitHovered(false)}
                disabled={
                  !isAuthorized ||
                  conflictResult.totalSessions === 0 ||
                  (!isSchoolOverride &&
                    conflictResult.conflictSessions ===
                      conflictResult.totalSessions)
                }
              >
                <span style={{ color: '#ffffff', fontWeight: 600 }}>
                  Xác nhận tạo Thời khóa biểu (
                  {isSchoolOverride
                    ? conflictResult.totalSessions
                    : conflictResult.totalSessions -
                      conflictResult.conflictSessions}{' '}
                  buổi)
                </span>
              </Button>
            </div>
          </div>
        ) : null
      }
      destroyOnHidden
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

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'manual' | 'excel')}
        type="card"
        style={{ marginBottom: 12 }}
        items={[
          {
            key: 'manual',
            label: (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <CalendarOutlined style={{ marginRight: 6 }} />
                Nhập thủ công
              </span>
            ),
            children: (
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
        <Row gutter={16} align="stretch">
          {/* CỘT TRÁI (Thời gian & Chu kỳ đào tạo) */}
          <Col span={12}>
            <div
              style={{
                background: '#f8fafc',
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                height: '100%'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  paddingBottom: 8,
                  borderBottom: '1px solid #e2e8f0'
                }}
              >
                <CalendarOutlined style={{ color: '#0d2e5c', fontSize: 16 }} />
                <Text strong style={{ fontSize: 13, color: '#0d2e5c', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Thời gian & Chu kỳ đào tạo
                </Text>
              </div>

              {/* Dòng 1: Năm học & Dải ngày áp dụng */}
              <Row gutter={10}>
                <Col span={10}>
                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Năm học</span>}
                    name="academicYear"
                    rules={[{ required: true }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      options={academicYears}
                      value={selectedAcademicYear}
                      onChange={(val) => setSelectedAcademicYear(val)}
                    />
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item
                    label={<span style={{ fontSize: 12, fontWeight: 600 }}>Dải ngày áp dụng</span>}
                    name="dateRange"
                    rules={[{ required: true, message: 'Vui lòng chọn dải ngày!' }]}
                    tooltip="Đề xuất dải ngày chuẩn theo học kỳ TBD"
                    style={{ marginBottom: 0 }}
                  >
                    <RangePicker
                      format="DD/MM/YYYY"
                      style={{ width: '100%' }}
                      value={dateRange}
                      onChange={(dates) => setDateRange(dates as any)}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* Dòng 2: Phân loại học kỳ (Lưới 4 ô chọn Radio.Button phẳng, thanh lịch) */}
              <div>
                <style>{`
                  .semester-radio-group .ant-radio-button-wrapper::before {
                    display: none !important;
                  }
                `}</style>
                <Form.Item
                  label={<span style={{ fontSize: 12, fontWeight: 600 }}>Phân loại học kỳ</span>}
                  name="semester"
                  rules={[{ required: true }]}
                  style={{ marginBottom: 0 }}
                >
                  <Radio.Group
                    className="semester-radio-group"
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}
                  >
                    <Radio.Button
                      value="HK1"
                      style={{
                        height: 'auto',
                        padding: '7px 10px',
                        borderRadius: 6,
                        textAlign: 'left',
                        border: selectedSemester === 'HK1' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: selectedSemester === 'HK1' ? '#eff6ff' : '#ffffff',
                        boxShadow: selectedSemester === 'HK1' ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Học kỳ 1 (Kỳ Thu)</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 500 }}>Tháng 9 - Tháng 1 (~18w)</div>
                    </Radio.Button>
                    <Radio.Button
                      value="HK2"
                      style={{
                        height: 'auto',
                        padding: '7px 10px',
                        borderRadius: 6,
                        textAlign: 'left',
                        border: selectedSemester === 'HK2' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: selectedSemester === 'HK2' ? '#eff6ff' : '#ffffff',
                        boxShadow: selectedSemester === 'HK2' ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Học kỳ 2 (Kỳ Xuân)</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 500 }}>Tháng 2 - Tháng 6 (~18w)</div>
                    </Radio.Button>
                    <Radio.Button
                      value="HK3"
                      style={{
                        height: 'auto',
                        padding: '7px 10px',
                        borderRadius: 6,
                        textAlign: 'left',
                        border: selectedSemester === 'HK3' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: selectedSemester === 'HK3' ? '#eff6ff' : '#ffffff',
                        boxShadow: selectedSemester === 'HK3' ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Học kỳ 3 (Học kỳ Hè)</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 500 }}>Tháng 7 - Tháng 8 (~8w)</div>
                    </Radio.Button>
                    <Radio.Button
                      value="CUSTOM"
                      style={{
                        height: 'auto',
                        padding: '7px 10px',
                        borderRadius: 6,
                        textAlign: 'left',
                        border: selectedSemester === 'CUSTOM' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                        background: selectedSemester === 'CUSTOM' ? '#eff6ff' : '#ffffff',
                        boxShadow: selectedSemester === 'CUSTOM' ? '0 1px 4px rgba(37, 99, 235, 0.15)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#0f172a' }}>Tùy chỉnh (Custom)</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2, fontWeight: 500 }}>Tự chọn theo tuần/tháng</div>
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
              </div>

              {/* Dòng 3: Lịch học các thứ trong tuần (Checkbox tối giản Thứ 2 đến Chủ nhật) */}
              <div style={{ marginTop: 'auto' }}>
                <Form.Item
                  label={<span style={{ fontSize: 12, fontWeight: 600 }}>Lịch học các thứ trong tuần</span>}
                  name="daysOfWeek"
                  rules={[{ required: true, message: 'Vui lòng chọn ít nhất một thứ!' }]}
                  style={{ marginBottom: 0 }}
                >
                  <div style={{ background: '#fff', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    <Checkbox.Group
                      options={DAYS_OF_WEEK_OPTIONS}
                      value={selectedDays}
                      onChange={(vals) => setSelectedDays(vals as number[])}
                      style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 8px' }}
                    />
                  </div>
                </Form.Item>
              </div>
            </div>
          </Col>

          {/* CỘT PHẢI (Địa điểm, Tiết học & Thông tin lớp) */}
          <Col span={12}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              {/* Khối 1: Phòng học & Khối tiết chuẩn TBD */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClockCircleOutlined style={{ color: '#0d2e5c', fontSize: 15 }} />
                    <Text strong style={{ fontSize: 13, color: '#0d2e5c', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      Địa điểm & Tiết học chuẩn TBD
                    </Text>
                  </div>
                  <Radio.Group
                    size="small"
                    value={periodMode}
                    onChange={(e) => setPeriodMode(e.target.value)}
                  >
                    <Radio.Button value="preset" style={{ fontSize: 11 }}>Khối chuẩn</Radio.Button>
                    <Radio.Button value="custom" style={{ fontSize: 11 }}>Tùy chọn</Radio.Button>
                  </Radio.Group>
                </div>

                {/* Phòng học (Select) */}
                <Form.Item
                  label={<span style={{ fontSize: 12, fontWeight: 600 }}>Phòng học giảng dạy</span>}
                  name="roomId"
                  rules={[{ required: true, message: 'Vui lòng chọn phòng học!' }]}
                  style={{ marginBottom: 8 }}
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
                        {r.name} - {r.capacity} chỗ ({r.building || 'Khu GD'})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>

                {/* Khối tiết chuẩn TBD (Nút bấm phẳng) */}
                {periodMode === 'preset' ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {PERIOD_BLOCK_PRESETS.map((p) => {
                        const isSelected = selectedPresetKey === p.key
                        const periodRangeStr = `Tiết ${p.fromPeriod}-${p.toPeriod}`
                        const timeRangeStr = `${p.startTime} - ${p.endTime}`
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => handlePresetSelect(p)}
                            style={{
                              border: isSelected ? '1.5px solid #0f172a' : '1px solid #cbd5e1',
                              background: isSelected ? '#0f172a' : '#ffffff',
                              borderRadius: 6,
                              padding: '6px 4px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              outline: 'none',
                              boxShadow: isSelected ? '0 2px 4px rgba(15, 23, 42, 0.25)' : 'none'
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: 12,
                                lineHeight: 1.2,
                                color: isSelected ? '#ffffff' : '#0f172a'
                              }}
                            >
                              {periodRangeStr}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                fontWeight: 500,
                                color: isSelected ? '#e0f2fe' : '#475569',
                                marginTop: 3
                              }}
                            >
                              {timeRangeStr}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <Row gutter={8}>
                    <Col span={12}>
                      <Form.Item label={<span style={{ fontSize: 12 }}>Từ tiết</span>} required style={{ marginBottom: 0 }}>
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
                      <Form.Item label={<span style={{ fontSize: 12 }}>Đến tiết</span>} required style={{ marginBottom: 0 }}>
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

                {/* Sub-banner: Giờ áp dụng */}
                <div
                  style={{
                    marginTop: 6,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 11
                  }}
                >
                  <div style={{ color: '#0369a1', fontWeight: 600 }}>
                    <strong style={{ color: '#0369a1' }}>Áp dụng: </strong>
                    <Tag
                      color="blue"
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        margin: '0 4px',
                        padding: '1px 6px',
                        color: '#0369a1',
                        background: '#e0f2fe',
                        borderColor: '#7dd3fc'
                      }}
                    >
                      {startTimeStr} - {endTimeStr}
                    </Tag>
                    <span style={{ color: '#0369a1', fontWeight: 600, fontSize: 11 }}>
                      ({periodDisplayLabel})
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
                    Nghỉ 15p: 09:30 & 15:45
                  </div>
                </div>
              </div>

              {/* Khối 2: Tên học phần, Mã HP, Mã lớp, Giảng viên & Khoa/Bộ môn */}
              <div
                style={{
                  background: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  marginTop: 'auto'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <BookOutlined style={{ color: '#0d2e5c', fontSize: 14 }} />
                  <Text strong style={{ fontSize: 13, color: '#0d2e5c', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Thông tin học phần & Giảng viên
                  </Text>
                </div>

                {/* Tên học phần */}
                <Form.Item
                  label={<span style={{ fontSize: 12, fontWeight: 600 }}>Tên học phần / Môn học</span>}
                  name="subjectName"
                  rules={[{ required: true, message: 'Vui lòng nhập tên học phần!' }]}
                  style={{ marginBottom: 8 }}
                >
                  <Input placeholder="VD: Lập trình Web nâng cao" />
                </Form.Item>

                {/* Mã học phần & Mã lớp (2 ô song song) kèm số SV */}
                <Row gutter={8} style={{ marginBottom: 8 }}>
                  <Col span={10}>
                    <Form.Item
                      label={<span style={{ fontSize: 12, fontWeight: 600 }}>Mã học phần</span>}
                      name="subjectCode"
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="VD: CNTT302" />
                    </Form.Item>
                  </Col>
                  <Col span={9}>
                    <Form.Item
                      label={<span style={{ fontSize: 12, fontWeight: 600 }}>Mã lớp</span>}
                      name="classCode"
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="VD: 22CT111" />
                    </Form.Item>
                  </Col>
                  <Col span={5}>
                    <Form.Item
                      label={<span style={{ fontSize: 12, fontWeight: 600 }}>Số SV</span>}
                      name="participantCount"
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber min={1} max={300} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Giảng viên phụ trách & Khoa/Bộ môn (2 ô song song) */}
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontSize: 12, fontWeight: 600 }}>Giảng viên phụ trách</span>}
                      name="lecturerName"
                      rules={[{ required: true, message: 'Vui lòng nhập tên giảng viên!' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="VD: TS. Nguyễn Văn A" prefix={<UserOutlined style={{ color: '#94a3b8' }} />} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ fontSize: 12, fontWeight: 600 }}>Khoa / Bộ môn</span>}
                      name="department"
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder="VD: Khoa CNTT" />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </div>
          </Col>
        </Row>
      </Form>
            )
          },
          {
            key: 'excel',
            label: (
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                <FileExcelOutlined style={{ marginRight: 6, color: '#16a34a' }} />
                Nhập từ File (Excel / CSV)
              </span>
            ),
            children: (
              <SemesterScheduleExcelImport
                rooms={rooms}
                allBookings={allBookings}
                currentUserRole={currentUserRole}
                currentUserEmail={currentUserEmail}
                currentUserName={currentUserName}
                onClose={onClose}
                onScheduleCreated={onScheduleCreated}
              />
            )
          }
        ]}
      />
    </Modal>
  )
}
