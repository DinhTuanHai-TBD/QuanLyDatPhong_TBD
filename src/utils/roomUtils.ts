import type { Room } from '../types/room';

export const OFFICIAL_ROOMS: Record<string, { building: string, type: string, capacity: number, note?: string }> = {
  A201: { building: 'Khu A', type: 'Phòng học', capacity: 100 },
  A202: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A203: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A204: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A205: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A206: { building: 'Khu A', type: 'Phòng học', capacity: 40 },
  A302: { building: 'Khu A', type: 'Phòng Cinema', capacity: 40 },
  A304: { building: 'Khu A', type: 'Phòng Lab', capacity: 20, note: '20 máy tính' },
  A305: { building: 'Khu A', type: 'Phòng học nhóm', capacity: 10 },
  A401: { building: 'Khu A', type: 'Hội trường', capacity: 300 },
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

export type ValidatedRoom = Room & { _displayType: string; _displayNote?: string };

export function getOfficialRooms(apiRooms?: Room[]): ValidatedRoom[] {
  if (!apiRooms) {
    return Object.entries(OFFICIAL_ROOMS).map(([name, info], index) => ({
      id: index + 1000,
      name,
      building: info.building,
      capacity: info.capacity,
      roomType: info.type as any,
      status: 'Active',
      isActive: true,
      description: info.note || '',
      imageUrl: '',
      _displayType: info.type,
      _displayNote: info.note
    }));
  }

  const validRooms = apiRooms.filter(r => OFFICIAL_ROOMS[r.name]);
  
  return validRooms.map(r => {
    const override = OFFICIAL_ROOMS[r.name];
    return {
      ...r,
      building: override.building,
      capacity: override.capacity,
      _displayType: override.type,
      _displayNote: override.note
    };
  });
}

export function hasInvalidRooms(apiRooms: Room[]) {
  return apiRooms.some(r => !OFFICIAL_ROOMS[r.name]);
}
