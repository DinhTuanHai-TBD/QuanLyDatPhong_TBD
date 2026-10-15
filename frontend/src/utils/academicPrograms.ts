/**
 * Danh mục Khoa và Ngành đào tạo chuẩn - Trường Đại học Thái Bình Dương (TBD)
 * Chuẩn hóa: 9 Khoa, 23 Ngành học chính khóa
 */

export interface MajorItem {
  id: string
  label: string // Nhãn hiển thị (giữ nguyên dấu * nếu có)
  value: string // Giá trị lưu trữ (đã loại bỏ dấu *)
}

export interface FacultyItem {
  id: string
  name: string
  majors: MajorItem[]
}

export const ACADEMIC_FACULTIES: FacultyItem[] = [
  {
    id: 'f_tktt',
    name: 'Khoa Thiết kế và Truyền thông',
    majors: [
      { id: 'm_tkdh', label: 'Thiết kế đồ họa', value: 'Thiết kế đồ họa' },
      { id: 'm_ttdpt', label: 'Truyền thông đa phương tiện', value: 'Truyền thông đa phương tiện' }
    ]
  },
  {
    id: 'f_dl',
    name: 'Khoa Du lịch',
    majors: [
      { id: 'm_dl', label: 'Du lịch', value: 'Du lịch' },
      { id: 'm_qtks', label: 'Quản trị khách sạn', value: 'Quản trị khách sạn' }
    ]
  },
  {
    id: 'f_luat',
    name: 'Khoa Luật',
    majors: [
      { id: 'm_luat', label: 'Luật', value: 'Luật' },
      { id: 'm_lkt', label: 'Luật kinh tế', value: 'Luật kinh tế' },
      { id: 'm_qlnn', label: 'Quản lý nhà nước', value: 'Quản lý nhà nước' }
    ]
  },
  {
    id: 'f_cntt_bd',
    name: 'Khoa Công nghệ thông tin và Bán dẫn',
    majors: [
      { id: 'm_cntt', label: 'Công nghệ thông tin', value: 'Công nghệ thông tin' },
      { id: 'm_cnbd', label: 'Công nghệ bán dẫn*', value: 'Công nghệ bán dẫn' },
      { id: 'm_ttnt', label: 'Trí tuệ nhân tạo', value: 'Trí tuệ nhân tạo' },
      { id: 'm_ktpm', label: 'Kỹ thuật phần mềm', value: 'Kỹ thuật phần mềm' },
      { id: 'm_ktcdt', label: 'Kỹ thuật cơ điện tử', value: 'Kỹ thuật cơ điện tử' }
    ]
  },
  {
    id: 'f_nnvh',
    name: 'Khoa Ngôn ngữ và Văn hóa',
    majors: [
      { id: 'm_nna', label: 'Ngôn ngữ Anh', value: 'Ngôn ngữ Anh' },
      { id: 'm_tthq', label: 'Tiếng Hàn Quốc (Đông phương học)*', value: 'Tiếng Hàn Quốc (Đông phương học)' },
      { id: 'm_tttq', label: 'Tiếng Trung Quốc (Đông phương học)*', value: 'Tiếng Trung Quốc (Đông phương học)' }
    ]
  },
  {
    id: 'f_kdql',
    name: 'Khoa Kinh doanh và Quản lý',
    majors: [
      { id: 'm_kt', label: 'Kế toán', value: 'Kế toán' },
      { id: 'm_mkt', label: 'Marketing', value: 'Marketing' },
      { id: 'm_qtkd', label: 'Quản trị kinh doanh', value: 'Quản trị kinh doanh' },
      { id: 'm_tcnh', label: 'Tài chính - Ngân hàng', value: 'Tài chính - Ngân hàng' },
      { id: 'm_logistics', label: 'Logistics và Quản lý chuỗi cung ứng', value: 'Logistics và Quản lý chuỗi cung ứng' }
    ]
  },
  {
    id: 'f_nv',
    name: 'Khoa Nhân văn',
    majors: [
      { id: 'm_qlvh', label: 'Quản lý văn hóa', value: 'Quản lý văn hóa' }
    ]
  },
  {
    id: 'f_khxhnv',
    name: 'Khoa Khoa học xã hội và Hành vi',
    majors: [
      { id: 'm_tlh', label: 'Tâm lý học', value: 'Tâm lý học' }
    ]
  },
  {
    id: 'f_khsk',
    name: 'Khoa Khoa học sức khỏe',
    majors: [
      { id: 'm_khys', label: 'Khoa học Y sinh', value: 'Khoa học Y sinh' }
    ]
  }
]

/**
 * Đơn vị hành chính chuyên trách - Không phải là khoa và không gắn ngành
 */
export const NON_FACULTY_UNITS = [
  'Phòng Quản lý Đào tạo & CSVC'
]

/**
 * Tên Khoa cũ & Tên Khoa mới chuẩn hóa
 */
export const OLD_FACULTY_TECH_ENGINEERING = 'Khoa Công nghệ & Kỹ thuật'
export const NEW_FACULTY_IT_SEMICONDUCTOR = 'Khoa Công nghệ thông tin và Bán dẫn'

/**
 * Chuẩn hóa tên Khoa / Đơn vị dùng chung trên toàn hệ thống:
 * - Chỉ đổi giá trị khớp tên cũ "Khoa Công nghệ & Kỹ thuật" (sau khi trim) sang "Khoa Công nghệ thông tin và Bán dẫn"
 * - Giữ nguyên các khoa / đơn vị khác
 * - Xử lý an toàn các giá trị null / undefined / rỗng
 */
