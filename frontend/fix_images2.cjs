const fs = require('fs');
let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

const replaceFn = `
const getRoomImageUrl = (room: any) => {
  if (!room.imageUrl) return '';
  return room.imageUrl;
};
`;

// we need to find the old getRoomImageUrl and replace it
file = file.replace(/const getRoomImageUrl = \(room: any\) => \{[\s\S]*?return baseUrl \+ room\.imageUrl;\n\};\n/, replaceFn);

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
