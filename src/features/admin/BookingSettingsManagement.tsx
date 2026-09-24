import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  TimePicker,
  Typography,
  App,
  Switch
} from 'antd'
import {
  CheckOutlined,
  PlusOutlined,
  SettingOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  BOOKING_SETTINGS_QUERY_KEY,
  useBookingSettings,
  updateBookingSettings,
  validateBookingSettingsPayload
} from '../../api/bookingSettings'
import type { BookingSettings, ClosedPeriod } from '../../api/bookingSettings'
import type { Room } from '../../types/room'
import { http } from '../../api/http'
import { toVN, VN_TIMEZONE } from '../../utils/dateUtils'

async function fetchRooms(): Promise<Room[]> {
  try {
    const res = await http.get<Room[]>('/api/rooms')
    return res.data || []
  } catch (err) {
    console.error('Không thể tải danh sách phòng từ /api/rooms:', err)
    return []
  }
}

const { Title, Text, Paragraph } = Typography

const WORKING_DAY_OPTIONS = [
  { label: 'Thứ Hai', value: 1 },
  { label: 'Thứ Ba', value: 2 },
  { label: 'Thứ Tư', value: 3 },
  { label: 'Thứ Năm', value: 4 },
  { label: 'Thứ Sáu', value: 5 },
  { label: 'Thứ Bảy', value: 6 },
  { label: 'Chủ Nhật', value: 0 },
]