export function normalizeDepartmentName(dept?: string | null): string {
  if (dept === null || dept === undefined) return ''
  const trimmed = String(dept).trim()
  if (trimmed === OLD_FACULTY_TECH_ENGINEERING) {
    return NEW_FACULTY_IT_SEMICONDUCTOR
  }
  return trimmed
}

export const normalizeFacultyName = normalizeDepartmentName

/**
 * Danh sách toàn bộ Đơn vị & Khoa dùng cho ô chọn (Select options)
 */
export const ALL_DEPARTMENT_OPTIONS = [
  ...ACADEMIC_FACULTIES.map(f => ({
    label: f.name,
    value: f.name,
    isFaculty: true
  })),
  ...NON_FACULTY_UNITS.map(u => ({
    label: u,
    value: u,
    isFaculty: false
  }))
]

/**
 * Tìm thông tin Khoa theo tên (hỗ trợ so khớp linh hoạt và ánh xạ tên cũ)
 */
export function findFaculty(facultyName?: string): FacultyItem | undefined {
  if (!facultyName) return undefined
  const normalized = normalizeDepartmentName(facultyName)
  const cleaned = normalized.trim().toLowerCase()
  return ACADEMIC_FACULTIES.find(f => {
    const fName = f.name.toLowerCase()
    return fName === cleaned || fName.replace(/^khoa\s+/, '') === cleaned.replace(/^khoa\s+/, '')
  })
}

/**
 * Kiểm tra xem một đơn vị có phải là Khoa học thuật hay không
 */
export function isAcademicFaculty(unitName?: string): boolean {
  if (!unitName) return false
  return !!findFaculty(unitName)
}

/**
 * Lấy danh sách ngành của một khoa
 */
export function getMajorsByFaculty(facultyName?: string): MajorItem[] {
  const faculty = findFaculty(facultyName)
  return faculty ? faculty.majors : []
}

/**
 * Chuẩn hóa tên ngành: loại bỏ dấu * ở cuối nếu có
 */
export function cleanMajorValue(major?: string): string {
  if (!major) return ''
  return major.replace(/\*+$/, '').trim()
}

/**
 * Kiểm tra tính hợp lệ của cặp Khoa - Ngành học
 */
export function validateFacultyMajorPair(
  facultyName?: string,
  majorName?: string
): { isValid: boolean; normalizedFaculty?: string; cleanMajor?: string; error?: string } {
  const trimmedFaculty = normalizeDepartmentName(facultyName)
  const trimmedMajor = (majorName || '').trim()

  // Trường hợp không nhập ngành -> Hợp lệ (tương thích lịch cũ)
  if (!trimmedMajor) {
    return { isValid: true, normalizedFaculty: trimmedFaculty, cleanMajor: '' }
  }

  // Nếu là đơn vị phi học thuật (như Phòng Quản lý Đào tạo & CSVC)
  const isNonFaculty = NON_FACULTY_UNITS.some(u => u.toLowerCase() === trimmedFaculty.toLowerCase())
  if (isNonFaculty) {
    return {
      isValid: false,
      error: `Đơn vị "${trimmedFaculty}" không có ngành học. Vui lòng để trống cột Ngành học.`
    }
  }

  const faculty = findFaculty(trimmedFaculty)
  if (!faculty) {
    return {
      isValid: false,
      error: `Khoa "${trimmedFaculty}" không thuộc danh mục 9 Khoa đào tạo của Nhà trường.`
    }
  }

  // Kiểm tra ngành có thuộc khoa đó hay không
  const cleanInputMajor = cleanMajorValue(trimmedMajor).toLowerCase()
  const matchedMajor = faculty.majors.find(m => {
    const cleanItemVal = cleanMajorValue(m.value).toLowerCase()
    const cleanItemLabel = cleanMajorValue(m.label).toLowerCase()
    return cleanItemVal === cleanInputMajor || cleanItemLabel === cleanInputMajor
  })

  if (!matchedMajor) {
    const availableNames = faculty.majors.map(m => m.label).join(', ')
    return {
      isValid: false,
      error: `Ngành "${trimmedMajor}" không thuộc "${faculty.name}". Các ngành trực thuộc gồm: ${availableNames}.`
    }
  }

  return {
    isValid: true,
    normalizedFaculty: faculty.name,
    cleanMajor: matchedMajor.value
  }
}

/**
 * Định dạng ghi chú (notes) lưu vào backend:
 * Quy tắc:
 * Ngành học: <tên ngành>
 * <ghi chú người dùng>
 * Nếu không chọn ngành, giữ nguyên ghi chú người dùng.
 */
export function buildNotesWithMajor(userNotes?: string, major?: string): string {
  const cleanMajor = cleanMajorValue(major)
  const trimmedNotes = (userNotes || '').trim()

  if (cleanMajor) {
    if (trimmedNotes) {
      return `Ngành học: ${cleanMajor}\n${trimmedNotes}`
    }
    return `Ngành học: ${cleanMajor}`
  }

  return trimmedNotes
}

/**
 * Trích xuất ngành học và ghi chú gốc từ chuỗi notes
 */
export function extractMajorFromNotes(notes?: string | null): { major?: string; remainingNotes: string } {
  if (!notes) return { remainingNotes: '' }

  const match = notes.match(/^Ngành học:\s*([^\n\r]+)(?:\r?\n([\s\S]*))?$/)
  if (match) {
    return {
      major: match[1]?.trim(),
      remainingNotes: match[2]?.trim() || ''
    }
  }

  return { remainingNotes: notes }
}
