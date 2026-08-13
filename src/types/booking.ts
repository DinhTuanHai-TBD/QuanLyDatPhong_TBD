export type BookingStatus = 'Pending' | 'PendingSpecial' | 'Approved' | 'Using' | 'Completed' | 'Rejected' | 'Cancelled' | number

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
}
