const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');
// Revert
css = css.replace('display: flex !important;', 'display: flex;');
// Update slick-arrow
css = css.replace('.home-hero .ant-carousel .slick-arrow {\n   z-index: 3;\n   width: 44px;\n   height: 44px;\n   color: #ffffff;\n   font-size: 24px;\n   background: rgba(255, 255, 255, 0.15);\n  border-radius: 50%;\n  display: flex;\n  align-items: center;\n  justify-content: center;',
'.home-hero .ant-carousel .slick-arrow {\n   z-index: 3;\n   width: 44px;\n   height: 44px;\n   color: #ffffff;\n   font-size: 24px;\n   background: rgba(255, 255, 255, 0.15);\n  border-radius: 50%;\n  display: flex !important;\n  align-items: center;\n  justify-content: center;');
fs.writeFileSync('src/index.css', css);
