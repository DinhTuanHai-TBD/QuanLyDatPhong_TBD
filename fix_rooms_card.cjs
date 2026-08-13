const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/\{roomTypeLabels\[String\(room\.roomType\)\] \?\? String\(room\.roomType\)\}/g, "{(room as any)._displayType} {(room as any)._displayNote && <span style={{ marginLeft: 4, color: '#64748b', fontWeight: 'normal', fontSize: 12 }}>({(room as any)._displayNote})</span>}");

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
