const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

css = css.replace(
  /\.home-hero \.ant-carousel \.slick-arrow::before \{\n  display: none !important;\n\}/g,
  ".home-hero .ant-carousel .slick-arrow::before,\n.home-hero .ant-carousel .slick-prev::before,\n.home-hero .ant-carousel .slick-next::before {\n  display: none !important;\n  content: '' !important;\n}"
);

fs.writeFileSync('src/index.css', css);
