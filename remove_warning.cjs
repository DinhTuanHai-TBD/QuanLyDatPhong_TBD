const fs = require('fs');
let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/const hasWarning = hasInvalidRooms\(apiRooms\)/g, "");

file = file.replace(/\{hasWarning && \(\s*<Alert\s*title="Cảnh báo: Dữ liệu từ Backend đang trả về các phòng không thuộc danh sách chính thức \(ví dụ: Khu C\)\. Vui lòng cập nhật lại Database\."\s*type="warning"\s*showIcon\s*style=\{\{ marginBottom: 16 \}\}\s*\/>\s*\)\}/g, "");

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
