import { 
  ReloadOutlined, 
  SearchOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Empty, Row, Typography, Input, Select, Modal, Descriptions } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'
import type { Room } from '../../types/room'
import { getOfficialRooms, cleanupLocalStorageRooms, isFakeOrDisallowedRoom } from '../../utils/roomUtils'

async function fetchRooms(): Promise<Room[]> {
  cleanupLocalStorageRooms()
  try {
    const res = await http.get<Room[]>('/api/rooms')
    if (Array.isArray(res.data) && res.data.length > 0) {
      return res.data.filter((r) => !isFakeOrDisallowedRoom(r))
    }
  } catch {
    // fallback
  }
  const localStr = localStorage.getItem('tbd_admin_rooms')
  if (localStr) {
    try {
      const parsed = JSON.parse(localStr)
      if (Array.isArray(parsed)) {
        return parsed.filter((r: any) => !isFakeOrDisallowedRoom(r))
      }
    } catch {
      // ignore
    }
  }
  return getOfficialRooms()
}

const getRoomImageUrl = (room: any) => {
  if (!room.imageUrl) return '';
  return room.imageUrl;
};

const getFormattedRoomType = (room: any) => {
  const type = String(room._displayType || room.roomType || 'Phòng học').toLowerCase();
  if (type.includes('lab')) return 'PHÒNG THỰC HÀNH LAB';
  if (type.includes('hội trường')) return 'HỘI TRƯỜNG';
  if (type.includes('cinema')) return 'PHÒNG CINEMA';
  if (type.includes('nhóm')) return 'PHÒNG HỌC NHÓM';
  return 'PHÒNG HỌC TIÊU CHUẨN';
};

const getRoomEquipments = (room: any, allEquipments: any[] = []) => {
  const roomEquips = allEquipments
    .filter((e: any) => e.roomId === room.id && e.status !== 'Maintenance' && e.status !== 'Broken')
    .map((e: any) => e.name || e.type);
  if (roomEquips.length > 0) {
    return roomEquips.join(', ');
  }
  const type = String(room._displayType || room.roomType || '').toLowerCase();
  if (type.includes('lab')) return 'Máy tính cấu hình cao, Máy chiếu, Điều hòa, Bảng từ';
  if (type.includes('hội trường')) return 'Hệ thống âm thanh, Màn hình LED, Micro không dây, Điều hòa';
  if (type.includes('cinema')) return 'Màn chiếu lớn, Âm thanh vòm, Điều hòa, Ghế rạp';
  if (type.includes('nhóm')) return 'Bảng thông minh, Điều hòa, Wifi tốc độ cao';
  return 'Máy chiếu, Điều hòa, Micro';
};

const isKhuA = (room: any) => {
  const b = (room.building || '').toLowerCase();
  const name = (room.name || '').toLowerCase();
  return b.includes('a') || name.startsWith('a');
};

const isKhuB = (room: any) => {
  const b = (room.building || '').toLowerCase();
  const name = (room.name || '').toLowerCase();
  return b.includes('b') || name.startsWith('b');
};

