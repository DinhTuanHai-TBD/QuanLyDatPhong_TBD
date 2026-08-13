
import { QRCodeSVG } from 'qrcode.react'
import { Modal, Form } from 'antd'
import dayjs from 'dayjs'
import { QrcodeOutlined, ExportOutlined } from '@ant-design/icons'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { getUserRole } from '../../api/authUtils'
import { Alert, Button, Card, Empty, Table, Tag, Typography, Input, InputNumber, Segmented, App } from 'antd'
import { 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  StopOutlined, 
  SearchOutlined, 
  ReloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { http } from '../../api/http'
import type { Booking } from '../../types/booking'

const bookingStatuses: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  '0': { label: 'Chờ duyệt', color: 'gold', icon: <ClockCircleOutlined /> },
  '1': { label: 'Đã duyệt', color: 'green', icon: <CheckCircleOutlined /> },
  '2': { label: 'Từ chối', color: 'red', icon: <CloseCircleOutlined /> },
  '-1': { label: 'Đã hủy', color: 'default', icon: <StopOutlined /> },
  Pending: { label: 'Chờ duyệt', color: 'gold', icon: <ClockCircleOutlined /> },
  PendingSpecial: { label: 'Chờ duyệt đặc biệt', color: 'volcano', icon: <ClockCircleOutlined /> },
  Approved: { label: 'Đã duyệt', color: 'green', icon: <CheckCircleOutlined /> },
  Rejected: { label: 'Từ chối', color: 'red', icon: <CloseCircleOutlined /> },
  Cancelled: { label: 'Đã hủy', color: 'default', icon: <StopOutlined /> },
  Using: { label: 'Đang sử dụng', color: 'blue', icon: <PlayCircleOutlined /> },
  Completed: { label: 'Hoàn thành', color: 'cyan', icon: <CheckCircleOutlined /> },
}

async function fetchMyBookings() {
  try {
    return (await http.get<Booking[]>('/api/bookings/mine')).data
  } catch (e) {
    const localStr = localStorage.getItem('tbd_admin_bookings')
    if (localStr) {
      return (JSON.parse(localStr) as Booking[])
    }
    return []
  }
}


const BookingActionColumn = ({ record, handleEditClick, handleCancelClick, setSelectedBookingForQR, setQrModalVisible, setCheckoutModalVisible }: any) => {
  const [now, setNow] = useState(dayjs());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isPending = String(record.status) === '0' || record.status === 'Pending' || record.status === 'PendingSpecial'
  const isApproved = String(record.status) === '1' || record.status === 'Approved'
  const isUsing = String(record.status) === 'Using'
  const isEditable = isPending
  const isCancellable = isPending || isApproved

  const startTime = dayjs(record.startTime);
  const diffMinutes = startTime.diff(now, 'minute', true);
  
  const canCheckIn = isApproved && diffMinutes <= 15 && diffMinutes >= -15;
  const isNoShowRisk = isApproved && diffMinutes < -15;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {isApproved && (
        <div style={{ fontSize: 12, color: diffMinutes <= 15 && diffMinutes > 0 ? '#d97706' : '#64748b' }}>
          {diffMinutes > 15 ? `Check-in mở trước 15p` : 
           diffMinutes > 0 ? `Có thể check-in (còn ${Math.floor(diffMinutes)}p)` : 
           canCheckIn ? `Đang trong thời gian check-in` : 
           isNoShowRisk ? `Quá giờ check-in` : ''}
        </div>
      )}
      {isNoShowRisk && (
        <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '4px 8px', borderRadius: 4, border: '1px solid #fecaca' }}>
          ⚠️ Quá hạn check-in (No-show)
          <br/>
          <span style={{ fontSize: 11, color: '#666' }}>Đề xuất API: PUT /api/bookings/:id/no-show</span>
        </div>
      )}
      {isApproved && canCheckIn && (
        <Button size="small" type="primary" icon={<QrcodeOutlined />} onClick={() => { setSelectedBookingForQR(record); setQrModalVisible(true) }}>
          Check-in
        </Button>
      )}
      {isUsing && (
        <div style={{ fontSize: 12, color: '#10b981' }}>
          Đã check-in: {dayjs(record.actualStartTime).format('HH:mm')}
        </div>
      )}
      {isUsing && (
        <Button size="small" style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }} icon={<ExportOutlined />} onClick={() => { setSelectedBookingForQR(record); setCheckoutModalVisible(true) }}>
          Check-out
        </Button>
      )}
      {isEditable && (
        <Button type="link" style={{ padding: 0, fontWeight: 600, textAlign: 'left' }} onClick={() => handleEditClick(record)}>
          Sửa yêu cầu
        </Button>
      )}
      {isCancellable && (
        <Button type="link" danger style={{ padding: 0, fontWeight: 600, textAlign: 'left' }} onClick={() => handleCancelClick(record)}>
          Hủy đặt phòng
        </Button>
      )}
    </div>
  )
}

