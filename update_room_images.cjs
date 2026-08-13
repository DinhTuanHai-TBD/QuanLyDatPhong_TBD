const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

const getImageUrlFn = `
const getRoomImageUrl = (room: any) => {
  if (room.imageUrl) return room.imageUrl;
  
  const type = room._displayType || '';
  if (type.includes('Phòng học nhóm')) {
    return 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop';
  }
  if (type.includes('Hội trường') || type.includes('Giảng đường')) {
    return 'https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=2070&auto=format&fit=crop';
  }
  if (type.includes('Lab') || type.includes('máy')) {
    return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=2070&auto=format&fit=crop';
  }
  if (type.includes('Phòng học')) {
    return 'https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070&auto=format&fit=crop';
  }
  if (type.includes('Cinema')) {
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop';
  }
  return 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop';
};
`;

// Insert the function before the RoomsPage component
file = file.replace("function RoomsPage() {", getImageUrlFn + "\nfunction RoomsPage() {");

// Replace room.imageUrl with getRoomImageUrl(room)
file = file.replace(/room\.imageUrl \?/g, "getRoomImageUrl(room) ?");
file = file.replace(/src=\{room\.imageUrl\}/g, "src={getRoomImageUrl(room)}");

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