function RoomsPage() {
  const navigate = useNavigate()
  const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('All')
  const [buildingFilter, setBuildingFilter] = useState<string>('All')
  const [quickTab, setQuickTab] = useState<'all' | 'khu-a' | 'khu-b'>('all')
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

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

  const totalCount = rooms.length;
  const countA = rooms.filter(isKhuA).length;
  const countB = rooms.filter(isKhuB).length;

  const handleSelectQuickTab = (tab: 'all' | 'khu-a' | 'khu-b') => {
    setQuickTab(tab);
    setTypeFilter('All');
    setBuildingFilter('All');
  };

  // Client side filtering for better UX
  const filteredRooms = rooms.filter((room) => {
    if (!room) return false
    const nameStr = room.name ?? ''
    const buildingStr = room.building ?? ''
    const descStr = room.description ?? ''
    const matchesSearch = nameStr.toLowerCase().includes(searchText.toLowerCase()) || 
      buildingStr.toLowerCase().includes(searchText.toLowerCase()) ||
      descStr.toLowerCase().includes(searchText.toLowerCase())
    
    let matchesQuickTab = true
    if (quickTab === 'khu-a') {
      matchesQuickTab = isKhuA(room)
    } else if (quickTab === 'khu-b') {
      matchesQuickTab = isKhuB(room)
    }

    let matchesType = typeFilter === 'All'
    if (!matchesType) {
      matchesType = (room as any)._displayType === typeFilter
    }

    let matchesBuilding = buildingFilter === 'All'
    if (!matchesBuilding) {
      matchesBuilding = room.building === buildingFilter
    }

    return matchesSearch && matchesQuickTab && matchesType && matchesBuilding
  })

  return (
    <main className="app-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      <div className="toolbar" style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Typography.Title level={2} style={{ color: '#0d2e5c', margin: 0, fontWeight: 800 }}>
            Thông tin phòng
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 15 }}>
            Tra cứu sức chứa, phân loại, trang thiết bị sẵn có tại các giảng đường Đại học Thái Bình Dương.
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

      {/* Thanh Tab phân loại khu vực: Tất cả, Khu A, Khu B */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: '#f8fafc',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginBottom: 20,
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        <button
          type="button"
          onClick={() => handleSelectQuickTab('all')}
          style={{
            background: quickTab === 'all' ? '#0d2e5c' : 'transparent',
            color: quickTab === 'all' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '7px 16px',
            borderRadius: 6,
            fontWeight: quickTab === 'all' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Tất cả ({totalCount})
        </button>

        <span style={{ color: '#cbd5e1', margin: '0 4px', userSelect: 'none' }}>|</span>

        <button
          type="button"
          onClick={() => handleSelectQuickTab('khu-a')}
          style={{
            background: quickTab === 'khu-a' ? '#0d2e5c' : 'transparent',
            color: quickTab === 'khu-a' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '7px 16px',
            borderRadius: 6,
            fontWeight: quickTab === 'khu-a' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Khu A ({countA})
        </button>

        <span style={{ color: '#cbd5e1', margin: '0 4px', userSelect: 'none' }}>|</span>

        <button
          type="button"
          onClick={() => handleSelectQuickTab('khu-b')}
          style={{
            background: quickTab === 'khu-b' ? '#0d2e5c' : 'transparent',
            color: quickTab === 'khu-b' ? '#ffffff' : '#475569',
            border: 'none',
            padding: '7px 16px',
            borderRadius: 6,
            fontWeight: quickTab === 'khu-b' ? 700 : 500,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          Khu B ({countB})
        </button>
      </div>

      {/* Bộ lọc và tìm kiếm */}
      <Card 
        style={{ 
          marginBottom: 32, 
          borderRadius: 10, 
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          border: '1px solid #e2e8f0',
          padding: '2px'
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
                onChange={(value) => {
                  setBuildingFilter(value)
                  if (value !== 'All') setQuickTab('all')
                }}
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
                onChange={(value) => {
                  setTypeFilter(value)
                  if (value !== 'All') setQuickTab('all')
                }}
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
        <Row gutter={[24, 24]}>
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <Col xs={24} sm={12} lg={8} key={key}>
              <Card 
                style={{
                  borderRadius: 10,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  border: '1px solid #e2e8f0',
                }}
                cover={
                  <div className="skeleton-card-loading" style={{ height: 195, borderRadius: '10px 10px 0 0' }} />
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="skeleton-shimmer-box" style={{ width: 140, height: 20, borderRadius: 4 }} />
                  <div className="skeleton-shimmer-box" style={{ width: '60%', height: 24, borderRadius: 6, margin: '4px 0' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton-shimmer-box" style={{ width: '50%', height: 16, borderRadius: 4 }} />
                    <div className="skeleton-shimmer-box" style={{ width: '55%', height: 16, borderRadius: 4 }} />
                    <div className="skeleton-shimmer-box" style={{ width: '85%', height: 16, borderRadius: 4 }} />
                  </div>
                  <div className="skeleton-shimmer-box" style={{ width: '100%', height: 32, borderRadius: 4, marginTop: 4 }} />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <div className="skeleton-shimmer-box" style={{ flex: 1, height: 38, borderRadius: 6 }} />
                    <div className="skeleton-shimmer-box" style={{ flex: 1, height: 38, borderRadius: 6 }} />
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : roomsQuery.isError ? (
        <Alert 
          showIcon 
          type="error" 
          title="Không thể kết nối máy chủ để lấy danh sách phòng" 
          description="Vui lòng xác minh máy chủ backend đang hoạt động trên hệ thống và thử lại." 
          style={{ borderRadius: 8 }}
        />
      ) : filteredRooms.length ? (
        <Row gutter={[24, 24]}>
          {filteredRooms.map((room) => {
            return (
              <Col xs={24} sm={12} lg={8} key={room.id}>
                <Card 
                  className="room-grid-card academic-room-card" 
                  style={{
                    borderRadius: 10,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                    background: '#ffffff',
                  }}
                  styles={{
                    body: {
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      justifyContent: 'space-between'
                    }
                  }}
                  cover={
                    getRoomImageUrl(room) ? (
                      <div 
                        style={{ height: 195, overflow: 'hidden', position: 'relative', cursor: 'pointer' }}
                        onClick={() => setSelectedRoom(room)}
                      >
                        <img 
                          src={getRoomImageUrl(room)} 
                          alt={`Phòng ${room.name}`} 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            transition: 'transform 0.35s ease'
                          }} 
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)'
                          }}
                        />
                      </div>
                    ) : (
                      <div 
                        className="room-empty-image" 
                        style={{ 
                          height: 160, 
                          background: '#f8fafc', 
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex', 
                          flexDirection: 'column',
                          justifyContent: 'center', 
                          alignItems: 'center',
                          cursor: 'pointer',
                          padding: '16px',
                          textAlign: 'center'
                        }}
                        onClick={() => setSelectedRoom(room)}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#0d2e5c', letterSpacing: '0.8px' }}>
                          ĐẠI HỌC THÁI BÌNH DƯƠNG
                        </span>
                        <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                          Cơ sở Đào tạo Pasteur - Nha Trang
                        </span>
                      </div>
                    )
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    {/* 1. Loại phòng: Tag chữ in hoa nhỏ màu xám nhạt (BỎ HOÀN TOÀN NHÃN TRẠNG THÁI) */}
                    <div style={{ marginBottom: 8 }}>
                      <span 
                        style={{
                          display: 'inline-block',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#475569',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: 4,
                          padding: '2px 8px',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {getFormattedRoomType(room)}
                      </span>
                    </div>

                    {/* 2. Mã phòng: Tiêu đề in đậm to rõ nét màu xanh Navy TBD #0d2e5c */}
                    <Typography.Title 
                      level={3} 
                      style={{ 
                        color: '#0d2e5c', 
                        margin: '0 0 12px 0', 
                        fontWeight: 800, 
                        fontSize: 22,
                        cursor: 'pointer' 
                      }}
                      onClick={() => setSelectedRoom(room)}
                    >
                      {room.name}
                    </Typography.Title>

                    {/* 3. Thông số phòng thuần chữ (Typography) */}
                    <div style={{ fontSize: 13.5, color: '#475569', marginBottom: 12, lineHeight: 1.6 }}>
                      <span>Sức chứa: <strong style={{ color: '#0f172a' }}>{room.capacity} người</strong></span>
                      <span style={{ margin: '0 8px', color: '#94a3b8' }}>•</span>
                      <span>Khu vực: <strong style={{ color: '#0f172a' }}>{room.building ?? 'Khu A'}</strong></span>
                      <span style={{ margin: '0 8px', color: '#94a3b8' }}>•</span>
                      <span>Thiết bị: <span style={{ color: '#334155' }}>{getRoomEquipments(room, equipmentsQuery.data)}</span></span>
                    </div>

                    {/* Mô tả ngắn về phòng */}
                    <Typography.Paragraph 
                      ellipsis={{ rows: 2 }} 
                      style={{ color: '#64748b', fontSize: 13, lineHeight: '1.5', margin: '0 0 16px 0' }}
                    >
                      {room.description && room.description !== room.name
                        ? room.description 
                        : 'Phòng học tiêu chuẩn trang bị đầy đủ máy chiếu, điều hòa và hệ thống âm thanh phục vụ giảng dạy.'}
                    </Typography.Paragraph>
                  </div>

                  {/* 4. Bố trí 2 Nút Thao Tác Chữ Rõ Ràng dưới chân mỗi thẻ */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 10 }}>
                    <Button 
                      type="primary"
                      onClick={() => navigate('/bookings?roomId=' + room.id)}
                      style={{ 
                        flex: 1, 
                        height: 38,
                        fontWeight: 600,
                        fontSize: 13.5,
                        borderRadius: 6,
                        background: '#0d2e5c',
                        borderColor: '#0d2e5c',
                        color: '#ffffff',
                        boxShadow: 'none'
                      }}
                    >
                      Đặt phòng này
                    </Button>
                    <Button 
                      onClick={() => navigate('/calendar?roomId=' + room.id)}
                      style={{ 
                        flex: 1, 
                        height: 38,
                        fontWeight: 600,
                        fontSize: 13.5,
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        background: '#ffffff',
                        boxShadow: 'none'
                      }}
                    >
                      Xem lịch phòng
                    </Button>
                  </div>
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
      
      {/* Modal chi tiết khi người dùng nhấn vào phòng */}
      <Modal
        title="Thông tin chi tiết phòng"
        open={selectedRoom !== null}
        onCancel={() => setSelectedRoom(null)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setSelectedRoom(null)}>Đóng</Button>,
          <Button 
            key="calendar"
            onClick={() => {
              if (selectedRoom) {
                navigate('/calendar?roomId=' + selectedRoom.id);
              }
            }}
          >
            Xem lịch phòng
          </Button>,
          <Button 
            key="book" 
            type="primary" 
            style={{ background: '#0d2e5c', borderColor: '#0d2e5c' }}
            onClick={() => {
              if (selectedRoom) {
                navigate('/bookings?roomId=' + selectedRoom.id);
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
              <div style={{ width: '100%', height: 280, borderRadius: 8, overflow: 'hidden' }}>
                <img src={selectedRoom.imageUrl} alt={selectedRoom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Mã phòng"><strong>{selectedRoom.name}</strong></Descriptions.Item>
              <Descriptions.Item label="Loại phòng">{getFormattedRoomType(selectedRoom)}</Descriptions.Item>
              <Descriptions.Item label="Khu vực/Tòa nhà">{selectedRoom.building || 'Khu A'}{selectedRoom.floor ? ` - Tầng ${selectedRoom.floor}` : ''}</Descriptions.Item>
              <Descriptions.Item label="Sức chứa">{selectedRoom.capacity} người</Descriptions.Item>
              <Descriptions.Item label="Trang bị sẵn có">{getRoomEquipments(selectedRoom, equipmentsQuery.data)}</Descriptions.Item>
              <Descriptions.Item label="Mô tả">{selectedRoom.description || 'Phòng học tiêu chuẩn Đại học Thái Bình Dương'}</Descriptions.Item>
              {selectedRoom.openTime && <Descriptions.Item label="Giờ mở cửa">{selectedRoom.openTime}</Descriptions.Item>}
              {selectedRoom.closeTime && <Descriptions.Item label="Giờ đóng cửa">{selectedRoom.closeTime}</Descriptions.Item>}
            </Descriptions>
            
            <div style={{ marginTop: 8, padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 8, color: '#334155' }}>
                Nội quy sử dụng phòng học:
              </Typography.Text>
              <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <li>Sử dụng đúng mục đích đã đăng ký.</li>
                <li>Không tự ý chuyển phòng hoặc chuyển quyền sử dụng cho người khác.</li>
                <li>Không tập trung vượt quá sức chứa cho phép.</li>
                <li>Giữ gìn vệ sinh chung, không mang đồ ăn có mùi vào phòng.</li>
                <li>Không tự ý tháo lắp, di chuyển trang thiết bị cố định.</li>
                <li>Tắt toàn bộ hệ thống điện, điều hòa và máy chiếu khi rời phòng.</li>
                <li>Báo cáo ngay cho Ban quản trị thiết bị khi xảy ra sự cố kỹ thuật.</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}

export default RoomsPage



