import { useState, useMemo } from 'react'
import { Card, Table, Tag, Typography, Button, DatePicker, Select, Input, Modal, message, Popconfirm } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { getUserRole, getUserEmail } from '../../api/authUtils'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'

dayjs.extend(isBetween)
dayjs.extend(isSameOrBefore)
dayjs.extend(isSameOrAfter)

const { Title, Text } = Typography

export default function ApprovalsPage() {
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

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const res = await http.get<Booking[]>('/api/bookings')
      return res.data
    }
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await http.get<Room[]>('/api/rooms')
      return res.data
    }
  })

  // Mutations
  const processMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: number, action: 'approve' | 'reject', reason?: string }) => {
      // In case the API is missing, we use standard REST semantics
      // We expect the backend to have PUT /api/bookings/:id/approve and PUT /api/bookings/:id/reject
      const endpoint = `/api/bookings/${id}/${action}`
      const res = await http.put(endpoint, { reason })
      return res.data
    },
    onSuccess: () => {
      message.success('Xử lý yêu cầu thành công')
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      setProcessModalOpen(false)
      setRejectModalOpen(false)
      setProcessingBooking(null)
      setRejectReason('')
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Có lỗi xảy ra khi gọi API. (Cần đảm bảo backend có endpoint PUT /api/bookings/:id/approve và PUT /api/bookings/:id/reject)')
    }
  })

  const getStatusLabel = (s: string | number) => {
    switch (String(s)) {
      case 'Pending':
      case 'PendingSpecial':
      case '0':
        return 'Chờ duyệt'
      case 'Approved':
      case '1':
        return 'Đã duyệt'
      case 'Using':
        return 'Đang sử dụng'
      case 'Completed':
        return 'Hoàn thành'
      case 'Rejected':
      case '2':
        return 'Từ chối'
      case 'Cancelled':
      case '3':
        return 'Đã hủy'
      case 'NoShow':
        return 'Không đến'
      default:
        return 'Không xác định'
    }
  }

  const getStatusColor = (s: string | number) => {
    switch (String(s)) {
      case 'Pending':
      case '0':
        return 'orange'
      case 'PendingSpecial':
        return 'red'
      case 'Approved':
      case '1':
        return 'green'
      case 'Using':
        return 'blue'
      case 'Completed':
        return 'purple'
      case 'Rejected':
      case '2':
      case 'Cancelled':
      case '3':
      case 'NoShow':
        return 'default'
      default:
        return 'default'
    }
  }

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (filterDate) {
        const bDate = dayjs(b.startTime)
        if (!bDate.isSame(filterDate, 'day')) return false
      }
      if (filterRoom && b.roomId !== filterRoom) return false
      if (filterUser && b.userEmail && !b.userEmail.toLowerCase().includes(filterUser.toLowerCase())) return false
      
      const s = String(b.status)
      if (filterStatus === 'Pending') {
        if (s !== 'Pending' && s !== 'PendingSpecial' && s !== '0') return false
      } else if (filterStatus !== 'All') {
        if (s !== filterStatus) return false
      }
      return true
    }).sort((a, b) => dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf())
  }, [bookings, filterDate, filterRoom, filterUser, filterStatus])

  
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
      } catch (error) {
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
          <div>{record.userEmail || 'N/A'}</div>
          {record.department && <div style={{ fontSize: 12, color: '#64748b' }}>{record.department}</div>}
        </div>
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      render: (_: any, record: Booking) => (
        <Tag color={getStatusColor(record.status)}>{getStatusLabel(record.status)}</Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_: any, record: Booking) => (
        <Button size="small" type="primary" ghost onClick={() => {
          setProcessingBooking(record)
          setProcessModalOpen(true)
        }}>
          Xem chi tiết
        </Button>
      )
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
      <Title level={2} style={{ color: '#0d2e5c', marginBottom: 24 }}>Phê duyệt yêu cầu đặt phòng</Title>
      
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
          pagination={{ pageSize: 15 }}
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
                <Tag color={getStatusColor(processingBooking.status)} style={{ width: 'fit-content' }}>
                  {getStatusLabel(processingBooking.status)}
                </Tag>
                
                {(processingBooking.adminNotes || processingBooking.rejectReason) && (
                  <>
                    <Text type="secondary">Ghi chú xử lý:</Text>
                    <Text type="danger">{processingBooking.adminNotes || processingBooking.rejectReason}</Text>
                  </>
                )}
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


            {(String(processingBooking.status) === 'Pending' || String(processingBooking.status) === 'PendingSpecial' || String(processingBooking.status) === '0') && (
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
                    icon={<CheckCircleOutlined />}
                    loading={processMutation.isPending}
                  >
                    Phê duyệt
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
