const fs = require('fs');

let file = fs.readFileSync('src/features/admin/AdminPage.tsx', 'utf8');

if (!file.includes('getOfficialRooms')) {
  file = file.replace("import type { Room, RoomStatus, RoomType } from '../../types/room'", "import type { Room, RoomStatus, RoomType } from '../../types/room'\nimport { getOfficialRooms } from '../../utils/roomUtils'");
}

file = file.replace("const rooms = roomsQuery.data || []", "const rooms = getOfficialRooms(roomsQuery.data || [])");
file = file.replace(/\{ value: 'Khu C', label: 'Khu C' \}/g, '');

fs.writeFileSync('src/features/admin/AdminPage.tsx', file);
