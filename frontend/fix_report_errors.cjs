const fs = require('fs');

let file = fs.readFileSync('src/features/issues/ReportIssuePage.tsx', 'utf8');

// Remove unused imports
file = file.replace(/Popconfirm,\s*/g, '');
file = file.replace(/Tooltip,\s*/g, '');

// Fix status check
file = file.replace(/b\.status === 'InProgress'/g, "b.status === 'Using'");

fs.writeFileSync('src/features/issues/ReportIssuePage.tsx', file);
