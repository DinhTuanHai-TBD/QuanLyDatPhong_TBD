import { useState, useMemo } from 'react'
import { Form, Input, Button, Select, Card, App, Row, Col, Typography, Table, Modal, Empty, Upload, Tabs } from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import type { IssueReport, CreateIssuePayload } from '../../types/issue'
import type { Room } from '../../types/room'
import type { Booking } from '../../types/booking'
import { useSearchParams } from 'react-router-dom'
import { getOfficialRooms } from '../../utils/roomUtils'

const { Text } = Typography

const ISSUE_TYPES = [
  'Máy chiếu/Màn chiếu',
  'Micro/Âm thanh',
  'Điều hòa',
  'Mạng Internet/Máy tính',
  'Điện/Đèn',
  'Cơ sở vật chất khác'
]

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Low: { label: 'Thấp', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  Medium: { label: 'Trung bình', bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  High: { label: 'Cao', bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
  Critical: { label: 'Khẩn cấp', bg: '#ffe4e6', text: '#991b1b', border: '#fecdd3' },
  Normal: { label: 'Bình thường', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  Urgent: { label: 'Khẩn cấp', bg: '#ffe4e6', text: '#991b1b', border: '#fecdd3' },
}

const STATUS_CONFIG: Record<string, { label: string; dotColor: string }> = {
  Pending: { label: 'Mới gửi', dotColor: '#3b82f6' },
  Received: { label: 'Đã tiếp nhận', dotColor: '#6366f1' },
  InProgress: { label: 'Đang xử lý', dotColor: '#f59e0b' },
  Resolved: { label: 'Đã khắc phục', dotColor: '#10b981' },
  Closed: { label: 'Đã đóng', dotColor: '#64748b' },
}

export default function ReportIssuePage() {
  const [form] = Form.useForm()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialRoomId = searchParams.get('roomId') ? Number(searchParams.get('roomId')) : undefined

  const [activeTab, setActiveTab] = useState<string>('create')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  
  const watchRoomId = Form.useWatch('roomId', form)

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      try {
        const res = await http.get<Room[]>('/api/rooms')
        return getOfficialRooms(res.data)
      } catch {
        return getOfficialRooms()
      }
    }
  })

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-bookings-for-issues'],
    queryFn: async () => {
      const res = await http.get<Booking[]>('/api/bookings/mine')
      return res.data
    }
  })

  // Lọc danh sách phòng theo thứ tự tên
  const roomOptions = useMemo(() => {
    return [...rooms]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(r => ({
        value: r.id,
        label: `${r.name}${r.building ? ` (${r.building})` : ''}`
      }))
  }, [rooms])

  // Chỉ lấy các booking Approved, Using hoặc Completed của phòng đang chọn
  const validBookings = useMemo(() => {
    if (!watchRoomId) return []
    return myBookings.filter(b => 
      b.roomId === watchRoomId && 
      (b.status === 'Approved' || b.status === 'Using' || b.status === 'Completed')
    )
  }, [myBookings, watchRoomId])

  const { data: myIssues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: ['my-issues'],
    queryFn: async () => {
      try {
        const res = await http.get<IssueReport[]>('/api/issues/mine')
        return res.data
      } catch (e: any) {
        console.warn('API /api/issues/mine fallback:', e.message)
        return []
      }
    }
  })

  const createIssueMutation = useMutation({
    mutationFn: async (payload: CreateIssuePayload) => {
      const res = await http.post('/api/issues', payload)
      return res.data
    },
    onSuccess: () => {
      message.success('Gửi báo cáo sự cố thành công! Bộ phận kỹ thuật đã tiếp nhận.')
      form.resetFields()
      setFileList([])
      queryClient.invalidateQueries({ queryKey: ['my-issues'] })
      setActiveTab('list')
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.')
    }
  })

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })

  const onFinish = async (values: any) => {
    let imageUrl = values.imageUrl
    
    if (fileList.length > 0 && fileList[0].originFileObj) {
      imageUrl = await getBase64(fileList[0].originFileObj as File)
    }

    const payload: CreateIssuePayload = { ...values, imageUrl }

    modal.confirm({
      title: 'Xác nhận gửi báo cáo sự cố',
      content: 'Bạn có chắc chắn muốn gửi báo cáo sự cố này? Bộ phận Kỹ thuật & Quản trị CSVC sẽ nhận được thông tin để kiểm tra, xử lý kịp thời.',
      okText: 'Gửi báo cáo',
      cancelText: 'Hủy bỏ',
      okButtonProps: { style: { backgroundColor: '#0d2e5c', borderColor: '#0d2e5c' } },
      onOk: () => {
        createIssueMutation.mutate(payload)
      }
    })
  }

  const columns = [
    { 
      title: 'Mã phiếu', 
      dataIndex: 'id', 
      key: 'id', 
      width: 100,
      render: (val: number) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0d2e5c' }}>
          #INC-{val}
        </span>
      )
    },
    { 
      title: 'Phòng học', 
      dataIndex: 'roomId', 
      key: 'roomId',
      render: (_: any, record: IssueReport) => {
        const rName = record.roomName || rooms.find(r => r.id === record.roomId)?.name || `Phòng ID ${record.roomId}`
        return <strong style={{ color: '#1e293b' }}>{rName}</strong>
      }
    },
    { 
      title: 'Loại sự cố', 
      dataIndex: 'issueType', 
      key: 'issueType',
      render: (val: string) => <span style={{ color: '#334155' }}>{val}</span>
    },
    { 
      title: 'Mức độ', 
      dataIndex: 'priority', 
      key: 'priority', 
      render: (val: string) => {
        const pri = PRIORITY_CONFIG[val] || { label: val || 'Trung bình', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
        return (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 4,
            backgroundColor: pri.bg,
            color: pri.text,
            border: `1px solid ${pri.border}`
          }}>
            {pri.label}
          </span>
        )
      }
    },
    { 
      title: 'Trạng thái xử lý', 
      dataIndex: 'status', 
      key: 'status', 
      render: (val: string) => {
        const st = STATUS_CONFIG[val] || { label: val || 'Mới gửi', dotColor: '#3b82f6' }
        return (
          <span style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6, 
            fontSize: 13, 
            fontWeight: 500,
            color: '#334155' 
          }}>
            <span style={{ 
              width: 7, 
              height: 7, 
              borderRadius: '50%', 
              backgroundColor: st.dotColor, 
              display: 'inline-block' 
            }} />
            {st.label}
          </span>
        )
      }
    },
    { 
      title: 'Ngày gửi', 
      dataIndex: 'createdAt', 
      key: 'createdAt', 
      width: 140,
      render: (val: string) => (
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {dayjs(val).format('DD/MM/YYYY HH:mm')}
        </span>
      )
    },
    { 
      title: 'Thao tác', 
      key: 'action', 
      width: 110,
      render: (_: any, record: IssueReport) => (
        <Button 
          type="link" 
          size="small" 
          style={{ padding: 0, fontWeight: 500, color: '#0d2e5c' }} 
          onClick={() => { setSelectedIssue(record); setIsModalOpen(true); }}
        >
          Xem chi tiết
        </Button>
      )
    }
  ]

  const tabItems = [
    {
      key: 'create',
      label: (
        <span style={{ fontSize: 15, fontWeight: 600, padding: '0 8px' }}>
          Gửi báo cáo sự cố mới
        </span>
      ),
      children: (
        <div style={{ maxWidth: 850, margin: '0 auto', paddingTop: 16 }}>
          <Card 
            variant="borderless" 
            style={{ 
              backgroundColor: '#ffffff',
              borderRadius: 12, 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
              <Text style={{ fontSize: 15, color: '#334155', lineHeight: 1.6 }}>
                Bạn phát hiện trang thiết bị hoặc cơ sở vật chất phòng học gặp sự cố? Vui lòng gửi thông tin chi tiết để Ban Kỹ thuật kiểm tra và khắc phục kịp thời, đảm bảo điều kiện giảng dạy và học tập.
              </Text>
            </div>
            
            <Form 
              form={form} 
              layout="vertical" 
              onFinish={onFinish} 
              initialValues={{ priority: 'Medium', roomId: initialRoomId }}
            >
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item 
                    name="roomId" 
                    label={<strong style={{ color: '#334155' }}>Phòng xảy ra sự cố</strong>} 
                    rules={[{ required: true, message: 'Vui lòng chọn phòng học!' }]}
                  >
                    <Select 
                      size="large"
                      showSearch 
                      placeholder="Tìm và chọn phòng học (Ví dụ: P.101, Lab 1...)" 
                      filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                      options={roomOptions} 
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item 
                    name="issueType" 
                    label={<strong style={{ color: '#334155' }}>Loại thiết bị gặp vấn đề</strong>} 
                    rules={[{ required: true, message: 'Vui lòng chọn loại thiết bị!' }]}
                  >
                    <Select 
                      size="large"
                      placeholder="Chọn loại thiết bị hoặc hạng mục..." 
                      options={ISSUE_TYPES.map(t => ({ value: t, label: t }))} 
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item 
                label={<strong style={{ color: '#334155' }}>Mức độ ảnh hưởng</strong>} 
                name="priority"
                rules={[{ required: true, message: 'Vui lòng chọn mức độ ảnh hưởng!' }]}
                extra={<span style={{ fontSize: 12, color: '#64748b' }}>Chọn đúng mức độ giúp Ban Kỹ thuật sắp xếp ưu tiên xử lý kịp thời.</span>}
              >
                <Select size="large" optionLabelProp="label">
                  <Select.Option value="Low" label="Thấp - Ảnh hưởng nhỏ">
                    <div style={{ padding: '4px 0' }}>
                      <strong style={{ color: '#475569' }}>Thấp (Low)</strong>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Sự cố nhỏ, không ảnh hưởng đến việc dạy và học (Ví dụ: Cháy 1 bóng đèn phụ, ghế lung lay, đồng hồ hết pin...).
                      </div>
                    </div>
                  </Select.Option>
                  <Select.Option value="Medium" label="Trung bình - Ảnh hưởng một phần">
                    <div style={{ padding: '4px 0' }}>
                      <strong style={{ color: '#d97706' }}>Trung bình (Medium)</strong>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Ảnh hưởng một phần nhưng buổi học vẫn tạm thời tiếp tục được (Ví dụ: Điều hòa làm lạnh yếu, micro thỉnh thoảng chập chờn, bảng từ bị mờ...).
                      </div>
                    </div>
                  </Select.Option>
                  <Select.Option value="High" label="Cao - Gián đoạn lớp học">
                    <div style={{ padding: '4px 0' }}>
                      <strong style={{ color: '#dc2626' }}>Cao (High)</strong>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        Gây gián đoạn giảng dạy, cần kỹ thuật hỗ trợ sớm (Ví dụ: Máy chiếu không lên hình, mất mạng phòng Lab, micro mất hẳn tiếng...).
                      </div>
                    </div>
                  </Select.Option>
                  <Select.Option value="Critical" label="Khẩn cấp - Nguy hiểm / Buộc dừng buổi học">
                    <div style={{ padding: '4px 0' }}>
                      <strong style={{ color: '#991b1b', fontWeight: 700 }}>Khẩn cấp (Critical)</strong>
                      <div style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>
                        Sự cố nghiêm trọng, đe dọa an toàn hoặc buộc dừng buổi học ngay (Ví dụ: Chập cháy điện, rò rỉ nước, điều hòa nổ khói, cửa bị kẹt...).
                      </div>
                    </div>
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item 
                name="description" 
                label={<strong style={{ color: '#334155' }}>Mô tả cụ thể</strong>} 
                rules={[{ required: true, message: 'Vui lòng miêu tả cụ thể tình trạng lỗi!' }]}
              >
                <Input.TextArea 
                  rows={4} 
                  placeholder="Miêu tả chi tiết tình trạng hỏng hóc hoặc biểu hiện lỗi (Ví dụ: Máy chiếu bật nguồn sáng đèn xanh nhưng không lên hình ảnh; Điều hòa phát ra tiếng kêu to và không mát...)" 
                  style={{ borderRadius: 6 }}
                />
              </Form.Item>

              <Form.Item 
                label={<strong style={{ color: '#334155' }}>Ảnh minh chứng (Không bắt buộc)</strong>}
                extra={<span style={{ fontSize: 12, color: '#64748b' }}>Đính kèm ảnh chụp màn hình hoặc hình ảnh hiện trạng thiết bị hỏng nếu có.</span>}
              >
                <Upload 
                  listType="picture-card" 
                  fileList={fileList} 
                  onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                  accept="image/*"
                >
                  {fileList.length >= 1 ? null : (
                    <div style={{ textAlign: 'center', padding: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}>Tải ảnh lên</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PNG, JPG</div>
                    </div>
                  )}
                </Upload>
              </Form.Item>

              {watchRoomId && validBookings.length > 0 && (
                <Form.Item 
                  name="bookingId" 
                  label={<strong style={{ color: '#334155' }}>Liên kết với lượt đặt phòng của tôi (Không bắt buộc)</strong>} 
                  extra={<span style={{ fontSize: 12, color: '#64748b' }}>Giúp Ban Kỹ thuật tra cứu đúng khung giờ và bối cảnh sử dụng phòng.</span>}
                >
                  <Select 
                    allowClear 
                    placeholder="Chọn lượt đặt phòng tương ứng của bạn..." 
                    options={validBookings.map(b => ({
                      value: b.id,
                      label: `[${dayjs(b.startTime).format('DD/MM/YYYY')}] ${dayjs(b.startTime).format('HH:mm')} - ${dayjs(b.endTime).format('HH:mm')}: ${b.purpose}`
                    }))} 
                  />
                </Form.Item>
              )}

              <div style={{ marginTop: 32 }}>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  size="large" 
                  block 
                  loading={createIssueMutation.isPending} 
                  style={{ 
                    backgroundColor: '#0d2e5c', 
                    borderColor: '#0d2e5c',
                    height: 48,
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 8
                  }}
                >
                  Gửi báo cáo sự cố
                </Button>
              </div>
            </Form>
          </Card>
        </div>
      )
    },
    {
      key: 'list',
      label: (
        <span style={{ fontSize: 15, fontWeight: 600, padding: '0 8px' }}>
          Sự cố tôi đã gửi ({myIssues.length})
        </span>
      ),
      children: (
        <div style={{ paddingTop: 16 }}>
          <Card 
            variant="borderless" 
            style={{ 
              backgroundColor: '#ffffff',
              borderRadius: 12, 
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}
          >
            <Table 
              columns={columns} 
              dataSource={myIssues} 
              rowKey="id" 
              loading={isLoadingIssues}
              pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} sự cố` }} 
              scroll={{ x: 'max-content' }}
              locale={{ 
                emptyText: (
                  <Empty 
                    image={Empty.PRESENTED_IMAGE_SIMPLE} 
                    description="Bạn chưa gửi báo cáo sự cố nào." 
                  />
                ) 
              }}
            />
          </Card>
        </div>
      )
    }
  ]

  return (
    <div style={{ padding: '28px 20px', maxWidth: 1100, margin: '0 auto', minHeight: '80vh' }}>
      {/* Tiêu đề phẳng tối giản màu xanh Navy - không icon cờ lê trang trí */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: '#0d2e5c', fontSize: 24, fontWeight: 700, margin: '0 0 6px 0', letterSpacing: '-0.3px' }}>
          Báo Cáo Sự Cố
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Hệ thống tiếp nhận và theo dõi xử lý sự cố cơ sở vật chất, trang thiết bị phòng học Đại học Thái Bình Dương
        </p>
      </div>

      {/* Tabs học thuật tối giản */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab} 
        items={tabItems}
        size="large"
      />

      {/* Modal chi tiết sự cố */}
      <Modal
        title={
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0d2e5c' }}>
            Chi tiết sự cố {selectedIssue ? `#INC-${selectedIssue.id}` : ''}
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button 
            key="close" 
            onClick={() => setIsModalOpen(false)}
            style={{ borderRadius: 6, fontWeight: 500 }}
          >
            Đóng
          </Button>
        ]}
      >
        {selectedIssue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 10 }}>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Mã phiếu:</Col>
              <Col span={16}>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0d2e5c' }}>
                  #INC-{selectedIssue.id}
                </span>
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Ngày gửi:</Col>
              <Col span={16}>
                <span style={{ color: '#1e293b' }}>{dayjs(selectedIssue.createdAt).format('DD/MM/YYYY HH:mm')}</span>
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Phòng học:</Col>
              <Col span={16}>
                <strong style={{ color: '#1e293b' }}>
                  {selectedIssue.roomName || rooms.find(r => r.id === selectedIssue.roomId)?.name || `Phòng ID ${selectedIssue.roomId}`}
                </strong>
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Thiết bị / Hạng mục:</Col>
              <Col span={16}>
                <span style={{ color: '#1e293b', fontWeight: 500 }}>{selectedIssue.issueType}</span>
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Mức độ ảnh hưởng:</Col>
              <Col span={16}>
                {(() => {
                  const pri = PRIORITY_CONFIG[selectedIssue.priority] || { label: selectedIssue.priority, bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
                  return (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 4,
                      backgroundColor: pri.bg,
                      color: pri.text,
                      border: `1px solid ${pri.border}`
                    }}>
                      {pri.label}
                    </span>
                  )
                })()}
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Trạng thái xử lý:</Col>
              <Col span={16}>
                {(() => {
                  const st = STATUS_CONFIG[selectedIssue.status] || { label: selectedIssue.status, dotColor: '#3b82f6' }
                  return (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: 6, 
                      fontSize: 13, 
                      fontWeight: 500,
                      color: '#334155' 
                    }}>
                      <span style={{ 
                        width: 7, 
                        height: 7, 
                        borderRadius: '50%', 
                        backgroundColor: st.dotColor, 
                        display: 'inline-block' 
                      }} />
                      {st.label}
                    </span>
                  )
                })()}
              </Col>
            </Row>
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Mô tả cụ thể:</Col>
              <Col span={16} style={{ color: '#1e293b', lineHeight: 1.5 }}>
                {selectedIssue.description}
              </Col>
            </Row>
            {selectedIssue.bookingId && (
              <Row>
                <Col span={8} style={{ color: '#64748b' }}>Lượt đặt phòng:</Col>
                <Col span={16} style={{ color: '#0d2e5c', fontWeight: 500 }}>
                  #{selectedIssue.bookingId}
                </Col>
              </Row>
            )}
            {selectedIssue.imageUrl && (
              <Row>
                <Col span={8} style={{ color: '#64748b' }}>Ảnh minh chứng:</Col>
                <Col span={16}>
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt="Hiện trạng sự cố" 
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, border: '1px solid #e2e8f0' }} 
                  />
                </Col>
              </Row>
            )}
            <Row>
              <Col span={8} style={{ color: '#64748b' }}>Phản hồi từ kỹ thuật:</Col>
              <Col span={16}>
                {selectedIssue.adminNotes ? (
                  <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', color: '#334155', fontSize: 13 }}>
                    {selectedIssue.adminNotes}
                  </div>
                ) : (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 13 }}>
                    Chưa có phản hồi từ bộ phận kỹ thuật
                  </span>
                )}
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  )
}