function BookingHistoryPage() {
  const queryClient = useQueryClient()
  const { message: AppMessage } = App.useApp()

  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [selectedBookingForQR, setSelectedBookingForQR] = useState<Booking | null>(null)
  
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false)

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<Booking | null>(null);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bookingToEdit, setBookingToEdit] = useState<Booking | null>(null);
  const [editForm] = Form.useForm();

  const [cancelReason, setCancelReason] = useState('');

  const [checkoutForm] = Form.useForm()

  const checkinMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        const res = await http.put(`/api/bookings/${id}/checkin`);
        return res.data;
      } catch (error) {
        throw new Error("Backend cần bổ sung endpoint PUT /api/bookings/:id/checkin để xử lý Check-in. (Cập nhật actualStartTime, đổi trạng thái thành Using)");
      }
    },
    onSuccess: () => {
      AppMessage.success('Check-in thành công!');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setQrModalVisible(false);
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi Check-in!');
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number, notes: string }) => {
      try {
        const res = await http.put(`/api/bookings/${id}/checkout`, { notes });
        return res.data;
      } catch (error) {
        throw new Error("Backend cần bổ sung endpoint PUT /api/bookings/:id/checkout để xử lý Check-out. (Cập nhật actualEndTime, checkoutNotes, đổi trạng thái thành Completed)");
      }
    },
    onSuccess: () => {
      AppMessage.success('Check-out thành công!');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setCheckoutModalVisible(false);
      checkoutForm.resetFields();
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi Check-out!');
    }
  });

  const handleSimulateCheckIn = () => {
    if (selectedBookingForQR) {
      checkinMutation.mutate(selectedBookingForQR.id);
    }
  }

  

  const handleCheckoutSubmit = (values: any) => {
    if (selectedBookingForQR) {
      checkoutMutation.mutate({ id: selectedBookingForQR.id, notes: values.notes });
    }
  }

  const bookingsQuery = useQuery({ queryKey: ['my-bookings'], queryFn: fetchMyBookings })
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')

  useEffect(() => {
    if (bookingsQuery.data) {
      const now = new Date().getTime();
      let startingSoon = 0;
      bookingsQuery.data.forEach((b: Booking) => {
        if (b.status === 'Approved' || String(b.status) === '1') {
          const startTime = new Date(b.startTime).getTime();
          if (startTime - now > 0 && startTime - now < 30 * 60 * 1000) {
            startingSoon++;
          }
        }
      });
      if (startingSoon > 0) {
        if (!sessionStorage.getItem('tbd_starting_soon_notified')) {
          sessionStorage.setItem('tbd_starting_soon_notified', 'true');
        }
      }
    }
  }, [bookingsQuery.data]);

  
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number, reason: string }) => {
      // Need PUT /api/bookings/:id/cancel
      try {
        const res = await http.put(`/api/bookings/${id}/cancel`, { reason })
        return res.data
      } catch(error) {
        throw new Error("Backend cần bổ sung endpoint PUT /api/bookings/:id/cancel để xử lý hủy lịch cùng với lý do.");
      }
    },
    onSuccess: () => {
      AppMessage.success('Đã hủy yêu cầu đặt phòng thành công!');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setCancelModalVisible(false);
      setBookingToCancel(null);
      setCancelReason('');
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi hủy đặt phòng!');
    }
  });


  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      // Need PUT /api/bookings/:id
      try {
        const res = await http.put(`/api/bookings/${id}`, data)
        return res.data
      } catch(error) {
        throw new Error("Backend cần bổ sung endpoint PUT /api/bookings/:id để cập nhật yêu cầu.");
      }
    },
    onSuccess: () => {
      AppMessage.success('Đã cập nhật yêu cầu đặt phòng thành công!');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setEditModalVisible(false);
      setBookingToEdit(null);
    },
    onError: (error: any) => {
      AppMessage.error(error.message || 'Lỗi khi cập nhật đặt phòng!');
    }
  });

  const handleEditClick = (booking: Booking) => {
    setBookingToEdit(booking);
    editForm.setFieldsValue({
      purpose: booking.purpose,
      participantCount: booking.participantCount,
      notes: booking.notes
    });
    setEditModalVisible(true);
  }

  const handleEditSubmit = () => {
    editForm.validateFields().then(values => {
      if (bookingToEdit) {
        editMutation.mutate({ id: bookingToEdit.id, data: values });
      }
    });
  }

  const checkCanCancel = (booking: Booking) => {
    const isStudent = getUserRole() === 'student';
    const isLectureHall = booking.roomName.toLowerCase().includes('hội trường');
    const start = dayjs(booking.startTime);
    const now = dayjs();
    const diffHours = start.diff(now, 'hour', true);

    if (isLectureHall && diffHours < 24) {
      return { can: false, reason: 'Phòng Hội trường phải hủy trước ít nhất 24 giờ.' };
    }
    if (isStudent && diffHours < 2) {
      return { can: false, reason: 'Sinh viên phải hủy trước ít nhất 2 giờ.' };
    }
    if (start.isBefore(now)) {
      return { can: false, reason: 'Không thể hủy lịch trong quá khứ.' };
    }
    return { can: true };
  }

  const handleCancelClick = (booking: Booking) => {
    const { can, reason } = checkCanCancel(booking);
    if (!can) {
      AppMessage.error(`Không thể hủy: ${reason}`);
      return;
    }
    setBookingToCancel(booking);
    setCancelModalVisible(true);
  }

  const handleCancelSubmit = () => {
    if (!cancelReason.trim()) {
      AppMessage.error('Vui lòng nhập lý do hủy phòng!');
      return;
    }
    if (bookingToCancel) {
      cancelMutation.mutate({ id: bookingToCancel.id, reason: cancelReason });
    }
  }


    

  const bookingsData = (() => {
    const localBookingsStr = localStorage.getItem('tbd_admin_bookings')
    let localBookings: Booking[] = []
    if (localBookingsStr) {
      try { localBookings = JSON.parse(localBookingsStr) } catch (e) { }
    }

    const apiData = bookingsQuery.data ?? []
    const combined: Booking[] = [...apiData]
    localBookings.forEach((local) => {
      const idx = combined.findIndex((b) => b.id === local.id)
      if (idx > -1) {
        combined[idx] = local
      } else {
        // Appending local items
        combined.push(local)
      }
    })

    const now = new Date().getTime()
    return combined.map((b) => {
      if (false) {
        return { ...b, status: 'Cancelled' as const }
      }

      const s = String(b.status)
      if (s === 'Approved' || s === '1' || s === 'Using') {
        const start = new Date(b.startTime).getTime()
        const end = new Date(b.endTime).getTime()
        if (now >= end) {
          return { ...b, status: 'Completed' as const }
        } else if (now >= start && now < end) {
          return { ...b, status: 'Using' as const }
        }
      }
      return b
    })
  })()

  // Client-side filtering for better UX
  const filteredBookings = bookingsData.filter((booking) => {
    const matchesSearch = booking.roomName.toLowerCase().includes(searchText.toLowerCase()) || 
      (booking.purpose ?? '').toLowerCase().includes(searchText.toLowerCase())
    
    if (statusFilter === 'All') return matchesSearch

    const statusObj = bookingStatuses[String(booking.status)]
    return matchesSearch && statusObj?.label === statusFilter
  }).sort((a, b) => dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf())

  return (
    <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div className="page-heading" style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
            Lịch Sử Đặt Phòng
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ fontSize: 15, marginTop: 8 }}>
            Theo dõi trạng thái các yêu cầu đặt phòng của bạn tại Đại học Thái Bình Dương.
          </Typography.Paragraph>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          loading={bookingsQuery.isFetching} 
          onClick={() => bookingsQuery.refetch()}
          size="large"
          style={{ borderRadius: 6 }}
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

      <Card 
        className="page-card"
        style={{ 
          borderRadius: 12, 
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid #e2e8f0',
          padding: '16px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <Input
            placeholder="Tìm theo tên phòng hoặc mục đích..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ maxWidth: 320, borderRadius: 6 }}
            allowClear
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#64748b', fontWeight: 500, fontSize: 14 }}>Trạng thái:</span>
            <Segmented
              options={['All', 'Chờ duyệt', 'Đã duyệt', 'Từ chối', 'Đã hủy']}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as string)}
              style={{ borderRadius: 6 }}
            />
          </div>
        </div>

        <Table<Booking>
          rowKey="id"
          loading={bookingsQuery.isLoading}
          dataSource={filteredBookings}
          locale={{ 
            emptyText: (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                description={
                  <span style={{ color: '#94a3b8' }}>
                    Chưa có yêu cầu đặt phòng nào phù hợp với bộ lọc
                  </span>
                } 
              />
            ) 
          }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          columns={[
            { 
              title: 'Phòng học / Phòng họp', 
              dataIndex: 'roomName',
              key: 'roomName',
              render: (text: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarOutlined style={{ color: '#0d2e5c', fontSize: 16 }} />
                  <strong style={{ color: '#0d2e5c', fontSize: 15 }}>{text}</strong>
                </div>
              )
            },
            {
              title: 'Thời gian bắt đầu',
              dataIndex: 'startTime',
              key: 'startTime',
              render: (value: string) => (
                <span style={{ fontWeight: 500, color: '#334155' }}>
                  {new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              ),
            },
            {
              title: 'Thời gian kết thúc',
              dataIndex: 'endTime',
              key: 'endTime',
              render: (value: string) => (
                <span style={{ fontWeight: 500, color: '#334155' }}>
                  {new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  {' — '}
                  {new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              ),
            },
            { 
              title: 'Mục đích sử dụng', 
              dataIndex: 'purpose',
              key: 'purpose',
              render: (value?: string) => (
                <span style={{ color: '#475569', fontSize: 14 }}>
                  {value || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa cung cấp</span>}
                </span>
              )
            },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              key: 'status',
              render: (status: Booking['status'], record: Booking) => {
                const item = bookingStatuses[String(status)] ?? { label: String(status), color: 'default', icon: <InfoCircleOutlined /> }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Tag 
                      color={item.color} 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: 5, 
                        fontWeight: 650, 
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: 'none',
                        width: 'fit-content'
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Tag>
                    {record.actualStartTime && (
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        <strong>In:</strong> {dayjs(record.actualStartTime).format('HH:mm DD/MM')}
                      </div>
                    )}
                    {record.actualEndTime && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        <strong>Out:</strong> {dayjs(record.actualEndTime).format('HH:mm DD/MM')}
                      </div>
                    )}
                    {record.rejectReason && (String(status) === '2' || status === 'Rejected' || String(status) === '3' || status === 'Cancelled') && (
                      <div style={{
                         fontSize: 12,
                         color: '#b91c1c',
                         background: '#fef2f2',
                         padding: '6px 10px',
                         borderRadius: 6,
                         border: '1px dashed #fca5a5',
                        maxWidth: 240,
                        marginTop: 4,
                        lineHeight: '1.4'
                      }}>
                        <strong>Lý do:</strong> {record.rejectReason}
                        {(record as any).cancelledBy && <div><strong>Người hủy:</strong> {(record as any).cancelledBy}</div>}
                        {(record as any).cancelledAt && <div><strong>Thời gian hủy:</strong> {new Date((record as any).cancelledAt).toLocaleString('vi-VN')}</div>}
                      </div>
                    )}
                  </div>
                )
              },
            },
            {
              title: 'Thao tác',
              key: 'action',
              render: (_: any, record: Booking) => (
                <BookingActionColumn 
                  record={record} 
                  handleEditClick={handleEditClick} 
                  handleCancelClick={handleCancelClick}
                  setSelectedBookingForQR={setSelectedBookingForQR}
                  setQrModalVisible={setQrModalVisible}
                  setCheckoutModalVisible={setCheckoutModalVisible}
                />
              )
            }
          ]}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '16px 24px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', margin: 0 }}>
                <Typography.Title level={5} style={{ color: '#0d2e5c', margin: '0 0 12px 0' }}><InfoCircleOutlined /> CHI TIẾT ĐĂNG KÝ #{record.id}</Typography.Title>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '8px 16px', fontSize: 13 }}>
                  <Typography.Text type="secondary">Phòng học / Giảng đường:</Typography.Text>
                  <Typography.Text strong style={{ color: '#0d2e5c' }}>{record.roomName}</Typography.Text>

                  <Typography.Text type="secondary">Người tạo:</Typography.Text>
                  <Typography.Text>{record.userEmail || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Ẩn danh</span>}</Typography.Text>

                  {(record as any).createdAt && (
                    <>
                      <Typography.Text type="secondary">Thời gian tạo:</Typography.Text>
                      <Typography.Text>{new Date((record as any).createdAt).toLocaleString('vi-VN')}</Typography.Text>
                    </>
                  )}

                  <Typography.Text type="secondary">Bắt đầu sử dụng:</Typography.Text>
                  <Typography.Text>{new Date(record.startTime).toLocaleString('vi-VN')}</Typography.Text>

                  <Typography.Text type="secondary">Kết thúc sử dụng:</Typography.Text>
                  <Typography.Text>{new Date(record.endTime).toLocaleString('vi-VN')}</Typography.Text>

                  <Typography.Text type="secondary">Mục đích sử dụng:</Typography.Text>
                  <Typography.Text style={{ whiteSpace: 'pre-line' }}>{record.purpose || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa cung cấp</span>}</Typography.Text>

                  {record.notes && (
                    <>
                      <Typography.Text type="secondary">Ghi chú:</Typography.Text>
                      <Typography.Text style={{ whiteSpace: 'pre-line' }}>{record.notes}</Typography.Text>
                    </>
                  )}

                  {record.participantCount && (
                    <>
                      <Typography.Text type="secondary">Số lượng người (sĩ số):</Typography.Text>
                      <Typography.Text strong>{record.participantCount} người</Typography.Text>
                    </>
                  )}

                  <Typography.Text type="secondary">Thiết bị mượn kèm:</Typography.Text>
                  <div>
                    {record.requestedEquipments && record.requestedEquipments.length > 0 ? (
                      record.requestedEquipments.map((equip, i) => (
                        <Tag key={i} color="blue" style={{ borderRadius: 4, margin: 2 }}>{equip}</Tag>
                      ))
                    ) : (
                      <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không mượn thêm thiết bị</span>
                    )}
                  </div>
                </div>
              </div>
            )
          }}
        />
      </Card>
      
      <Modal
        title="Mã QR Check-in"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQrModalVisible(false)}>Đóng</Button>,
          <Button key="simulate" type="primary" style={{ background: '#10b981' }} icon={<CheckCircleOutlined />} onClick={handleSimulateCheckIn}>
            Mô phỏng Quét QR (Check-in)
          </Button>
        ]}
        centered
      >
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <QRCodeSVG value={JSON.stringify({ bookingId: selectedBookingForQR?.id, action: 'checkin' })} size={200} />
          <div style={{ marginTop: 16, color: '#475569' }}>
            Quét mã này tại phòng <strong>{selectedBookingForQR?.roomName}</strong> để bắt đầu sử dụng.
          </div>
        </div>
      </Modal>

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
          <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 6 }}>
            <div style={{ marginBottom: 4 }}>Phòng: <strong>{selectedBookingForQR?.roomName}</strong></div>
            <div>Giờ Check-in: <strong>{selectedBookingForQR?.actualStartTime ? dayjs(selectedBookingForQR.actualStartTime).format('HH:mm DD/MM/YYYY') : 'N/A'}</strong></div>
          </div>
          <Form.Item name="notes" label="Tình trạng phòng & thiết bị khi bàn giao" rules={[{ required: true, message: 'Vui lòng nhập tình trạng!' }]}>
            <Input.TextArea rows={4} placeholder="Ví dụ: Phòng sạch sẽ, thiết bị hoạt động bình thường..." />
          </Form.Item>
        </Form>
      </Modal>
    
      <Modal
        title="Hủy yêu cầu đặt phòng"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={handleCancelSubmit}
        okText="Xác nhận hủy"
        cancelText="Không"
        okButtonProps={{ danger: true, loading: cancelMutation.isPending }}
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

    
      <Modal
        title="Sửa yêu cầu đặt phòng"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleEditSubmit}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        confirmLoading={editMutation.isPending}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="purpose" label="Mục đích sử dụng" rules={[{ required: true, message: 'Vui lòng nhập mục đích!' }]}>
            <Input placeholder="Ví dụ: Họp nhóm học phần ABCD..." />
          </Form.Item>
          <Form.Item name="participantCount" label="Số người dự kiến" rules={[{ required: true, message: 'Vui lòng nhập số người!' }]}>
            <InputNumber min={1} max={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Ghi chú thêm">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div style={{ fontSize: 13, color: '#666', marginTop: 8 }}>
            * Lưu ý: Không thể thay đổi thời gian hoặc phòng học. Nếu cần thay đổi phòng hoặc thời gian, vui lòng hủy yêu cầu này và tạo yêu cầu mới.
          </div>
        </Form>
      </Modal>

    </main>

  )
}

export default BookingHistoryPage

