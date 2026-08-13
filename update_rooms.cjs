const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

// Add import
if (!file.includes('getOfficialRooms')) {
  file = file.replace("import type { Room } from '../../types/room'", "import type { Room } from '../../types/room'\nimport { getOfficialRooms, hasInvalidRooms } from '../../utils/roomUtils'");
}

// Add state for building filter
if (!file.includes('const [buildingFilter, setBuildingFilter] = useState')) {
  file = file.replace("const [typeFilter, setTypeFilter] = useState<string>('All')", "const [typeFilter, setTypeFilter] = useState<string>('All')\n  const [buildingFilter, setBuildingFilter] = useState<string>('All')");
}

// Apply filter and map
file = file.replace("const rooms = roomsQuery.data ?? []", "const apiRooms = roomsQuery.data ?? []\n  const hasWarning = hasInvalidRooms(apiRooms)\n  const rooms = getOfficialRooms(apiRooms)");

// Update filteredRooms logic
file = file.replace(/const filteredRooms = rooms\.filter\(\(room\) => \{[\s\S]*?return matchesSearch && mappedType === typeFilter\n  \}\)/, `const filteredRooms = rooms.filter((room) => {
    if (!room) return false
    const nameStr = room.name ?? ''
    const buildingStr = room.building ?? ''
    const descStr = room.description ?? ''
    const matchesSearch = nameStr.toLowerCase().includes(searchText.toLowerCase()) || 
      buildingStr.toLowerCase().includes(searchText.toLowerCase()) ||
      descStr.toLowerCase().includes(searchText.toLowerCase())
    
    let matchesType = typeFilter === 'All'
    if (!matchesType) {
      matchesType = (room as any)._displayType === typeFilter
    }

    let matchesBuilding = buildingFilter === 'All'
    if (!matchesBuilding) {
      matchesBuilding = room.building === buildingFilter
    }

    return matchesSearch && matchesType && matchesBuilding
  })`);

// Add Warning Alert
if (!file.includes('hasWarning &&')) {
  file = file.replace("{/* Filter and Search Section */}", `{hasWarning && (
        <Alert
          message="Cảnh báo: Dữ liệu từ Backend đang trả về các phòng không thuộc danh sách chính thức (ví dụ: Khu C). Vui lòng cập nhật lại Database."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      {/* Filter and Search Section */}`);
}

// Update Filter UI
const oldColType = `<Col xs={24} md={10}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Select
                value={typeFilter}
                onChange={(value) => setTypeFilter(value)}
                size="large"
                style={{ width: '100%', borderRadius: 6 }}
                options={[
                  { value: 'All', label: 'Tất cả các loại' },
                  { value: 'Phòng học', label: 'Phòng học lý thuyết' },
                  { value: 'Hội trường', label: 'Hội trường / Giảng đường' },
                  { value: 'Phòng lab', label: 'Phòng thực hành (Lab)' },
                ]}
              />
            </div>
          </Col>`;

const newColFilters = `<Col xs={24} md={10}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Select
                value={buildingFilter}
                onChange={(value) => setBuildingFilter(value)}
                size="large"
                style={{ width: '50%', borderRadius: 6 }}
                options={[
                  { value: 'All', label: 'Tất cả khu vực' },
                  { value: 'Khu A', label: 'Khu A' },
                  { value: 'Khu B', label: 'Khu B' },
                ]}
              />
              <Select
                value={typeFilter}
                onChange={(value) => setTypeFilter(value)}
                size="large"
                style={{ width: '50%', borderRadius: 6 }}
                options={[
                  { value: 'All', label: 'Tất cả các loại' },
                  { value: 'Phòng học', label: 'Phòng học' },
                  { value: 'Hội trường', label: 'Hội trường' },
                  { value: 'Phòng Lab', label: 'Phòng Lab' },
                  { value: 'Phòng Cinema', label: 'Phòng Cinema' },
                  { value: 'Phòng học nhóm', label: 'Phòng học nhóm' }
                ]}
              />
            </div>
          </Col>`;
file = file.replace(oldColType, newColFilters);

// Update Type & Note displays
file = file.replace(/<span style={{ fontWeight: 600, color: '#334155' }}>\s*\{roomTypeLabels\[String\(room\.roomType\)\] \?\? String\(room\.roomType\)\}\s*<\/span>/, 
  `<span style={{ fontWeight: 600, color: '#334155' }}>
                            {(room as any)._displayType}
                            {(room as any)._displayNote && <span style={{ marginLeft: 4, color: '#64748b', fontWeight: 'normal', fontSize: 12 }}>({(room as any)._displayNote})</span>}
                          </span>`);

// Details modal
file = file.replace(/<Descriptions\.Item label="Loại phòng">\{roomTypeLabels\[String\(selectedRoom\.roomType\)\] \?\? String\(selectedRoom\.roomType\)\}<\/Descriptions\.Item>/,
  `<Descriptions.Item label="Loại phòng">{(selectedRoom as any)._displayType} {(selectedRoom as any)._displayNote ? \`(\${(selectedRoom as any)._displayNote})\` : ''}</Descriptions.Item>`);

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
