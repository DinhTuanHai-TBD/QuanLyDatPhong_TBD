const fs = require('fs');

// Fix CalendarPage
let cal = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');
cal = cal.replace(/import \{ getOfficialRooms, hasInvalidRooms \} from '\.\.\/\.\.\/utils\/roomUtils'/, "import { getOfficialRooms } from '../../utils/roomUtils'");
cal = cal.replace(/const hasWarning = hasInvalidRooms\(apiRooms\)/g, "");
fs.writeFileSync('src/features/calendar/CalendarPage.tsx', cal);

// While at it, does RoomsPage or any other file have unused vars?
// "src/features/rooms/RoomsPage.tsx(46,26): error TS6133: 'setBuildingFilter' is declared but its value is never read."
// Let's check RoomsPage.tsx
let rooms = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');
if (!rooms.includes('setBuildingFilter(')) {
  console.log("RoomsPage missing setBuildingFilter usage");
}
