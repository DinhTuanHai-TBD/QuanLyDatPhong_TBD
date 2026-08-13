import { useState, useMemo } from 'react'
import { Form, Input, Button, Select, Card, App, Row, Col, Typography, Tag, Table, Modal, Empty, Upload } from 'antd'
import { ToolOutlined, LinkOutlined, ExclamationCircleOutlined, UploadOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload/interface'
import dayjs from 'dayjs'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { http } from '../../api/http'
import type { IssueReport, CreateIssuePayload } from '../../types/issue'
import type { Room } from '../../types/room'
import type { Booking } from '../../types/booking'
import { useSearchParams } from 'react-router-dom'

const { Title, Paragraph } = Typography

/*
  BACKEND API REQUIREMENTS CHO CHỨC NĂNG BÁO SỰ CỐ:
  
  1. Lấy danh sách sự cố của tôi:
     - Endpoint: GET /api/issues/mine
     - Method: GET
     - Auth: Yêu cầu Header Authorization (Bearer Token)
     - Response: Mảng các object IssueReport
     
  2. Tạo báo cáo sự cố mới:
     - Endpoint: POST /api/issues
     - Method: POST
     - Auth: Yêu cầu Header Authorization
     - Request body: CreateIssuePayload ({ roomId, issueType, priority, description, bookingId, imageUrl })
     - Response: { success: boolean, message: string, issue: IssueReport }
*/

const ISSUE_TYPES = [
  'Máy chiếu hoặc màn chiếu',
  'Micro hoặc loa',
  'Điều hòa',
  'Máy tính hoặc mạng Internet',
  'Điện hoặc đèn',
  'Bàn ghế',
  'Vệ sinh',
  'Khác'
];

const STATUS_LABELS: Record<string, { label: string, color: string }> = {
  'Pending': { label: 'Mới gửi', color: 'default' },
  'Received': { label: 'Đã tiếp nhận', color: 'processing' },
  'InProgress': { label: 'Đang xử lý', color: 'warning' },
  'Resolved': { label: 'Đã khắc phục', color: 'success' },
  'Closed': { label: 'Đã đóng', color: 'error' },
};

export default function ReportIssuePage() {
  const [form] = Form.useForm()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const initialRoomId = searchParams.get('roomId') ? Number(searchParams.get('roomId')) : undefined

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  
  const watchRoomId = Form.useWatch('roomId', form)

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await http.get<Room[]>('/api/rooms')
      return res.data
    }
  })

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-bookings-for-issues'],
    queryFn: async () => {
      const res = await http.get<Booking[]>('/api/bookings/mine')
      return res.data
    }
  })

  // Chỉ lấy các booking Approved hoặc InProgress của phòng đang chọn
  const validBookings = useMemo(() => {
    if (!watchRoomId) return [];
    return myBookings.filter(b => 
      b.roomId === watchRoomId && 
      (b.status === 'Approved' || b.status === 'Using' || b.status === 'Completed') // Cho phép báo sự cố sau khi dùng xong
    )
  }, [myBookings, watchRoomId])

  const { data: myIssues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: ['my-issues'],
    queryFn: async () => {
      try {
        const res = await http.get<IssueReport[]>('/api/issues/mine')
        return res.data
      } catch (e: any) {
        // Fallback for demo purposes if backend doesn't implement it yet
        console.warn('API /api/issues/mine not implemented. Returning empty array.', e.message)
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
      message.success('Báo cáo sự cố thành công!')
      form.resetFields()
      setFileList([])
      queryClient.invalidateQueries({ queryKey: ['my-issues'] })
    },
    onError: (error: any) => {
      message.error(error?.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại sau.')
    }
  })

  const getBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

  const onFinish = async (values: any) => {
    let imageUrl = values.imageUrl;
    
    if (fileList.length > 0 && fileList[0].originFileObj) {
      imageUrl = await getBase64(fileList[0].originFileObj as File);
    }

    const payload = { ...values, imageUrl };

    modal.confirm({
      title: 'Xác nhận gửi báo cáo sự cố',
      icon: <ExclamationCircleOutlined />,
      content: 'Bạn có chắc chắn muốn gửi báo cáo sự cố này? Bộ phận kỹ thuật sẽ nhận được thông báo ngay lập tức.',
      okText: 'Gửi báo cáo',
      cancelText: 'Hủy',
      onOk: () => {
        createIssueMutation.mutate(payload)
      }
    })
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: 'Ngày báo', dataIndex: 'createdAt', key: 'createdAt', render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm') },
    { title: 'Phòng', dataIndex: 'roomName', key: 'roomName', render: (_: any, record: IssueReport) => {
      const rName = record.roomName || rooms.find(r => r.id === record.roomId)?.name || `Phòng ID ${record.roomId}`;
      return <div style={{ fontWeight: 600 }}>{rName}</div>;
    } },
    { title: 'Loại sự cố', dataIndex: 'issueType', key: 'issueType' },
    { title: 'Mức độ', dataIndex: 'priority', key: 'priority', render: (val: string) => {
      return <Tag color={val === 'Urgent' ? 'red' : 'blue'}>{val === 'Urgent' ? 'Khẩn cấp' : 'Bình thường'}</Tag>
    }},
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (val: string) => {
      const statusObj = STATUS_LABELS[val] || STATUS_LABELS['Pending'];
      return <Tag color={statusObj.color}>{statusObj.label}</Tag>
    }},
    { title: 'Thao tác', key: 'action', render: (_: any, record: IssueReport) => (
      <Button type="link" onClick={() => { setSelectedIssue(record); setIsModalOpen(true); }}>Chi tiết</Button>
    )}
  ]

  return (
    <div style={{ padding: '24px 16px', maxWidth: 1200, margin: '0 auto', minHeight: '80vh' }}>
      <Title level={2} style={{ color: '#0d2e5c', marginBottom: 24 }}><ToolOutlined /> Báo Cáo Sự Cố</Title>
      
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={10}>
          <Card title="Gửi báo cáo mới" variant="borderless" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              Bạn phát hiện sự cố về cơ sở vật chất hoặc thiết bị? Vui lòng điền thông tin bên dưới để được hỗ trợ kịp thời. Không bắt buộc phải là người đặt phòng.
            </Paragraph>
            
            <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ priority: 'Normal', roomId: initialRoomId }}>
              <Form.Item name="roomId" label="Phòng xảy ra sự cố" rules={[{ required: true, message: 'Vui lòng chọn phòng!' }]}>
                <Select showSearch placeholder="Chọn phòng..." filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={rooms.map(r => ({ value: r.id, label: r.name }))} />
              </Form.Item>

              <Form.Item name="issueType" label="Loại sự cố" rules={[{ required: true, message: 'Vui lòng chọn loại sự cố!' }]}>
                <Select placeholder="Chọn loại sự cố..." options={ISSUE_TYPES.map(t => ({ value: t, label: t }))} />
              </Form.Item>

              <Form.Item name="priority" label="Mức độ ưu tiên" rules={[{ required: true, message: 'Vui lòng chọn mức độ!' }]}>
                <Select options={[
                  { value: 'Normal', label: 'Bình thường (Ảnh hưởng một phần)' },
                  { value: 'Urgent', label: 'Khẩn cấp (Không thể sử dụng, ảnh hưởng tới sự kiện/buổi học)' },
                ]} />
              </Form.Item>

              <Form.Item name="description" label="Mô tả chi tiết" rules={[{ required: true, message: 'Vui lòng mô tả chi tiết!' }]}>
                <Input.TextArea rows={4} placeholder="Mô tả cụ thể tình trạng lỗi (VD: Máy chiếu không lên hình, điều hòa chảy nước...)" />
              </Form.Item>

              <Form.Item label="Ảnh sự cố (Không bắt buộc)">
                <Upload 
                  listType="picture-card" 
                  fileList={fileList} 
                  onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                >
                  {fileList.length >= 1 ? null : <div><UploadOutlined /><div style={{ marginTop: 8 }}>Tải ảnh lên</div></div>}
                </Upload>
              </Form.Item>

              {watchRoomId && validBookings.length > 0 && (
                <Form.Item name="bookingId" label="Liên kết với lượt đặt phòng của tôi (Không bắt buộc)" tooltip="Giúp chúng tôi xác định thời gian và bối cảnh xảy ra sự cố dễ dàng hơn.">
                  <Select allowClear placeholder="Chọn một lượt đặt phòng của bạn..." options={validBookings.map(b => ({
                    value: b.id,
                    label: `[${dayjs(b.startTime).format('DD/MM/YYYY')}] ${dayjs(b.startTime).format('HH:mm')} - ${dayjs(b.endTime).format('HH:mm')} : ${b.purpose}`
                  }))} />
                </Form.Item>
              )}
              {watchRoomId && validBookings.length === 0 && (
                <div style={{ marginBottom: 24, fontSize: 13, color: '#64748b', display: 'flex', gap: 6 }}>
                  <LinkOutlined /> <span>Bạn không có lượt đặt phòng nào tại phòng này để liên kết. Bạn vẫn có thể gửi báo cáo bình thường.</span>
                </div>
              )}

              <Button type="primary" htmlType="submit" size="large" block loading={createIssueMutation.isPending} style={{ background: '#1e40af' }}>
                Gửi Báo Cáo
              </Button>
            </Form>
          </Card>
        </Col>
        
        <Col xs={24} lg={14}>
          <Card title="Sự cố của tôi" variant="borderless" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}>
            <Table 
               columns={columns} 
               dataSource={myIssues} 
               rowKey="id" 
               loading={isLoadingIssues}
               pagination={{ pageSize: 8 }} 
               scroll={{ x: 600 }}
              locale={{ emptyText: <Empty description="Bạn chưa gửi báo cáo sự cố nào." /> }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Chi tiết sự cố"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[<Button key="close" onClick={() => setIsModalOpen(false)}>Đóng</Button>]}
      >
        {selectedIssue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row><Col span={8} style={{ color: '#64748b' }}>Ngày báo cáo:</Col><Col span={16}>{dayjs(selectedIssue.createdAt).format('DD/MM/YYYY HH:mm')}</Col></Row>
            <Row><Col span={8} style={{ color: '#64748b' }}>Phòng:</Col><Col span={16}><strong>{selectedIssue.roomName || rooms.find(r => r.id === selectedIssue.roomId)?.name || `Phòng ID ${selectedIssue.roomId}`}</strong></Col></Row>
            <Row><Col span={8} style={{ color: '#64748b' }}>Loại sự cố:</Col><Col span={16}><strong>{selectedIssue.issueType}</strong></Col></Row>
            <Row><Col span={8} style={{ color: '#64748b' }}>Trạng thái:</Col>
              <Col span={16}>
                <Tag color={STATUS_LABELS[selectedIssue.status]?.color || 'default'}>{STATUS_LABELS[selectedIssue.status]?.label || selectedIssue.status}</Tag>
              </Col>
            </Row>
            <Row><Col span={8} style={{ color: '#64748b' }}>Mô tả lỗi:</Col><Col span={16}>{selectedIssue.description}</Col></Row>
            {selectedIssue.bookingId && (
              <Row><Col span={8} style={{ color: '#64748b' }}>Mã đặt phòng liên kết:</Col><Col span={16}>#{selectedIssue.bookingId}</Col></Row>
            )}
            {selectedIssue.imageUrl && (
              <Row><Col span={8} style={{ color: '#64748b' }}>Hình ảnh:</Col><Col span={16}><img src={selectedIssue.imageUrl} alt="Sự cố" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} /></Col></Row>
            )}
            <Row><Col span={8} style={{ color: '#64748b' }}>Phản hồi từ BQL:</Col><Col span={16}>{selectedIssue.adminNotes || <em>Chưa có phản hồi</em>}</Col></Row>
          </div>
        )}
      </Modal>
    </div>
  )
}
