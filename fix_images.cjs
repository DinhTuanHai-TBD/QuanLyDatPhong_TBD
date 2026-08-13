const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

// The original was: room.imageUrl
// Let's replace getRoomImageUrl(room) with a function that prefixes the URL
const replaceFn = `
const getRoomImageUrl = (room: any) => {
  if (!room.imageUrl) return '';
  if (room.imageUrl.startsWith('http')) return room.imageUrl;
  const baseUrl = import.meta.env.VITE_API_URL ?? 'https://tartness-empathy-gambling.ngrok-free.dev';
  return baseUrl + room.imageUrl;
};
`;

file = file.replace(/const getRoomImageUrl = \(room: any\) => \{[\s\S]*?return 'https:\/\/images.unsplash.com\/photo-1497366216548-37526070297c\?q=80&w=2069&auto=format&fit=crop';\n\};\n/, replaceFn);

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
