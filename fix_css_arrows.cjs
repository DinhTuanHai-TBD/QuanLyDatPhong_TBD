const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Replace the previous slick-arrow block to add display: flex !important; and reset sizes
const newSlickArrow = `.home-hero .ant-carousel .slick-arrow {
  z-index: 3;
  width: 48px !important;
  height: 48px !important;
  color: #ffffff;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.15) !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  line-height: 1 !important;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}
.home-hero .ant-carousel .slick-arrow:hover {
  background: var(--accent-color) !important;
  color: #ffffff;
}
.home-hero .ant-carousel .slick-arrow::before {
  display: none !important;
}
.home-hero .ant-carousel .slick-arrow .anticon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
@media (max-width: 768px) {
  .home-hero .ant-carousel .slick-arrow {
    width: 42px !important;
    height: 42px !important;
    font-size: 16px;
  }
}`;

// remove old slick-arrow rules
css = css.replace(/\.home-hero \.ant-carousel \.slick-arrow \{[\s\S]*?transition: all 0\.2s ease;\n\}/g, '');
css = css.replace(/\.home-hero \.ant-carousel \.slick-arrow:hover \{[\s\S]*?color: #ffffff;\n\}/g, '');

// remove old ::before hacks
css = css.replace(/\.home-hero \.ant-carousel \.slick-arrow::before \{[\s\S]*?display: block !important;\n\}/g, '');
css = css.replace(/\.home-hero \.ant-carousel \.slick-prev::before \{[\s\S]*?margin-left: -4px !important;\n\}/g, '');
css = css.replace(/\.home-hero \.ant-carousel \.slick-next::before \{[\s\S]*?margin-left: -8px !important;\n\}/g, '');

// Append new rules before .home-hero .ant-carousel .slick-prev
css = css.replace(/\.home-hero \.ant-carousel \.slick-prev \{ left: 24px; \}/, newSlickArrow + '\n\n.home-hero .ant-carousel .slick-prev { left: 24px; }');

fs.writeFileSync('src/index.css', css);
