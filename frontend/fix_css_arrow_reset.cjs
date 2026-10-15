const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

const replacement = `.home-hero .ant-carousel .slick-arrow {
  z-index: 3 !important;
  width: 48px !important;
  height: 48px !important;
  color: #ffffff !important;
  background: rgba(255, 255, 255, 0.15) !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 0 !important;
  margin: 0 !important;
  backdrop-filter: blur(4px) !important;
  transition: all 0.2s ease !important;
  transform: translateY(-50%) !important;
  top: 50% !important;
}
.home-hero .ant-carousel .slick-arrow:hover {
  background: var(--accent-color) !important;
  color: #ffffff !important;
}
.home-hero .ant-carousel .slick-arrow::before,
.home-hero .ant-carousel .slick-arrow::after,
.home-hero .ant-carousel .slick-prev::before,
.home-hero .ant-carousel .slick-prev::after,
.home-hero .ant-carousel .slick-next::before,
.home-hero .ant-carousel .slick-next::after {
  display: none !important;
  content: '' !important;
}
.home-hero .ant-carousel .slick-arrow .anticon {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 20px !important;
  line-height: 1 !important;
  margin: 0 !important;
  padding: 0 !important;
}
@media (max-width: 768px) {
  .home-hero .ant-carousel .slick-arrow {
    width: 42px !important;
    height: 42px !important;
  }
  .home-hero .ant-carousel .slick-arrow .anticon {
    font-size: 18px !important;
  }
}
.home-hero .ant-carousel .slick-prev { left: 24px !important; }
.home-hero .ant-carousel .slick-next { right: 24px !important; }`;

css = css.replace(/\.home-hero \.ant-carousel \.slick-arrow \{[\s\S]*?\.home-hero \.ant-carousel \.slick-next \{ right: 24px; \}/, replacement);

fs.writeFileSync('src/index.css', css);
