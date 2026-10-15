const fs = require('fs');
let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/import \{ getOfficialRooms, hasInvalidRooms \} from '\.\.\/\.\.\/utils\/roomUtils'/, "import { getOfficialRooms } from '../../utils/roomUtils'");

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
