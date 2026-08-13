const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace('filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));', 'filter: brightness(0) invert(1) drop-shadow(0 2px 4px rgba(0,0,0,0.2));');
fs.writeFileSync('src/index.css', css);

let notif = fs.readFileSync('src/features/notifications/NotificationBell.tsx', 'utf8');
notif = notif.replace("style={{ padding: '4px 8px' }}", "style={{ padding: '4px 8px', color: '#ffffff' }}");
fs.writeFileSync('src/features/notifications/NotificationBell.tsx', notif);
