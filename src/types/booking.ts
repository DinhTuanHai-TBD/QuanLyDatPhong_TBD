export type BookingStatus = 'Pending' | 'PendingSpecial' | 'Approved' | 'Using' | 'Completed' | 'Rejected' | 'Cancelled' | 'Expired' | number

export interface Booking {
  actualStartTime?: string | null
  actualEndTime?: string | null
  checkoutNotes?: string | null
  id: number
  roomId: number
  roomName: string
  startTime: string
  endTime: string
  purpose?: string | null
  status: BookingStatus
  rejectReason?: string | null
  rejectionReason?: string | null
  
  // Richer booking details for academic usage
  participantCount?: number
  requestedEquipments?: string[]
  department?: string
  personInCharge?: string
  notes?: string
  isSpecialRequest?: boolean
  specialRequestReason?: string
  agreedToRules?: boolean
  userEmail?: string // Who requested
  
  // Approval metadata
  approvedBy?: string | null
  approvedAt?: string | null
  adminNotes?: string | null

  // School timetable and override metadata
  isSchoolOverride?: boolean
  IsSchoolOverride?: boolean
  semester?: string
  academicYear?: string
  subjectCode?: string
  subjectName?: string
  classCode?: string
  lecturerName?: string
  periodInfo?: string
}

export interface CreateBookingPayload {
  roomId: number
  startTime: string
  endTime: string
  purpose?: string
  participantCount?: number
  requestedEquipments?: string[]
  department?: string
  personInCharge?: string
  notes?: string
  isSpecialRequest?: boolean
  specialRequestReason?: string
  agreedToRules?: boolean
  status?: BookingStatus
  approvedBy?: string | null
  approvedAt?: string | null
  adminNotes?: string | null
  isSchoolOverride?: boolean
  IsSchoolOverride?: boolean
  semester?: string
  academicYear?: string
  subjectCode?: string
  subjectName?: string
  classCode?: string
  lecturerName?: string
  periodInfo?: string
}
