import type { Room } from '../types/room';

export const OFFICIAL_ROOMS: Record<
  string, 
  { building: string; type: string; capacity: number; displayName?: string; note?: string }
> = {
  A201: { building: 'Khu A', type: 'Phòng học', capacity: 100 },
  A202: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A203: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A204: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A205: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A206: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A302: { building: 'Khu A', type: 'Phòng Cinema', capacity: 40 },
  A304: { building: 'Khu A', type: 'Phòng Lab', capacity: 20, note: '20 máy tính' },
  A305: { building: 'Khu A', type: 'Phòng học nhóm', capacity: 10 },
  A401: { 
    building: 'Khu A', 
    type: 'Hội trường 300 chỗ', 
    capacity: 300, 
    displayName: 'A401 (Hội trường 300 chỗ)', 
    note: 'Hội trường lớn 300 chỗ ngồi' 
  },
  A402: { building: 'Khu A', type: 'Phòng Lab', capacity: 20, note: '20 máy tính' },
  A403: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  
  B001: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B002: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B101: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B102: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B103: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B104: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B105: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B106: { building: 'Khu B', type: 'Phòng học', capacity: 40 },
  B107: { building: 'Khu B', type: 'Phòng học', capacity: 40 }
};

export type ValidatedRoom = Room & { 
  _displayType: string; 
  _displayNote?: string;
  _displayName?: string;
};

export function isFakeOrDisallowedRoom(room: Partial<Room>): boolean {
  if (!room) return true;
  const name = String(room.name || '').toLowerCase();
  const building = String(room.building || '').toLowerCase();
  const capacity = Number(room.capacity || 0);

  // Loại bỏ hoàn toàn phòng ảo "Hội trường TBD", "Tòa Trung tâm", hoặc 180 chỗ
  if (
    name.includes('hội trường tbd') ||
    name.includes('hoi truong tbd') ||
    name.includes('tòa trung tâm') ||
    name.includes('toa trung tam') ||
    building.includes('tòa trung tâm') ||
    building.includes('toa trung tam') ||
    building.includes('trung tâm') ||
    capacity === 180 ||
    (name.includes('hội trường') && capacity === 180)
  ) {
    return true;
  }
  return false;
}

export function cleanupLocalStorageRooms(): void {
  try {
    const localStr = localStorage.getItem('tbd_admin_rooms');
    if (localStr) {
      const rooms = JSON.parse(localStr);
      if (Array.isArray(rooms)) {
        const filtered = rooms.filter((r: any) => !isFakeOrDisallowedRoom(r));
        if (filtered.length !== rooms.length) {
          localStorage.setItem('tbd_admin_rooms', JSON.stringify(filtered));
        }
      }
    }
  } catch (err) {
    console.error('Error in cleanupLocalStorageRooms:', err);
  }
}

// Chạy dọn dẹp ngay khi nạp module
if (typeof window !== 'undefined') {
  cleanupLocalStorageRooms();
}

export function extractOfficialCode(roomName?: string): string | null {
  if (!roomName) return null;
  const clean = roomName.trim().replace(/^phòng\s+/i, '').trim();
  const match = clean.match(/^([AB]\d{3})/i);
  if (match) {
    const code = match[1].toUpperCase();
    if (OFFICIAL_ROOMS[code]) {
      return code;
    }
  }
  return null;
}

export function getOfficialRooms(apiRooms?: Room[]): ValidatedRoom[] {
  cleanupLocalStorageRooms();

  const officialEntries = Object.entries(OFFICIAL_ROOMS);

  if (!apiRooms || apiRooms.length === 0) {
    return officialEntries.map(([code, info], index) => ({
      id: index + 1,
      name: info.displayName || code,
      building: info.building,
      capacity: info.capacity,
      roomType: (info.type.includes('Hội trường') ? 'LectureHall' : info.type.includes('Lab') ? 'Lab' : 'Classroom') as any,
      status: 'Active',
      isActive: true,
      description: info.note || '',
      imageUrl: '',
      _displayType: info.type,
      _displayNote: info.note,
      _displayName: info.displayName || code
    }));
  }

  // Lọc bỏ bất kỳ phòng ảo nào từ apiRooms
  const validApiRooms = apiRooms.filter(r => !isFakeOrDisallowedRoom(r));
  const matchedCodes = new Set<string>();
  const result: ValidatedRoom[] = [];

  for (const r of validApiRooms) {
    const code = extractOfficialCode(r.name);
    if (code && OFFICIAL_ROOMS[code]) {
      matchedCodes.add(code);
      const info = OFFICIAL_ROOMS[code];
      const roomType = (info.type.includes('Hội trường') ? 'LectureHall' : info.type.includes('Lab') ? 'Lab' : 'Classroom') as any;
      result.push({
        ...r,
        name: info.displayName || r.name,
        building: info.building,
        capacity: info.capacity,
        roomType: r.roomType || roomType,
        _displayType: info.type,
        _displayNote: info.note || r.description || '',
        _displayName: info.displayName || r.name
      });
    }
  }

  // Bổ sung các phòng chính thức chưa có trong API để luôn đủ 21 phòng chuẩn
  officialEntries.forEach(([code, info], index) => {
    if (!matchedCodes.has(code)) {
      result.push({
        id: 1000 + index,
        name: info.displayName || code,
        building: info.building,
        capacity: info.capacity,
        roomType: (info.type.includes('Hội trường') ? 'LectureHall' : info.type.includes('Lab') ? 'Lab' : 'Classroom') as any,
        status: 'Active',
        isActive: true,
        description: info.note || '',
        imageUrl: '',
        _displayType: info.type,
        _displayNote: info.note,
        _displayName: info.displayName || code
      });
    }
  });

  // Sắp xếp thứ tự: Khu A trước (A201 -> A403), Khu B sau (B001 -> B107)
  return result.sort((a, b) => {
    const codeA = extractOfficialCode(a.name) || a.name;
    const codeB = extractOfficialCode(b.name) || b.name;
    const isAKhuA = codeA.startsWith('A');
    const isBKhuA = codeB.startsWith('A');
    if (isAKhuA && !isBKhuA) return -1;
    if (!isAKhuA && isBKhuA) return 1;
    return codeA.localeCompare(codeB, undefined, { numeric: true });
  });
}

export function hasInvalidRooms(apiRooms: Room[]): boolean {
  return apiRooms.some(r => isFakeOrDisallowedRoom(r) || !extractOfficialCode(r.name));
}

