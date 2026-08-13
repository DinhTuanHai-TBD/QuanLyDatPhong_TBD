const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/const roomTypeLabels: Record<string, string> = \{[\s\S]*?Lab: 'Phòng lab'[\s\S]*?\}/, "");

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
