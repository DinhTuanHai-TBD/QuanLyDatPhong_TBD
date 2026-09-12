
import { QRCodeSVG } from 'qrcode.react'
import { Modal, Form, DatePicker, Select, Row, Col, Alert, Button, Empty, Tag, Typography, Input, InputNumber, Pagination, App } from 'antd'
import dayjs from 'dayjs'
import { HomeOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getUserRole } from '../../api/authUtils'
import { useState, useEffect } from 'react'
import { http } from '../../api/http'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'
import { isBookingExpired, getEffectiveBooking } from '../../utils/bookingStatusUtils'
import type { EquipmentItem } from '../admin/AdminPage'
import { EquipmentSelector } from './EquipmentSelector'

async function fetchMyBookings(): Promise<Booking[]> {
  const response = await http.get<Booking[]>('/api/bookings/mine')
  return response.data
}

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00'
]

const getDurationText = (startTime: string, endTime: string) => {
  const start = dayjs(startTime)
  const end = dayjs(endTime)
  if (!start.isValid() || !end.isValid()) return ''
  const diffMinutes = Math.max(0, end.diff(start, 'minute'))
  if (diffMinutes === 0) return '0 phút'
  const hours = Math.floor(diffMinutes / 60)
  const mins = diffMinutes % 60
  if (hours > 0 && mins === 0) return `${hours} giờ`
  if (hours > 0) return `${hours} giờ ${mins} phút`
  return `${mins} phút`
}

export const isExpiredBooking = (b: any): boolean => {
  if (!b) return false
  const s = String(b.status).toLowerCase()
  const reason = (b.rejectReason || b.rejectionReason || b.notes || '').toLowerCase()
  return s === '3' || s === 'expired' || reason.includes('hết hạn') || isBookingExpired(b)
}

const renderHistoryStatusTag = (status: any, record?: any) => {
  const s = String(status).toLowerCase()
  const isExpired = s === 'expired' || s === '3' || (record && isExpiredBooking(record))

  if (isExpired) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#f1f5f9',
          color: '#475569',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #e2e8f0'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
        Hết hạn
      </span>
    )
  }

  const isPending = s === '0' || s === 'pending' || s === 'pendingspecial'
  const isApproved = s === '1' || s === 'approved'
  const isRejected = s === '2' || s === 'rejected'
  const isCancelled = s === '-1' || s === 'cancelled'
  const isUsing = s === 'using'
  const isCompleted = s === 'completed'

  if (isPending) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#fffbeb',
          color: '#b45309',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #fef3c7'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
        {status === 'PendingSpecial' ? 'Chờ duyệt đặc biệt' : 'Chờ phê duyệt'}
      </span>
    )
  }

  if (isApproved) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#ecfdf5',
          color: '#047857',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #d1fae5'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
        Đã phê duyệt
      </span>
    )
  }

  if (isRejected) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #fee2e2'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
        Từ chối
      </span>
    )
  }

  if (isCancelled) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#f8fafc',
          color: '#475569',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #e2e8f0'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
        Đã hủy
      </span>
    )
  }

  if (isUsing) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#f0f9ff',
          color: '#0369a1',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #e0f2fe'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#0284c7', display: 'inline-block' }} />
        Đang sử dụng
      </span>
    )
  }

  if (isCompleted) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          backgroundColor: '#f0fdfa',
          color: '#0f766e',
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          border: '1px solid #ccfbf1'
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#14b8a6', display: 'inline-block' }} />
        Hoàn thành
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f8fafc',
        color: '#475569',
        padding: '4px 10px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        border: '1px solid #e2e8f0'
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#94a3b8', display: 'inline-block' }} />
      {status}
    </span>
  )
}

type StatusTabKey = 'all' | 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'

interface BookingCardProps {
  record: Booking
  now: dayjs.Dayjs
  handleEditClick: (b: Booking) => void
  handleCancelClick: (b: Booking) => void
  handleDetailClick: (b: Booking) => void
  setSelectedBookingForQR: (b: Booking) => void
  setQrModalVisible: (v: boolean) => void
  setCheckoutModalVisible: (v: boolean) => void
}

