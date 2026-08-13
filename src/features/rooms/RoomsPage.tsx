import { 
  EnvironmentOutlined, 
  ReloadOutlined, 
  TeamOutlined, 
  AppstoreOutlined,
  CalendarOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Empty, Row, Space, Spin, Tag, Typography, Input, Select, Modal, Descriptions } from 'antd'
import { InfoCircleOutlined, ToolOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import type { Room } from '../../types/room'
import { getOfficialRooms } from '../../utils/roomUtils'




const statusLabels: Record<string, { label: string; color: string }> = { 
  '0': { label: 'Đang sử dụng', color: 'green' }, 
  '1': { label: 'Bảo trì', color: 'gold' }, 
  '2': { label: 'Đóng', color: 'red' }, 
  Active: { label: 'Đang sử dụng', color: 'green' }, 
  Maintenance: { label: 'Bảo trì', color: 'gold' }, 
  Closed: { label: 'Đóng', color: 'red' } 
}

async function fetchRooms() {
  try {
    return (await http.get<Room[]>('/api/rooms')).data
  } catch (e) {
    const localStr = localStorage.getItem('tbd_admin_rooms')
    if (localStr) return JSON.parse(localStr) as Room[]
    return getOfficialRooms()
  }
}




const getRoomImageUrl = (room: any) => {
  if (!room.imageUrl) return '';
  return room.imageUrl;
};

function RoomsPage() {
  const navigate = useNavigate()
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [buildingFilter, setBuildingFilter] = useState<string>('All')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'))


  const equipmentsQuery = useQuery({
    queryKey: ['equipments'],
    queryFn: async () => {
      const localStr = localStorage.getItem('tbd_admin_equipments')
      if (localStr) return JSON.parse(localStr)
      return []
    }
  })
  const apiRooms = roomsQuery.data ?? []
  
  const rooms = getOfficialRooms(apiRooms)

  // Client side filtering for better UX
  const filteredRooms = rooms.filter((room) => {
    if (!room) return false
    const nameStr = room.name ?? ''
    const buildingStr = room.building ?? ''
    const descStr = room.description ?? ''
    const matchesSearch = nameStr.toLowerCase().includes(searchText.toLowerCase()) || 
      buildingStr.toLowerCase().includes(searchText.toLowerCase()) ||
      descStr.toLowerCase().includes(searchText.toLowerCase())
    
    let matchesType = typeFilter === 'All'
    if (!matchesType) {
      matchesType = (room as any)._displayType === typeFilter
    }

    let matchesBuilding = buildingFilter === 'All'
    if (!matchesBuilding) {
      matchesBuilding = room.building === buildingFilter
    }

    return matchesSearch && matchesType && matchesBuilding
  })

  return (
    <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div className="toolbar" style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
            Thông tin phòng
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 15 }}>
            Tra cứu sức chứa, loại phòng, thiết bị và trạng thái sử dụng tại các giảng đường của TBD.
          </Typography.Text>
        </div>
        <Button 
          icon={<ReloadOutlined />} 
          loading={roomsQuery.isFetching} 
          onClick={() => roomsQuery.refetch()}
          size="large"
          style={{ borderRadius: 6 }}
        >
          Tải lại
        </Button>
      </div>

      
      {/* Filter and Search Section */}
      <Card 
        style={{ 
          marginBottom: 32, 
          borderRadius: 12, 
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.02)',
          border: '1px solid #e2e8f0',
          padding: '4px'
        }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={14}>
            <Input
              placeholder="Tìm kiếm phòng theo tên, tòa nhà, mô tả..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="large"
              style={{ borderRadius: 6 }}
              allowClear
            />
          </Col>
          <Col xs={24} md={10}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Select
                value={buildingFilter}
                onChange={(value) => setBuildingFilter(value)}
                size="large"
                style={{ width: '50%', borderRadius: 6 }}
                options={[
                  { value: 'All', label: 'Tất cả khu vực' },
                  { value: 'Khu A', label: 'Khu A' },
                  { value: 'Khu B', label: 'Khu B' },
                ]}
              />
              <Select
                value={typeFilter}
                onChange={(value) => setTypeFilter(value)}
                size="large"
                style={{ width: '50%', borderRadius: 6 }}
                options={[
                  { value: 'All', label: 'Tất cả các loại' },
                  { value: 'Phòng học', label: 'Phòng học' },
                  { value: 'Hội trường', label: 'Hội trường' },
                  { value: 'Phòng Lab', label: 'Phòng Lab' },
                  { value: 'Phòng Cinema', label: 'Phòng Cinema' },
                  { value: 'Phòng học nhóm', label: 'Phòng học nhóm' }
                ]}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {roomsQuery.isLoading ? (
        <div className="rooms-loading" style={{ display: 'grid', placeItems: 'center', minHeight: 300 }}>
          <Space orientation="vertical" align="center">
            <Spin size="large" />
            <Typography.Text type="secondary">Đang tải danh sách phòng học...</Typography.Text>
          </Space>
        </div>
      ) : roomsQuery.isError ? (
        <Alert 
          showIcon 
          type="error" 
          title="Không thể kết nối máy chủ để lấy danh sách phòng" 
          description="Vui lòng xác minh máy chủ backend ASP.NET Core đang hoạt động trên hệ thống và thử lại." 
          style={{ borderRadius: 8 }}
        />
      ) : filteredRooms.length ? (
        <Row gutter={[24, 24]}>
          {filteredRooms.map((room) => {
            const status = statusLabels[String(room.status)] ?? { label: String(room.status), color: 'default' }
            const isAvailable = String(room.status) === '0' || room.status === 'Active'
            return (
              <Col xs={24} sm={12} lg={8} key={room.id}>
                <Card 
                  className="room-grid-card" 
                  style={{
                    borderRadius: 12,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    border: '1px solid #e2e8f0',
                  }}
                  cover={
                    getRoomImageUrl(room) ? (
                      <div style={{ height: 210, overflow: 'hidden', position: 'relative' }}>
                        <img 
                          src={getRoomImageUrl(room)} 
                          alt={`Phòng ${room.name}`} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            transition: 'transform 0.4s ease'
                          }} 
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.06)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        />
                      </div>
                    ) : (
                      <div className="room-empty-image" style={{ height: 210, background: '#f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <AppstoreOutlined style={{ fontSize: 48, color: '#94a3b8' }} />
                      </div>
                    )
                  }
                >
                  <Space orientation="vertical" size={12} style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>
                          {(room as any)._displayType} {(room as any)._displayNote && <span style={{ marginLeft: 4, color: '#64748b', fontWeight: 'normal', fontSize: 12 }}>({(room as any)._displayNote})</span>}
                        </Tag>
                        <Tag color={status.color} style={{ borderRadius: 4, fontWeight: 600 }}>
                          {status.label}
                        </Tag>
                      </div>

                      <Typography.Title level={4} style={{ color: '#0d2e5c', margin: '0 0 10px', fontWeight: 750 }}>
                        {room.name}
                      </Typography.Title>

                      <div className="room-card-meta" style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#475569', fontSize: 14, marginBottom: 12 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TeamOutlined style={{ color: '#64748b' }} /> 
                          <span>Sức chứa: <strong>{room.capacity}</strong> người</span>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <EnvironmentOutlined style={{ color: '#64748b' }} /> 
                          <span>Khu vực: {room.building ?? 'Cơ sở Pasteur, Nha Trang'}</span>
                        </span>
                      </div>

                      <Typography.Paragraph 
                        ellipsis={{ rows: 2 }} 
                        style={{ color: '#64748b', fontSize: 13, lineHeight: '1.5', margin: 0 }}
                      >
                        {room.description ?? 'Phòng học tiêu chuẩn được trang bị hệ thống máy chiếu hiện đại, máy điều hòa công suất lớn, âm thanh sắc nét.'}
                      </Typography.Paragraph>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Button 
                        icon={<InfoCircleOutlined />}
                        onClick={() => setSelectedRoom(room)}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                        }}
                      >
                        Chi tiết
                      </Button>
                      <Button 
                        danger
                        icon={<ToolOutlined />}
                        onClick={() => {
                          const target = `/report-issue?roomId=${room.id}`;
                          if (isLoggedIn) {
                            navigate(target);
                          } else {
                            navigate(`/login?redirect=${encodeURIComponent(target)}`);
                          }
                        }}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                        }}
                      >
                        Sự cố
                      </Button>
                      <Button 
                        type={isAvailable ? "primary" : "dashed"}
                        disabled={!isAvailable}
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          const target = `/bookings?roomId=${room.id}`;
                          if (isLoggedIn) {
                            navigate(target)
                          } else {
                            navigate(`/login?redirect=${encodeURIComponent(target)}`)
                          }
                        }}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: isAvailable ? '#0d2e5c' : undefined,
                          borderColor: isAvailable ? '#0d2e5c' : undefined,
                        }}
                      >
                        Đặt phòng
                      </Button>
                    </div>
                  </Space>
                </Card>
              </Col>
            )
          })}
        </Row>
      ) : (
        <Empty 
          description={
            <span style={{ color: '#64748b', fontSize: 15 }}>
              Không tìm thấy phòng học nào phù hợp với điều kiện tìm kiếm.
            </span>
          } 
          style={{ margin: '64px 0' }}
        />
      )}
      
      <Modal
        title="Thông tin chi tiết phòng"
        open={selectedRoom !== null}
        onCancel={() => setSelectedRoom(null)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setSelectedRoom(null)}>Đóng</Button>,
          <Button 
            key="report"
            danger
            icon={<ToolOutlined />}
            onClick={() => {
              if (selectedRoom) {
                const target = `/report-issue?roomId=${selectedRoom.id}`;
                if (isLoggedIn) {
                  navigate(target);
                } else {
                  navigate(`/login?redirect=${encodeURIComponent(target)}`);
                }
              }
            }}
          >
            Báo sự cố
          </Button>,
          <Button 
            key="book" 
            type="primary" 
            icon={<CalendarOutlined />}
            style={{ background: '#0d2e5c', borderColor: '#0d2e5c' }}
            disabled={selectedRoom ? (String(selectedRoom.status) !== '0' && selectedRoom.status !== 'Active') : false}
            onClick={() => {
              if (selectedRoom) {
                const target = `/bookings?roomId=${selectedRoom.id}`;
                if (isLoggedIn) {
                  navigate(target)
                } else {
                  navigate(`/login?redirect=${encodeURIComponent(target)}`)
                }
              }
            }}
          >
            Đặt phòng này
          </Button>
        ]}
      >
        {selectedRoom && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {selectedRoom.imageUrl && (
              <div style={{ width: '100%', height: 300, borderRadius: 8, overflow: 'hidden' }}>
                <img src={selectedRoom.imageUrl} alt={selectedRoom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã/Tên phòng"><strong>{selectedRoom.name}</strong></Descriptions.Item>
              <Descriptions.Item label="Loại phòng">{(selectedRoom as any)._displayType} {(selectedRoom as any)._displayNote ? `(${(selectedRoom as any)._displayNote})` : ''}</Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={statusLabels[String(selectedRoom.status)]?.color || 'default'}>
                  {statusLabels[String(selectedRoom.status)]?.label || String(selectedRoom.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Khu vực/Tòa nhà">{selectedRoom.building || 'Không có'}{selectedRoom.floor ? ` - Tầng ${selectedRoom.floor}` : ''}</Descriptions.Item>
              <Descriptions.Item label="Sức chứa">{selectedRoom.capacity} người</Descriptions.Item>
              <Descriptions.Item label="Mô tả">{selectedRoom.description || 'Không có'}</Descriptions.Item>
              {selectedRoom.openTime && <Descriptions.Item label="Giờ mở cửa">{selectedRoom.openTime}</Descriptions.Item>}
              {selectedRoom.closeTime && <Descriptions.Item label="Giờ đóng cửa">{selectedRoom.closeTime}</Descriptions.Item>}
              {equipmentsQuery.data && equipmentsQuery.data.filter((e: any) => e.roomId === selectedRoom.id && e.status !== 'Maintenance' && e.status !== 'Broken').length > 0 && (
                <Descriptions.Item label="Thiết bị có sẵn">
                  {equipmentsQuery.data.filter((e: any) => e.roomId === selectedRoom.id && e.status !== 'Maintenance' && e.status !== 'Broken').map((e: any) => e.type).join(', ')}
                </Descriptions.Item>
              )}
            </Descriptions>
            
            <div style={{ marginTop: 8, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8, color: '#334155' }}>
                Nội quy sử dụng phòng:
              </Typography.Text>
              <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Sử dụng đúng mục đích đã đăng ký.</li>
                <li>Không tự ý chuyển phòng hoặc chuyển quyền sử dụng.</li>
                <li>Không vượt quá sức chứa.</li>
                <li>Giữ vệ sinh và trật tự.</li>
                <li>Không tự ý di chuyển thiết bị.</li>
                <li>Tuân thủ quy định đồ ăn và thức uống của từng phòng.</li>
                <li>Tắt điện, điều hòa và thiết bị sau khi sử dụng.</li>
                <li>Báo ngay khi xảy ra sự cố.</li>
                <li>Người đặt chịu trách nhiệm đối với hư hỏng do sử dụng sai.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}

export default RoomsPage


