const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace(/(\.home-hero \.ant-carousel \.slick-arrow \{[^}]*?)display:\s*flex;([^}]*\})/s, '$1display: flex !important;$2');

fs.writeFileSync('src/index.css', css);
