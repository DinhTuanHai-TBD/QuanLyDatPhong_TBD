import type { Room } from '../types/room';

export type ValidatedRoom = Room & { 
  _displayType: string; 
  _displayNote?: string;
  _displayName?: string;
};

/**
 * Derives user-friendly display labels for room types based on backend enum & characteristics.
 * Backend Enum: Classroom = 0, LectureHall = 1, Lab = 2
 */
export function getRoomTypeDisplayLabel(roomOrType: any, optionalRoomObj?: any): string {
  const room = (typeof roomOrType === 'object' && roomOrType !== null) ? roomOrType : optionalRoomObj;
  const name = String(room?.name || '').toLowerCase();
  const desc = String(room?.description || '').toLowerCase();
  const rawType = (typeof roomOrType === 'object' && roomOrType !== null) ? roomOrType.roomType : roomOrType;
  const t = String(rawType ?? '').toLowerCase().trim();

  // Specialized rooms detected by code / name / description
  if (name.includes('cinema') || desc.includes('cinema') || name === 'a302') {
    return 'Phòng Cinema';
  }
  if (name.includes('nhóm') || desc.includes('nhóm') || desc.includes('group') || name === 'a305') {
    return 'Phòng học nhóm';
  }

  // Enum 1: LectureHall
  if (t === '1' || t === 'lecturehall' || name.includes('hội trường') || desc.includes('hội trường')) {
    return 'Hội trường';
  }

  // Enum 2: Lab / Practical rooms
  if (
    t === '2' ||
    t === 'lab' ||
    t === 'computerlab' ||
    name.includes('lab') ||
    desc.includes('lab') ||
    desc.includes('máy tính') ||
    desc.includes('nhiếp ảnh') ||
    name === 'greenlab'
  ) {
    return 'Phòng Lab';
  }

  if (t.includes('họp') || desc.includes('họp')) {
    return 'Phòng họp';
  }

  // Enum 0: Classroom
  return 'Phòng học lý thuyết';
}

/**
 * Kiểm tra phòng có bị chặn đặt đối với tài khoản Sinh viên hay không.
 * Các loại phòng bị chặn gồm:
 * 1. Hội trường (Lecture Hall)
 * 2. Phòng Lab / Thực hành / Máy tính
 * 3. Cinema (Phòng A302 / Phòng chiếu phim)
 */
