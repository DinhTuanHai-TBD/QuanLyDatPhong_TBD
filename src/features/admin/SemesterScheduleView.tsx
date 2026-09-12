import { useState, useMemo } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Input,
  Select,
  Row,
  Col,
  Statistic,
  Badge,
  Popconfirm,
  message,
  Drawer,
  Empty
} from 'antd'
import {
  CalendarOutlined,
  PlusOutlined,
  SearchOutlined,
  BookOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  LockOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { toVN, formatVNTime } from '../../utils/dateUtils'
import type { Booking } from '../../types/booking'
import type { Room } from '../../types/room'
import { http } from '../../api/http'
import { useQueryClient } from '@tanstack/react-query'

const { Title, Text } = Typography

interface SemesterScheduleViewProps {
  bookings: Booking[]
  rooms: Room[]
  onOpenCreateModal: () => void
  canManageSchedule: boolean
}

interface CourseScheduleGroup {
  courseKey: string
  subjectName: string
  subjectCode: string
  classCode: string
  lecturerName: string
  department: string
  roomId: number
  roomName: string
  semester: string
  academicYear: string
  periodInfo: string
  sessionCount: number
  firstSessionDate: string
  lastSessionDate: string
  daysOfWeekText: string
  sessions: Booking[]
}

export default function SemesterScheduleView({
  bookings,
  rooms,
  onOpenCreateModal,
  canManageSchedule
}: SemesterScheduleViewProps) {
  const queryClient = useQueryClient()
  const [semesterFilter, setSemesterFilter] = useState<string>('all')
  const [roomFilter, setRoomFilter] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedGroup, setSelectedGroup] = useState<CourseScheduleGroup | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false)

  // Filter school schedule bookings (those with isSchoolOverride or marked as timetable)
  const schoolBookings = useMemo(() => {
    return bookings.filter((b) => {
      const isOverride = b.isSchoolOverride || b.IsSchoolOverride
      const purpose = (b.purpose || '').toLowerCase()
      const notes = (b.notes || '').toLowerCase()
      const adminNotes = (b.adminNotes || '').toLowerCase()

      const isTimetable =
        isOverride ||
        purpose.includes('[tkb') ||
        purpose.includes('lịch học:') ||
        purpose.includes('thời khóa biểu') ||
        notes.includes('lịch học chính khóa') ||
        adminNotes.includes('thời khóa biểu')

      const status = String(b.status).toLowerCase()
      const isActive = status !== 'cancelled' && status !== 'rejected' && status !== '-1' && status !== '2'

      return isTimetable && isActive
    })
  }, [bookings])

  // Group individual sessions into course subjects
  const courseGroups = useMemo(() => {
    const map = new Map<string, CourseScheduleGroup>()

    schoolBookings.forEach((b) => {
      // Group key by subject + class + room
      const subject = b.subjectName || (b.purpose ? b.purpose.split('-')[0].trim() : 'Lịch học chính khóa')
      const classCode = b.classCode || ''
      const key = `${subject}_${classCode}_${b.roomId}_${b.semester || 'HK'}`

      const d = toVN(b.startTime)
      const dayOfWeek = d.day()
      const dayName = dayOfWeek === 0 ? 'CN' : `T${dayOfWeek + 1}`

      if (!map.has(key)) {
        map.set(key, {
          courseKey: key,
          subjectName: b.subjectName || subject,
          subjectCode: b.subjectCode || 'N/A',
          classCode: b.classCode || 'Lớp chung',
          lecturerName: b.lecturerName || b.personInCharge || 'Bộ môn',
          department: b.department || 'Đại học Thái Bình Dương',
          roomId: b.roomId,
          roomName: b.roomName || `Phòng ${b.roomId}`,
          semester: b.semester || 'Học kỳ',
          academicYear: b.academicYear || `${dayjs().year()}-${dayjs().year() + 1}`,
          periodInfo: b.periodInfo || 'Tiết chuẩn',
          sessionCount: 1,
          firstSessionDate: b.startTime,
          lastSessionDate: b.endTime,
          daysOfWeekText: dayName,
          sessions: [b]
        })
      } else {
        const group = map.get(key)!
        group.sessionCount += 1
        group.sessions.push(b)

        if (new Date(b.startTime).getTime() < new Date(group.firstSessionDate).getTime()) {
          group.firstSessionDate = b.startTime
        }
        if (new Date(b.endTime).getTime() > new Date(group.lastSessionDate).getTime()) {
          group.lastSessionDate = b.endTime
        }

        if (!group.daysOfWeekText.includes(dayName)) {
          group.daysOfWeekText += `, ${dayName}`
        }
      }
    })

    return Array.from(map.values())
  }, [schoolBookings])

  // Filtered course groups
  const filteredCourses = useMemo(() => {
    return courseGroups.filter((g) => {
      if (semesterFilter !== 'all') {
        const sem = g.semester.toLowerCase()
        if (!sem.includes(semesterFilter.toLowerCase())) return false
      }
      if (roomFilter !== 'all' && g.roomId !== roomFilter) {
        return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          g.subjectName.toLowerCase().includes(q) ||
          g.subjectCode.toLowerCase().includes(q) ||
          g.classCode.toLowerCase().includes(q) ||
          g.lecturerName.toLowerCase().includes(q) ||
          g.roomName.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [courseGroups, semesterFilter, roomFilter, searchQuery])

  // Count by summer semester
  const hk3Count = useMemo(() => schoolBookings.filter(b => (b.semester || b.purpose || '').includes('HK3') || (b.purpose || '').toLowerCase().includes('hè')).length, [schoolBookings])

  // Delete/Cancel an entire course timetable
  const handleDeleteCourse = async (group: CourseScheduleGroup) => {
    try {
      // 1. Cancel sessions in API if supported
      for (const s of group.sessions) {
        try {
          await http.put(`/api/bookings/${s.id}/reject`, {
            reason: `Hủy toàn bộ thời khóa biểu môn ${group.subjectName}`
          })
        } catch {}
      }

      // 2. Remove or cancel in local storage
      const localStr = localStorage.getItem('tbd_admin_bookings')
      if (localStr) {
        const list: Booking[] = JSON.parse(localStr)
        const sessionIds = new Set(group.sessions.map(s => s.id))
        const updated = list.filter(b => !sessionIds.has(b.id))
        localStorage.setItem('tbd_admin_bookings', JSON.stringify(updated))
      }

      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['all-bookings-validation'] })

      message.success(`Đã xóa thành công lịch học của môn ${group.subjectName} (${group.sessionCount} buổi)!`)
    } catch {
      message.error('Có lỗi xảy ra khi xóa lịch học.')
    }
  }

  const columns = [
    {
      title: 'Học kỳ',
      dataIndex: 'semester',
      key: 'semester',
      width: 140,
      render: (sem: string) => {
        let color = 'blue'
        let text = sem || 'Chính khóa'
        if (sem.includes('HK1') || sem.includes('Kỳ 1')) {
          color = 'blue'
          text = 'HK1 (Thu)'
        } else if (sem.includes('HK2') || sem.includes('Kỳ 2')) {
          color = 'green'
          text = 'HK2 (Xuân)'
        } else if (sem.includes('HK3') || sem.includes('Hè') || sem.includes('Summer')) {
          color = 'orange'
          text = 'HK3 (Hè)'
        } else {
          color = 'purple'
        }
        return <Tag color={color} style={{ fontWeight: 600 }}>{text}</Tag>
      }
    },
    {
      title: 'Môn học & Lớp học phần',
      key: 'subject',
      render: (_: any, r: CourseScheduleGroup) => (
        <div>
          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>{r.subjectName}</div>
          <Space orientation="horizontal" size={4} style={{ marginTop: 2 }}>
            {r.subjectCode !== 'N/A' && <Tag style={{ fontSize: 11 }}>Mã: {r.subjectCode}</Tag>}
            <Tag color="cyan" style={{ fontSize: 11 }}>Lớp: {r.classCode}</Tag>
          </Space>
        </div>
      )
    },
    {
      title: 'Phòng học',
      key: 'room',
      width: 140,
      render: (_: any, r: CourseScheduleGroup) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0284c7' }}>{r.roomName}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Lịch học chính khóa</div>
        </div>
      )
    },
    {
      title: 'Khung giờ & Lịch học',
      key: 'time',
      render: (_: any, r: CourseScheduleGroup) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1e40af' }}>
            {r.daysOfWeekText} | {r.periodInfo}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {dayjs(r.firstSessionDate).format('DD/MM/YYYY')} - {dayjs(r.lastSessionDate).format('DD/MM/YYYY')}
          </div>
        </div>
      )
    },
    {
      title: 'Giảng viên',
      dataIndex: 'lecturerName',
      key: 'lecturerName',
      render: (name: string, r: CourseScheduleGroup) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{r.department}</div>
        </div>
      )
    },
    {
      title: 'Số buổi',
      dataIndex: 'sessionCount',
      key: 'sessionCount',
      width: 100,
      align: 'center' as const,
      render: (count: number) => (
        <Badge
          count={`${count} buổi`}
          style={{ backgroundColor: '#0284c7', fontWeight: 600 }}
        />
      )
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: () => (
        <div>
          <Tag color="success" icon={<CheckCircleOutlined />}>Đã duyệt</Tag>
          <Tag color="gold" icon={<LockOutlined />} style={{ marginTop: 4 }}>IsOverride</Tag>
        </div>
      )
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_: any, r: CourseScheduleGroup) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedGroup(r)
              setIsDetailDrawerOpen(true)
            }}
          />
          {canManageSchedule && (
            <Popconfirm
              title="Xóa toàn bộ lịch học môn này?"
              description={`Hành động này sẽ hủy ${r.sessionCount} buổi học chính khóa của học phần tại ${r.roomName}.`}
              onConfirm={() => handleDeleteCourse(r)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24 }}>
      {/* Header with Title and Action CTA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#0f172a' }}>
            Thời Khóa Biểu & Lịch Học Định Kỳ Theo Học Kỳ (TBD)
          </Title>
          <Text style={{ fontSize: 13, color: '#64748b' }}>
            Quản lý kế hoạch giảng dạy chính khóa các Học kỳ 1, 2, Học kỳ 3 (Hè), phân bổ phòng học và kiểm tra trùng lịch
          </Text>
        </div>

        {canManageSchedule && (
          <Button
            id="btn-import-semester-schedule"
            type="primary"
            icon={<PlusOutlined />}
            onClick={onOpenCreateModal}
            size="large"
            style={{ background: '#0284c7', borderColor: '#0284c7', fontWeight: 600 }}
          >
            Nhập Thời Khóa Biểu Học Kỳ
          </Button>
        )}
      </div>

      {/* KPI Stats Bar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#64748b' }}>Tổng số học phần</span>}
              value={courseGroups.length}
              suffix="môn"
              styles={{ content: { color: '#0284c7', fontWeight: 700 } }}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#1e40af' }}>Tổng số buổi học</span>}
              value={schoolBookings.length}
              suffix="buổi"
              styles={{ content: { color: '#1e40af', fontWeight: 700 } }}
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#fefce8', border: '1px solid #fef08a' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#854d0e' }}>HK3 (Học kỳ Hè)</span>}
              value={hk3Count}
              suffix="buổi"
              styles={{ content: { color: '#ca8a04', fontWeight: 700 } }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#166534' }}>Lịch học chính khóa</span>}
              value={schoolBookings.length}
              suffix="buổi"
              styles={{ content: { color: '#16a34a', fontWeight: 700 } }}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          placeholder="Tìm tên môn, mã môn, giảng viên, lớp..."
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />

        <Select
          value={semesterFilter}
          onChange={setSemesterFilter}
          style={{ width: 200 }}
        >
          <Select.Option value="all">Tất cả học kỳ</Select.Option>
          <Select.Option value="HK1">Học kỳ 1 (Kỳ Thu)</Select.Option>
          <Select.Option value="HK2">Học kỳ 2 (Kỳ Xuân)</Select.Option>
          <Select.Option value="HK3">Học kỳ 3 (Học kỳ Hè)</Select.Option>
          <Select.Option value="CUSTOM">Tùy chỉnh (Custom)</Select.Option>
        </Select>

        <Select
          value={roomFilter}
          onChange={setRoomFilter}
          style={{ width: 200 }}
        >
          <Select.Option value="all">Tất cả phòng học</Select.Option>
          {rooms.map((r) => (
            <Select.Option key={r.id} value={r.id}>
              {r.name}
            </Select.Option>
          ))}
        </Select>
      </div>

      {/* Courses Schedule Table */}
      <Table
        className="academic-table"
        columns={columns}
        dataSource={filteredCourses}
        rowKey="courseKey"
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty
              description="Chưa có thời khóa biểu học kỳ nào được nhập"
            >
              {canManageSchedule && (
                <Button id="btn-empty-import-semester-schedule" type="primary" icon={<PlusOutlined />} onClick={onOpenCreateModal} style={{ background: '#0284c7' }}>
                  Nhập Thời Khóa Biểu Ngay
                </Button>
              )}
            </Empty>
          )
        }}
      />

      {/* Detail Drawer for Selected Course */}
      <Drawer
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              {selectedGroup?.subjectName} ({selectedGroup?.classCode})
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Danh sách chi tiết các buổi học tại {selectedGroup?.roomName}
            </div>
          </div>
        }
        placement="right"
        size={560}
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
      >
        {selectedGroup && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#f8fafc' }}>
              <Row gutter={12}>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Giảng viên:</div>
                  <div style={{ fontWeight: 600 }}>{selectedGroup.lecturerName}</div>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Khoa / Bộ môn:</div>
                  <div style={{ fontWeight: 600 }}>{selectedGroup.department}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Khung giờ chuẩn:</div>
                  <div style={{ fontWeight: 600, color: '#0284c7' }}>{selectedGroup.periodInfo}</div>
                </Col>
                <Col span={12} style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Tổng số buổi:</div>
                  <div style={{ fontWeight: 700, color: '#16a34a' }}>{selectedGroup.sessionCount} buổi học</div>
                </Col>
              </Row>
            </Card>

            <Title level={5} style={{ fontSize: 14 }}>Danh sách từng buổi học cụ thể:</Title>
            <Table
              size="small"
              dataSource={selectedGroup.sessions.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              columns={[
                {
                  title: 'Ngày học',
                  key: 'date',
                  render: (_: any, b: Booking) => {
                    const d = toVN(b.startTime)
                    const dayOfWeek = d.day() === 0 ? 'CN' : `Thứ ${d.day() + 1}`
                    return (
                      <div>
                        <strong>{d.format('DD/MM/YYYY')}</strong> ({dayOfWeek})
                      </div>
                    )
                  }
                },
                {
                  title: 'Giờ học',
                  key: 'time',
                  render: (_: any, b: Booking) => (
                    <Tag color="blue">
                      {formatVNTime(b.startTime)} - {formatVNTime(b.endTime)}
                    </Tag>
                  )
                },
                {
                  title: 'Trạng thái',
                  key: 'status',
                  render: () => <Tag color="blue">Thời khóa biểu chính khóa</Tag>
                }
              ]}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}
