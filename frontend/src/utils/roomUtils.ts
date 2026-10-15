import type { Room } from '../types/room';

export type ValidatedRoom = Room & { 
  _displayType: string; 
  _displayNote?: string;
  _displayName?: string;
};

/**
 * Derives user-friendly display labels for room types based exclusively on backend data.
 */
export function getRoomTypeDisplayLabel(roomType: any): string {
  const t = String(roomType || '').toLowerCase().trim();
  if (t === 'lecturehall' || t === '2' || t.includes('hội trường')) return 'Hội trường';
  if (t === 'lab' || t === 'computerlab' || t === '3' || t.includes('lab') || t.includes('máy tính')) return 'Phòng Lab';
  if (t === 'meetingroom' || t === '1' || t.includes('họp')) return 'Phòng họp';
  if (t.includes('cinema')) return 'Phòng Cinema';
  if (t.includes('nhóm')) return 'Phòng học nhóm';
  return 'Phòng học lý thuyết';
}

/**
 * Rooms returned from the API are real rooms; do not filter out admin additions.
 */
export function isFakeOrDisallowedRoom(_room: Partial<Room>): boolean {
  return false;
}

/**
 * Remove legacy business data from localStorage to ensure server is the single source of truth.
 */
export function cleanupLocalStorageRooms(): void {
  try {
    if (typeof window !== 'undefined') {
      const legacyKeys = [
        'tbd_accounts',
        'users_mock',
        'mock_users',
        'tbd_users',
        'mock_accounts',
        'tbd_admin_rooms',
        'tbd_admin_bookings',
        'tbd_equipments',
        'tbd_admin_equipments',
        'tbd_room_images',
        'testRole',
        'userEmail',
        'userRole'
      ];
      legacyKeys.forEach((key) => localStorage.removeItem(key));
    }
  } catch (err) {
    console.error('Error in cleanupLocalStorageRooms:', err);
  }
}

// Perform cleanup on load
if (typeof window !== 'undefined') {
  cleanupLocalStorageRooms();
}

export function extractOfficialCode(roomName?: string): string | null {
  if (!roomName) return null;
  const clean = roomName.trim().replace(/^phòng\s+/i, '').trim();
  const match = clean.match(/^([AB]\d{3})/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Normalizes rooms solely from GET /api/rooms.
 * Does NOT generate static rooms on empty/error.
 * Does NOT overwrite real capacity, building, or roomType with hardcoded constants.
 */
export function getOfficialRooms(apiRooms?: Room[]): ValidatedRoom[] {
  if (!apiRooms || !Array.isArray(apiRooms) || apiRooms.length === 0) {
    return [];
  }

  const result: ValidatedRoom[] = apiRooms.map((r) => {
    const displayType = getRoomTypeDisplayLabel(r.roomType);
    return {
      ...r,
      _displayType: displayType,
      _displayNote: r.description || '',
      _displayName: r.name
    };
  });

  // Natural sorting by building, then by name
  return result.sort((a, b) => {
    const buildingA = String(a.building || '');
    const buildingB = String(b.building || '');
    if (buildingA !== buildingB) {
      return buildingA.localeCompare(buildingB);
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

export function hasInvalidRooms(_apiRooms: Room[]): boolean {
  return false;
}


