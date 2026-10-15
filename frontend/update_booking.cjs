const fs = require('fs');

let file = fs.readFileSync('src/features/bookings/BookingPage.tsx', 'utf8');

// Add import
if (!file.includes('getOfficialRooms')) {
  file = file.replace("import type { Room } from '../../types/room'", "import type { Room } from '../../types/room'\nimport { getOfficialRooms } from '../../utils/roomUtils'");
}

file = file.replace(/const rooms = roomsQuery\.data \?\? \[\]/g, "const rooms = getOfficialRooms(roomsQuery.data ?? [])");

fs.writeFileSync('src/features/bookings/BookingPage.tsx', file);
