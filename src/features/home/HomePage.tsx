import { LeftOutlined, RightOutlined, CalendarOutlined, 
  SearchOutlined, 
  FormOutlined,
  HistoryOutlined,
  ToolOutlined,
  EditOutlined,
  TeamOutlined
} from '@ant-design/icons'
import {  Button, Carousel, Col, Row, Typography } from 'antd'
import {  useEffect } from 'react'
import {  Link, useNavigate } from 'react-router-dom'



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

const slides = [
  {
    image: '/images/hinh1.png',
    title: <><span className="hero-line">Đặt phòng nhanh chóng</span><br /><span className="hero-line">Học tập và làm việc hiệu quả</span></>,
    desc: 'Tìm kiếm phòng phù hợp, kiểm tra lịch trống và gửi yêu cầu đặt phòng trực tuyến chỉ trong vài bước.',
    actions: [
      { label: 'Đặt phòng ngay', path: '/bookings', type: 'primary' },
      { label: 'Xem lịch phòng', path: '/calendar', type: 'default' }
    ]
  },
  {
    image: '/images/hinh2.png',
    title: <><span className="hero-line">Không gian phù hợp</span><br /><span className="hero-line">Thiết bị sẵn sàng</span></>,
    desc: 'Dễ dàng tìm phòng theo sức chứa, khu vực và thiết bị phục vụ học tập, giảng dạy và tổ chức sự kiện.',
    actions: [
      { label: 'Tìm phòng', path: '/rooms', type: 'primary' },
      { label: 'Xem thông tin phòng', path: '/rooms', type: 'default' }
    ]
  },
  {
    image: '/images/hinh3.png',
    title: <><span className="hero-line">Phê duyệt minh bạch</span><br /><span className="hero-line">Theo dõi thuận tiện</span></>,
    desc: 'Theo dõi trạng thái yêu cầu, nhận thông báo phê duyệt và quản lý lịch sử sử dụng phòng trong một hệ thống thống nhất.',
    actions: [
      { label: 'Lịch sử đặt phòng', path: '/booking-history', type: 'primary', requiresLogin: true }
    ]
  }
]

