const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Replace the previous slick-arrow block to remove display: flex !important;
css = css.replace(/(\.home-hero \.ant-carousel \.slick-arrow \{[^}]*?)display:\s*flex\s*!important;([^}]*\})/s, '$1$2');

// Add specific styles to center the ::before pseudo-element
const appendCss = `
.home-hero .ant-carousel .slick-arrow::before {
  position: absolute !important;
  top: 50% !important;
  left: 50% !important;
  margin-top: -6px !important;
  display: block !important;
}
.home-hero .ant-carousel .slick-prev::before {
  margin-left: -4px !important;
}
.home-hero .ant-carousel .slick-next::before {
  margin-left: -8px !important;
}
`;

css += appendCss;

fs.writeFileSync('src/index.css', css);
