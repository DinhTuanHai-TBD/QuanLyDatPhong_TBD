import React, { useMemo } from 'react';
import { Checkbox, InputNumber, Typography, Tag, Tooltip } from 'antd';
import { InfoCircleOutlined, ToolOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { EquipmentItem } from '../admin/AdminPage';
import type { Booking } from '../../types/booking';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

interface EquipmentSelectorProps {
  value?: string[];
  onChange?: (val: string[]) => void;
  equipments: EquipmentItem[];
  allBookings: Booking[];
  selectedDate: dayjs.Dayjs;
  startTime: string | null;
  endTime: string | null;
  selectedRoomId: number | null;
}

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
  // Parsing the value strings like "Tên thiết bị (SL: 2)" to get current selections
  const selections = useMemo(() => {
    const map = new Map<string, number>();
    value.forEach(v => {
      const match = v.match(/(.+) \(SL: (\d+)\)/);
      if (match) {
        map.set(match[1].trim(), parseInt(match[2]));
      } else {
        map.set(v.trim(), 1);
      }
    });
    return map;
  }, [value]);

  const handleChange = (name: string, quantity: number, checked: boolean) => {
    const newMap = new Map(selections);
    if (checked && quantity > 0) {
      newMap.set(name, quantity);
    } else {
      newMap.delete(name);
    }
    
    const newVal: string[] = [];
    newMap.forEach((q, n) => {
      newVal.push(`${n} (SL: ${q})`);
    });
    onChange?.(newVal);
  };

  const st = startTime ? dayjs(`${selectedDate.format('YYYY-MM-DD')} ${startTime}`) : null;
  const et = endTime ? dayjs(`${selectedDate.format('YYYY-MM-DD')} ${endTime}`) : null;

  const getAvailableQuantity = (equipment: EquipmentItem) => {
    if (equipment.status === 'Broken' || equipment.status === 'Maintenance' || equipment.status === 'Disposed') {
      return 0;
    }
    let usedQuantity = 0;
    if (st && et) {
      allBookings.forEach(b => {
        if (b.status === 'Cancelled' || b.status === 'Rejected' || String(b.status) === '2' || String(b.status) === '3') return;
        
        const bStart = dayjs(b.startTime);
        const bEnd = dayjs(b.endTime);
        
        // Overlap condition
        if (st.isBefore(bEnd) && et.isAfter(bStart)) {
          // Check if this booking uses this equipment
          b.requestedEquipments?.forEach(reqEq => {
             const match = reqEq.match(/(.+) \(SL: (\d+)\)/);
             let name = reqEq.trim();
             let q = 1;
             if (match) {
                name = match[1].trim();
                q = parseInt(match[2]);
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

  const allowedEquipments = useMemo(() => {
    return equipments.filter(e => e.roomId === null || e.roomId === selectedRoomId);
  }, [equipments, selectedRoomId]);

  if (!startTime || !endTime) {
    return (
      <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, color: '#64748b', textAlign: 'center' }}>
        Vui lòng chọn thời gian bắt đầu và kết thúc trên bảng để xem thiết bị khả dụng.
        <div style={{ fontSize: 11, marginTop: 4, color: '#94a3b8' }}>
          Đề xuất API: GET /api/equipments/available?startTime=...&endTime=...
        </div>
      </div>
    );
  }

  if (allowedEquipments.length === 0) {
    return <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, color: '#64748b' }}>Không có thiết bị nào được phép mượn thêm.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {allowedEquipments.map((item) => {

        const availableQty = getAvailableQuantity(item);
        const isUnavailable = availableQty === 0;
        const currentSelectedQty = selections.get(item.name) || 0;
        const checked = currentSelectedQty > 0;
        
        let statusTag = <Tag color="success" icon={<CheckCircleOutlined />}>Khả dụng</Tag>;
        if (item.status === 'Maintenance') statusTag = <Tag color="warning" icon={<ToolOutlined />}>Đang bảo trì</Tag>;
        else if (item.status === 'Broken') statusTag = <Tag color="error" icon={<WarningOutlined />}>Đang hỏng</Tag>;
        else if (isUnavailable) statusTag = <Tag color="default">Hết số lượng</Tag>;

        // Simulate a requiresTechSupport flag based on type
        const requiresTechSupport = ['Projector', 'Sound System', 'Microphone', 'Máy chiếu', 'Âm thanh', 'Camera'].some(t => item.type?.toLowerCase().includes(t.toLowerCase()) || item.name?.toLowerCase().includes(t.toLowerCase()));

        return (
          <div
            key={item.id}
            style={{ 
              background: isUnavailable ? '#f8fafc' : '#fff', 
              opacity: isUnavailable ? 0.7 : 1,
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              marginBottom: 8,
              padding: '12px 16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 12 }}>
              <Checkbox 
                disabled={isUnavailable}
                checked={checked}
                onChange={e => handleChange(item.name, e.target.checked ? 1 : 0, e.target.checked)}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  {statusTag}
                  {requiresTechSupport && (
                    <Tooltip title="Cần cán bộ kỹ thuật hỗ trợ khi sử dụng">
                      <Tag color="processing" icon={<InfoCircleOutlined />}>Kỹ thuật hỗ trợ</Tag>
                    </Tooltip>
                  )}
                </div>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  Mã: {item.code} - Số lượng khả dụng: {availableQty} / {item.quantity}
                </Typography.Text>
              </div>
              <div>
                <InputNumber 
                  min={1}
                  max={Math.max(1, availableQty)}
                  disabled={!checked || isUnavailable}
                  value={currentSelectedQty || 1}
                  onChange={v => handleChange(item.name, v || 1, checked)}
                />
              </div>
            </div>
          </div>
        );
      
      })}
    </div>
  );
};
