const fs = require('fs');
let file = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');

file = file.replace(/roomsQuery\.data\.map/g, "getOfficialRooms(roomsQuery.data).map");
file = file.replace(/roomsQuery\.data\.filter/g, "getOfficialRooms(roomsQuery.data).filter");

// We need to make sure we don't apply it if it's already getOfficialRooms(getOfficialRooms(...))
// Let's just do it cleanly:
file = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');
file = file.replace(/roomsQuery\.data/g, "apiRooms");
file = file.replace("const apiRooms = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })", "const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })");

file = file.replace("const apiRooms = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })", "const roomsQuery = useQuery({ queryKey: ['rooms'], queryFn: fetchRooms })"); // Wait, replacing roomsQuery.data with apiRooms is dangerous if I don't set apiRooms = roomsQuery.data

