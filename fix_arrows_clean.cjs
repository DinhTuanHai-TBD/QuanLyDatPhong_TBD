const fs = require('fs');

// 1. Update HomePage.tsx
let tsx = fs.readFileSync('src/features/home/HomePage.tsx', 'utf8');

const customArrows = `
const CustomPrevArrow = (props: any) => {
  const { onClick } = props;
  return (
    <div className="custom-hero-arrow custom-hero-prev" onClick={onClick}>
      <LeftOutlined />
    </div>
  );
};

const CustomNextArrow = (props: any) => {
  const { onClick } = props;
  return (
    <div className="custom-hero-arrow custom-hero-next" onClick={onClick}>
      <RightOutlined />
    </div>
  );
};
`;

tsx = tsx.replace(/const CustomPrevArrow = [\s\S]*?const slides = \[/, customArrows + "\nconst slides = [");

fs.writeFileSync('src/features/home/HomePage.tsx', tsx);

// 2. Update index.css
let css = fs.readFileSync('src/index.css', 'utf8');

const newCSS = `
.home-hero .custom-hero-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 3;
  width: 48px;
  height: 48px;
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
  cursor: pointer;
}
.home-hero .custom-hero-arrow:hover {
  background: var(--accent-color);
  color: #ffffff;
}
.home-hero .custom-hero-prev {
  left: 24px;
}
.home-hero .custom-hero-next {
  right: 24px;
}
.home-hero .custom-hero-arrow .anticon {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  margin: 0;
  padding: 0;
}
@media (max-width: 768px) {
  .home-hero .custom-hero-arrow {
    width: 42px;
    height: 42px;
  }
  .home-hero .custom-hero-arrow .anticon {
    font-size: 18px;
  }
}
`;

css = css.replace(/\.home-hero \.ant-carousel \.slick-arrow \{[\s\S]*?\.home-hero \.ant-carousel \.slick-next \{ right: 24px !important; \}/, newCSS);

fs.writeFileSync('src/index.css', css);

