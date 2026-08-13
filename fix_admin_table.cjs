const fs = require('fs');

let file = fs.readFileSync('src/features/admin/AdminPage.tsx', 'utf8');

file = file.replace(/title: 'Loại phòng',[\s\S]*?render: \(type: any\) => \{[\s\S]*?let label = String\(type\)[\s\S]*?if \(type === 0 \|\| type === 'Classroom'\) label = 'Phòng học lý thuyết'[\s\S]*?if \(type === 1 \|\| type === 'LectureHall'\) label = 'Hội trường'[\s\S]*?if \(type === 'MeetingRoom'\) label = 'Phòng họp'[\s\S]*?if \(type === 'ComputerLab'\) label = 'Phòng máy'[\s\S]*?if \(type === 2 \|\| type === 'Lab'\) label = 'Phòng Lab'[\s\S]*?return <Tag color="blue" style=\{\{ borderRadius: 4 \}\}>\{label\}<\/Tag>[\s\S]*?\}[\s\S]*?\},/, `title: 'Loại phòng',
      key: 'roomType',
      render: (_: any, record: any) => {
        const label = record._displayType || record.roomType;
        return <Tag color="blue" style={{ borderRadius: 4 }}>{label} {record._displayNote && \`(\${record._displayNote})\`}</Tag>
      }
    },`);

fs.writeFileSync('src/features/admin/AdminPage.tsx', file);
