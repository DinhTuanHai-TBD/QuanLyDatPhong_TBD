const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/<Col xs=\{24\} md=\{10\}>[\s\S]*?<\/Col>/, `<Col xs={24} md={10}>
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
          </Col>`);

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
