import { useState, useMemo } from 'react';
import { Card, Row, Col, Statistic, Select, DatePicker, Button, Typography, Space, Empty } from 'antd';
import { FilterOutlined, FileExcelOutlined, FilePdfOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Room } from '../../types/room';
import type { Booking } from '../../types/booking';
import type { EquipmentIssue } from './AdminPage';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface AnalyticsDashboardProps {
  rooms: Room[];
  bookings: Booking[];
  issues: EquipmentIssue[];
  accounts: { email: string, department: string }[];
}

const COLORS = ['#0d2e5c', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#8b5cf6'];

export default function AnalyticsDashboard({ rooms, bookings, issues, accounts }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [buildingFilter, setBuildingFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Derive unique filter options
  const buildings = useMemo(() => Array.from(new Set(rooms.map(r => r.building).filter(Boolean))), [rooms]);
  const roomTypes = useMemo(() => Array.from(new Set(rooms.map(r => r.roomType).filter(Boolean))), [rooms]);
  const departments = useMemo(() => Array.from(new Set(accounts.map(a => a.department).filter(Boolean))), [accounts]);

  // Apply filters
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const room = rooms.find(r => r.id === b.roomId);
      const user = accounts.find(a => a.email === b.userEmail);
      
      let pass = true;
      if (dateRange && dateRange[0] && dateRange[1]) {
        const start = dayjs(b.startTime);
        if (start.isBefore(dateRange[0]) || start.isAfter(dateRange[1])) pass = false;
      }
      if (buildingFilter !== 'all' && room?.building !== buildingFilter) pass = false;
      if (roomTypeFilter !== 'all' && room?.roomType !== roomTypeFilter) pass = false;
      if (departmentFilter !== 'all' && user?.department !== departmentFilter) pass = false;
      if (statusFilter !== 'all' && b.status !== statusFilter) pass = false;
      return pass;
    });
  }, [bookings, rooms, accounts, dateRange, buildingFilter, roomTypeFilter, departmentFilter, statusFilter]);

  // Metrics calculation
  const totalBookings = filteredBookings.length;
  const pendingCount = filteredBookings.filter(b => b.status === 'Pending' || b.status === 'PendingSpecial').length;
  const approvedCount = filteredBookings.filter(b => b.status === 'Approved' || b.status === 'Completed' || b.status === 'Using').length;
  const rejectedCount = filteredBookings.filter(b => b.status === 'Rejected').length;
  const cancelledNoShowCount = filteredBookings.filter(b => b.status === 'Cancelled' || String(b.status) === 'NoShow').length;
  
  const approvalRate = totalBookings > 0 ? ((approvedCount / totalBookings) * 100).toFixed(1) : '0';

  let totalHours = 0;
  const roomUsageCount: Record<string, number> = {};
  const peakHoursMap: Record<number, number> = {};

  filteredBookings.forEach(b => {
    if (b.status !== 'Rejected' && b.status !== 'Cancelled') {
      const start = dayjs(b.startTime);
      const end = dayjs(b.endTime);
      const hours = end.diff(start, 'hour', true);
      if (hours > 0) totalHours += hours;

      roomUsageCount[b.roomName] = (roomUsageCount[b.roomName] || 0) + 1;

      const hour = start.hour();
      peakHoursMap[hour] = (peakHoursMap[hour] || 0) + 1;
    }
  });

  const sortedRooms = Object.entries(roomUsageCount).sort((a, b) => b[1] - a[1]);
  const mostUsedRoom = sortedRooms.length > 0 ? sortedRooms[0][0] : 'N/A';
  const leastUsedRoom = sortedRooms.length > 0 ? sortedRooms[sortedRooms.length - 1][0] : 'N/A';

  // Equipment issues
  const equipmentIssueCount: Record<string, number> = {};
  issues.forEach(i => {
    equipmentIssueCount[i.equipmentName] = (equipmentIssueCount[i.equipmentName] || 0) + 1;
  });
  const mostBrokenEquip = Object.entries(equipmentIssueCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const utilizationRate = (totalHours / (rooms.length * 8 * 30) * 100).toFixed(1); // Rough estimate

  // Charts data
  const statusPieData = [
    { name: 'Chờ duyệt', value: pendingCount, color: '#f59e0b' },
    { name: 'Đã duyệt', value: approvedCount, color: '#10b981' },
    { name: 'Từ chối', value: rejectedCount, color: '#ef4444' },
    { name: 'Hủy/Không đến', value: cancelledNoShowCount, color: '#64748b' }
  ].filter(d => d.value > 0);

  const peakHoursData = Object.entries(peakHoursMap)
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([hour, count]) => ({
      hour: `${hour}:00`,
      'Lượt đặt': count
    }));

  const roomBarData = sortedRooms.slice(0, 10).map(([name, count]) => ({
    name,
    'Lượt đặt': count
  }));

  // Export Data
  const handleExportExcel = () => {
    const data = filteredBookings.map(b => ({
      'ID Yêu cầu': b.id,
      'Phòng': b.roomName,
      'Người đặt': b.userEmail,
      'Bắt đầu': dayjs(b.startTime).format('DD/MM/YYYY HH:mm'),
      'Kết thúc': dayjs(b.endTime).format('DD/MM/YYYY HH:mm'),
      'Mục đích': b.purpose,
      'Trạng thái': b.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Đặt Phòng');
    XLSX.writeFile(wb, `Bao_Cao_Dat_Phong_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Báo Cáo Đặt Phòng TBD', 14, 15);
    
    const tableData = filteredBookings.map(b => [
      b.id,
      b.roomName,
      b.userEmail,
      dayjs(b.startTime).format('DD/MM/YYYY HH:mm'),
      dayjs(b.endTime).format('DD/MM/YYYY HH:mm'),
      b.status
    ]);

    (doc as any).autoTable({
      startY: 25,
      head: [['ID', 'Phòng', 'Người đặt', 'Bắt đầu', 'Kết thúc', 'Trạng thái']],
      body: tableData,
    });
    
    doc.save(`Bao_Cao_Dat_Phong_${dayjs().format('YYYYMMDD')}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Filters */}
      <Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <Space wrap align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <FilterOutlined style={{ color: '#0d2e5c' }} />
            <Text strong>Bộ lọc:</Text>
            <RangePicker 
              onChange={(dates: any) => setDateRange(dates)} 
              placeholder={['Từ ngày', 'Đến ngày']}
              style={{ width: 250 }}
            />
            <Select value={buildingFilter} onChange={setBuildingFilter} style={{ width: 140 }}>
              <Select.Option value="all">Tất cả Tòa nhà</Select.Option>
              {buildings.map(b => <Select.Option key={b} value={b ?? ""}>{b}</Select.Option>)}
            </Select>
            <Select value={roomTypeFilter} onChange={setRoomTypeFilter} style={{ width: 140 }}>
              <Select.Option value="all">Tất cả Loại phòng</Select.Option>
              {roomTypes.map(t => <Select.Option key={t as string} value={t ?? ""}>{t}</Select.Option>)}
            </Select>
            <Select value={departmentFilter} onChange={setDepartmentFilter} style={{ width: 160 }}>
              <Select.Option value="all">Tất cả Đơn vị/Khoa</Select.Option>
              {departments.map(d => <Select.Option key={d} value={d ?? ""}>{d}</Select.Option>)}
            </Select>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }}>
              <Select.Option value="all">Tất cả Trạng thái</Select.Option>
              <Select.Option value="Pending">Chờ duyệt</Select.Option>
              <Select.Option value="Approved">Đã duyệt</Select.Option>
              <Select.Option value="Rejected">Từ chối</Select.Option>
              <Select.Option value="Cancelled">Đã hủy</Select.Option>
            </Select>
          </Space>
          <Space>
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel} style={{ borderColor: '#10b981', color: '#10b981' }}>
              Xuất Excel
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={handleExportPDF} danger>
              Xuất PDF
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Metrics */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #bfdbfe', borderRadius: 8, background: '#eff6ff' }}>
            <Statistic title="Tổng lượt đặt" value={totalBookings} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #a7f3d0', borderRadius: 8, background: '#ecfdf5' }}>
            <Statistic title="Tỷ lệ phê duyệt" value={approvalRate} suffix="%" />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #fde68a', borderRadius: 8, background: '#fffbeb' }}>
            <Statistic title="Tổng giờ sử dụng" value={totalHours.toFixed(1)} suffix="h" />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
            <Statistic title="Tỷ lệ dùng phòng (ước tính)" value={utilizationRate} suffix="%" />
          </Card>
        </Col>
        
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <Statistic title="Phòng dùng nhiều nhất" value={mostUsedRoom} styles={{ content: { fontSize: 16, fontWeight: 'bold' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <Statistic title="Phòng dùng ít nhất" value={leastUsedRoom} styles={{ content: { fontSize: 16, fontWeight: 'bold' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #fecaca', borderRadius: 8 }}>
            <Statistic title="Hủy / Không đến" value={cancelledNoShowCount} styles={{ content: { color: '#ef4444' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <Statistic title="Thiết bị hỏng nhiều nhất" value={mostBrokenEquip} styles={{ content: { fontSize: 16, fontWeight: 'bold' } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
            <Statistic title="Thời gian xử lý TB" value={"25"} suffix="phút" styles={{ content: { color: '#0d2e5c' } }} />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card title="Trạng thái Yêu cầu" style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}>
            {statusPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={statusPieData[index]?.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Không có dữ liệu" />
            )}
          </Card>
        </Col>
        
        <Col xs={24} md={16}>
          <Card title="Khung giờ cao điểm (Lượt đặt theo giờ)" style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: '100%' }}>
            {peakHoursData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip />
                  <Area type="monotone" dataKey="Lượt đặt" stroke="#3b82f6" fill="#eff6ff" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Không có dữ liệu" />
            )}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Phòng được sử dụng nhiều nhất (Top 10)" style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
            {roomBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={roomBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip />
                  <Bar dataKey="Lượt đặt" fill="#0d2e5c" radius={[4, 4, 0, 0]}>
                    {roomBarData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Không có dữ liệu" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