export function isRoomRestrictedForStudent(room: any): boolean {
  if (!room) return false;
  const name = String(room.name || '').trim().toLowerCase();
  const desc = String(room.description || '').trim().toLowerCase();
  const rawType = String(room.roomType ?? '').trim().toLowerCase();
  const displayType = String(room._displayType || getRoomTypeDisplayLabel(room.roomType, room)).trim().toLowerCase();

  // 1. Hội trường (Lecture Hall) - Enum 1
  if (
    rawType === '1' ||
    rawType === 'lecturehall' ||
    displayType.includes('hội trường') ||
    name.includes('hội trường') ||
    desc.includes('hội trường')
  ) {
    return true;
  }

  // 2. Phòng Lab / máy tính / thực hành - Enum 2
  if (
    rawType === '2' ||
    rawType === 'lab' ||
    rawType === 'computerlab' ||
    displayType.includes('lab') ||
    name.includes('lab') ||
    desc.includes('lab') ||
    desc.includes('máy tính') ||
    name === 'greenlab'
  ) {
    return true;
  }

  // 3. Cinema (A302 hoặc phòng có chứa cinema)
  if (
    displayType.includes('cinema') ||
    name.includes('cinema') ||
    desc.includes('cinema') ||
    name === 'a302'
  ) {
    return true;
  }

  return false;
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
 * Ensures consistent naming (A101), standardized buildings (Khu A / Khu B),
 * accurate display types, and natural numeric sorting.
 */
export function getOfficialRooms(apiRooms?: Room[]): ValidatedRoom[] {
  if (!apiRooms || !Array.isArray(apiRooms) || apiRooms.length === 0) {
    return [];
  }

  const result: ValidatedRoom[] = apiRooms.map((r) => {
    // 1. Chuẩn hóa tên phòng: bỏ dấu chấm thừa ("A.101" -> "A101"), xóa tiền tố "Phòng " thừa
    let cleanName = (r.name || '').trim().replace(/^phòng\s+/i, '').trim();
    if (cleanName === 'A.101') cleanName = 'A101';

    // 2. Chuẩn hóa phân loại tòa nhà: Khu A và Khu B
    let building = (r.building || '').trim();
    const lowerName = cleanName.toLowerCase();
    const lowerBuilding = building.toLowerCase();
    if (lowerBuilding.includes('a') || lowerName.startsWith('a')) {
      building = 'Khu A';
    } else if (lowerBuilding.includes('b') || lowerName.startsWith('b') || lowerName.includes('lab') || lowerName.includes('greenlab')) {
      building = 'Khu B';
    } else if (!building) {
      building = lowerName.startsWith('b') ? 'Khu B' : 'Khu A';
    }

    const displayType = getRoomTypeDisplayLabel(r.roomType, { ...r, name: cleanName });

    return {
      ...r,
      name: cleanName,
      building: building,
      _displayType: displayType,
      _displayNote: r.description || '',
      _displayName: cleanName
    };
  });

  // Sắp xếp tự nhiên chuẩn học vụ:
  // - Khu A trước, Khu B sau
  // - Thứ tự số phòng tăng dần: A101, A108, A109, A110, A111, A201, ..., A403, rồi B001, ..., B107, Greenlab, Lab.204
  return result.sort((a, b) => {
    const buildingA = String(a.building || '');
    const buildingB = String(b.building || '');
    if (buildingA !== buildingB) {
      return buildingA.localeCompare(buildingB, 'vi');
    }
    return a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' });
  });
}

export function hasInvalidRooms(_apiRooms: Room[]): boolean {
  return false;
}

/**
 * Lấy danh sách trang thiết bị có sẵn thực tế trong phòng học.
 * Ưu tiên dữ liệu từ CSDL (bảng Equipments/RoomEquipments).
 * Tự động đồng bộ chuẩn theo loại phòng (Lý thuyết, Lab, Hội trường, Cinema, Phòng nhóm).
 */
export function getRoomAvailableEquipmentList(room: any, allEquipments: any[] = []): string[] {
  if (!room) return [];

  // 1. Kiểm tra thiết bị được gán chính xác trong CSDL (qua roomId hoặc tên phòng)
  const matched = (allEquipments || []).filter((e: any) => {
    if (!e) return false;
    const matchId = e.roomId && String(e.roomId) === String(room.id);
    const matchName = e.roomName && room.name && (
      String(e.roomName).toLowerCase().includes(String(room.name).toLowerCase()) ||
      String(room.name).toLowerCase().includes(String(e.roomName).toLowerCase())
    );
    const isUsable = e.status !== 'Maintenance' && e.status !== 'Broken';
    return (matchId || matchName) && isUsable;
  });

  if (matched.length > 0) {
    return matched.map((e: any) => e.name || e.type);
  }

  // 2. Nếu trường description của phòng có ghi nhận thiết bị
  if (room.description && typeof room.description === 'string' && (
    room.description.includes('Máy chiếu') ||
    room.description.includes('Điều hòa') ||
    room.description.includes('Micro') ||
    room.description.includes('máy tính')
  )) {
    return room.description
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  // 3. Chuẩn hóa theo phân loại phòng học thực tế của Đại học Thái Bình Dương
  const typeStr = String(room._displayType || room.roomType || '').toLowerCase();
  const nameStr = String(room.name || '').toLowerCase();

  if (typeStr.includes('lab') || nameStr.includes('lab') || nameStr.includes('máy tính')) {
    return ['Dàn máy tính Core i7 (20-35 máy)', 'Máy chiếu tương tác', 'Điều hòa nhiệt độ Daikin', 'Bảng từ', 'Hệ thống mạng LAN gigabit'];
  }
  if (typeStr.includes('hội trường') || nameStr.includes('hội trường')) {
    return ['Màn hình LED P3 sân khấu', 'Hệ thống âm thanh hội trường', 'Micro không dây chuyên dụng (2-4 mic)', 'Điều hòa trung tâm', 'Bục phát biểu'];
  }
  if (typeStr.includes('cinema') || nameStr.includes('cinema')) {
    return ['Màn chiếu cong Ultra HD', 'Hệ thống âm thanh vòm Dolby Surround', 'Máy chiếu phim chuyên dụng', 'Điều hòa công suất lớn', 'Ghế đệm rạp phim'];
  }
  if (typeStr.includes('nhóm') || nameStr.includes('nhóm') || nameStr.includes('thảo luận')) {
    return ['Smart TV / Bảng thông minh tương tác', 'Điều hòa 18000 BTU', 'Wifi tốc độ cao', 'Bảng kính viết bút dạ'];
  }
  if (typeStr.includes('họp') || nameStr.includes('họp')) {
    return ['Màn hình TV 75 inch họp trực tuyến', 'Micro hội nghị đa hướng', 'Điều hòa', 'Wifi chuyên dụng'];
  }

  // Phòng học lý thuyết tiêu chuẩn (A101-A206, A403, B001-B107,...)
  return ['Máy chiếu độ nét cao', 'Điều hòa 2 chiều', 'Micro giảng viên & Loa trợ giảng', 'Bảng từ chống lóa', 'Wifi trường'];
}


