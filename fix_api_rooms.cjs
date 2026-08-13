const fs = require('fs');

let file = fs.readFileSync('src/features/calendar/CalendarPage.tsx', 'utf8');
file = file.replace(/const apiRooms = roomsQuery\.data \?\? \[\]\n/, "");
fs.writeFileSync('src/features/calendar/CalendarPage.tsx', file);
