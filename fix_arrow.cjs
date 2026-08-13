const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
css = css.replace('display: flex;', 'display: flex !important;');
fs.writeFileSync('src/index.css', css);
