import { useState, useMemo, useEffect } from 'react'
import { Card, Table, Tag, Typography, Button, DatePicker, Select, Input, Modal, Popconfirm, Space, App } from 'antd'
import { CheckCircleOutlined, CheckCircleFilled, CloseCircleOutlined, SearchOutlined, WarningOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { getUserRole, getUserEmail } from '../../api/authUtils'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { isBookingUrgent, isBookingExpired, getEffectiveBooking } from '../../utils/bookingStatusUtils'

dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

const { Title, Text } = Typography

export default function ApprovalsPage() {
  const { message } = App.useApp()
  const userRole = getUserRole()
  const currentUserEmail = getUserEmail()
  const canApprove = userRole === 'admin' || userRole === 'approver'
  const queryClient = useQueryClient()

  // Filters
  const [filterDate, setFilterDate] = useState<dayjs.Dayjs | null>(null)
  const [filterRoom, setFilterRoom] = useState<number | null>(null)
  const [filterUser, setFilterUser] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('All')

  // Modals
  const [processModalOpen, setProcessModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [processingBooking, setProcessingBooking] = useState<Booking | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvedId, setApprovedId] = useState<number | null>(null)
  const [removingIds, setRemovingIds] = useState<number[]>([])

  const { data: rawBookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const res = await http.get<Booking[]>('/api/bookings')
      return res.data
    }
  })

  // Apply auto-expire dynamically: pending bookings where now >= startTime automatically become 'Expired'
  const bookings = useMemo(() => {
    return rawBookings.map(b => getEffectiveBooking(b))
  }, [rawBookings])

  // Urgent pending bookings (starts in < 2 hours)
  const urgentBookings = useMemo(() => {
    return bookings.filter(b => isBookingUrgent(b))
  }, [bookings])

  // Toast warning for urgent bookings when visiting ApprovalsPage
  useEffect(() => {
    if (urgentBookings.length > 0) {
      const first = urgentBookings[0]
      message.warning({
        content: `Đơn đặt phòng #${first.id} tại ${first.roomName} chỉ còn dưới 2 tiếng nữa sẽ diễn ra, cần phê duyệt gấp!`,
        duration: 7,
        key: 'urgent-admin-reminder-booking'
      })
    }
  }, [urgentBookings])

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await http.get<Room[]>('/api/rooms')
      return res.data
    }
  })

  // Mutations
  const processMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      notes,
      reason,
    }: {
      id: number
      action: 'approve' | 'reject'
      notes?: string
      reason?: string
    }) => {
      try {
        const endpoint = `/api/bookings/${id}/${action}`
        const payload =
          action === 'approve'
            ? { notes: notes || 'Ban Quản lý đồng ý phê duyệt' }
            : { reason: reason || '' }
        const res = await http.put(endpoint, payload)
        return res.data
      } catch (err) {
        // Local fallback sync
        const localStr = localStorage.getItem('tbd_admin_bookings')
        if (localStr) {
          try {
            const list = JSON.parse(localStr) as Booking[]
            const nextStatus = action === 'approve' ? 'Approved' : 'Rejected'
            const updated = list.map(b =>
              b.id === id
                ? {
                    ...b,
                    status: nextStatus,
                    adminNotes: action === 'approve' ? notes || 'Ban Quản lý đồng ý phê duyệt' : b.adminNotes,
                    rejectReason: action === 'reject' ? reason : b.rejectReason,
                  }
                : b
            )
            localStorage.setItem('tbd_admin_bookings', JSON.stringify(updated))
          } catch {
            // fallback
          }
        }
        throw err
      }
    },
    onSuccess: (_, variables) => {
      setRemovingIds(prev => [...prev, variables.id])
      if (variables.action === 'approve') {
        setApprovedId(variables.id)
        message.success('Phê duyệt đơn đặt phòng thành công!')
      } else {
        message.success('Đã từ chối đơn đặt phòng.')
      }
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        setProcessModalOpen(false)
        setRejectModalOpen(false)
        setProcessingBooking(null)
        setRejectReason('')
        setApprovedId(null)
        setRemovingIds(prev => prev.filter(item => item !== variables.id))
      }, 400)
    },
    onError: (error: any, variables) => {
      setApprovedId(null)
      setRemovingIds(prev => prev.filter(item => item !== variables.id))
      message.error(error?.response?.data?.message || 'Có lỗi xảy ra khi xử lý đơn đặt phòng.')
    }
  })

  const getStatusLabel = (s: string | number, reason: string = '') => {
    const str = String(s)
    const r = (reason || '').toLowerCase()
    if (str === '3' || str === 'Expired' || str.toLowerCase() === 'expired' || r.includes('hết hạn')) {
      return 'Hết hạn'
    }
    if (str === '-1' || str === 'Cancelled' || str.toLowerCase() === 'cancelled') {
      return 'Đã hủy'
    }
    switch (str) {
      case 'Pending':
      case 'PendingSpecial':
      case '0':
        return 'Chờ phê duyệt'
      case 'Approved':
      case '1':
        return 'Đã phê duyệt'
      case 'Using':
        return 'Đang sử dụng'
      case 'Completed':
        return 'Hoàn thành'
      case 'Rejected':
      case '2':
        return 'Từ chối'
      case 'NoShow':
        return 'Không đến'
      default:
        return str || 'Chờ phê duyệt'
    }
  }

  const renderStatusTag = (status: string | number, reason: string = '') => {
    const s = String(status)
    const r = (reason || '').toLowerCase()
    const isExpired = s === '3' || s === 'Expired' || s.toLowerCase() === 'expired' || r.includes('hết hạn')
    const isPending = !isExpired && (s === 'Pending' || s === 'PendingSpecial' || s === '0')
    const isApproved = s === 'Approved' || s === '1'
    const isRejected = s === 'Rejected' || s === '2'
    const isCancelled = !isExpired && (s === '-1' || s === 'Cancelled' || s.toLowerCase() === 'cancelled')

    if (isExpired) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#f1f5f9',
            color: '#475569',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: '1px solid #e2e8f0'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
          Hết hạn
        </span>
      )
    }

    if (isPending) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#fffbeb',
            color: '#b45309',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: '1px solid #fef3c7'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
          Chờ phê duyệt
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
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: '1px solid #d1fae5'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
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
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: '1px solid #fee2e2'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
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
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: '1px solid #e2e8f0'
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
          Đã hủy
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
          padding: '3px 8px',
          borderRadius: 6,
          fontSize: 12.5,
          fontWeight: 500,
          border: '1px solid #e2e8f0'
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#94a3b8', display: 'inline-block' }} />
        {getStatusLabel(status, reason)}
      </span>
    )
  }

  const matchStatus = (bookingStatus: any, selectedFilter: string, reason: string = '') => {
    if (!selectedFilter || selectedFilter === 'All' || selectedFilter === 'all') return true;
    
    const s = String(bookingStatus).toLowerCase();
    const f = selectedFilter.toLowerCase();
    const r = (reason || '').toLowerCase();
    const isExpired = s === '3' || s === 'expired' || r.includes('hết hạn');

    if (selectedFilter === 'Expired' || selectedFilter === 'Hết hạn' || selectedFilter === '3' || f === 'expired') {
      return isExpired;
    }
    if (selectedFilter === 'Cancelled' || selectedFilter === 'Đã hủy' || selectedFilter === '-1' || f === 'cancelled') {
      return !isExpired && (s === '-1' || s === 'cancelled' || s === 'noshow' || s.includes('hủy'));
    }
    // 1. Chờ duyệt (0 / Pending)
    if (f === 'pending' || f === '0' || f.includes('chờ')) {
      return !isExpired && (s === '0' || s === 'pending' || s === 'pendingspecial' || s.includes('chờ'));
    }
    // 2. Đã duyệt (1 / Approved)
    if (f === 'approved' || f === '1' || f.includes('duyệt')) {
      return s === '1' || s === 'approved' || s === 'using' || s === 'completed' || s.includes('duyệt');
    }
    // 3. Từ chối (2 / Rejected)
    if (f === 'rejected' || f === '2' || f.includes('chối')) {
      return s === '2' || s === 'rejected' || s.includes('từ chối');
    }
    if (f === 'noshow') {
      return s === 'noshow';
    }
    
    return s === f;
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (filterDate) {
        const bDate = dayjs(b.startTime);
        if (!bDate.isSame(filterDate, 'day')) return false;
      }
      if (filterRoom && b.roomId !== filterRoom) return false;
      if (filterUser && b.userEmail && !b.userEmail.toLowerCase().includes(filterUser.toLowerCase())) return false;
      
      if (!matchStatus(b.status, filterStatus, b.rejectReason || b.rejectionReason || b.adminNotes || '')) return false;
      return true;
    }).sort((a, b) => {
      // Prioritize urgent bookings (< 2h) to the TOP of the pending list
      const aUrgent = isBookingUrgent(a)
      const bUrgent = isBookingUrgent(b)
      if (aUrgent && !bUrgent) return -1
      if (!aUrgent && bUrgent) return 1
      if (aUrgent && bUrgent) {
        return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf()
      }

      return dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf()
    });
  }, [bookings, filterDate, filterRoom, filterUser, filterStatus]);

  
  const getPriority = (b: Booking) => {
    const purpose = (b.purpose || '').toLowerCase();
    if (purpose.includes('thi') || purpose.includes('đào tạo')) return { level: 1, label: 'Lịch thi & Đào tạo' };
    if (purpose.includes('sự kiện') || purpose.includes('trường')) return { level: 2, label: 'Sự kiện cấp trường' };
    if (purpose.includes('giảng dạy') || purpose.includes('dạy') || purpose.includes('lên lớp')) return { level: 3, label: 'Lịch giảng dạy' };
    if (purpose.includes('khoa') || purpose.includes('phòng ban')) return { level: 4, label: 'Hoạt động khoa/phòng' };
    if (purpose.includes('nghiên cứu') || purpose.includes('hội thảo')) return { level: 5, label: 'Nghiên cứu & Hội thảo' };
    if (purpose.includes('câu lạc bộ') || purpose.includes('clb')) return { level: 6, label: 'Hoạt động CLB' };
    if (purpose.includes('nhóm') || purpose.includes('học nhóm')) return { level: 7, label: 'Học nhóm' };
    return { level: 8, label: 'Khác' };
  }

  const getOverlapping = (target: Booking) => {
    if (!target) return []
    const start = dayjs(target.startTime)
    const end = dayjs(target.endTime)
    return bookings.filter(b => {
      if (b.id === target.id) return false
      if (b.roomId !== target.roomId) return false
      const s = String(b.status)
      if (s === 'Rejected' || s === 'Cancelled' || s === '2' || s === '3') return false
      
      const bStart = dayjs(b.startTime)
      const bEnd = dayjs(b.endTime)
      return (start.isBefore(bEnd) && end.isAfter(bStart))
    })
  }

  
  const conflictQuery = useQuery({
    queryKey: ['booking-conflicts', processingBooking?.id],
    queryFn: async () => {
      if (!processingBooking) return null;
      try {
        const res = await http.get(`/api/bookings/${processingBooking.id}/conflicts`);
        return res.data;
      } catch {
        console.warn("Backend missing GET /api/bookings/:id/conflicts");
        // Fallback to local filtering
        const conflicts = getOverlapping(processingBooking);
        return {
          conflicts,
          alternatives: [] // Backend can return: { roomId: 1, roomName: 'A.102', startTime: '...', endTime: '...' }
        };
      }
    },
    enabled: !!processingBooking
  });

  const handleApprove = (id: number) => {
    const targetBooking = bookings.find(b => b.id === id);
    if (userRole !== 'admin' && targetBooking && targetBooking.userEmail === currentUserEmail) {
      message.error('Bạn không được phép tự duyệt yêu cầu do chính mình tạo.');
      return;
    }
    setApprovedId(id);
    processMutation.mutate({ id, action: 'approve' })
  }

  const handleReject = () => {
    if (!rejectReason.trim()) {
      message.error('Vui lòng nhập lý do từ chối!')
      return
    }
    if (processingBooking) {
      processMutation.mutate({ id: processingBooking.id, action: 'reject', reason: rejectReason })
    }
  }

  const columns = [
    {
      title: 'Thời gian',
      key: 'time',
      render: (_: any, record: Booking) => (
        <div>
          <div style={{ fontWeight: 600 }}>{dayjs(record.startTime).format('DD/MM/YYYY')}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {dayjs(record.startTime).format('HH:mm')} - {dayjs(record.endTime).format('HH:mm')}
          </div>
        </div>
      )
    },
    {
      title: 'Phòng',
      dataIndex: 'roomName',
      key: 'room',
      render: (text: string) => <strong style={{ color: '#0d2e5c' }}>{text}</strong>
    },
    {
      title: 'Người yêu cầu',
      key: 'user',
      render: (_: any, record: Booking) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.userEmail || 'N/A'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            {record.purpose ? `Mục đích: ${record.purpose}` : (record.department || 'Không có ghi chú')}
          </div>
        </div>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: any, record: Booking) => {
        const urgent = isBookingUrgent(record)
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            {renderStatusTag(record.status, record.rejectReason || record.rejectionReason || record.adminNotes || '')}
            {urgent && (
              <span
                style={{
                  display: 'inline-block',
                  color: '#dc2626',
                  fontSize: 11.5,
                  fontWeight: 600,
                  border: '1px solid #fca5a5',
                  borderRadius: 4,
                  padding: '1px 6px',
                  backgroundColor: '#fff1f2',
                  whiteSpace: 'nowrap'
                }}
              >
                [Cần duyệt gấp &lt; 2h]
              </span>
            )}
          </div>
        )
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Booking) => {
        const isExpired = String(record.status) === 'Expired' || isBookingExpired(record)
        const isPending = !isExpired && (String(record.status) === 'Pending' || String(record.status) === 'PendingSpecial' || String(record.status) === '0')
        const isApprovedThis = approvedId === record.id
        return (
          <Space size="small">
            <Button size="small" type="default" onClick={() => {
              setProcessingBooking(record)
              setProcessModalOpen(true)
            }}>
              Xem chi tiết
            </Button>
            {isExpired && (
              <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', padding: '0 4px' }}>
                Quá giờ duyệt
              </span>
            )}
            {isPending && (
              <>
                <Popconfirm
                  title="Xác nhận phê duyệt"
                  description="Bạn có chắc chắn muốn duyệt yêu cầu này không?"
                  onConfirm={() => handleApprove(record.id)}
                  okText="Duyệt"
                  cancelText="Hủy"
                >
                  <Button
                    size="small"
                    type="primary"
                    className={isApprovedThis ? 'btn-approve-success' : ''}
                    style={{
                      backgroundColor: isApprovedThis ? '#10b981' : '#059669',
                      borderColor: isApprovedThis ? '#10b981' : '#059669',
                      fontWeight: 500,
                      transition: 'all 0.3s'
                    }}
                    loading={processMutation.isPending && processMutation.variables?.id === record.id && processMutation.variables?.action === 'approve'}
                  >
                    {isApprovedThis ? 'Đã duyệt' : 'Duyệt'}
                  </Button>
                </Popconfirm>
                <Button
                  size="small"
                  danger
                  style={{ fontWeight: 500 }}
                  onClick={() => {
                    setProcessingBooking(record)
                    setRejectReason('')
                    setRejectModalOpen(true)
                  }}
                  loading={processMutation.isPending && processMutation.variables?.id === record.id && processMutation.variables?.action === 'reject'}
                >
                  Từ chối
                </Button>
              </>
            )}
          </Space>
        )
      }
    }
  ]

  if (!canApprove) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
        <Title level={3}>Không có quyền truy cập</Title>
        <Text>Chỉ Người phê duyệt và Quản trị viên mới có thể truy cập trang này.</Text>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <Title level={2} style={{ color: '#0d2e5c', marginBottom: 20 }}>Phê duyệt yêu cầu đặt phòng</Title>

      {/* Cảnh báo Admin khẩn cấp trước 2 tiếng (< 2h Urgent Warning) */}
      {urgentBookings.length > 0 && (
        <div
          style={{
            marginBottom: 20,
            background: '#fff1f0',
            border: '1px solid #ffccc7',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 280 }}>
            <div>
              <div style={{ fontWeight: 700, color: '#cf1322', fontSize: 14.5 }}>
                Cảnh báo khẩn cấp: Có {urgentBookings.length} đơn đặt phòng cần duyệt gấp (&lt; 2 tiếng nữa sẽ bắt đầu)!
              </div>
              <div style={{ fontSize: 13, color: '#820014', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {urgentBookings.slice(0, 3).map((b) => (
                  <span key={b.id}>
                    • Đơn đặt phòng <strong>#{b.id}</strong> tại <strong>{b.roomName}</strong> chỉ còn dưới 2 tiếng nữa sẽ diễn ra ({dayjs(b.startTime).format('HH:mm DD/MM')}), cần phê duyệt gấp!
                  </span>
                ))}
                {urgentBookings.length > 3 && (
                  <span style={{ fontStyle: 'italic' }}>...và {urgentBookings.length - 3} đơn khác cần duyệt gấp.</span>
                )}
              </div>
            </div>
          </div>
          <Button
            type="primary"
            danger
            style={{ fontWeight: 600, borderRadius: 6 }}
            onClick={() => setFilterStatus('Pending')}
          >
            Lọc đơn khẩn cấp ({urgentBookings.length})
          </Button>
        </div>
      )}
      
      <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Ngày sử dụng</Text>
            <DatePicker style={{ width: '100%' }} value={filterDate} onChange={setFilterDate} format="DD/MM/YYYY" placeholder="Chọn ngày" />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Phòng học</Text>
            <Select 
              style={{ width: '100%' }} 
              value={filterRoom} 
              onChange={setFilterRoom}
              allowClear
              placeholder="Tất cả phòng"
              options={rooms.map(r => ({ value: r.id, label: r.name }))}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Người yêu cầu</Text>
            <Input 
              placeholder="Email người yêu cầu" 
              value={filterUser} 
              onChange={e => setFilterUser(e.target.value)} 
              prefix={<SearchOutlined />}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>Trạng thái</Text>
            <Select style={{ width: '100%' }} value={filterStatus} onChange={setFilterStatus}>
              <Select.Option value="All">Tất cả</Select.Option>
              <Select.Option value="Pending">Chờ duyệt</Select.Option>
              <Select.Option value="Approved">Đã duyệt</Select.Option>
              <Select.Option value="Using">Đang sử dụng</Select.Option>
              <Select.Option value="Completed">Hoàn thành</Select.Option>
              <Select.Option value="Rejected">Từ chối</Select.Option>
              <Select.Option value="Cancelled">Đã hủy</Select.Option>
              <Select.Option value="Expired">Hết hạn</Select.Option>
              <Select.Option value="NoShow">Không đến</Select.Option>
            </Select>
          </div>
        </div>
      </Card>

      <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }} styles={{ body: { padding: 0 } }}>
        <Table
          loading={bookingsLoading}
          dataSource={filteredBookings}
          columns={columns}
          rowKey="id"
          rowClassName={(record: Booking) => removingIds.includes(record.id) ? 'booking-row-removing' : ''}
          pagination={{ pageSize: 15 }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Chi tiết Modal */}
      <Modal
        title={<span style={{ color: '#0d2e5c', fontSize: 18 }}>Chi tiết yêu cầu #{processingBooking?.id}</span>}
        open={processModalOpen}
        onCancel={() => setProcessModalOpen(false)}
        footer={null}
        width={700}
      >
        {processingBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px 12px' }}>
                <Text type="secondary">Phòng:</Text>
                <Text strong style={{ color: '#0d2e5c' }}>{processingBooking.roomName}</Text>
                
                <Text type="secondary">Thời gian:</Text>
                <Text>{dayjs(processingBooking.startTime).format('DD/MM/YYYY HH:mm')} - {dayjs(processingBooking.endTime).format('HH:mm')}</Text>

                <Text type="secondary">Người yêu cầu:</Text>
                <Text strong>{processingBooking.userEmail}</Text>

                <Text type="secondary">Mục đích:</Text>
                <Text>{processingBooking.purpose || 'Không có'}</Text>

                <Text type="secondary">Số người:</Text>
                <Text>{processingBooking.participantCount || 1}</Text>

                <Text type="secondary">Thiết bị yêu cầu:</Text>
                <Text>{processingBooking.requestedEquipments?.join(', ') || 'Không có'}</Text>
                
                <Text type="secondary">Trạng thái:</Text>
                <div>{renderStatusTag(processingBooking.status, processingBooking.rejectReason || processingBooking.rejectionReason || processingBooking.adminNotes || '')}</div>
                
                {(() => {
                  const reason = processingBooking.adminNotes || processingBooking.rejectReason || processingBooking.rejectionReason
                  if (!reason) return null
                  const s = String(processingBooking.status).toLowerCase()
                  const isExp = s === '3' || s === 'expired' || (reason || '').toLowerCase().includes('hết hạn') || isBookingExpired(processingBooking)
                  return isExp ? (
                    <>
                      <Text type="secondary">Thông tin hệ thống:</Text>
                      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '6px 10px', borderRadius: 6, color: '#475569', fontSize: 13 }}>
                        {reason}
                      </div>
                    </>
                  ) : (
                    <>
                      <Text type="secondary">Ghi chú xử lý:</Text>
                      <Text type="danger">{reason}</Text>
                    </>
                  )
                })()}
              </div>
            </div>

            
            {conflictQuery.data?.conflicts && conflictQuery.data.conflicts.length > 0 && (
              <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', padding: 16, borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <WarningOutlined style={{ color: '#cf1322', fontSize: 20 }} />
                  <Text strong type="danger">Cảnh báo: Trùng lịch với {conflictQuery.data.conflicts.length} yêu cầu khác!</Text>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[processingBooking, ...conflictQuery.data.conflicts]
                    .sort((a, b) => getPriority(a).level - getPriority(b).level)
                    .map(b => (
                    <div key={b.id} style={{ background: '#fff', padding: 12, borderRadius: 6, border: b.id === processingBooking.id ? '2px solid #1890ff' : '1px solid #d9d9d9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div>
                          <Tag color="magenta">Ưu tiên {getPriority(b).level}: {getPriority(b).label}</Tag>
                          <Text strong>{b.userEmail}</Text>
                        </div>
                        <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                          {dayjs(b.startTime).format('HH:mm')} - {dayjs(b.endTime).format('HH:mm')} | {b.purpose || 'Không ghi rõ'} | {getStatusLabel(b.status)}
                        </div>
                      </div>
                      {b.id !== processingBooking.id && (String(b.status) === 'Pending' || String(b.status) === 'PendingSpecial' || String(b.status) === '0') && (
                        <Popconfirm
                          title="Duyệt yêu cầu này?"
                          description="Điều này có thể sẽ khiến các yêu cầu khác cùng giờ (kể cả yêu cầu hiện tại) không thể thực hiện."
                          onConfirm={() => {
                            setProcessingBooking(b);
                          }}
                        >
                          <Button size="small">Chọn xử lý</Button>
                        </Popconfirm>
                      )}
                      {b.id === processingBooking.id && (
                        <Tag color="blue">Đang xử lý</Tag>
                      )}
                    </div>
                  ))}
                </div>
                {conflictQuery.data.alternatives && conflictQuery.data.alternatives.length > 0 && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
                    <Text strong style={{ color: '#389e0d' }}>Gợi ý thay thế từ hệ thống:</Text>
                    <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                      {conflictQuery.data.alternatives.map((alt: any, idx: number) => (
                        <li key={idx}>Phòng <strong>{alt.roomName}</strong> thời gian {dayjs(alt.startTime).format('HH:mm')} - {dayjs(alt.endTime).format('HH:mm')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#cf1322', marginTop: 12 }}>
                  * Lưu ý: API GET /api/bookings/:id/conflicts cần được backend hỗ trợ để trả về danh sách xung đột và suggestions (alternatives).
                </div>
              </div>
            )}


            {(processingBooking.status === 'Expired' || isBookingExpired(processingBooking)) && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 12, borderRadius: 8, color: '#64748b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <InfoCircleOutlined style={{ fontSize: 16, color: '#64748b' }} />
                <span>Đơn đặt phòng đã hết hạn xử lý do đã quá thời gian bắt đầu sử dụng. Không thể thao tác duyệt đơn quá giờ.</span>
              </div>
            )}

            {!isBookingExpired(processingBooking) && processingBooking.status !== 'Expired' && (String(processingBooking.status) === 'Pending' || String(processingBooking.status) === 'PendingSpecial' || String(processingBooking.status) === '0') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <Button 
                  danger 
                  onClick={() => {
                    setRejectReason('')
                    setRejectModalOpen(true)
                  }}
                  icon={<CloseCircleOutlined />}
                  disabled={processMutation.isPending}
                >
                  Từ chối
                </Button>
                
                <Popconfirm
                  title="Xác nhận phê duyệt"
                  description="Bạn có chắc chắn muốn duyệt yêu cầu này không?"
                  onConfirm={() => handleApprove(processingBooking.id)}
                  okText="Duyệt"
                  cancelText="Hủy"
                >
                  <Button 
                    type="primary" 
                    icon={approvedId === processingBooking.id ? <CheckCircleFilled /> : <CheckCircleOutlined />}
                    className={approvedId === processingBooking.id ? 'btn-approve-success' : ''}
                    style={{
                      backgroundColor: approvedId === processingBooking.id ? '#10b981' : undefined,
                      borderColor: approvedId === processingBooking.id ? '#10b981' : undefined,
                      transition: 'all 0.3s'
                    }}
                    loading={processMutation.isPending && processMutation.variables?.id === processingBooking.id}
                  >
                    {approvedId === processingBooking.id ? 'Đã phê duyệt' : 'Duyệt yêu cầu'}
                  </Button>
                </Popconfirm>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal nhập lý do từ chối */}
      <Modal
        title="Từ chối yêu cầu"
        open={rejectModalOpen}
        onCancel={() => setRejectModalOpen(false)}
        onOk={handleReject}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        okButtonProps={{ danger: true, loading: processMutation.isPending }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Lý do từ chối (bắt buộc):</Text>
        </div>
        <Input.TextArea
          rows={4}
          placeholder="Nhập lý do từ chối để thông báo cho người đặt..."
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  )
}
