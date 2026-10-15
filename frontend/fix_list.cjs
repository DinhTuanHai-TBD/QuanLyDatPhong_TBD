const fs = require('fs');

let eq = fs.readFileSync('src/features/bookings/EquipmentSelector.tsx', 'utf8');
eq = eq.replace("import { Checkbox, InputNumber, Typography, Tag, List, Tooltip } from 'antd';", "import { Checkbox, InputNumber, Typography, Tag, Tooltip } from 'antd';");

// Replace <List ... > with <div> and .map
eq = eq.replace(/<List\s+itemLayout="horizontal"\s+dataSource=\{allowedEquipments\}\s+renderItem=\{item => \{([\s\S]*?)\}\}\s+\/>/, 
  "<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>\n      {allowedEquipments.map((item) => {\n$1\n      })}\n    </div>"
);

eq = eq.replace(/<List\.Item/g, '<div');
eq = eq.replace(/<\/List\.Item>/g, '</div>');
// Also need to add key to div
eq = eq.replace(/<div\n\s*style=\{\{/, '<div\n            key={item.id}\n            style={{');

fs.writeFileSync('src/features/bookings/EquipmentSelector.tsx', eq);
