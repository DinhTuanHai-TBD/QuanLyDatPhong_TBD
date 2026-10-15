export type RoomType = 'Classroom' | 'MeetingRoom' | 'LectureHall' | 'ComputerLab' | 'Lab' | number
export type RoomStatus = 'Active' | 'Maintenance' | 'Closed' | number

export interface Room {
  id: number
  name: string
  building?: string | null
  floor?: string | null
  capacity: number
  roomType: RoomType
  status: RoomStatus
  imageUrl?: string | null
  mapImageUrl?: string | null
  description?: string | null
  isActive: boolean
  openTime?: string | null
  closeTime?: string | null
}
