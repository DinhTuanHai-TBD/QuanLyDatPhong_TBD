import { useState, useMemo } from 'react'
import {
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Switch,
  Alert,
  Tooltip,
  Modal,
  Spin,
  message,
  Typography
} from 'antd'
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  ScheduleOutlined
} from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import type { Booking, CreateBookingPayload } from '../../types/booking'
import type { Room } from '../../types/room'
import type { CalculatedSession } from '../../types/schedule'
import {
  TBD_STUDY_PERIODS,
  calculateScheduleSessions
} from '../../types/schedule'
import { http } from '../../api/http'
import { useQueryClient } from '@tanstack/react-query'

dayjs.extend(customParseFormat)

const { Dragger } = Upload
const { Text } = Typography

export interface ParsedCourseRow {
  rowNumber: number
  rawRoom: string
  matchedRoom?: Room
  subjectName: string
  subjectCode?: string
  classCode?: string
  lecturerName: string
  dayOfWeek: number | null // 0: CN, 1: T2, ..., 6: T7
  dayOfWeekLabel: string
  startPeriod: number
  endPeriod: number
  startTimeStr: string
  endTimeStr: string
  startDateStr: string
  endDateStr: string
  semester: string
  department?: string
  notes?: string
  isValid: boolean
  errors: string[]
  totalSessions: number
  sessions: CalculatedSession[]
  hasConflict: boolean
  conflictingBookings: Booking[]
}

interface SemesterScheduleExcelImportProps {
  rooms: Room[]
  allBookings: Booking[]
  currentUserRole: string
  currentUserEmail: string
  currentUserName?: string
  onClose: () => void
  onScheduleCreated?: (createdCount: number) => void
}

