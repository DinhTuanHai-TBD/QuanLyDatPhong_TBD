import re

with open('src/features/admin/AdminPage.tsx', 'r') as f:
    content = f.read()

# Put back EquipmentItem
equipment_item = """export interface EquipmentItem {
  id: number
  code: string 
  name: string 
  type: string 
  roomId: number | null 
  roomName?: string
  quantity: number
  status: 'Active' | 'InUse' | 'Broken' | 'Maintenance' | 'Disposed'
  purchaseDate?: string
  warrantyExpiry?: string
  lastMaintenanceDate?: string
  issueNotes?: string
}

export default function AdminPage() {"""

content = content.replace("export default function AdminPage() {", equipment_item)

# Fix RoomStatus, RoomType not used
content = content.replace("import type { Room, RoomStatus, RoomType }", "import type { Room }")

# Fix toLowerCase
content = content.replace("status.toLowerCase()", "String(status).toLowerCase()")

# Fix b implicitly any
content = content.replace("(b => b.id", "((b: Booking) => b.id")

# Fix text assignment
content = content.replace("let text = record.status;", "let text: string = String(record.status);")

with open('src/features/admin/AdminPage.tsx', 'w') as f:
    f.write(content)