function BookingCard({
  record,
  now,
  handleEditClick,
  handleCancelClick,
  handleDetailClick,
  setSelectedBookingForQR,
  setQrModalVisible,
  setCheckoutModalVisible
}: BookingCardProps) {
  const isExpired = isExpiredBooking(record)
  const isPending = !isExpired && (String(record.status) === '0' || record.status === 'Pending' || record.status === 'PendingSpecial')
  const isApproved = !isExpired && (String(record.status) === '1' || record.status === 'Approved')
  const isUsing = !isExpired && record.status === 'Using'
  const isEditable = isPending
  const isCancellable = (isPending || isApproved) && !isExpired

  const startTime = dayjs(record.startTime)
  const diffMinutes = startTime.diff(now, 'minute', true)

  const canCheckIn = isApproved && diffMinutes <= 15 && diffMinutes >= -15
  const isNoShowRisk = isApproved && diffMinutes < -15

  const durationText = getDurationText(record.startTime, record.endTime)
  const equipmentsStr = record.requestedEquipments && record.requestedEquipments.length > 0
    ? record.requestedEquipments.join(' • ')
    : 'Không có thiết bị mượn kèm'

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'all 0.15s ease'
      }}
    >
      {/* 1. Header Thẻ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            {dayjs(record.startTime).format('DD/MM/YYYY')}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
            {dayjs(record.startTime).format('HH:mm')} - {dayjs(record.endTime).format('HH:mm')}
          </span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            (Thời lượng: {durationText})
          </span>
        </div>
        <div>
          {renderHistoryStatusTag(isExpired ? 'Expired' : record.status, record)}
        </div>
      </div>

      {/* 2. Body Thẻ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Mã đơn & Tên phòng */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: '#0d2e5c' }}>
            Phòng {record.roomName}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>
            #TBD-{record.id}
          </span>
          {record.department && (
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              • {record.department}
            </span>
          )}
        </div>

        {/* Thông tin chi tiết phiếu */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '8px 24px', fontSize: 14 }}>
          <div>
            <span style={{ color: '#64748b' }}>Mục đích: </span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>{record.purpose || 'Chưa cung cấp'}</span>
          </div>

          <div>
            <span style={{ color: '#64748b' }}>Người phụ trách: </span>
            <span style={{ color: '#1e293b', fontWeight: 500 }}>
              {record.personInCharge || record.userEmail || 'Chưa cập nhật'}
            </span>
          </div>

          {record.participantCount && (
            <div>
              <span style={{ color: '#64748b' }}>Sĩ số: </span>
              <span style={{ color: '#1e293b', fontWeight: 500 }}>{record.participantCount} người</span>
            </div>
          )}

          <div>
            <span style={{ color: '#64748b' }}>Thiết bị: </span>
            <span style={{ color: '#334155' }}>{equipmentsStr}</span>
          </div>
        </div>

        {/* Khung thông báo đơn hết hạn */}
        {isExpired && (
          <div
            style={{
              marginTop: 4,
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              color: '#475569',
              fontSize: 13,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <div style={{ flex: 1 }}>
              <strong style={{ color: '#334155' }}>Thông báo hết hạn:</strong>{' '}
              <span>Đơn đặt phòng đã hết hạn xử lý do đã quá thời gian bắt đầu sử dụng.</span>
            </div>
          </div>
        )}

        {/* Thời gian Check-in / Check-out thực tế */}
        {!isExpired && (record.actualStartTime || record.actualEndTime) && (
          <div style={{ fontSize: 13, color: '#059669', display: 'flex', gap: 16, marginTop: 4 }}>
            {record.actualStartTime && <span>Đã Check-in: <strong>{dayjs(record.actualStartTime).format('HH:mm DD/MM')}</strong></span>}
            {record.actualEndTime && <span>Đã Check-out: <strong>{dayjs(record.actualEndTime).format('HH:mm DD/MM')}</strong></span>}
          </div>
        )}

        {/* Khung ghi chú từ chối / hủy (chỉ hiển thị khi KHÔNG phải đơn hết hạn) */}
        {!isExpired && (record.rejectReason || record.rejectionReason) && (String(record.status) === '2' || record.status === 'Rejected' || String(record.status) === 'Cancelled' || String(record.status) === '-1') && (
          <div
            style={{
              marginTop: 4,
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              color: '#b91c1c',
              fontSize: 13,
              lineHeight: 1.5
            }}
          >
            <strong>Lý do từ chối từ Ban Quản lý:</strong> {record.rejectReason || record.rejectionReason}
            {(record as any).cancelledBy && (
              <div style={{ marginTop: 2, fontSize: 12, color: '#991b1b' }}>
                Người hủy: {(record as any).cancelledBy} {(record as any).cancelledAt && `(${dayjs((record as any).cancelledAt).format('HH:mm DD/MM/YYYY')})`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Footer Thẻ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 14,
          borderTop: '1px solid #f1f5f9'
        }}
      >
        {/* Thông báo trạng thái Check-in */}
        <div>
          {isApproved && (
            <span style={{ fontSize: 13, fontWeight: 500, color: diffMinutes <= 15 && diffMinutes > 0 ? '#d97706' : '#64748b' }}>
              {diffMinutes > 15 ? 'Check-in mở trước 15 phút' :
               diffMinutes > 0 ? `Có thể check-in (còn ${Math.floor(diffMinutes)} phút)` :
               canCheckIn ? 'Đang trong thời gian check-in' :
               isNoShowRisk ? 'Quá giờ check-in (No-show)' : ''}
            </span>
          )}
          {isNoShowRisk && (
            <span style={{ marginLeft: 8, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 4, border: '1px solid #fecaca' }}>
              Quá hạn
            </span>
          )}
        </div>

        {/* Các nút thao tác chữ rõ ràng */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {isExpired && (
            <button
              type="button"
              onClick={() => {
                const targetRoomId = record.roomId || (record as any).room_id;
                window.location.href = targetRoomId ? `/bookings?roomId=${targetRoomId}` : '/bookings';
              }}
              style={{
                background: '#0d2e5c',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              Đặt lại ca khác
            </button>
          )}

          {isApproved && canCheckIn && (
            <button
              type="button"
              onClick={() => { setSelectedBookingForQR(record); setQrModalVisible(true); }}
              style={{
                background: '#10b981',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              Check-in
            </button>
          )}

          {isUsing && (
            <button
              type="button"
              onClick={() => { setSelectedBookingForQR(record); setCheckoutModalVisible(true); }}
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
            >
              Check-out
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDetailClick(record)}
            style={{
              background: '#ffffff',
              color: '#0d2e5c',
              border: '1px solid #cbd5e1',
              padding: '6px 14px',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Xem chi tiết
          </button>

          {isEditable && (
            <button
              type="button"
              onClick={() => handleEditClick(record)}
              style={{
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Chỉnh sửa
            </button>
          )}

          {isCancellable && (
            <button
              type="button"
              onClick={() => handleCancelClick(record)}
              style={{
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                padding: '6px 14px',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Hủy đặt phòng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BookingHistoryPage() {
  const queryClient = useQueryClient()
  const { message: AppMessage } = App.useApp()

  const [now, setNow] = useState(dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [selectedBookingForQR, setSelectedBookingForQR] = useState<Booking | null>(null)

  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false)

  const [cancelModalVisible, setCancelModalVisible] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null)

  const [editModalVisible, setEditModalVisible] = useState(false)
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null)
  const [editForm] = Form.useForm()

  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedBookingForDetail, setSelectedBookingForDetail] = useState<Booking | null>(null)

  const [cancelReason, setCancelReason] = useState('')
  const [checkoutForm] = Form.useForm()

  const [searchText, setSearchText] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTabKey>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 6

  const checkinMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await http.put(`/api/bookings/${id}/checkin`)
        return res.data
      } catch {
        throw new Error('Backend cần bổ sung endpoint PUT /api/bookings/:id/checkin để xử lý Check-in.')
      }
    },
    onSuccess: () => {
      AppMessage.success('Check-in thành công!')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      setQrModalVisible(false)
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi Check-in!')
    }
  })

  const checkoutMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number, notes: string }) => {
      try {
        const res = await http.put(`/api/bookings/${id}/checkout`, { notes })
        return res.data
      } catch {
        throw new Error('Backend cần bổ sung endpoint PUT /api/bookings/:id/checkout để xử lý Check-out.')
      }
    },
    onSuccess: () => {
      AppMessage.success('Check-out thành công!')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      setCheckoutModalVisible(false)
      checkoutForm.resetFields()
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi Check-out!')
    }
  })

  const handleSimulateCheckIn = () => {
    if (selectedBookingForQR) {
      checkinMutation.mutate(selectedBookingForQR.id)
    }
  }

  const handleCheckoutSubmit = (values: any) => {
    if (selectedBookingForQR) {
      checkoutMutation.mutate({ id: selectedBookingForQR.id, notes: values.notes })
    }
  }

  const bookingsQuery = useQuery<Booking[]>({ queryKey: ['my-bookings'], queryFn: fetchMyBookings })

  useEffect(() => {
    if (bookingsQuery.data) {
      const currentTime = new Date().getTime()
      let startingSoon = 0
      bookingsQuery.data.forEach((b: Booking) => {
        if (b.status === 'Approved' || String(b.status) === '1') {
          const startTime = new Date(b.startTime).getTime()
          if (startTime - currentTime > 0 && startTime - currentTime < 30 * 60 * 1000) {
            startingSoon++
          }
        }
      })
      if (startingSoon > 0) {
        if (!sessionStorage.getItem('tbd_starting_soon_notified')) {
          sessionStorage.setItem('tbd_starting_soon_notified', 'true')
        }
      }
    }
  }, [bookingsQuery.data])

  const roomsQuery = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        const res = await http.get<Room[]>('/api/rooms')
        return getOfficialRooms(res.data)
      } catch {
        const localStr = localStorage.getItem('tbd_admin_rooms')
        if (localStr) return getOfficialRooms(JSON.parse(localStr))
        return getOfficialRooms()
      }
    }
  })

  const DEFAULT_EQUIPMENTS: EquipmentItem[] = [
    { id: 101, code: 'EQ-MC-001', name: 'Micro không dây Shure (Bộ 2 mic)', type: 'Microphone', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 10, status: 'Active' },
    { id: 102, code: 'EQ-SP-002', name: 'Loa kéo công suất lớn 500W', type: 'Sound System', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 5, status: 'Active' },
    { id: 103, code: 'EQ-PJ-003', name: 'Máy chiếu di động Panasonic PT-LB386', type: 'Projector', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 4, status: 'Active' },
    { id: 104, code: 'EQ-CAM-004', name: 'Webcam/Camera họp & giảng dạy trực tuyến HD', type: 'Camera', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 6, status: 'Active' },
    { id: 105, code: 'EQ-BO-005', name: 'Bảng di động Flipchart / Bảng phụ', type: 'Board', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 8, status: 'Active' },
    { id: 106, code: 'EQ-EXT-006', name: 'Ổ cắm điện kéo dài (Dây 10m)', type: 'Extension Cord', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 12, status: 'Active' },
    { id: 107, code: 'EQ-PRES-007', name: 'Bút trình chiếu Laser (Presenter)', type: 'Presenter', roomId: null, roomName: 'Kho thiết bị dùng chung', quantity: 15, status: 'Active' }
  ]

  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      try {
        const res = await http.get<EquipmentItem[]>('/api/equipments')
        if (Array.isArray(res.data) && res.data.length > 0) return res.data
      } catch {}
      const localStr = localStorage.getItem('tbd_equipments') || localStorage.getItem('tbd_admin_equipments')
      if (localStr) {
        try {
          const parsed = JSON.parse(localStr)
          if (Array.isArray(parsed) && parsed.length > 0) return parsed
        } catch {}
      }
      return DEFAULT_EQUIPMENTS
    }
  })

  const allBookingsQuery = useQuery({
    queryKey: ['all-bookings'],
    queryFn: async () => {
      try {
        return (await http.get<Booking[]>('/api/bookings')).data
      } catch {
        const localStr = localStorage.getItem('tbd_admin_bookings')
        if (localStr) return JSON.parse(localStr) as Booking[]
        return []
      }
    }
  })

  const watchedDate = Form.useWatch('date', editForm) || dayjs()
  const watchedStartTime = Form.useWatch('startTime', editForm) || '07:00'
  const watchedEndTime = Form.useWatch('endTime', editForm) || '08:00'

  const selectedRoom = roomsQuery.data?.find(r => r.id === bookingToEdit?.roomId || r.name === bookingToEdit?.roomName)
  const selectedRoomCapacity = selectedRoom?.capacity || bookingToEdit?.participantCount || 50

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number, reason: string }) => {
      try {
        const res = await http.put(`/api/bookings/${id}/cancel`, { reason })
        return res.data
      } catch {
        throw new Error('Backend cần bổ sung endpoint PUT /api/bookings/:id/cancel để xử lý hủy lịch cùng với lý do.')
      }
    },
    onSuccess: () => {
      AppMessage.success('Đã hủy yêu cầu đặt phòng thành công!')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      setCancelModalVisible(false)
      setBookingToCancel(null)
      setCancelReason('')
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi hủy đặt phòng!')
    }
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const res = await http.put(`/api/bookings/${id}`, data)
      return res.data
    },
    onSuccess: () => {
      AppMessage.success('Cập nhật yêu cầu đặt phòng thành công!')
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] })
      queryClient.invalidateQueries({ queryKey: ['all-bookings'] })
      setEditModalVisible(false)
      setBookingToEdit(null)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.response?.data?.error || error.message || 'Lỗi khi cập nhật đặt phòng!'
      AppMessage.error(msg)
    }
  })

  const handleEditClick = (booking: Booking) => {
    setBookingToEdit(booking)
    const startDayjs = dayjs(booking.startTime)
    const endDayjs = dayjs(booking.endTime)

    editForm.setFieldsValue({
      date: startDayjs.isValid() ? startDayjs.startOf('day') : dayjs(),
      startTime: startDayjs.isValid() ? startDayjs.format('HH:mm') : '07:00',
      endTime: endDayjs.isValid() ? endDayjs.format('HH:mm') : '08:00',
      purpose: booking.purpose || '',
      participantCount: booking.participantCount || 1,
      department: booking.department || '',
      personInCharge: booking.personInCharge || '',
      requestedEquipments: booking.requestedEquipments || [],
      notes: booking.notes || ''
    })
    setEditModalVisible(true)
  }

  const handleEditSubmit = async () => {
    try {
      const values = await editForm.validateFields()
      if (!bookingToEdit) return

      const selectedDate = values.date as dayjs.Dayjs
      const dateStr = selectedDate.format('YYYY-MM-DD')
      const startTimeIso = `${dateStr}T${values.startTime}:00`
      const endTimeIso = `${dateStr}T${values.endTime}:00`

      const [startH, startM] = (values.startTime as string).split(':').map(Number)
      const [endH, endM] = (values.endTime as string).split(':').map(Number)
      if (endH * 60 + endM <= startH * 60 + startM) {
        AppMessage.error('Giờ kết thúc phải lớn hơn giờ bắt đầu!')
        return
      }

      if (values.participantCount > selectedRoomCapacity) {
        AppMessage.error(`Số lượng người (${values.participantCount}) vượt quá sức chứa tối đa của phòng ${bookingToEdit.roomName} (${selectedRoomCapacity} người).`)
        return
      }

      const updatedPayload: Partial<Booking> = {
        ...bookingToEdit,
        startTime: startTimeIso,
        endTime: endTimeIso,
        purpose: values.purpose,
        participantCount: values.participantCount,
        department: values.department,
        personInCharge: values.personInCharge,
        requestedEquipments: values.requestedEquipments || [],
        notes: values.notes || ''
      }

      editMutation.mutate({ id: bookingToEdit.id, data: updatedPayload })
    } catch {
      // Form validation errors handled by AntD
    }
  }

  const checkCanCancel = (booking: Booking) => {
    const isStudent = getUserRole() === 'student'
    const isLectureHall = booking.roomName.toLowerCase().includes('hội trường')
    const start = dayjs(booking.startTime)
    const currentTime = dayjs()
    const diffHours = start.diff(currentTime, 'hour', true)

    if (isLectureHall && diffHours < 24) {
      return { can: false, reason: 'Phòng Hội trường phải hủy trước ít nhất 24 giờ.' }
    }
    if (isStudent && diffHours < 2) {
      return { can: false, reason: 'Sinh viên phải hủy trước ít nhất 2 giờ.' }
    }
    if (start.isBefore(currentTime)) {
      return { can: false, reason: 'Không thể hủy lịch trong quá khứ.' }
    }
    return { can: true }
  }

  const handleCancelClick = (booking: Booking) => {
    const { can, reason } = checkCanCancel(booking)
    if (!can) {
      AppMessage.error(`Không thể hủy: ${reason}`)
      return
    }
    setBookingToCancel(booking)
    setCancelModalVisible(true)
  }

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      AppMessage.error('Vui lòng nhập lý do hủy phòng!')
      return
    }
    if (bookingToCancel) {
      cancelMutation.mutate({ id: bookingToCancel.id, reason: cancelReason })
    }
  }

  const handleDetailClick = (booking: Booking) => {
    setSelectedBookingForDetail(booking)
    setDetailModalVisible(true)
  }

  const bookingsData = (() => {
    const apiData = bookingsQuery.data ?? []
    return apiData.map((b) => getEffectiveBooking(b))
  })()

  const isPendingBooking = (b: Booking) => {
    if (isExpiredBooking(b)) return false
    const s = String(b.status).toLowerCase()
    return s === '0' || s === 'pending' || s === 'pendingspecial'
  }

  const isApprovedBooking = (b: Booking) => {
    if (isExpiredBooking(b)) return false
    const s = String(b.status).toLowerCase()
    return s === '1' || s === 'approved' || s === 'using' || s === 'completed'
  }

  const isRejectedBooking = (b: Booking) => {
    if (isExpiredBooking(b)) return false
    const s = String(b.status).toLowerCase()
    return s === '2' || s === 'rejected'
  }

  const isCancelledBooking = (b: Booking) => {
    if (isExpiredBooking(b)) return false
    const s = String(b.status).toLowerCase()
    const reason = (b.rejectReason || b.rejectionReason || b.notes || '').toLowerCase()
    if (reason.includes('hết hạn')) return false
    return s === '-1' || s === 'cancelled'
  }

  const totalCount = bookingsData.length
  const pendingCount = bookingsData.filter(isPendingBooking).length
  const approvedCount = bookingsData.filter(isApprovedBooking).length
  const rejectedCount = bookingsData.filter(isRejectedBooking).length
  const cancelledCount = bookingsData.filter(isCancelledBooking).length
  const expiredCount = bookingsData.filter(isExpiredBooking).length

  const handleTabChange = (key: StatusTabKey) => {
    setStatusTab(key)
    setCurrentPage(1)
  }

  // Client-side filtering
  const filteredBookings = bookingsData.filter((booking) => {
    const q = searchText.trim().toLowerCase()
    const matchesSearch = !q || 
      booking.roomName.toLowerCase().includes(q) || 
      (booking.purpose ?? '').toLowerCase().includes(q) ||
      (booking.personInCharge ?? '').toLowerCase().includes(q) ||
      `#tbd-${booking.id}`.toLowerCase().includes(q)

    if (!matchesSearch) return false

    if (statusTab === 'all') return true
    if (statusTab === 'pending') return isPendingBooking(booking)
    if (statusTab === 'approved') return isApprovedBooking(booking)
    if (statusTab === 'rejected') return isRejectedBooking(booking)
    if (statusTab === 'cancelled') return isCancelledBooking(booking)
    if (statusTab === 'expired') return isExpiredBooking(booking)

    return true
  }).sort((a, b) => dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf())

  const paginatedBookings = filteredBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      {/* Tiêu đề trang học thuật */}
      <div className="page-heading" style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
            Lịch Sử Đặt Phòng
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 15, marginTop: 6, marginBottom: 0 }}>
            Theo dõi trạng thái các yêu cầu đặt phòng và quản lý phiếu mượn tại Đại học Thái Bình Dương.
          </Typography.Paragraph>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          loading={bookingsQuery.isFetching} 
          onClick={() => bookingsQuery.refetch()}
          size="middle"
          style={{ borderRadius: 6, fontWeight: 500 }}
        >
          Tải lại
        </Button>
      </div>

      {bookingsQuery.isError && (
        <Alert
          type="error"
          showIcon
          title="Không thể tải lịch sử đặt phòng"
          description="Vui lòng kiểm tra lại kết nối máy chủ hoặc thử đăng xuất rồi đăng nhập lại."
          action={<Button size="small" type="dashed" onClick={() => bookingsQuery.refetch()}>Thử lại</Button>}
          style={{ marginBottom: 24, borderRadius: 8 }}
        />
      )}

      {/* 1. Bố cục Bộ Lọc Phẳng & Thanh Tab Trạng Thái Tối Giản */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          {/* Ô tìm kiếm phẳng */}
          <Input
            placeholder="Tìm kiếm theo tên phòng, mục đích mượn..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setCurrentPage(1)
            }}
            style={{ width: '100%', maxWidth: 380, borderRadius: 6, padding: '7px 12px' }}
            allowClear
          />

          {/* Thanh Tab trạng thái tối giản bằng văn bản */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#f8fafc',
              padding: '4px 6px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              maxWidth: '100%',
              WebkitOverflowScrolling: 'touch',
              whiteSpace: 'nowrap'
            }}
          >
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              style={{
                background: statusTab === 'all' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'all' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'all' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Tất cả ({totalCount})
            </button>

            <span style={{ color: '#cbd5e1', margin: '0 2px', userSelect: 'none' }}>|</span>

            <button
              type="button"
              onClick={() => handleTabChange('pending')}
              style={{
                background: statusTab === 'pending' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'pending' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'pending' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Chờ duyệt ({pendingCount})
            </button>

            <span style={{ color: '#cbd5e1', margin: '0 2px', userSelect: 'none' }}>|</span>

            <button
              type="button"
              onClick={() => handleTabChange('approved')}
              style={{
                background: statusTab === 'approved' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'approved' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'approved' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Đã duyệt ({approvedCount})
            </button>

            <span style={{ color: '#cbd5e1', margin: '0 2px', userSelect: 'none' }}>|</span>

            <button
              type="button"
              onClick={() => handleTabChange('rejected')}
              style={{
                background: statusTab === 'rejected' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'rejected' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'rejected' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Từ chối ({rejectedCount})
            </button>

            <span style={{ color: '#cbd5e1', margin: '0 2px', userSelect: 'none' }}>|</span>

            <button
              type="button"
              onClick={() => handleTabChange('cancelled')}
              style={{
                background: statusTab === 'cancelled' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'cancelled' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'cancelled' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Đã hủy ({cancelledCount})
            </button>

            <span style={{ color: '#cbd5e1', margin: '0 2px', userSelect: 'none' }}>|</span>

            <button
              type="button"
              onClick={() => handleTabChange('expired')}
              style={{
                background: statusTab === 'expired' ? '#0d2e5c' : 'transparent',
                color: statusTab === 'expired' ? '#ffffff' : '#475569',
                border: 'none',
                padding: '7px 14px',
                borderRadius: 6,
                fontWeight: statusTab === 'expired' ? 700 : 500,
                fontSize: 13.5,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Hết hạn ({expiredCount})
            </button>
          </div>
        </div>
      </div>

      {/* 2. Danh Sách Thẻ Phiếu Đặt Phòng (Booking Pass Cards) */}
      {filteredBookings.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '48px 24px',
            textAlign: 'center'
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#64748b', fontSize: 14 }}>
                Chưa có yêu cầu đặt phòng nào phù hợp với bộ lọc hiện tại
              </span>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {paginatedBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              record={booking}
              now={now}
              handleEditClick={handleEditClick}
              handleCancelClick={handleCancelClick}
              handleDetailClick={handleDetailClick}
              setSelectedBookingForQR={setSelectedBookingForQR}
              setQrModalVisible={setQrModalVisible}
              setCheckoutModalVisible={setCheckoutModalVisible}
            />
          ))}
        </div>
      )}

      {/* Phân trang danh sách thẻ */}
      {filteredBookings.length > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={filteredBookings.length}
            onChange={(p) => {
              setCurrentPage(p)
              window.scrollTo({ top: 120, behavior: 'smooth' })
            }}
            showSizeChanger={false}
          />
        </div>
      )}

      {/* Modal Xem Chi Tiết Phiếu Đặt Phòng Học Thuật */}
      <Modal
        title={`Phiếu Đặt Phòng - #TBD-${selectedBookingForDetail?.id}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          selectedBookingForDetail && isExpiredBooking(selectedBookingForDetail) && (
            <Button
              key="rebook"
              type="primary"
              style={{ background: '#0d2e5c', borderRadius: 6 }}
              onClick={() => {
                const targetRoomId = selectedBookingForDetail.roomId || (selectedBookingForDetail as any).room_id;
                window.location.href = targetRoomId ? `/bookings?roomId=${targetRoomId}` : '/bookings';
              }}
            >
              Đặt lại ca khác
            </Button>
          ),
          <Button key="close" onClick={() => setDetailModalVisible(false)} style={{ borderRadius: 6 }}>
            Đóng
          </Button>
        ]}
        width={640}
        centered
      >
        {selectedBookingForDetail && (
          <div style={{ paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header phòng & trạng thái */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0d2e5c' }}>
                  Phòng {selectedBookingForDetail.roomName}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                  Mã phiếu: #TBD-{selectedBookingForDetail.id}
                </div>
              </div>
              <div>
                {renderHistoryStatusTag(
                  isExpiredBooking(selectedBookingForDetail)
                    ? 'Expired'
                    : selectedBookingForDetail.status,
                  selectedBookingForDetail
                )}
              </div>
            </div>

            {isExpiredBooking(selectedBookingForDetail) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 14px', borderRadius: 8, color: '#475569', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#334155' }}>Thông báo hết hạn:</strong>{' '}
                  <span>Đơn đặt phòng đã hết hạn xử lý do đã quá thời gian bắt đầu sử dụng.</span>
                </div>
              </div>
            )}

            {/* Bảng thông số chi tiết */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: '10px 16px',
                fontSize: 14,
                lineHeight: 1.6
              }}
            >
              <span style={{ color: '#64748b' }}>Ngày sử dụng:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                {dayjs(selectedBookingForDetail.startTime).format('DD/MM/YYYY')}
              </span>

              <span style={{ color: '#64748b' }}>Khung giờ:</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>
                {dayjs(selectedBookingForDetail.startTime).format('HH:mm')} - {dayjs(selectedBookingForDetail.endTime).format('HH:mm')} ({getDurationText(selectedBookingForDetail.startTime, selectedBookingForDetail.endTime)})
              </span>

              <span style={{ color: '#64748b' }}>Mục đích sử dụng:</span>
              <span style={{ color: '#334155' }}>
                {selectedBookingForDetail.purpose || 'Chưa cung cấp'}
              </span>

              <span style={{ color: '#64748b' }}>Người phụ trách / SĐT:</span>
              <span style={{ color: '#334155' }}>
                {selectedBookingForDetail.personInCharge || selectedBookingForDetail.userEmail || 'Chưa cập nhật'}
              </span>

              {selectedBookingForDetail.department && (
                <>
                  <span style={{ color: '#64748b' }}>Đơn vị / Khoa / Lớp:</span>
                  <span style={{ color: '#334155' }}>{selectedBookingForDetail.department}</span>
                </>
              )}

              {selectedBookingForDetail.participantCount && (
                <>
                  <span style={{ color: '#64748b' }}>Sĩ số tham gia:</span>
                  <span style={{ fontWeight: 600, color: '#334155' }}>
                    {selectedBookingForDetail.participantCount} người
                  </span>
                </>
              )}

              <span style={{ color: '#64748b' }}>Thiết bị mượn kèm:</span>
              <span style={{ color: '#334155' }}>
                {selectedBookingForDetail.requestedEquipments && selectedBookingForDetail.requestedEquipments.length > 0
                  ? selectedBookingForDetail.requestedEquipments.join(' • ')
                  : 'Không mượn thêm thiết bị'}
              </span>

              {selectedBookingForDetail.notes && (
                <>
                  <span style={{ color: '#64748b' }}>Ghi chú thêm:</span>
                  <span style={{ color: '#334155', whiteSpace: 'pre-line' }}>{selectedBookingForDetail.notes}</span>
                </>
              )}

              {selectedBookingForDetail.actualStartTime && (
                <>
                  <span style={{ color: '#64748b' }}>Giờ Check-in:</span>
                  <span style={{ color: '#059669', fontWeight: 500 }}>
                    {dayjs(selectedBookingForDetail.actualStartTime).format('HH:mm DD/MM/YYYY')}
                  </span>
                </>
              )}

              {selectedBookingForDetail.actualEndTime && (
                <>
                  <span style={{ color: '#64748b' }}>Giờ Check-out:</span>
                  <span style={{ color: '#059669', fontWeight: 500 }}>
                    {dayjs(selectedBookingForDetail.actualEndTime).format('HH:mm DD/MM/YYYY')}
                  </span>
                </>
              )}

              {(selectedBookingForDetail as any).createdAt && (
                <>
                  <span style={{ color: '#64748b' }}>Thời gian gửi đơn:</span>
                  <span style={{ color: '#64748b' }}>
                    {dayjs((selectedBookingForDetail as any).createdAt).format('HH:mm DD/MM/YYYY')}
                  </span>
                </>
              )}
            </div>

            {!isExpiredBooking(selectedBookingForDetail) && (selectedBookingForDetail.rejectReason || selectedBookingForDetail.rejectionReason) && (
              <div
                style={{
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  color: '#b91c1c',
                  fontSize: 13,
                  lineHeight: 1.5
                }}
              >
                <strong>Lý do từ chối từ Ban Quản lý:</strong> {selectedBookingForDetail.rejectReason || selectedBookingForDetail.rejectionReason}
                {(selectedBookingForDetail as any).cancelledBy && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#991b1b' }}>
                    Người hủy: {(selectedBookingForDetail as any).cancelledBy} {(selectedBookingForDetail as any).cancelledAt && `(${dayjs((selectedBookingForDetail as any).cancelledAt).format('HH:mm DD/MM/YYYY')})`}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal QR Check-in */}
      <Modal
        title="Mã QR Check-in"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQrModalVisible(false)} style={{ borderRadius: 6 }}>Đóng</Button>,
          <Button key="simulate" type="primary" style={{ background: '#10b981', borderRadius: 6 }} onClick={handleSimulateCheckIn}>
            Mô phỏng Quét QR (Check-in)
          </Button>
        ]}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <QRCodeSVG value={JSON.stringify({ bookingId: selectedBookingForQR?.id, action: 'checkin' })} size={200} />
          <div style={{ marginTop: 16, color: '#475569', fontSize: 14 }}>
            Quét mã này tại phòng <strong>{selectedBookingForQR?.roomName}</strong> để bắt đầu sử dụng.
          </div>
        </div>
      </Modal>

      {/* Modal Check-out */}
      <Modal
        title="Check-out & Bàn giao phòng"
        open={checkoutModalVisible}
        onCancel={() => setCheckoutModalVisible(false)}
        onOk={() => checkoutForm.submit()}
        okText="Hoàn tất Check-out"
        cancelText="Hủy"
        centered
      >
        <Form form={checkoutForm} layout="vertical" onFinish={handleCheckoutSubmit}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <div style={{ marginBottom: 4 }}>Phòng: <strong>{selectedBookingForQR?.roomName}</strong></div>
            <div>Giờ Check-in: <strong>{selectedBookingForQR?.actualStartTime ? dayjs(selectedBookingForQR.actualStartTime).format('HH:mm DD/MM/YYYY') : 'N/A'}</strong></div>
          </div>
          <Form.Item name="notes" label="Tình trạng phòng & thiết bị khi bàn giao" rules={[{ required: true, message: 'Vui lòng nhập tình trạng!' }]}>
            <Input.TextArea rows={4} placeholder="Ví dụ: Phòng sạch sẽ, thiết bị hoạt động bình thường..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Hủy Đơn */}
      <Modal
        title="Hủy yêu cầu đặt phòng"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={handleCancelSubmit}
        okText="Xác nhận hủy"
        cancelText="Không"
        okButtonProps={{ danger: true, loading: cancelMutation.isPending }}
        centered
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16, padding: 12, background: '#fef2f2', borderRadius: 6, border: '1px solid #fca5a5' }}>
            <strong>Cảnh báo:</strong> Thao tác này sẽ giải phóng phòng và không thể hoàn tác.
          </div>
          <Form layout="vertical">
            <Form.Item required label="Lý do hủy (bắt buộc)">
              <Input.TextArea
                rows={4}
                placeholder="Nhập lý do hủy đặt phòng..."
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* Modal Chỉnh Sửa Phiếu Đặt Phòng */}
      <Modal
        title={`Sửa yêu cầu đặt phòng - ${bookingToEdit?.roomName || ''}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSubmit}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={editMutation.isPending}
        width={720}
        centered
        destroyOnHidden
      >
        {bookingToEdit && (
          <div style={{ paddingTop: 8 }}>
            {/* 1. Thông tin phòng */}
            <div style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #cbd5e1', padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Phòng đăng ký (Cố định):</Typography.Text>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#0d2e5c', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <HomeOutlined style={{ color: '#1890ff' }} />
                    <span>{bookingToEdit.roomName}</span>
                  </div>
                </div>
                <Tag color="blue" style={{ borderRadius: 6, padding: '4px 10px', fontSize: 13, fontWeight: 600 }}>
                  Sức chứa: {selectedRoomCapacity} người
                </Tag>
              </div>
            </div>

            <Form form={editForm} layout="vertical">
              {/* 2. Chọn lại Ngày & Thời gian mượn */}
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="date" label="Ngày mượn phòng" rules={[{ required: true, message: 'Vui lòng chọn ngày mượn!' }]}>
                    <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} allowClear={false} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="startTime" label="Giờ bắt đầu" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                    <Select options={TIME_OPTIONS.map(t => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item name="endTime" label="Giờ kết thúc" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                    <Select options={TIME_OPTIONS.map(t => ({ label: t, value: t }))} />
                  </Form.Item>
                </Col>
              </Row>

              {/* 3. Nội dung sử dụng */}
              <Row gutter={16}>
                <Col xs={24} sm={16}>
                  <Form.Item name="purpose" label="Mục đích sử dụng" rules={[{ required: true, message: 'Vui lòng nhập mục đích sử dụng!' }]}>
                    <Input.TextArea rows={2} placeholder="Ví dụ: Họp nhóm học phần CNTT, sinh hoạt CLB..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item 
                    name="participantCount" 
                    label="Số lượng người tham gia" 
                    rules={[
                      { required: true, message: 'Vui lòng nhập số người!' },
                      { type: 'number', max: selectedRoomCapacity, message: `Tối đa ${selectedRoomCapacity} người` }
                    ]}
                  >
                    <InputNumber min={1} max={selectedRoomCapacity} style={{ width: '100%' }} placeholder={`Tối đa ${selectedRoomCapacity}`} />
                  </Form.Item>
                </Col>
              </Row>

              {/* 4. Đơn vị & Người đại diện */}
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="department" label="Lớp / Khoa / CLB" rules={[{ required: true, message: 'Vui lòng nhập đơn vị!' }]}>
                    <Input placeholder="Ví dụ: K18-CNTT, Khoa CNTT, CLB Truyền thông..." />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="personInCharge" label="Người phụ trách & SĐT" rules={[{ required: true, message: 'Vui lòng nhập người phụ trách!' }]}>
                    <Input placeholder="Ví dụ: Nguyễn Văn A - 0912345678" />
                  </Form.Item>
                </Col>
              </Row>

              {/* 5. Thiết bị mượn thêm */}
              <Form.Item name="requestedEquipments" label="Trang thiết bị mượn thêm">
                <EquipmentSelector
                  equipments={equipmentsQuery.data || []}
                  allBookings={allBookingsQuery.data || []}
                  selectedDate={watchedDate}
                  startTime={watchedStartTime}
                  endTime={watchedEndTime}
                  selectedRoomId={bookingToEdit?.roomId || null}
                />
              </Form.Item>

              {/* 6. Ghi chú */}
              <Form.Item name="notes" label="Ghi chú thêm">
                <Input.TextArea rows={2} placeholder="Nhập ghi chú bổ sung (nếu có)..." />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </main>
  )
}

export default BookingHistoryPage
