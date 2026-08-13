const fs = require('fs');
let file = fs.readFileSync('src/features/home/HomePage.tsx', 'utf8');

// Add LeftOutlined, RightOutlined to imports
if (!file.includes('LeftOutlined')) {
  file = file.replace("import {\n  CalendarOutlined,", "import {\n  LeftOutlined,\n  RightOutlined,\n  CalendarOutlined,");
}

// Custom Arrow Components
const customArrows = `
const CustomPrevArrow = (props: any) => {
  const { className, style, onClick } = props;
  return (
    <div
      className={className}
      style={{ ...style }}
      onClick={onClick}
    >
      <LeftOutlined />
    </div>
  );
};

const CustomNextArrow = (props: any) => {
  const { className, style, onClick } = props;
  return (
    <div
      className={className}
      style={{ ...style }}
      onClick={onClick}
    >
      <RightOutlined />
    </div>
  );
};
`;

if (!file.includes('CustomPrevArrow')) {
  file = file.replace("const slides = [", customArrows + "\nconst slides = [");
}

// Add arrows props to Carousel
file = file.replace(
  /<Carousel autoplay autoplaySpeed=\{6000\} effect="fade" arrows pauseOnHover=\{true\}>/,
  `<Carousel autoplay autoplaySpeed={6000} effect="fade" arrows prevArrow={<CustomPrevArrow />} nextArrow={<CustomNextArrow />} pauseOnHover={true}>`
);

fs.writeFileSync('src/features/home/HomePage.tsx', file);