export default function BookingSettingsManagement() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()

  // Track if user has touched form to avoid clobbering edits during background refetch
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [currentRevision, setCurrentRevision] = useState<number | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)
  const [hasSaveError, setHasSaveError] = useState(false)
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)

  // Closed periods state (in-form editing)
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([])

  // Modal for Add/Edit closed period
  const [isPeriodModalVisible, setIsPeriodModalVisible] = useState(false)
  const [editingPeriodIndex, setEditingPeriodIndex] = useState<number | null>(null)
  const [periodForm] = Form.useForm()
  const [isAllDay, setIsAllDay] = useState(true)

  // Query booking settings from backend
  const {
    data: settingsData,
    isLoading: isSettingsLoading,
    isError: isSettingsError,
    refetch: refetchSettings
  } = useBookingSettings()

  // Query rooms for closed period room selector
  const roomsQuery = useQuery<Room[]>({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    staleTime: 5 * 60 * 1000
  })

  // Sync loaded data to form when not dirty or when refetched
  useEffect(() => {
    if (settingsData && !isFormDirty) {
      form.setFieldsValue({
        maxAdvanceDays: settingsData.maxAdvanceDays,
        minAdvanceMinutes: settingsData.minAdvanceMinutes,
        maxHoursPerBooking: settingsData.maxHoursPerBooking,
        minCancelHours: settingsData.minCancelHours,
        openTime: dayjs(settingsData.openTime, 'HH:mm'),
        closeTime: dayjs(settingsData.closeTime, 'HH:mm'),
        workingDays: settingsData.workingDays || [1, 2, 3, 4, 5, 6],
        studentMaxAdvanceDays: settingsData.studentMaxAdvanceDays ?? 7,
        studentMaxHoursPerBooking: settingsData.studentMaxHoursPerBooking ?? 3,
        facultyMaxAdvanceDays: settingsData.facultyMaxAdvanceDays ?? 30,
        facultyMaxHoursPerBooking: settingsData.facultyMaxHoursPerBooking ?? 8,
        autoApproveForFaculty: settingsData.autoApproveForFaculty ?? true,
        maxPendingBookingsPerUser: settingsData.maxPendingBookingsPerUser ?? 3,
        maxBookedHoursPerUserPerWeek: settingsData.maxBookedHoursPerUserPerWeek ?? 20,
        approvalReminderHours: settingsData.approvalReminderHours ?? 1.0,
        checkInGraceMinutes: settingsData.checkInGraceMinutes ?? 15,
      })
      setCurrentRevision(settingsData.revision)
      setClosedPeriods(settingsData.closedPeriods || [])
      setConflictError(null)
      setHasSaveError(false)
      setSaveErrorMessage(null)
    }
  }, [settingsData, isFormDirty, form])

  // Mutation to save settings
  const saveMutation = useMutation({
    mutationFn: updateBookingSettings,
    onSuccess: (updatedData) => {
      message.success('Đã lưu quy định vào hệ thống')
      queryClient.setQueryData(BOOKING_SETTINGS_QUERY_KEY, updatedData)
      queryClient.invalidateQueries({ queryKey: BOOKING_SETTINGS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })

      // Cập nhật form và revision bằng chính response của backend
      setCurrentRevision(updatedData.revision)
      setClosedPeriods(updatedData.closedPeriods || [])
      form.setFieldsValue({
        maxAdvanceDays: updatedData.maxAdvanceDays,
        minAdvanceMinutes: updatedData.minAdvanceMinutes,
        maxHoursPerBooking: updatedData.maxHoursPerBooking,
        minCancelHours: updatedData.minCancelHours,
        openTime: dayjs(updatedData.openTime, 'HH:mm'),
        closeTime: dayjs(updatedData.closeTime, 'HH:mm'),
        workingDays: updatedData.workingDays,
        studentMaxAdvanceDays: updatedData.studentMaxAdvanceDays,
        studentMaxHoursPerBooking: updatedData.studentMaxHoursPerBooking,
        facultyMaxAdvanceDays: updatedData.facultyMaxAdvanceDays,
        facultyMaxHoursPerBooking: updatedData.facultyMaxHoursPerBooking,
        autoApproveForFaculty: updatedData.autoApproveForFaculty,
        maxPendingBookingsPerUser: updatedData.maxPendingBookingsPerUser,
        maxBookedHoursPerUserPerWeek: updatedData.maxBookedHoursPerUserPerWeek,
        approvalReminderHours: updatedData.approvalReminderHours,
        checkInGraceMinutes: updatedData.checkInGraceMinutes,
      })
      setIsFormDirty(false)
      setConflictError(null)
      setHasSaveError(false)
      setSaveErrorMessage(null)
    },
    onError: (err: any) => {
      setHasSaveError(true)
      const status = err?.response?.status
      const isNetworkError =
        !err?.response ||
        err?.code === 'ECONNABORTED' ||
        err?.code === 'ERR_NETWORK' ||
        err?.message?.toLowerCase().includes('network error') ||
        err?.message?.toLowerCase().includes('failed to fetch') ||
        err?.message?.toLowerCase().includes('connection refused')

      if (isNetworkError) {
        const msg = 'Không thể kết nối với máy chủ. Quy định chưa được lưu. Vui lòng thử lại sau.'
        setSaveErrorMessage(msg)
        message.error(msg)
      } else if (status === 401) {
        const msg = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        setSaveErrorMessage(msg)
        message.error(msg)
      } else if (status === 403) {
        const msg = 'Tài khoản không có quyền sửa quy định.'
        setSaveErrorMessage(msg)
        message.error(msg)
      } else if (status === 409) {
        const msg = 'Quy định đã được quản trị viên khác cập nhật. Vui lòng tải lại dữ liệu mới trước khi lưu.'
        setConflictError(msg)
        setSaveErrorMessage(msg)
        message.error(msg)
      } else if (status === 400) {
        const serverMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          (typeof err?.response?.data === 'string' ? err?.response?.data : null) ||
          'Dữ liệu cấu hình không hợp lệ theo quy định của hệ thống.'
        setSaveErrorMessage(serverMsg)
        message.error(serverMsg)
      } else if (status === 500) {
        const msg = 'Máy chủ gặp lỗi khi lưu quy định. Quy định chưa được lưu. Vui lòng thử lại sau.'
        setSaveErrorMessage(msg)
        message.error(msg)
      } else {
        const serverMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Không thể kết nối với máy chủ. Quy định chưa được lưu. Vui lòng thử lại sau.'
        setSaveErrorMessage(serverMsg)
        message.error(serverMsg)
      }
    }
  })

  // Handle submit form
  const handleSave = async () => {
    if (!settingsData || isSettingsError || !isFormDirty || saveMutation.isPending) {
      return
    }

    try {
      const values = await form.validateFields()
      const openTimeStr = values.openTime.format('HH:mm')
      const closeTimeStr = values.closeTime.format('HH:mm')

      const payload: BookingSettings = {
        maxAdvanceDays: Number(values.maxAdvanceDays),
        minAdvanceMinutes: Number(values.minAdvanceMinutes),
        maxHoursPerBooking: Number(values.maxHoursPerBooking),
        minCancelHours: Number(values.minCancelHours),
        openTime: openTimeStr,
        closeTime: closeTimeStr,
        workingDays: values.workingDays || [],
        studentMaxAdvanceDays: Number(values.studentMaxAdvanceDays ?? 7),
        studentMaxHoursPerBooking: Number(values.studentMaxHoursPerBooking ?? 3),
        facultyMaxAdvanceDays: Number(values.facultyMaxAdvanceDays ?? 30),
        facultyMaxHoursPerBooking: Number(values.facultyMaxHoursPerBooking ?? 8),
        autoApproveForFaculty: values.autoApproveForFaculty !== false,
        maxPendingBookingsPerUser: Number(values.maxPendingBookingsPerUser ?? 3),
        maxBookedHoursPerUserPerWeek: Number(values.maxBookedHoursPerUserPerWeek ?? 20),
        approvalReminderHours: Number(values.approvalReminderHours ?? 1.0),
        checkInGraceMinutes: Number(values.checkInGraceMinutes ?? 15),
        closedPeriods: closedPeriods,
        revision: currentRevision ?? 0,
      }

      // Pre-validation
      const validationErrors = validateBookingSettingsPayload(payload)
      if (validationErrors.length > 0) {
        Modal.error({
          title: 'Dữ liệu quy định chưa hợp lệ',
          content: (
            <ul style={{ paddingLeft: 18, marginTop: 8 }}>
              {validationErrors.map((e, idx) => (
                <li key={idx} style={{ color: '#dc2626', marginBottom: 4 }}>{e}</li>
              ))}
            </ul>
          )
        })
        return
      }

      setHasSaveError(false)
      setSaveErrorMessage(null)
      saveMutation.mutate(payload)
    } catch {
      message.error('Vui lòng kiểm tra lại các trường thông tin trong biểu mẫu.')
    }
  }

  // Handle open add/edit period modal
  const handleOpenPeriodModal = (index?: number) => {
    if (typeof index === 'number') {
      // Edit
      const p = closedPeriods[index]
      setEditingPeriodIndex(index)
      const pStartVN = toVN(p.start)
      const pEndVN = toVN(p.end)
      const isWholeDay = pStartVN.format('HH:mm') === '00:00' && pEndVN.format('HH:mm') === '00:00'
      setIsAllDay(isWholeDay)

      periodForm.setFieldsValue({
        scope: p.roomId === null ? 'campus' : 'room',
        roomId: p.roomId ?? undefined,
        isAllDay: isWholeDay,
        dateRangeAllDay: isWholeDay ? [pStartVN, pEndVN.subtract(1, 'minute')] : undefined,
        dateRangeTime: !isWholeDay ? [pStartVN, pEndVN] : undefined,
        reason: p.reason,
      })
    } else {
      // Add new
      setEditingPeriodIndex(null)
      setIsAllDay(true)
      const tomorrowVN = toVN().add(1, 'day').startOf('day')
      periodForm.setFieldsValue({
        scope: 'campus',
        roomId: undefined,
        isAllDay: true,
        dateRangeAllDay: [tomorrowVN, tomorrowVN],
        dateRangeTime: undefined,
        reason: '',
      })
    }
    setIsPeriodModalVisible(true)
  }

  // Handle save period inside modal
  const handleSavePeriod = async () => {
    try {
      const values = await periodForm.validateFields()
      const isCampus = values.scope === 'campus'
      const targetRoomId = isCampus ? null : Number(values.roomId)

      let startIsoUtc: string
      let endIsoUtc: string

      if (values.isAllDay) {
        const [startDate, endDate] = values.dateRangeAllDay
        // Start: 00:00 VN of startDate converted to UTC ISO
        const startVN = toVN(startDate).startOf('day')
        // End: 00:00 VN of day following endDate converted to UTC ISO
        const endVN = toVN(endDate).add(1, 'day').startOf('day')
        startIsoUtc = dayjs.tz(startVN.format('YYYY-MM-DD HH:mm:ss'), VN_TIMEZONE).toISOString()
        endIsoUtc = dayjs.tz(endVN.format('YYYY-MM-DD HH:mm:ss'), VN_TIMEZONE).toISOString()
      } else {
        const [startDateTime, endDateTime] = values.dateRangeTime
        const startVN = toVN(startDateTime)
        const endVN = toVN(endDateTime)
        startIsoUtc = dayjs.tz(startVN.format('YYYY-MM-DD HH:mm:ss'), VN_TIMEZONE).toISOString()
        endIsoUtc = dayjs.tz(endVN.format('YYYY-MM-DD HH:mm:ss'), VN_TIMEZONE).toISOString()
      }

      if (!dayjs(endIsoUtc).isAfter(dayjs(startIsoUtc))) {
        message.error('Thời điểm kết thúc phải sau thời điểm bắt đầu!')
        return
      }

      const newPeriod: ClosedPeriod = {
        roomId: targetRoomId,
        start: startIsoUtc,
        end: endIsoUtc,
        reason: values.reason.trim(),
      }

      const updated = [...closedPeriods]
      if (editingPeriodIndex !== null) {
        updated[editingPeriodIndex] = newPeriod
      } else {
        updated.push(newPeriod)
      }

      setClosedPeriods(updated)
      setIsFormDirty(true)
      setIsPeriodModalVisible(false)
      periodForm.resetFields()
      message.info('Đã cập nhật khoảng nghỉ/bảo trì trên biểu mẫu. Hãy nhấn "Lưu quy định đặt phòng" ở cuối form để áp dụng.')
    } catch {
      // Form validation error handled by AntD
    }
  }

  // Handle delete period
  const handleDeletePeriod = (index: number) => {
    const updated = closedPeriods.filter((_, idx) => idx !== index)
    setClosedPeriods(updated)
    setIsFormDirty(true)
    message.info('Đã xóa khoảng nghỉ trên biểu mẫu. Hãy nhấn "Lưu quy định đặt phòng" ở cuối form để áp dụng.')
  }

  // Determine if Save button is disabled
  const isSaveDisabled =
    !settingsData ||
    isSettingsError ||
    !isFormDirty ||
    saveMutation.isPending ||
    isSettingsLoading

  // Period columns for table
  const periodColumns = [
    {
      title: 'Phạm vi',
      dataIndex: 'roomId',
      key: 'roomId',
      width: 170,
      render: (roomId: number | null) => {
        if (roomId === null) {
          return <Tag color="geekblue" style={{ fontWeight: 600 }}>🏛️ Toàn trường</Tag>
        }
        const room = roomsQuery.data?.find(r => r.id === roomId)
        return <Tag color="orange" style={{ fontWeight: 600 }}>🚪 {room ? room.name : `Phòng #${roomId}`}</Tag>
      }
    },
    {
      title: 'Thời gian bắt đầu (VN)',
      dataIndex: 'start',
      key: 'start',
      width: 180,
      render: (val: string) => toVN(val).format('HH:mm DD/MM/YYYY')
    },
    {
      title: 'Thời gian kết thúc (VN)',
      dataIndex: 'end',
      key: 'end',
      width: 180,
      render: (val: string) => toVN(val).format('HH:mm DD/MM/YYYY')
    },
    {
      title: 'Lý do nghỉ / Bảo trì',
      dataIndex: 'reason',
      key: 'reason',
      render: (val: string) => <Text style={{ color: '#334155' }}>{val}</Text>
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: any, __: any, index: number) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenPeriodModal(index)}
            style={{ color: '#0284c7' }}
            disabled={isSettingsError || !settingsData}
            title="Chỉnh sửa"
          />
          <Popconfirm
            title="Xác nhận xóa khoảng nghỉ/bảo trì này?"
            onConfirm={() => handleDeletePeriod(index)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            disabled={isSettingsError || !settingsData}
          >
            <Button
              type="text"
              icon={<DeleteOutlined />}
              danger
              disabled={isSettingsError || !settingsData}
              title="Xóa"
            />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, maxWidth: 960 }}>
      {/* Header - Không có nút bấm ở đầu trang */}
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <SettingOutlined style={{ color: '#0284c7' }} />
          Quy Định Đặt Phòng &amp; Tham Số Vận Hành
        </Title>
        {settingsData && !isSettingsError && currentRevision !== null && (
          <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'inline-block' }}>
            Phiên bản hiện tại: <Tag color="blue">Revision #{currentRevision}</Tag>
          </Text>
        )}
      </div>

      {/* API Error Alert khi tải trang không kết nối được backend */}
      {isSettingsError && (
        <Alert
          type="error"
          showIcon
          title="Không thể kết nối với máy chủ. Không thể tải quy định đặt phòng. Vui lòng thử lại sau."
          description={
            <div style={{ marginTop: 8 }}>
              <Button
                size="small"
                type="primary"
                danger
                onClick={() => {
                  setConflictError(null)
                  setHasSaveError(false)
                  refetchSettings()
                }}
              >
                Thử kết nối lại
              </Button>
            </div>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Save Error Alert khi lưu thất bại */}
      {hasSaveError && saveErrorMessage && (
        <Alert
          type="error"
          showIcon
          title="Chưa lưu được vào máy chủ"
          description={saveErrorMessage}
          style={{ marginBottom: 16 }}
          closable
          onClose={() => setHasSaveError(false)}
        />
      )}

      {/* Conflict Error (HTTP 409) */}
      {conflictError && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title="Phát hiện xung đột phiên bản cấu hình"
          description={
            <div>
              <p style={{ margin: '4px 0 8px' }}>{conflictError}</p>
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  setConflictError(null)
                  setIsFormDirty(false)
                  refetchSettings()
                }}
                style={{ background: '#d97706', borderColor: '#d97706' }}
              >
                Tải lại dữ liệu mới nhất
              </Button>
            </div>
          }
          style={{ marginBottom: 16, borderColor: '#fde68a', backgroundColor: '#fefce8' }}
        />
      )}

      {/* Dirty Warning */}
      {isFormDirty && !conflictError && !hasSaveError && (
        <Alert
          type="info"
          showIcon
          title="Bạn đang có thay đổi chưa lưu"
          description="Các thông số bạn chỉnh sửa đang nằm trên biểu mẫu. Bấm nút 'Lưu quy định đặt phòng' ở cuối form để lưu vào hệ thống."
          style={{ marginBottom: 16 }}
        />
      )}

      {isSettingsLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#64748b', fontSize: 14 }}>
            Đang tải quy định từ máy chủ…
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          disabled={isSettingsError || !settingsData}
          onValuesChange={() => {
            setIsFormDirty(true)
            setHasSaveError(false)
          }}
        >
          {/* Group: Quy định theo vai trò: Sinh viên & Giảng viên */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                Quy định phân quyền theo đối tượng (Sinh viên &amp; Giảng viên)
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f8fafc', borderRadius: 6, fontSize: 13, color: '#475569' }}>
              <strong>Lưu ý:</strong> Sinh viên không được tự ý đặt Hội trường (LectureHall) trừ khi gửi đơn yêu cầu xét duyệt đặc biệt. Giảng viên được ưu tiên thời hạn và thời lượng đặt phòng dài hơn.
            </div>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="studentMaxAdvanceDays"
                  label="Sinh viên: Đặt trước tối đa (ngày)"
                  tooltip="Số ngày tối đa Sinh viên được phép chọn lịch phòng trước (mặc định 7 ngày)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số ngày!' },
                    { type: 'number', min: 1, max: 365, message: 'Từ 1 đến 365 ngày!' }
                  ]}
                >
                  <InputNumber min={1} max={365} suffix="ngày" style={{ width: '100%' }} placeholder="VD: 7" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="studentMaxHoursPerBooking"
                  label="Sinh viên: Thời lượng tối đa mỗi lượt (giờ)"
                  tooltip="Thời lượng tối đa mỗi đơn đặt phòng của Sinh viên (mặc định 3.0 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập thời lượng!' },
                    { type: 'number', min: 0.5, max: 24, message: 'Từ 0.5 đến 24 giờ!' }
                  ]}
                >
                  <InputNumber min={0.5} max={24} step={0.5} suffix="giờ" style={{ width: '100%' }} placeholder="VD: 3" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="facultyMaxAdvanceDays"
                  label="Giảng viên: Đặt trước tối đa (ngày)"
                  tooltip="Số ngày tối đa Giảng viên được phép chọn lịch phòng trước (mặc định 30 ngày)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số ngày!' },
                    { type: 'number', min: 1, max: 365, message: 'Từ 1 đến 365 ngày!' }
                  ]}
                >
                  <InputNumber min={1} max={365} suffix="ngày" style={{ width: '100%' }} placeholder="VD: 30" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="facultyMaxHoursPerBooking"
                  label="Giảng viên: Thời lượng tối đa mỗi lượt (giờ)"
                  tooltip="Thời lượng tối đa mỗi đơn đặt phòng của Giảng viên (mặc định 8.0 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập thời lượng!' },
                    { type: 'number', min: 0.5, max: 24, message: 'Từ 0.5 đến 24 giờ!' }
                  ]}
                >
                  <InputNumber min={0.5} max={24} step={0.5} suffix="giờ" style={{ width: '100%' }} placeholder="VD: 8" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="autoApproveForFaculty"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Switch />
                <span style={{ fontWeight: 500, color: '#1e293b' }}>
                  Tự động phê duyệt đơn của Giảng viên (Áp dụng cho phòng thường, đơn đặc biệt vẫn cần duyệt)
                </span>
              </div>
            </Form.Item>
          </Card>

          {/* Group: Hạn mức số lượng đơn & Quản lý nhận phòng */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                Hạn mức sử dụng (Quotas), Nhắc duyệt &amp; Quy định Check-in
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="maxPendingBookingsPerUser"
                  label="Số đơn chờ duyệt tối đa / Người dùng"
                  tooltip="Mỗi người dùng không được có quá số đơn Pending này cùng lúc (mặc định 3 đơn)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số đơn!' },
                    { type: 'number', min: 1, max: 50, message: 'Từ 1 đến 50 đơn!' }
                  ]}
                >
                  <InputNumber min={1} max={50} suffix="đơn" style={{ width: '100%' }} placeholder="VD: 3" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="maxBookedHoursPerUserPerWeek"
                  label="Tổng số giờ đặt tối đa trong tuần (giờ/tuần)"
                  tooltip="Tính tổng số giờ của các đơn Pending, Approved, Using trong tuần (Thứ Hai đến Chủ Nhật, mặc định 20 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số giờ!' },
                    { type: 'number', min: 1, max: 168, message: 'Từ 1 đến 168 giờ/tuần!' }
                  ]}
                >
                  <InputNumber min={1} max={168} step={0.5} suffix="giờ/tuần" style={{ width: '100%' }} placeholder="VD: 20" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="approvalReminderHours"
                  label="Mốc nhắc duyệt khẩn cấp (giờ trước giờ bắt đầu)"
                  tooltip="Hệ thống quét các đơn Pending bắt đầu trong vòng mốc này để gửi thông báo khẩn cấp (mặc định 1.0 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số giờ nhắc!' },
                    { type: 'number', min: 0.25, max: 24, message: 'Từ 0.25 đến 24 giờ!' }
                  ]}
                >
                  <InputNumber min={0.25} max={24} step={0.25} suffix="giờ" style={{ width: '100%' }} placeholder="VD: 1.0" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="checkInGraceMinutes"
                  label="Thời gian ân hạn nhận phòng - Grace period (phút)"
                  tooltip="Khoảng thời gian cho phép check-in sau giờ bắt đầu. Quá thời gian này đơn sẽ tự động hủy No-show (mặc định 15 phút)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số phút!' },
                    { type: 'number', min: 5, max: 120, message: 'Từ 5 đến 120 phút!' }
                  ]}
                >
                  <InputNumber min={5} max={120} suffix="phút" style={{ width: '100%' }} placeholder="VD: 15" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          {/* Group 1 & 2: Hạn đặt trước */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                1 &amp; 2. Giới hạn thời gian đặt phòng trước
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="maxAdvanceDays"
                  label="Đặt trước tối đa chung (ngày)"
                  tooltip="Số ngày tối đa người dùng được phép chọn lịch phòng trước (mặc định 14 ngày)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số ngày đặt trước tối đa!' },
                    { type: 'number', min: 1, max: 365, message: 'Số ngày phải từ 1 đến 365!' }
                  ]}
                >
                  <InputNumber min={1} max={365} suffix="ngày" style={{ width: '100%' }} placeholder="VD: 14" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="minAdvanceMinutes"
                  label="Đặt trước tối thiểu (phút)"
                  tooltip="Khoảng thời gian tối thiểu trước khi phòng bắt đầu được sử dụng (mặc định 30 phút)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số phút đặt trước tối thiểu!' },
                    { type: 'number', min: 0, max: 1440, message: 'Số phút phải từ 0 đến 1440!' }
                  ]}
                >
                  <InputNumber min={0} max={1440} suffix="phút" style={{ width: '100%' }} placeholder="VD: 30" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Group 3: Thời lượng sử dụng tối đa mỗi lượt */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                3. Thời lượng sử dụng phòng tối đa chung
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="maxHoursPerBooking"
                  label="Thời lượng tối đa mỗi lượt đặt chung (giờ)"
                  tooltip="Thời lượng tối đa cho mỗi lượt mượn phòng học (mặc định 4.0 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập thời lượng tối đa!' },
                    { type: 'number', min: 0.5, max: 24, message: 'Thời lượng phải từ 0.5 đến 24 giờ!' }
                  ]}
                >
                  <InputNumber min={0.5} max={24} step={0.5} suffix="giờ" style={{ width: '100%' }} placeholder="VD: 4" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="minCancelHours"
                  label="Hủy phòng trước tối thiểu (giờ)"
                  tooltip="Số giờ tối thiểu trước khi bắt đầu mượn phòng để người dùng có thể tự hủy đơn (mặc định 2.0 giờ)."
                  rules={[
                    { required: true, message: 'Vui lòng nhập số giờ hủy tối thiểu!' },
                    { type: 'number', min: 0, max: 72, message: 'Số giờ phải từ 0 đến 72!' }
                  ]}
                >
                  <InputNumber min={0} max={72} step={0.5} suffix="giờ" style={{ width: '100%' }} placeholder="VD: 2" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Group 5: Giờ mở cửa & Đóng cửa */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <ClockCircleOutlined style={{ marginRight: 6 }} />
                5. Khung giờ mở cửa &amp; đóng cửa phòng học trong ngày
              </span>
            }
            style={{ marginBottom: 16, borderRadius: 8 }}
          >
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="openTime"
                  label="Giờ mở cửa"
                  tooltip="Giờ bắt đầu cho phép mượn và sử dụng các phòng học trong ngày (mặc định 07:00)."
                  rules={[{ required: true, message: 'Vui lòng chọn giờ mở cửa!' }]}
                >
                  <TimePicker
                    format="HH:mm"
                    minuteStep={15}
                    style={{ width: '100%' }}
                    placeholder="Chọn giờ mở cửa (VD: 07:00)"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  name="closeTime"
                  label="Giờ đóng cửa"
                  tooltip="Giờ kết thúc hoạt động của các phòng học trong ngày (mặc định 20:00). Các đơn mượn phòng phải kết thúc chậm nhất tại mốc này."
                  rules={[{ required: true, message: 'Vui lòng chọn giờ đóng cửa!' }]}
                >
                  <TimePicker
                    format="HH:mm"
                    minuteStep={15}
                    style={{ width: '100%' }}
                    placeholder="Chọn giờ đóng cửa (VD: 20:00)"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Group 6: Ngày hoạt động trong tuần & Danh sách ngày nghỉ/bảo trì */}
          <Card
            size="small"
            title={
              <span style={{ color: '#0369a1', fontWeight: 600 }}>
                <CalendarOutlined style={{ marginRight: 6 }} />
                6. Ngày hoạt động trong tuần &amp; Danh sách ngày nghỉ / bảo trì
              </span>
            }
            style={{ marginBottom: 20, borderRadius: 8 }}
          >
            <Form.Item
              name="workingDays"
              label="Các ngày hoạt động trong tuần"
              tooltip="Người dùng chỉ được phép chọn các ngày thuộc danh sách này khi đặt phòng."
              rules={[{ required: true, message: 'Vui lòng chọn ít nhất một ngày hoạt động trong tuần!' }]}
            >
              <Checkbox.Group
                options={WORKING_DAY_OPTIONS}
                style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 4 }}
              />
            </Form.Item>

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
                    Danh sách ngày nghỉ toàn trường &amp; bảo trì phòng học
                  </Text>
                  <Paragraph type="secondary" style={{ fontSize: 12.5, margin: '2px 0 0' }}>
                    Các khung thời gian này sẽ được khóa trên lịch và hệ thống sẽ chặn không cho đặt phòng mới.
                  </Paragraph>
                </div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenPeriodModal()}
                  disabled={isSettingsError || !settingsData}
                  style={{ borderColor: '#0284c7', color: '#0284c7', fontWeight: 500 }}
                >
                  Thêm ngày nghỉ / bảo trì
                </Button>
              </div>

              <Table
                columns={periodColumns}
                dataSource={closedPeriods.map((p, idx) => ({ ...p, key: idx }))}
                pagination={false}
                size="small"
                bordered
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: 'Chưa có khoảng nghỉ hoặc bảo trì nào được thiết lập'
                }}
              />
            </div>
          </Card>

          {/* Bottom actions: Chỉ giữ lại một nút duy nhất ở cuối form */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleSave}
              loading={saveMutation.isPending}
              disabled={isSaveDisabled}
              style={{
                background: isSaveDisabled ? undefined : '#0284c7',
                borderColor: isSaveDisabled ? undefined : '#0284c7',
                padding: '0 28px',
                fontWeight: 600,
                height: 40
              }}
            >
              Lưu quy định đặt phòng
            </Button>
          </div>
        </Form>
      )}

      {/* Modal Add / Edit Closed Period */}
      <Modal
        title={editingPeriodIndex !== null ? 'Chỉnh sửa khoảng nghỉ / bảo trì' : 'Thêm khoảng nghỉ toàn trường hoặc bảo trì phòng'}
        open={isPeriodModalVisible}
        onOk={handleSavePeriod}
        onCancel={() => {
          setIsPeriodModalVisible(false)
          periodForm.resetFields()
        }}
        okText={editingPeriodIndex !== null ? 'Cập nhật' : 'Thêm vào danh sách'}
        cancelText="Đóng"
        destroyOnHidden
        width={560}
      >
        <Form form={periodForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="scope"
            label="Phạm vi áp dụng"
            rules={[{ required: true }]}
            initialValue="campus"
          >
            <Radio.Group onChange={(e) => {
              if (e.target.value === 'campus') {
                periodForm.setFieldValue('roomId', undefined)
              }
            }}>
              <Radio.Button value="campus">Toàn trường (Tất cả phòng)</Radio.Button>
              <Radio.Button value="room">Theo phòng cụ thể</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.scope !== cur.scope}
          >
            {({ getFieldValue }) =>
              getFieldValue('scope') === 'room' ? (
                <Form.Item
                  name="roomId"
                  label="Chọn phòng học bảo trì"
                  rules={[{ required: true, message: 'Vui lòng chọn phòng học!' }]}
                >
                  <Select
                    placeholder="Chọn phòng học trong danh mục..."
                    showSearch
                    optionFilterProp="children"
                  >
                    {roomsQuery.data?.map(r => (
                      <Select.Option key={r.id} value={r.id}>
                        {r.name} {r.building ? `(${r.building})` : ''} - Sức chứa {r.capacity}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="isAllDay"
            label="Hình thức nghỉ / bảo trì"
            valuePropName="checked"
            initialValue={true}
          >
            <Checkbox onChange={(e) => setIsAllDay(e.target.checked)}>
              Nghỉ trọn ngày (từ 00:00 ngày bắt đầu đến 00:00 ngày hôm sau theo giờ VN)
            </Checkbox>
          </Form.Item>

          {isAllDay ? (
            <Form.Item
              name="dateRangeAllDay"
              label="Chọn ngày nghỉ (Giờ Việt Nam)"
              rules={[{ required: true, message: 'Vui lòng chọn dải ngày!' }]}
            >
              <DatePicker.RangePicker
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder={['Ngày bắt đầu', 'Ngày kết thúc']}
              />
            </Form.Item>
          ) : (
            <Form.Item
              name="dateRangeTime"
              label="Thời gian cụ thể (Bắt đầu - Kết thúc)"
              rules={[{ required: true, message: 'Vui lòng chọn dải thời gian chi tiết!' }]}
            >
              <DatePicker.RangePicker
                showTime={{ format: 'HH:mm' }}
                format="DD/MM/YYYY HH:mm"
                style={{ width: '100%' }}
                placeholder={['Thời điểm bắt đầu', 'Thời điểm kết thúc']}
              />
            </Form.Item>
          )}

          <Form.Item
            name="reason"
            label="Lý do nghỉ / Bảo trì"
            rules={[
              { required: true, message: 'Vui lòng nhập lý do!' },
              { max: 300, message: 'Lý do không được vượt quá 300 ký tự!' }
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Nghỉ lễ Quốc khánh 02/09, hoặc Bảo dưỡng hệ thống máy chiếu..."
              maxLength={300}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

