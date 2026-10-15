const fs = require('fs');

let file = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');

// Add import
if (!file.includes('getOfficialRooms')) {
  file = file.replace("import type { Room } from '../../types/room'", "import type { Room } from '../../types/room'\nimport { getOfficialRooms, hasInvalidRooms } from '../../utils/roomUtils'");
}

file = file.replace(/const rooms = roomsQuery\.data \?\? \[\]/g, "const rooms = getOfficialRooms(roomsQuery.data ?? [])\n  const apiRooms = roomsQuery.data ?? []\n  const hasWarning = hasInvalidRooms(apiRooms)");

if (!file.includes('hasWarning &&')) {
    file = file.replace("{/* Filter Section */}", `{hasWarning && (
          <Alert
            message="Cảnh báo: Database đang trả về các phòng không hợp lệ (như Khu C). Đã được lọc."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}\n        {/* Filter Section */}`);
}

// remove select Khu C
file = file.replace(/\{ value: 'Khu C', label: 'Khu C' \},/g, '');

fs.writeFileSync('src/features/calendar/CalendarPage.tsx', file);
