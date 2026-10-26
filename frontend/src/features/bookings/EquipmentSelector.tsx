import React, { useState, useMemo } from 'react';
import {
  Modal,
  Button,
  Checkbox,
  InputNumber,
  Typography,
  Tag,
  Tooltip,
  Input,
  Space,
  Alert,
  Empty
} from 'antd';
import {
  ToolOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PlusOutlined,
  EditOutlined,
  SearchOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import type { EquipmentItem } from '../admin/AdminPage';
import type { Booking } from '../../types/booking';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

export interface EquipmentSelectorProps {
  value?: string[];
  onChange?: (val: string[]) => void;
  equipments: EquipmentItem[];
  allBookings: Booking[];
  selectedDate?: dayjs.Dayjs | string | null;
  startTime?: string | null;
  endTime?: string | null;
  selectedRoomId?: number | null;
}

const DEFAULT_EQUIPMENTS: EquipmentItem[] = [
  {
    id: 101,
    code: 'EQ-MC-001',
    name: 'Micro không dây Shure (Bộ 2 mic)',
    type: 'Microphone',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 10,
    status: 'Active'
  },
  {
    id: 102,
    code: 'EQ-SP-002',
    name: 'Loa kéo công suất lớn 500W',
    type: 'Sound System',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 5,
    status: 'Active'
  },
  {
    id: 103,
    code: 'EQ-PJ-003',
    name: 'Máy chiếu di động Panasonic PT-LB386',
    type: 'Projector',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 4,
    status: 'Active'
  },
  {
    id: 104,
    code: 'EQ-CAM-004',
    name: 'Webcam/Camera họp & giảng dạy trực tuyến HD',
    type: 'Camera',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 6,
    status: 'Active'
  },
  {
    id: 105,
    code: 'EQ-BO-005',
    name: 'Bảng di động Flipchart / Bảng phụ',
    type: 'Board',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 8,
    status: 'Active'
  },
  {
    id: 106,
    code: 'EQ-EXT-006',
    name: 'Ổ cắm điện kéo dài (Dây 10m)',
    type: 'Extension Cord',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 12,
    status: 'Active'
  },
  {
    id: 107,
    code: 'EQ-PRES-007',
    name: 'Bút trình chiếu Laser (Presenter)',
    type: 'Presenter',
    roomId: null,
    roomName: 'Kho thiết bị dùng chung',
    quantity: 15,
    status: 'Active'
  }
];

export const EquipmentSelector: React.FC<EquipmentSelectorProps> = ({
  value = [],
  onChange,
  equipments,
  allBookings,
  selectedDate,
  startTime,
  endTime,
  selectedRoomId
}) => {
  // Parsing chuỗi "Tên thiết bị (SL: 2)" thành Map để hiển thị
  const selections = useMemo(() => {
    const map = new Map<string, number>();
    (value || []).forEach(v => {
      if (!v) return;
      const match = v.match(/(.+) \(SL: (\d+)\)/);
      if (match) {
        map.set(match[1].trim(), parseInt(match[2], 10));
      } else {
        map.set(v.trim(), 1);
      }
    });
    return map;
  }, [value]);

  // Trạng thái modal popup
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempSelections, setTempSelections] = useState<Map<string, number>>(new Map());
  const [searchKeyword, setSearchKeyword] = useState('');

  // Tính ngày và giờ bắt đầu / kết thúc
  const d = selectedDate ? (dayjs.isDayjs(selectedDate) ? selectedDate : dayjs(selectedDate)) : dayjs();
  const st = startTime ? dayjs(`${d.format('YYYY-MM-DD')} ${startTime}`) : null;
  const et = endTime ? dayjs(`${d.format('YYYY-MM-DD')} ${endTime}`) : null;
  const isTimeReady = Boolean(startTime && endTime);

  // Tính số lượng khả dụng của từng thiết bị trong khung giờ
  const getAvailableQuantity = (equipment: EquipmentItem) => {
    if (equipment.status === 'Broken' || equipment.status === 'Maintenance' || equipment.status === 'Disposed') {
      return 0;
    }
    let usedQuantity = 0;
    if (st && et) {
      (allBookings || []).forEach(b => {
        if (b.status === 'Cancelled' || b.status === 'Rejected' || String(b.status) === '2' || String(b.status) === '3') return;
        
        const bStart = dayjs(b.startTime);
        const bEnd = dayjs(b.endTime);
        
        // Điều kiện trùng lặp khung giờ
        if (st.isBefore(bEnd) && et.isAfter(bStart)) {
          b.requestedEquipments?.forEach(reqEq => {
            const match = reqEq.match(/(.+) \(SL: (\d+)\)/);
            let name = reqEq.trim();
            let q = 1;
            if (match) {
              name = match[1].trim();
              q = parseInt(match[2], 10);
            }
            if (name === equipment.name) {
              usedQuantity += q;
            }
          });
        }
      });
    }
    return Math.max(0, equipment.quantity - usedQuantity);
  };

  // Danh sách các thiết bị dùng chung hoặc thuộc phòng hiện tại
  const allowedEquipments = useMemo(() => {
    const fetched = Array.isArray(equipments) ? equipments : [];
    const combinedMap = new Map<string, EquipmentItem>();
    
    // Nạp thiết bị mặc định
    DEFAULT_EQUIPMENTS.forEach(eq => {
      combinedMap.set(eq.code || eq.name, eq);
    });
    
    // Ghi đè hoặc bổ sung từ CSDL
    fetched.forEach(eq => {
      combinedMap.set(eq.code || eq.name, eq);
    });

    const allList = Array.from(combinedMap.values());

    return allList.filter(e => {
      if (e.status === 'Disposed') return false;
      const isShared = e.roomId === null || e.roomId === undefined || e.roomId === 0 || !e.roomId || (e.roomName && e.roomName.toLowerCase().includes('dùng chung'));
      const isCurrentRoom = selectedRoomId ? String(e.roomId) === String(selectedRoomId) : false;
      return isShared || isCurrentRoom;
    });
  }, [equipments, selectedRoomId]);

  // Lọc theo từ khóa tìm kiếm trong modal
  const filteredEquipments = useMemo(() => {
    if (!searchKeyword.trim()) return allowedEquipments;
    const kw = searchKeyword.toLowerCase().trim();
    return allowedEquipments.filter(item =>
      item.name.toLowerCase().includes(kw) ||
      item.code.toLowerCase().includes(kw) ||
      (item.type && item.type.toLowerCase().includes(kw))
    );
  }, [allowedEquipments, searchKeyword]);

  // Mở modal popup và khởi tạo tạm thời theo danh sách đã chọn hiện tại
  const handleOpenModal = () => {
    setTempSelections(new Map(selections));
    setSearchKeyword('');
    setIsModalOpen(true);
  };

  // Thay đổi lựa chọn trong modal
  const handleToggleTemp = (name: string, checked: boolean, defaultQty: number = 1) => {
    const next = new Map(tempSelections);
    if (checked) {
      next.set(name, defaultQty > 0 ? defaultQty : 1);
    } else {
      next.delete(name);
    }
    setTempSelections(next);
  };

  // Cập nhật số lượng của thiết bị trong modal
  const handleUpdateTempQuantity = (name: string, quantity: number) => {
    const next = new Map(tempSelections);
    if (quantity > 0) {
      next.set(name, quantity);
    } else {
      next.delete(name);
    }
    setTempSelections(next);
  };

  // Xác nhận lưu từ modal vào form
  const handleConfirmModal = () => {
    const newVal: string[] = [];
    tempSelections.forEach((q, n) => {
      newVal.push(`${n} (SL: ${q})`);
    });
    onChange?.(newVal);
    setIsModalOpen(false);
  };

  // Xóa 1 thiết bị trực tiếp từ tag bên ngoài
  const handleRemoveOne = (nameToRemove: string) => {
    const newMap = new Map(selections);
    newMap.delete(nameToRemove);
    const newVal: string[] = [];
    newMap.forEach((q, n) => {
      newVal.push(`${n} (SL: ${q})`);
    });
    onChange?.(newVal);
  };

  // Tổng số lượng thiết bị đã chọn
  const totalQuantity = useMemo(() => {
    let count = 0;
    selections.forEach(q => { count += q; });
    return count;
  }, [selections]);

  const tempTotalQuantity = useMemo(() => {
    let count = 0;
    tempSelections.forEach(q => { count += q; });
    return count;
  }, [tempSelections]);

  // Trường hợp chưa chọn thời gian bắt đầu và kết thúc
  if (!isTimeReady) {
    return (
      <div
        style={{
          border: '1.5px dashed #cbd5e1',
          borderRadius: 8,
          padding: '14px 18px',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#64748b'
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: 18,
            border: '1px solid #e2e8f0'
          }}
        >
          <ToolOutlined />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: '#475569', fontSize: 13.5 }}>
            Mượn thêm thiết bị dùng chung
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Vui lòng chọn thời gian bắt đầu và kết thúc ở Bước 1 để kiểm tra số lượng thiết bị khả dụng.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* KHU VỰC HIỂN THỊ TRÊN FORM (GỌN GÀNG, BẤM VÀO ĐỂ MỞ POPUP) */}
      {selections.size === 0 ? (
        <div
          onClick={handleOpenModal}
          style={{
            border: '1.5px dashed #94a3b8',
            borderRadius: 8,
            padding: '12px 18px',
            background: '#f8fafc',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#0d2e5c';
            e.currentTarget.style.background = '#f0f9ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#94a3b8';
            e.currentTarget.style.background = '#f8fafc';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#eff6ff',
                color: '#0d2e5c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 19,
                border: '1.5px solid #bfdbfe'
              }}
            >
              <ToolOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13.5 }}>
                Chưa chọn thiết bị mượn thêm
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Bấm vào đây để mở danh sách chọn Micro, Loa kéo, Máy chiếu di động, Camera, Bảng phụ...
              </div>
            </div>
          </div>
          <Button
            type="primary"
            ghost
            icon={<PlusOutlined />}
            style={{
              borderColor: '#0d2e5c',
              color: '#0d2e5c',
              fontWeight: 600,
              borderRadius: 6,
              height: 34,
              pointerEvents: 'none'
            }}
          >
            Chọn thiết bị
          </Button>
        </div>
      ) : (
        <div
          style={{
            border: '1.5px solid #94a3b8',
            borderRadius: 8,
            padding: '12px 16px',
            background: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  background: '#eff6ff',
                  color: '#0d2e5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  border: '1px solid #bfdbfe'
                }}
              >
                <ToolOutlined />
              </div>
              <div>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5 }}>
                  Thiết bị mượn thêm đã chọn
                </span>
                <Tag color="blue" style={{ marginLeft: 8, borderRadius: 12, fontWeight: 600, border: '1px solid #93c5fd' }}>
                  {selections.size} loại ({totalQuantity} món)
                </Tag>
              </div>
            </div>
            <Space>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => onChange?.([])}
                style={{ fontSize: 12.5 }}
              >
                Xóa tất cả
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined />}
                onClick={handleOpenModal}
                style={{
                  backgroundColor: '#0d2e5c',
                  borderColor: '#0d2e5c',
                  borderRadius: 6,
                  fontWeight: 600,
                  height: 30
                }}
              >
                Thay đổi / Chọn thêm
              </Button>
            </Space>
          </div>

          {/* Danh sách các thiết bị đã chọn dưới dạng Tag nhãn */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
            {Array.from(selections.entries()).map(([name, qty]) => (
              <Tag
                key={name}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  handleRemoveOne(name);
                }}
                style={{
                  padding: '5px 12px',
                  fontSize: 13,
                  borderRadius: 6,
                  background: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  color: '#1e293b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ToolOutlined style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 600 }}>{name}</span>
                <span
                  style={{
                    background: '#0d2e5c',
                    color: '#ffffff',
                    borderRadius: 10,
                    padding: '1px 8px',
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  x{qty}
                </span>
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* MODAL POPUP CHỌN THIẾT BỊ MƯỢN THÊM */}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={740}
        centered
        zIndex={1060}
        destroyOnClose={false}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0d2e5c',
                fontSize: 20,
                border: '1.5px solid #bfdbfe'
              }}
            >
              <ToolOutlined />
            </div>
            <div>
              <Typography.Title level={4} style={{ margin: 0, color: '#0d2e5c', fontSize: 16.5, fontWeight: 700 }}>
                Danh Mục Thiết Bị Dùng Chung Mượn Thêm
              </Typography.Title>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Khung giờ: <strong>{startTime} - {endTime}</strong> | Ngày: <strong>{d.format('DD/MM/YYYY')}</strong>
              </div>
            </div>
          </div>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
            <div>
              {tempSelections.size > 0 ? (
                <span style={{ fontSize: 13, color: '#334155' }}>
                  Đã chọn: <strong style={{ color: '#0d2e5c' }}>{tempSelections.size} loại thiết bị</strong> ({tempTotalQuantity} món)
                </span>
              ) : (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  Chưa chọn thiết bị nào
                </span>
              )}
            </div>
            <Space>
              {tempSelections.size > 0 && (
                <Button onClick={() => setTempSelections(new Map())}>
                  Bỏ chọn tất cả
                </Button>
              )}
              <Button onClick={() => setIsModalOpen(false)}>
                Hủy bỏ
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleConfirmModal}
                style={{
                  backgroundColor: '#0d2e5c',
                  borderColor: '#0d2e5c',
                  fontWeight: 600,
                  padding: '0 22px',
                  borderRadius: 6
                }}
              >
                Xác nhận chọn thiết bị
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ paddingTop: 8 }}>
          {/* Thông báo hướng dẫn ngắn gọn */}
          <Alert
            type="info"
            showIcon
            style={{
              marginBottom: 12,
              borderRadius: 8,
              fontSize: 12.5,
              padding: '6px 12px',
              border: '1px solid #bae6fd',
              background: '#f0f9ff'
            }}
            message={
              <span style={{ color: '#0369a1' }}>
                Hệ thống tự động kiểm tra số lượng khả dụng theo khung giờ đặt phòng đã chọn. Tick chọn thiết bị và nhập số lượng cần mượn.
              </span>
            }
          />

          {/* Thanh tìm kiếm nhanh */}
          <Input
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            placeholder="Tìm nhanh theo tên thiết bị hoặc mã (VD: micro, loa, máy chiếu, camera, EQ-MC-001)..."
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            style={{ borderRadius: 8, marginBottom: 14, height: 38, border: '1.5px solid #cbd5e1' }}
          />

          {/* Danh sách thiết bị */}
          {filteredEquipments.length === 0 ? (
            <div style={{ padding: '30px 0' }}>
              <Empty description="Không tìm thấy thiết bị phù hợp với từ khóa tìm kiếm." />
            </div>
          ) : (
            <div
              style={{
                maxHeight: '50vh',
                overflowY: 'auto',
                paddingRight: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {filteredEquipments.map((item) => {
                const availableQty = getAvailableQuantity(item);
                const isUnavailable = availableQty === 0;
                const currentQty = tempSelections.get(item.name) || 0;
                const isChecked = currentQty > 0;

                let statusTag = <Tag color="success" icon={<CheckCircleOutlined />}>Khả dụng</Tag>;
                if (item.status === 'Maintenance') statusTag = <Tag color="warning" icon={<ToolOutlined />}>Đang bảo trì</Tag>;
                else if (item.status === 'Broken') statusTag = <Tag color="error" icon={<WarningOutlined />}>Đang hỏng</Tag>;
                else if (isUnavailable) statusTag = <Tag color="default">Hết số lượng</Tag>;

                const requiresTechSupport = ['Projector', 'Sound System', 'Microphone', 'Máy chiếu', 'Âm thanh', 'Camera'].some(
                  t => item.type?.toLowerCase().includes(t.toLowerCase()) || item.name?.toLowerCase().includes(t.toLowerCase())
                );

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (isUnavailable) return;
                      handleToggleTemp(item.name, !isChecked, currentQty > 0 ? currentQty : 1);
                    }}
                    style={{
                      background: isUnavailable ? '#f8fafc' : isChecked ? '#f0f9ff' : '#ffffff',
                      border: isChecked ? '1.5px solid #0284c7' : '1.5px solid #cbd5e1',
                      borderRadius: 8,
                      padding: '11px 16px',
                      cursor: isUnavailable ? 'not-allowed' : 'pointer',
                      opacity: isUnavailable ? 0.6 : 1,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: isChecked ? '0 1px 3px rgba(2, 132, 199, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <Checkbox
                        checked={isChecked}
                        disabled={isUnavailable}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleTemp(item.name, e.target.checked, currentQty > 0 ? currentQty : 1);
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Typography.Text strong style={{ fontSize: 13.5, color: isChecked ? '#0369a1' : '#0f172a' }}>
                            {item.name}
                          </Typography.Text>
                          {statusTag}
                          {requiresTechSupport && (
                            <Tooltip title="Cần cán bộ kỹ thuật hỗ trợ cài đặt và hướng dẫn sử dụng">
                              <Tag color="processing" icon={<InfoCircleOutlined />} style={{ fontSize: 11.5 }}>
                                Kỹ thuật hỗ trợ
                              </Tag>
                            </Tooltip>
                          )}
                        </div>
                        <Typography.Text type="secondary" style={{ fontSize: 12.5, display: 'block', marginTop: 2 }}>
                          Mã: <code style={{ color: '#475569' }}>{item.code}</code> • Số lượng khả dụng:{' '}
                          <strong style={{ color: availableQty > 0 ? '#16a34a' : '#dc2626' }}>
                            {availableQty}
                          </strong>{' '}
                          / {item.quantity}
                        </Typography.Text>
                      </div>
                    </div>

                    {/* Bộ đếm số lượng */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <span style={{ fontSize: 12, color: '#64748b' }}>SL:</span>
                      <InputNumber
                        min={1}
                        max={Math.max(1, availableQty)}
                        disabled={!isChecked || isUnavailable}
                        value={isChecked ? currentQty : 1}
                        onChange={(v) => {
                          if (v) {
                            handleUpdateTempQuantity(item.name, v);
                          }
                        }}
                        style={{
                          width: 68,
                          borderRadius: 6,
                          border: isChecked ? '1.5px solid #93c5fd' : '1px solid #d9d9d9',
                          fontWeight: 600
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default EquipmentSelector;
