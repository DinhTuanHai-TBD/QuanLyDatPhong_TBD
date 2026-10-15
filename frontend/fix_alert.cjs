const fs = require('fs');

let file = fs.readFileSync('src/features/bookings/BookingPage.tsx', 'utf8');
file = file.replace(/message=\{<strong/g, 'title={<strong');
fs.writeFileSync('src/features/bookings/BookingPage.tsx', file);