function HomePage() {
  const navigate = useNavigate()
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'))

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add('is-visible')),
      { threshold: 0.14 },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  const handleNavigate = (path: string, requiresLogin?: boolean) => {
    if (requiresLogin && !isLoggedIn) {
      navigate(`/login?redirect=${path}`)
    } else {
      navigate(path)
    }
  }

  return (
    <>
      <section className="home-hero" aria-label="Giới thiệu Đại học Thái Bình Dương" style={{ position: 'relative' }}>
        <Carousel autoplay autoplaySpeed={6000} effect="fade" arrows prevArrow={<CustomPrevArrow />} nextArrow={<CustomNextArrow />} pauseOnHover={true}>
          {slides.map((slide, index) => (
            <div key={index}>
              <div className="hero-slide" style={{ backgroundImage: `url(${slide.image})`, borderRadius: 0 }}>
                <div className="hero-overlay" />
                <div className="hero-copy">
                  <Typography.Title className="hero-title">{slide.title}</Typography.Title>
                  <Typography.Paragraph className="hero-desc">{slide.desc}</Typography.Paragraph>
                  <div className="hero-actions">
                    {slide.actions.map((action, i) => (
                      <Button 
                        key={i}
                        type={action.type as any}
                        className={action.type === 'primary' ? 'hero-action hero-action-primary' : 'hero-action hero-action-secondary'} 
                        size="large" 
                        onClick={() => handleNavigate(action.path, (action as any).requiresLogin)}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Carousel>

        {/* Curved bottom overlay */}
        <div className="hero-curve-bottom" style={{
          position: 'absolute',
          bottom: -1,
          left: 0,
          width: '100%',
          overflow: 'hidden',
          lineHeight: 0,
          zIndex: 10,
        }}>
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{
            position: 'relative',
            display: 'block',
            width: 'calc(100% + 1.3px)',
            height: '100px', // Adjusted to match typical curved look
          }}>
            <path d="M0,120 C300,60 900,60 1200,120 L1200,120 L0,120 Z" fill="#ffffff" />
          </svg>
        </div>
      </section>

      <section className="hero-cards" style={{
        position: 'relative',
        zIndex: 11,
        marginTop: '-100px',
        paddingBottom: '60px',
        background: 'transparent'
      }}>
        <div className="content-container">
          <Row gutter={[24, 24]} justify="center">
            <Col xs={24} md={12} xl={6}>
              <div className="feature-card" onClick={() => navigate('/rooms')}>
                <div className="feature-icon-wrapper">
                  <SearchOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Tìm phòng</h3>
                <p className="feature-desc">Tìm phòng theo loại, sức chứa, khu vực và thiết bị.</p>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div className="feature-card" onClick={() => navigate('/calendar')}>
                <div className="feature-icon-wrapper">
                  <CalendarOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Xem lịch phòng</h3>
                <p className="feature-desc">Kiểm tra lịch sử dụng và những khung giờ còn trống.</p>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div className="feature-card" onClick={() => handleNavigate('/bookings', true)}>
                <div className="feature-icon-wrapper">
                  <FormOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Đặt phòng</h3>
                <p className="feature-desc">Gửi yêu cầu đặt phòng trực tuyến nhanh chóng.</p>
              </div>
            </Col>
            <Col xs={24} md={12} xl={6}>
              <div className="feature-card" onClick={() => handleNavigate('/report-issue', true)}>
                <div className="feature-icon-wrapper">
                  <ToolOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Báo sự cố</h3>
                <p className="feature-desc">Thông báo nhanh sự cố phòng học hoặc thiết bị để được hỗ trợ kịp thời.</p>
              </div>
            </Col>
          </Row>
        </div>
      </section>

      <section className="about-band about-university">
        <div className="content-container">
          <Row gutter={[56, 32]} align="middle">
            <Col xs={24} lg={12} data-reveal="right">
              <div className="video-rounded-custom">
                <iframe src="https://www.youtube.com/embed/qqpFn4bEPys?rel=0" title="Giới thiệu Đại học Thái Bình Dương" allowFullScreen />
              </div>
            </Col>
            <Col xs={24} lg={12} data-reveal="left">
              <Typography.Text className="section-eyebrow">VỀ CHÚNG TÔI</Typography.Text>
              <Typography.Title level={2}>Đại học Thái Bình Dương</Typography.Title>
              <Typography.Paragraph className="lead-copy">Trường đại học tư thục phi lợi nhuận, đào tạo công dân toàn cầu với phương pháp giáo dục khai phóng.</Typography.Paragraph>
              <Typography.Paragraph>Chúng tôi cam kết tạo ra môi trường học tập hiện đại, sáng tạo và đầy cảm hứng bên bờ biển Nha Trang.</Typography.Paragraph>
            </Col>
          </Row>
        </div>
      </section>

      <section className="about-band about-system" id="about-system">
        <div className="content-container">
          <Row gutter={[56, 32]} align="middle">
            <Col xs={24} lg={12} data-reveal="right">
              <Typography.Text className="section-eyebrow">GIẢI PHÁP SỐ</Typography.Text>
              <Typography.Title level={2}>Hệ thống Đặt phòng TBD</Typography.Title>
              <Typography.Paragraph className="lead-copy">Tối ưu hóa quy trình đăng ký sử dụng phòng học và phòng họp.</Typography.Paragraph>
              <Typography.Paragraph>Giúp sinh viên và giảng viên chủ động tra cứu lịch, đặt phòng nhanh chóng mà không cần thủ tục giấy tờ phức tạp.</Typography.Paragraph>
            </Col>
            <Col xs={24} lg={12} data-reveal="left">
              <img className="img-rounded-custom" src="/images/hinh5.png" alt="Hệ thống đặt phòng TBD" />
            </Col>
          </Row>
        </div>
      </section>

      <section className="benefit-section">
        <div className="content-container">
          <div className="section-heading" data-reveal="up">
            <Typography.Title level={2}>TIỆN ÍCH</Typography.Title>
            <Typography.Paragraph>Nhanh chóng, chính xác mọi lúc mọi nơi</Typography.Paragraph>
          </div>
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8} data-reveal="up">
              <Link className="feature-box" to="/bookings"><EditOutlined /><h3>Đặt phòng</h3><p>Tiến hành đặt phòng học, phòng họp nhanh chóng chỉ với vài thao tác đơn giản.</p></Link>
            </Col>
            <Col xs={24} md={8} data-reveal="up" style={{ transitionDelay: '120ms' }}>
              <Link className="feature-box" to="/rooms"><TeamOutlined /><h3>Thông tin phòng</h3><p>Tra cứu danh sách phòng, sức chứa và các trang thiết bị có sẵn tại từng phòng.</p></Link>
            </Col>
            <Col xs={24} md={8} data-reveal="up" style={{ transitionDelay: '240ms' }}>
              <Link className="feature-box" to="/booking-history"><HistoryOutlined /><h3>Lịch sử đặt phòng</h3><p>Xem lại trạng thái các yêu cầu đã gửi, lịch sử sử dụng và quản lý cá nhân.</p></Link>
            </Col>
          </Row>
        </div>
      </section>
    </>
  )
}

export default HomePage