export default function SemesterScheduleExcelImport({
  rooms,
  allBookings,
  currentUserRole,
  currentUserEmail,
  currentUserName = 'Quản lý Đào tạo & CSVC',
  onClose,
  onScheduleCreated
}: SemesterScheduleExcelImportProps) {
  const queryClient = useQueryClient()
  const [fileList, setFileList] = useState<any[]>([])
  const [parsedRows, setParsedRows] = useState<ParsedCourseRow[]>([])
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isSchoolOverride, setIsSchoolOverride] = useState<boolean>(true)
  const [conflictDetailRow, setConflictDetailRow] = useState<ParsedCourseRow | null>(null)

  // Permission authorization check
  const isAuthorized = useMemo(() => {
    const role = (currentUserRole || '').toLowerCase()
    const email = (currentUserEmail || '').toLowerCase()
    return (
      role === 'admin' ||
      role === 'approver' ||
      role === 'manager' ||
      role === 'staff' ||
      email.includes('admin') ||
      email.includes('quanly')
    )
  }, [currentUserRole, currentUserEmail])

  // Helper: Normalize room query string
  const normalizeRoomKey = (str: string) => {
    return str
      .toLowerCase()
      .replace(/phòng|phong|p\./gi, '')
      .replace(/[-\s_]/g, '')
      .trim()
  }

  // Helper: Match room
  const findRoom = (rawRoomStr: string): Room | undefined => {
    if (!rawRoomStr) return undefined
    const q = normalizeRoomKey(rawRoomStr)
    return rooms.find((r) => {
      const roomNorm = normalizeRoomKey(r.name)
      return roomNorm === q || r.name.toLowerCase() === rawRoomStr.toLowerCase().trim()
    })
  }

  // Helper: Parse Day of Week
  const parseDayOfWeek = (val: any): { day: number | null; label: string } => {
    if (val === undefined || val === null || val === '') {
      return { day: null, label: 'Chưa xác định' }
    }

    if (typeof val === 'number') {
      if (val >= 2 && val <= 7) {
        return { day: val - 1, label: `Thứ ${val}` }
      }
      if (val === 8 || val === 0) {
        return { day: 0, label: 'Chủ nhật' }
      }
      if (val === 1) {
        return { day: 1, label: 'Thứ 2' }
      }
    }

    const s = String(val).toLowerCase().trim()
    if (s.includes('hai') || s === '2' || s === 'thứ 2' || s === 'thu 2' || s === 't2' || s === 'mon') {
      return { day: 1, label: 'Thứ 2' }
    }
    if (s.includes('ba') || s === '3' || s === 'thứ 3' || s === 'thu 3' || s === 't3' || s === 'tue') {
      return { day: 2, label: 'Thứ 3' }
    }
    if (s.includes('tư') || s.includes('tu') || s.includes('bốn') || s === '4' || s === 'thứ 4' || s === 'thu 4' || s === 't4' || s === 'wed') {
      return { day: 3, label: 'Thứ 4' }
    }
    if (s.includes('năm') || s.includes('nam') || s === '5' || s === 'thứ 5' || s === 'thu 5' || s === 't5' || s === 'thu') {
      return { day: 4, label: 'Thứ 5' }
    }
    if (s.includes('sáu') || s.includes('sau') || s === '6' || s === 'thứ 6' || s === 'thu 6' || s === 't6' || s === 'fri') {
      return { day: 5, label: 'Thứ 6' }
    }
    if (s.includes('bảy') || s.includes('bay') || s === '7' || s === 'thứ 7' || s === 'thu 7' || s === 't7' || s === 'sat') {
      return { day: 6, label: 'Thứ 7' }
    }
    if (s.includes('chủ nhật') || s.includes('chu nhat') || s === 'cn' || s === 'sun' || s === '0' || s === '8') {
      return { day: 0, label: 'Chủ nhật' }
    }

    return { day: null, label: String(val) }
  }

  // Helper: Format Date String YYYY-MM-DD
  const parseDateString = (val: any): string | null => {
    if (!val) return null
    if (val instanceof Date) {
      return dayjs(val).format('YYYY-MM-DD')
    }
    if (typeof val === 'number') {
      // Excel serial date format
      const date = new Date(Math.round((val - 25569) * 86400 * 1000))
      return dayjs(date).format('YYYY-MM-DD')
    }
    const s = String(val).trim()
    // Try formats
    const d1 = dayjs(s, ['YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'DD-MM-YYYY', 'D/M/YYYY'], true)
    if (d1.isValid()) return d1.format('YYYY-MM-DD')
    const d2 = dayjs(s)
    if (d2.isValid()) return d2.format('YYYY-MM-DD')
    return null
  }

  // Helper: Extract column value by multiple possible header keys
  const getColValue = (row: any, candidates: string[]): any => {
    const keys = Object.keys(row)
    for (const cand of candidates) {
      const match = keys.find((k) => k.toLowerCase().replace(/[\s_\-.]/g, '') === cand.toLowerCase().replace(/[\s_\-.]/g, ''))
      if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== '') {
        return row[match]
      }
    }
    return undefined
  }

  // 1. Download Template Excel (.xlsx)
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new()

      // Sheet 1: Mau_ThoiKhoaBieu_TBD
      const headers = [
        'Phòng học',
        'Tên môn học',
        'Mã lớp',
        'Giảng viên',
        'Thứ',
        'Tiết bắt đầu',
        'Tiết kết thúc',
        'Ngày bắt đầu',
        'Ngày kết thúc',
        'Học kỳ',
        'Khoa',
        'Ghi chú'
      ]

      const sampleRows = [
        headers,
        [
          'A201',
          'Lập trình Web nâng cao',
          'IT21A',
          'TS. Nguyễn Văn A',
          'Thứ 2',
          1,
          3,
          '2026-09-01',
          '2027-01-15',
          'HK1',
          'Khoa Công nghệ Thông tin',
          'Lớp chuyên ngành chính khóa (HK1)'
        ],
        [
          'B101',
          'Cơ sở dữ liệu phân tán',
          'IT21B',
          'ThS. Trần Thị B',
          'Thứ 4',
          7,
          9,
          '2027-02-15',
          '2027-06-25',
          'HK2',
          'Khoa Công nghệ Thông tin',
          'Thực hành phòng máy (HK2)'
        ],
        [
          'A102',
          'Kỹ năng giao tiếp chuyên nghiệp',
          'GE03',
          'ThS. Lê Văn C',
          'Thứ 6',
          4,
          6,
          '2027-07-01',
          '2027-08-25',
          'HK3',
          'Khoa Kinh tế & QTKD',
          'Học kỳ Hè (HK3)'
        ]
      ]

      const ws1 = XLSX.utils.aoa_to_sheet(sampleRows)
      ws1['!cols'] = [
        { wch: 14 }, // Phòng học
        { wch: 34 }, // Tên môn học
        { wch: 14 }, // Mã lớp
        { wch: 24 }, // Giảng viên
        { wch: 12 }, // Thứ
        { wch: 15 }, // Tiết bắt đầu
        { wch: 15 }, // Tiết kết thúc
        { wch: 16 }, // Ngày bắt đầu
        { wch: 16 }, // Ngày kết thúc
        { wch: 12 }, // Học kỳ
        { wch: 28 }, // Khoa
        { wch: 34 }  // Ghi chú
      ]
      XLSX.utils.book_append_sheet(wb, ws1, 'ThoiKhoaBieu_TBD')

      // Sheet 2: TraCuu_12TietHoc_TBD
      const periodHeaders = ['Tiết', 'Ca học', 'Giờ bắt đầu', 'Giờ kết thúc', 'Thời lượng', 'Ghi chú']
      const periodRows = [
        periodHeaders,
        ['Tiết 1', 'Ca Sáng', '07:00', '07:50', '50 phút', 'Tiết mở đầu ca sáng'],
        ['Tiết 2', 'Ca Sáng', '07:50', '08:40', '50 phút', ''],
        ['Tiết 3', 'Ca Sáng', '08:40', '09:30', '50 phút', 'Nghỉ giải lao 15 phút (09:30 - 09:45)'],
        ['Tiết 4', 'Ca Sáng', '09:45', '10:35', '50 phút', ''],
        ['Tiết 5', 'Ca Sáng', '10:35', '11:25', '50 phút', ''],
        ['Tiết 6', 'Ca Sáng', '11:25', '12:15', '50 phút', 'Tiết kết thúc ca sáng'],
        ['Tiết 7', 'Ca Chiều', '13:15', '14:05', '50 phút', 'Tiết mở đầu ca chiều'],
        ['Tiết 8', 'Ca Chiều', '14:05', '14:55', '50 phút', ''],
        ['Tiết 9', 'Ca Chiều', '14:55', '15:45', '50 phút', 'Nghỉ giải lao 15 phút (15:45 - 16:00)'],
        ['Tiết 10', 'Ca Chiều', '16:00', '16:50', '50 phút', ''],
        ['Tiết 11', 'Ca Chiều', '16:50', '17:40', '50 phút', ''],
        ['Tiết 12', 'Ca Chiều', '17:40', '18:30', '50 phút', 'Tiết kết thúc ca chiều']
      ]
      const ws2 = XLSX.utils.aoa_to_sheet(periodRows)
      ws2['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 40 }
      ]
      XLSX.utils.book_append_sheet(wb, ws2, 'TraCuu_12TietHoc_TBD')

      XLSX.writeFile(wb, 'Mau_ThoiKhoaBieu_TBD.xlsx')
      message.success('Đã tải xuống file mẫu Excel "Mau_ThoiKhoaBieu_TBD.xlsx" thành công!')
    } catch (err: any) {
      console.error(err)
      message.error('Không thể tải file mẫu Excel: ' + (err?.message || 'Lỗi không xác định'))
    }
  }

  // 2. Parse Excel/CSV File
  const handleFileProcess = async (file: File) => {
    setIsProcessingFile(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      
      const firstSheetName = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheetName]
      if (!ws) {
        throw new Error('Không tìm thấy nội dung bảng tính trong file!')
      }

      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
      if (!rawRows || rawRows.length === 0) {
        throw new Error('File rỗng hoặc không có dữ liệu hàng!')
      }

      const parsedList: ParsedCourseRow[] = []

      rawRows.forEach((row, index) => {
        const rowNumber = index + 2 // +2 vì có header row

        // Extract fields
        const rawRoom = String(getColValue(row, ['Phòng học', 'Phong hoc', 'Phòng', 'Phong', 'Room']) || '').trim()
        const subjectName = String(getColValue(row, ['Tên môn học', 'Ten mon hoc', 'Tên môn', 'Ten mon', 'Môn học', 'Mon hoc', 'Subject']) || '').trim()
        const classCode = String(getColValue(row, ['Mã lớp', 'Ma lop', 'Lớp', 'Lop', 'Class']) || '').trim()
        const lecturerName = String(getColValue(row, ['Giảng viên', 'Giang vien', 'GV', 'Lecturer']) || '').trim() || 'Bộ môn phân công'
        const rawDay = getColValue(row, ['Thứ', 'Thu', 'Day', 'Thứ trong tuần'])
        const rawStartPeriod = getColValue(row, ['Tiết bắt đầu', 'Tiet bat dau', 'Tiết BĐ', 'Tiet BD', 'Từ tiết', 'Start Period'])
        const rawEndPeriod = getColValue(row, ['Tiết kết thúc', 'Tiet ket thuc', 'Tiết KT', 'Tiet KT', 'Đến tiết', 'End Period'])
        const rawStartDate = getColValue(row, ['Ngày bắt đầu', 'Ngay bat dau', 'Ngày BĐ', 'Ngay BD', 'Start Date'])
        const rawEndDate = getColValue(row, ['Ngày kết thúc', 'Ngay ket thuc', 'Ngày KT', 'Ngay KT', 'End Date'])
        const semester = String(getColValue(row, ['Học kỳ', 'Hoc ky', 'HK', 'Semester']) || 'HK1').trim()
        const department = String(getColValue(row, ['Khoa', 'Đơn vị', 'Don vi', 'Department']) || 'Phòng Quản lý Đào tạo & CSVC').trim()
        const notes = String(getColValue(row, ['Ghi chú', 'Ghi chu', 'Notes', 'Lưu ý']) || '').trim()

        // Skip completely empty rows
        if (!rawRoom && !subjectName && !rawDay) {
          return
        }

        const errors: string[] = []

        // 1. Validate Room
        const matchedRoom = findRoom(rawRoom)
        if (!matchedRoom) {
          errors.push(`Phòng học "${rawRoom || 'Trống'}" không tồn tại trong hệ thống.`)
        }

        // 2. Validate Subject Name
        if (!subjectName) {
          errors.push('Tên môn học không được để trống.')
        }

        // 3. Validate Day of week
        const { day: dayOfWeek, label: dayOfWeekLabel } = parseDayOfWeek(rawDay)
        if (dayOfWeek === null) {
          errors.push(`Thứ "${rawDay}" không hợp lệ (hỗ trợ Thứ 2 đến Thứ 7, Chủ nhật).`)
        }

        // 4. Validate Periods
        const startPeriodNum = parseInt(String(rawStartPeriod).replace(/\D/g, ''), 10)
        const endPeriodNum = parseInt(String(rawEndPeriod).replace(/\D/g, ''), 10)

        if (isNaN(startPeriodNum) || startPeriodNum < 1 || startPeriodNum > 12) {
          errors.push(`Tiết bắt đầu (${rawStartPeriod}) không hợp lệ (phải từ 1 đến 12).`)
        }
        if (isNaN(endPeriodNum) || endPeriodNum < 1 || endPeriodNum > 12) {
          errors.push(`Tiết kết thúc (${rawEndPeriod}) không hợp lệ (phải từ 1 đến 12).`)
        }
        if (!isNaN(startPeriodNum) && !isNaN(endPeriodNum) && startPeriodNum > endPeriodNum) {
          errors.push(`Tiết bắt đầu (${startPeriodNum}) lớn hơn tiết kết thúc (${endPeriodNum}).`)
        }

        // Convert periods to standard TBD times
        let startTimeStr = '07:00'
        let endTimeStr = '09:30'
        if (!isNaN(startPeriodNum) && startPeriodNum >= 1 && startPeriodNum <= 12) {
          startTimeStr = TBD_STUDY_PERIODS[startPeriodNum - 1]?.startTime || '07:00'
        }
        if (!isNaN(endPeriodNum) && endPeriodNum >= 1 && endPeriodNum <= 12) {
          endTimeStr = TBD_STUDY_PERIODS[endPeriodNum - 1]?.endTime || '09:30'
        }

        // 5. Validate Dates
        const startDateStr = parseDateString(rawStartDate)
        const endDateStr = parseDateString(rawEndDate)

        if (!startDateStr) {
          errors.push(`Ngày bắt đầu "${rawStartDate}" không đúng định dạng ngày.`)
        }
        if (!endDateStr) {
          errors.push(`Ngày kết thúc "${rawEndDate}" không đúng định dạng ngày.`)
        }
        if (startDateStr && endDateStr && dayjs(startDateStr).isAfter(dayjs(endDateStr))) {
          errors.push(`Ngày bắt đầu (${startDateStr}) sau ngày kết thúc (${endDateStr}).`)
        }

        // 6. Calculate Sessions & Conflicts if valid so far
        let totalSessions = 0
        let sessions: CalculatedSession[] = []
        let hasConflict = false
        let conflictingBookings: Booking[] = []

        if (errors.length === 0 && matchedRoom && dayOfWeek !== null && startDateStr && endDateStr) {
          const calc = calculateScheduleSessions({
            startDate: startDateStr,
            endDate: endDateStr,
            selectedDays: [dayOfWeek],
            startTimeStr,
            endTimeStr,
            roomId: matchedRoom.id,
            allBookings
          })

          totalSessions = calc.totalSessions
          sessions = calc.sessions
          hasConflict = calc.conflictSessions > 0
          conflictingBookings = calc.allConflictingBookings

          if (totalSessions === 0) {
            errors.push(`Không có ngày nào rơi vào ${dayOfWeekLabel} trong khoảng ${startDateStr} đến ${endDateStr}.`)
          }
        }

        const isValid = errors.length === 0

        parsedList.push({
          rowNumber,
          rawRoom,
          matchedRoom,
          subjectName,
          classCode,
          lecturerName,
          dayOfWeek,
          dayOfWeekLabel,
          startPeriod: startPeriodNum,
          endPeriod: endPeriodNum,
          startTimeStr,
          endTimeStr,
          startDateStr: startDateStr || String(rawStartDate),
          endDateStr: endDateStr || String(rawEndDate),
          semester,
          department,
          notes,
          isValid,
          errors,
          totalSessions,
          sessions,
          hasConflict,
          conflictingBookings
        })
      })

      setParsedRows(parsedList)
      message.success(`Đã phân tích ${parsedList.length} dòng thời khóa biểu từ file thành công!`)
    } catch (err: any) {
      console.error(err)
      message.error(err?.message || 'Có lỗi khi phân tích file Excel/CSV.')
    } finally {
      setIsProcessingFile(false)
    }
  }

  // Quick Stats
  const stats = useMemo(() => {
    const total = parsedRows.length
    const valid = parsedRows.filter((r) => r.isValid).length
    const invalid = parsedRows.filter((r) => !r.isValid).length
    const totalSessions = parsedRows.filter((r) => r.isValid).reduce((sum, r) => sum + r.totalSessions, 0)
    
    // Total unique conflicting bookings
    const conflictBookingIds = new Set<number>()
    parsedRows.filter((r) => r.isValid && r.hasConflict).forEach((r) => {
      r.conflictingBookings.forEach((b) => conflictBookingIds.add(b.id))
    })

    return {
      total,
      valid,
      invalid,
      totalSessions,
      conflictCount: conflictBookingIds.size
    }
  }, [parsedRows])

  // Handle Save Valid Rows
  const handleSaveToSystem = async () => {
    if (!isAuthorized) {
      message.error('Bạn không có quyền nhập thời khóa biểu vào hệ thống!')
      return
    }

    const validCourses = parsedRows.filter((r) => r.isValid)
    if (validCourses.length === 0) {
      message.warning('Không có lớp học nào hợp lệ để nhập vào hệ thống!')
      return
    }

    setIsSubmitting(true)

    try {
      const localBookingsStr = localStorage.getItem('tbd_admin_bookings')
      let localBookingsList: Booking[] = localBookingsStr ? JSON.parse(localBookingsStr) : []

      // 1. If override enabled, reject/cancel all student conflicting bookings
      if (isSchoolOverride) {
        const uniqueConflicts = new Map<number, Booking>()
        validCourses.forEach((c) => {
          c.conflictingBookings.forEach((b) => uniqueConflicts.set(b.id, b))
        })

        for (const [id, conflict] of uniqueConflicts.entries()) {
          const cancelReason = `Điều chỉnh ưu tiên theo Thời khóa biểu chính khóa của Nhà trường thay cho đơn #${id}: ${conflict.purpose || 'Đơn đăng ký'}`
          try {
            await http.put(`/api/bookings/${id}/reject`, { reason: cancelReason })
          } catch {
            // fallback
          }

          const idx = localBookingsList.findIndex((b) => b.id === id)
          if (idx > -1) {
            localBookingsList[idx] = {
              ...localBookingsList[idx],
              status: 'Cancelled',
              rejectReason: cancelReason,
              rejectionReason: cancelReason,
              adminNotes: 'Điều chỉnh ưu tiên theo Thời khóa biểu chính khóa của Nhà trường'
            }
          }
        }
      }

      // 2. Generate and save academic sessions
      const createdBookings: Booking[] = []
      let baseId = Date.now()

      for (const course of validCourses) {
        const roomName = course.matchedRoom?.name || `Phòng ${course.matchedRoom?.id}`
        const periodDisplay = `Tiết ${course.startPeriod} - ${course.endPeriod} (${course.startTimeStr} - ${course.endTimeStr})`

        const sessionsToSave = isSchoolOverride
          ? course.sessions
          : course.sessions.filter((s) => !s.hasConflict)

        for (let i = 0; i < sessionsToSave.length; i++) {
          const session = sessionsToSave[i]
          const bookingId = baseId++

          const payload: CreateBookingPayload = {
            roomId: course.matchedRoom!.id,
            startTime: session.startTime,
            endTime: session.endTime,
            purpose: `[TKB ${course.semester}] ${course.subjectName} (${course.classCode || 'HP'}) - GV: ${course.lecturerName}`,
            status: 'Approved',
            participantCount: course.matchedRoom?.capacity || 45,
            department: course.department || 'Phòng Quản lý Đào tạo & CSVC',
            personInCharge: course.lecturerName || currentUserName,
            notes: `Thời khóa biểu chính khóa TBD | Môn: ${course.subjectName} | Lớp: ${course.classCode || 'N/A'} | ${periodDisplay} | ${session.dayOfWeekLabel} | Nhập từ File Excel`,
            isSchoolOverride: true,
            IsSchoolOverride: true,
            semester: course.semester,
            subjectCode: course.subjectCode,
            subjectName: course.subjectName,
            classCode: course.classCode,
            lecturerName: course.lecturerName,
            periodInfo: periodDisplay,
            approvedBy: currentUserName,
            approvedAt: new Date().toISOString(),
            adminNotes: 'Thời khóa biểu chính khóa do Phòng Quản lý Đào tạo sắp xếp.'
          }

          let apiSuccess = false
          try {
            const res = await http.post<Booking>('/api/bookings', payload)
            if (res.data && res.data.id) {
              createdBookings.push(res.data)
              apiSuccess = true
            }
          } catch {
            // fallback
          }

          if (!apiSuccess) {
            const localItem: Booking = {
              id: bookingId,
              roomId: course.matchedRoom!.id,
              roomName: roomName,
              startTime: session.startTime,
              endTime: session.endTime,
              purpose: payload.purpose,
              status: 'Approved',
              participantCount: payload.participantCount,
              department: payload.department,
              personInCharge: payload.personInCharge,
              notes: payload.notes,
              isSchoolOverride: true,
              IsSchoolOverride: true,
              semester: payload.semester,
              subjectCode: payload.subjectCode,
              subjectName: payload.subjectName,
              classCode: payload.classCode,
              lecturerName: payload.lecturerName,
              periodInfo: payload.periodInfo,
              approvedBy: currentUserName,
              approvedAt: new Date().toISOString(),
              adminNotes: payload.adminNotes,
              userEmail: currentUserEmail || 'quanly@tbd.edu.vn'
            }
            createdBookings.push(localItem)
          }
        }
      }

      // Merge and save to localStorage
      const mergedList = [...createdBookings, ...localBookingsList]
      localStorage.setItem('tbd_admin_bookings', JSON.stringify(mergedList))

      // Invalidate queries to refresh calendars and tables
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] })
      await queryClient.invalidateQueries({ queryKey: ['all-bookings-validation'] })

      message.success({
        content: `Đã lưu thành công Thời khóa biểu chính khóa cho ${validCourses.length} lớp học (Tổng cộng ${createdBookings.length} buổi học).`,
        duration: 5
      })

      if (onScheduleCreated) {
        onScheduleCreated(createdBookings.length)
      }

      onClose()
    } catch (err: any) {
      console.error(err)
      message.error(err?.message || 'Có lỗi xảy ra khi lưu thời khóa biểu vào hệ thống.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Preview Table Columns
  const columns = [
    {
      title: 'Dòng',
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      width: 65,
      render: (r: number) => <Text style={{ color: '#64748b' }}>#{r}</Text>
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 130,
      render: (_: any, row: ParsedCourseRow) => {
        if (row.isValid) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Hợp lệ
            </Tag>
          )
        }
        return (
          <Tooltip title={row.errors.join('; ')}>
            <Tag color="error" icon={<CloseCircleOutlined />} style={{ cursor: 'pointer' }}>
              Lỗi ({row.errors.length})
            </Tag>
          </Tooltip>
        )
      }
    },
    {
      title: 'Phòng học',
      key: 'room',
      width: 140,
      render: (_: any, row: ParsedCourseRow) => {
        if (row.matchedRoom) {
          return (
            <div>
              <Tag color="blue" style={{ fontWeight: 600 }}>
                {row.matchedRoom.name}
              </Tag>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {row.matchedRoom.building === 'A' ? 'Khu A' : 'Khu B'} ({row.matchedRoom.capacity} chỗ)
              </div>
            </div>
          )
        }
        return (
          <Tag color="red">
            {row.rawRoom || 'Không xác định'}
          </Tag>
        )
      }
    },
    {
      title: 'Môn học & Lớp',
      key: 'subject',
      render: (_: any, row: ParsedCourseRow) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{row.subjectName}</div>
          <Space size="small" style={{ marginTop: 2 }}>
            {row.classCode && <Tag color="cyan">Lớp: {row.classCode}</Tag>}
            {row.semester && <Tag color="purple">{row.semester}</Tag>}
          </Space>
        </div>
      )
    },
    {
      title: 'Giảng viên',
      dataIndex: 'lecturerName',
      key: 'lecturerName',
      width: 160,
      render: (name: string) => <Text style={{ fontSize: 13 }}>{name}</Text>
    },
    {
      title: 'Thứ & Tiết học (Giờ TBD)',
      key: 'schedule',
      width: 220,
      render: (_: any, row: ParsedCourseRow) => (
        <div>
          <Tag color="geekblue" style={{ fontWeight: 600 }}>
            {row.dayOfWeekLabel}
          </Tag>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#0284c7', marginTop: 2 }}>
            Tiết {row.startPeriod} - {row.endPeriod} ({row.startTimeStr} - {row.endTimeStr})
          </div>
        </div>
      )
    },
    {
      title: 'Khoảng ngày',
      key: 'dates',
      width: 180,
      render: (_: any, row: ParsedCourseRow) => (
        <div style={{ fontSize: 12 }}>
          <div>BĐ: {row.startDateStr ? dayjs(row.startDateStr).format('DD/MM/YYYY') : '---'}</div>
          <div>KT: {row.endDateStr ? dayjs(row.endDateStr).format('DD/MM/YYYY') : '---'}</div>
        </div>
      )
    },
    {
      title: 'Số buổi',
      key: 'sessions',
      width: 100,
      render: (_: any, row: ParsedCourseRow) => {
        if (!row.isValid) return <Text type="secondary">---</Text>
        return (
          <Tag color="processing" style={{ fontWeight: 600 }}>
            {row.totalSessions} buổi
          </Tag>
        )
      }
    },
    {
      title: 'Trùng lịch',
      key: 'conflict',
      width: 130,
      render: (_: any, row: ParsedCourseRow) => {
        if (!row.isValid) return <Text type="secondary">---</Text>
        if (!row.hasConflict) {
          return <Tag color="success">Không trùng lịch</Tag>
        }
        return (
          <Button
            size="small"
            danger
            type="link"
            icon={<ExclamationCircleOutlined />}
            onClick={() => setConflictDetailRow(row)}
            style={{ padding: 0, fontSize: 12 }}
          >
            Trùng {row.conflictingBookings.length} đơn
          </Button>
        )
      }
    }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* HEADER ACTIONS: DOWNLOAD TEMPLATE & INSTRUCTIONS */}
      <div
        style={{
          background: '#f8fafc',
          padding: '14px 18px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
            Nhập Danh Sách Thời Khóa Biểu Học Kỳ Từ File Excel / CSV
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Hỗ trợ chuẩn 12 tiết học TBD, đối chiếu mã phòng và kiểm tra lịch trùng với các đơn đăng ký.
          </div>
        </div>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownloadTemplate}
          style={{ background: '#16a34a', borderColor: '#16a34a' }}
        >
          Tải file mẫu Excel (.xlsx)
        </Button>
      </div>

      {/* UPLOAD DRAGGER AREA */}
      <Spin spinning={isProcessingFile} description="Đang đọc và phân tích dữ liệu file Excel / CSV...">
        <Dragger
          name="file"
          multiple={false}
          accept=".xlsx,.xls,.csv"
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([file])
            handleFileProcess(file)
            return false // Don't auto upload to server
          }}
          onRemove={() => {
            setFileList([])
            setParsedRows([])
          }}
          style={{ padding: '16px 0', background: '#fafafa', borderRadius: 8 }}
        >
          <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
            <InboxOutlined style={{ color: '#0284c7', fontSize: 36 }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
            Kéo thả file Excel (.xlsx, .xls) hoặc CSV vào đây hoặc bấm để chọn file
          </p>
          <p className="ant-upload-hint" style={{ fontSize: 12, color: '#64748b' }}>
            File mẫu gồm các cột: Phòng học, Tên môn học, Mã lớp, Giảng viên, Thứ, Tiết BĐ, Tiết KT, Ngày BĐ, Ngày KT, Học kỳ, Khoa, Ghi chú.
          </p>
        </Dragger>
      </Spin>

      {/* STATS OVERVIEW CARDS (WHEN FILE LOADED) */}
      {parsedRows.length > 0 && (
        <Row gutter={12}>
          <Col span={5}>
            <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#475569' }}>Tổng số lớp</span>}
                value={stats.total}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: '#0f172a' } }}
                prefix={<FileExcelOutlined style={{ color: '#0284c7' }} />}
              />
            </div>
          </Col>
          <Col span={5}>
            <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#166534' }}>Lớp hợp lệ</span>}
                value={stats.valid}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: '#16a34a' } }}
                prefix={<CheckCircleOutlined />}
              />
            </div>
          </Col>
          <Col span={5}>
            <div style={{ background: stats.invalid > 0 ? '#fef2f2' : '#f8fafc', padding: '10px 14px', borderRadius: 8, border: `1px solid ${stats.invalid > 0 ? '#fecaca' : '#e2e8f0'}` }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: stats.invalid > 0 ? '#991b1b' : '#64748b' }}>Lớp lỗi</span>}
                value={stats.invalid}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: stats.invalid > 0 ? '#dc2626' : '#94a3b8' } }}
                prefix={<CloseCircleOutlined />}
              />
            </div>
          </Col>
          <Col span={5}>
            <div style={{ background: '#eff6ff', padding: '10px 14px', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: '#1e40af' }}>Tổng buổi học sinh ra</span>}
                value={stats.totalSessions}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: '#2563eb' } }}
                prefix={<ScheduleOutlined />}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ background: stats.conflictCount > 0 ? '#fffbeb' : '#f8fafc', padding: '10px 14px', borderRadius: 8, border: `1px solid ${stats.conflictCount > 0 ? '#fde68a' : '#e2e8f0'}` }}>
              <Statistic
                title={<span style={{ fontSize: 12, color: stats.conflictCount > 0 ? '#92400e' : '#64748b' }}>Trùng đơn SV</span>}
                value={stats.conflictCount}
                styles={{ content: { fontSize: 20, fontWeight: 700, color: stats.conflictCount > 0 ? '#d97706' : '#94a3b8' } }}
                prefix={<ExclamationCircleOutlined />}
              />
            </div>
          </Col>
        </Row>
      )}

      {/* OVERRIDE SWITCH & WARNING */}
      {parsedRows.length > 0 && stats.valid > 0 && (
        <div
          style={{
            background: isSchoolOverride ? '#eff6ff' : '#f8fafc',
            border: `1px solid ${isSchoolOverride ? '#93c5fd' : '#cbd5e1'}`,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ThunderboltOutlined style={{ color: isSchoolOverride ? '#0284c7' : '#94a3b8', fontSize: 20, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13 }}>
                Ưu tiên Thời khóa biểu chính khóa khi trùng lịch
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Khi bật, lịch học chính khóa sẽ được ưu tiên bố trí phòng học theo kế hoạch giảng dạy của Nhà trường.
              </div>
            </div>
          </div>
          <Switch
            checked={isSchoolOverride}
            onChange={(checked) => setIsSchoolOverride(checked)}
            checkedChildren="BẬT"
            unCheckedChildren="TẮT"
          />
        </div>
      )}

      {/* PREVIEW TABLE */}
      {parsedRows.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
              Danh sách chi tiết các lớp đọc được ({parsedRows.length} dòng):
            </Text>
            {stats.invalid > 0 && (
              <Text type="danger" style={{ fontSize: 12 }}>
                ⚠️ Lưu ý: Các dòng dữ liệu không hợp lệ sẽ không được lưu vào hệ thống.
              </Text>
            )}
          </div>

          <Table
            dataSource={parsedRows}
            columns={columns}
            rowKey="rowNumber"
            size="small"
            pagination={{ pageSize: 5, showSizeChanger: true }}
            bordered
            scroll={{ x: 1000 }}
          />
        </div>
      )}

      {/* FOOTER ACTIONS */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 8,
          borderTop: '1px solid #e2e8f0'
        }}
      >
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={parsedRows.length === 0}
          onClick={() => {
            setParsedRows([])
            setFileList([])
          }}
        >
          Xóa danh sách
        </Button>

        <Space>
          <Button onClick={onClose} disabled={isSubmitting}>
            Đóng
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            loading={isSubmitting}
            disabled={!isAuthorized || stats.valid === 0}
            onClick={handleSaveToSystem}
            style={{ background: '#0284c7', borderColor: '#0284c7' }}
          >
            Xác nhận nhập vào hệ thống ({stats.valid} lớp - {stats.totalSessions} buổi học)
          </Button>
        </Space>
      </div>

      {/* CONFLICT DETAIL MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#d97706' }}>
            <ExclamationCircleOutlined />
            <span>Chi tiết các đơn đặt phòng bị trùng lịch ({conflictDetailRow?.subjectName})</span>
          </div>
        }
        open={!!conflictDetailRow}
        onCancel={() => setConflictDetailRow(null)}
        footer={[
          <Button key="close" onClick={() => setConflictDetailRow(null)}>
            Đóng
          </Button>
        ]}
        width={680}
      >
        {conflictDetailRow && (
          <div>
            <Alert
              type="warning"
              showIcon
              message={`Lớp ${conflictDetailRow.subjectName} tại ${conflictDetailRow.matchedRoom?.name} trùng ${conflictDetailRow.conflictingBookings.length} đơn của sinh viên:`}
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={conflictDetailRow.conflictingBookings}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: 'Mã đơn',
                  dataIndex: 'id',
                  key: 'id',
                  render: (id: number) => <Tag color="blue">#{id}</Tag>
                },
                {
                  title: 'Người đặt',
                  dataIndex: 'personInCharge',
                  key: 'personInCharge',
                  render: (name: string, row: Booking) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{name || row.userEmail}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{row.userEmail}</div>
                    </div>
                  )
                },
                {
                  title: 'Thời gian',
                  key: 'time',
                  render: (_: any, row: Booking) => (
                    <div>
                      <div>{dayjs(row.startTime).format('DD/MM/YYYY')}</div>
                      <div style={{ fontSize: 11, color: '#0284c7' }}>
                        {dayjs(row.startTime).format('HH:mm')} - {dayjs(row.endTime).format('HH:mm')}
                      </div>
                    </div>
                  )
                },
                {
                  title: 'Mục đích',
                  dataIndex: 'purpose',
                  key: 'purpose',
                  ellipsis: true
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
