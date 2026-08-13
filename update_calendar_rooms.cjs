const fs = require('fs');

let file = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');

// replace roomsQuery.data.map with getOfficialRooms(roomsQuery.data).map inside buildings and roomTypes
file = file.replace(/roomsQuery\.data\.map\(\(r: Room\) => r\.building\)/, "getOfficialRooms(roomsQuery.data).map((r: Room) => r.building)");
file = file.replace(/roomsQuery\.data\.map\(\(r: Room\) => r\.roomType\)/, "getOfficialRooms(roomsQuery.data).map((r: Room) => (r as any)._displayType || r.roomType)");
file = file.replace(/roomsQuery\.data\.filter\(\(r: Room\) => \{/g, "getOfficialRooms(roomsQuery.data).filter((r: any) => {");
file = file.replace(/if \(filterRoomType !== 'all' && \(r\.roomType\) !== filterRoomType\) return false/, "if (filterRoomType !== 'all' && r._displayType !== filterRoomType) return false");
file = file.replace(/const rooms = getOfficialRooms\(roomsQuery\.data \?\? \[\]\)\n  const apiRooms = roomsQuery\.data \?\? \[\]\n  const hasWarning = hasInvalidRooms\(apiRooms\)/g, "");
file = file.replace("const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })", "const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })\n  const apiRooms = roomsQuery.data ?? []\n  const hasWarning = hasInvalidRooms(apiRooms)");

fs.writeFileSync('src/features/calendar/CalendarPage.tsx', file);
