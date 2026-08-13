const fs = require('fs');
let file = fs.readFileSync('src/features/home/HomePage.tsx', 'utf8');

// strip out ALL bad imports
file = file.replace(/import { LeftOutlined, RightOutlined, /g, 'import { ');

// now add it ONLY to the @ant-design/icons import
file = file.replace(/import \{\s*CalendarOutlined,/, 'import { LeftOutlined, RightOutlined, CalendarOutlined,');

fs.writeFileSync('src/features/home/HomePage.tsx', file);
