import { getUserEmail, getUserRole } from "./api/authUtils";
import {
  CloseOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  GlobalOutlined,
  LoginOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  PhoneOutlined,
  UserOutlined,
  YoutubeFilled,
  EditOutlined,
  VerticalAlignTopOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Layout, Tooltip, Tag, FloatButton } from "antd";
import NotificationBell from "./features/notifications/NotificationBell";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { http } from "./api/http";
import { fetchUserProfile, type UserProfileData } from "./api/userProfile";
import UserProfileModal from "./components/UserProfileModal";
import BookingPage from "./features/bookings/BookingPage";
import BookingHistoryPage from "./features/bookings/BookingHistoryPage";
import HomePage from "./features/home/HomePage";
import LoginPage from "./features/auth/LoginPage";
import RoomsPage from "./features/rooms/RoomsPage";
import AdminPage from "./features/admin/AdminPage";
import ApprovalsPage from "./features/approvals/ApprovalsPage";
import CalendarPage from "./features/calendar/CalendarPage";
import ReportIssuePage from "./features/issues/ReportIssuePage";
import NotificationsPage from "./features/notifications/NotificationsPage";
import { useBookingMaintenanceWorker } from "./services/BookingMaintenanceWorker";
import { STATIC_IMAGES, handleImageFallback } from "./utils/storageUtils";

const { Content } = Layout;

function SiteFooter() {
  return (
    <footer className="footer-dark">
      <div className="footer-content">
        <section>
          <h3>ĐH Thái Bình Dương</h3>
          <p style={{ color: '#cbd5e1', fontSize: 13.5, lineHeight: 1.6, marginBottom: 12 }}>
            Hệ thống Quản lý & Đặt phòng học trực tuyến (TBD Room Booking).
          </p>
          <p style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6 }}>
            Phục vụ công tác giảng dạy, học tập, nghiên cứu khoa học và sinh hoạt học thuật của Giảng viên, Sinh viên và Cán bộ Nhà trường.
          </p>
        </section>

        <section>
          <h3>LIÊN HỆ</h3>
          <ul>
            <li>
              <EnvironmentOutlined style={{ color: '#fbbf24', marginTop: 4, flexShrink: 0 }} />
              <span style={{ color: '#e2e8f0', fontSize: 13 }}>
                79 Mai Thị Dõng, Vĩnh Ngọc, Nha Trang, Khánh Hòa
              </span>
            </li>
            <li>
              <PhoneOutlined style={{ color: '#fbbf24', marginTop: 4, flexShrink: 0 }} />
              <a href="tel:02583727147" style={{ color: '#e2e8f0', fontSize: 13 }}>
                (0258) 3727 147
              </a>
            </li>
            <li>
              <MailOutlined style={{ color: '#fbbf24', marginTop: 4, flexShrink: 0 }} />
              <a href="mailto:tbd@moet.edu.vn" style={{ color: '#e2e8f0', fontSize: 13 }}>
                tbd@moet.edu.vn
              </a>
            </li>
            <li>
              <FacebookFilled style={{ color: '#fbbf24', marginTop: 4, flexShrink: 0 }} />
              <a
                href="https://facebook.com/TruongDaihocThaiBinhDuong"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#e2e8f0', fontSize: 13, wordBreak: 'break-all' }}
              >
                fb.com/TruongDaihocThaiBinhDuong
              </a>
            </li>
            <li>
              <YoutubeFilled style={{ color: '#fbbf24', marginTop: 4, flexShrink: 0 }} />
              <a
                href="https://youtube.com/@tbduniversity"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#e2e8f0', fontSize: 13, wordBreak: 'break-all' }}
              >
                youtube.com/@tbduniversity
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h3>Danh mục</h3>
          <ul className="footer-links">
            <li>
              <Link to="/">Trang chủ</Link>
            </li>
            <li>
              <Link to="/rooms">Thông tin phòng</Link>
            </li>
            <li>
              <Link to="/bookings">Đặt phòng</Link>
            </li>
            <li>
              <Link to="/calendar">Lịch phòng</Link>
            </li>
          </ul>
        </section>

        <section>
          <h3>Hỗ trợ</h3>
          <ul className="footer-links" style={{ marginBottom: 18 }}>
            <li>
              <Link to="/booking-history">Lịch sử đặt phòng</Link>
            </li>
            <li>
              <Link to="/report-issue">Báo cáo sự cố CSVC</Link>
            </li>
            <li>
              <a href="https://tbd.edu.vn" target="_blank" rel="noreferrer">
                Cổng thông tin TBD
              </a>
            </li>
          </ul>

          <div className="social-links" aria-label="Kênh mạng xã hội TBD">
            <Tooltip title="Facebook TBD">
              <a
                href="https://facebook.com/TruongDaihocThaiBinhDuong"
                target="_blank"
                rel="noreferrer"
              >
                <FacebookFilled />
              </a>
            </Tooltip>
            <Tooltip title="YouTube TBD">
              <a
                href="https://youtube.com/@tbduniversity"
                target="_blank"
                rel="noreferrer"
              >
                <YoutubeFilled />
              </a>
            </Tooltip>
            <Tooltip title="Website TBD">
              <a href="https://tbd.edu.vn" target="_blank" rel="noreferrer">
                <GlobalOutlined />
              </a>
            </Tooltip>
          </div>
        </section>
      </div>
      <div className="footer-copyright">
        © 2026 - Trường Đại học Thái Bình Dương (TBD). Hệ thống Đặt phòng học trực tuyến.
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname, search]);

  return null;
}

function App() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLoggedIn = Boolean(localStorage.getItem("accessToken"));
  const isLoginPage = location.pathname === "/login";
  const isHomePage = location.pathname === "/";

  // Tác vụ nền kiểm tra hạn nhận phòng (No-show auto expire) và nhắc duyệt khẩn cấp
  useBookingMaintenanceWorker();

  // 1. Trích xuất thông tin người dùng thực tế từ API GET /api/auth/me
  const { data: userProfile } = useQuery<UserProfileData>({
    queryKey: ['user-profile'],
    queryFn: async () => {
      try {
        const res = await http.get('/api/auth/me');
        if (res.data) {
          const email = getUserEmail();
          const hasFullInfo = Boolean(
            res.data.fullName?.trim() &&
            res.data.phoneNumber?.trim() &&
            res.data.department?.trim()
          );
          const merged = { ...res.data, isProfileComplete: hasFullInfo };
          localStorage.setItem(`tbd_user_profile_${(email || 'default').toLowerCase().trim()}`, JSON.stringify(merged));
          return merged;
        }
      } catch (err) {
        console.warn('API /api/auth/me chưa phản hồi, sử dụng bộ nhớ cache', err);
      }
      return fetchUserProfile();
    },
    enabled: isLoggedIn,
  });

  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Kiểm tra xem hồ sơ đã có số điện thoại liên hệ chưa (các thông tin định danh do Admin cấp đã có sẵn)
  const isProfileIncomplete = Boolean(
    isLoggedIn &&
    userProfile &&
    !userProfile.phoneNumber?.trim()
  );

  const userRole = getUserRole();
  const isAdmin = isLoggedIn && (userRole === "admin" || userProfile?.role === "Admin" || String(userProfile?.role).toLowerCase() === "admin");
  const isApprover = isLoggedIn && (
    userRole === "approver" ||
    userProfile?.role === "Approver" ||
    String(userProfile?.role).toLowerCase() === "approver" ||
    String(userProfile?.role).toLowerCase() === "manager" ||
    String(userProfile?.role).toLowerCase() === "quanly" ||
    String(userProfile?.role).toLowerCase() === "staff"
  );
  const canAccessAdminPage = isAdmin || isApprover;

  const navigationItems = [
    { to: "/", label: "Trang chủ" },
    { to: "/calendar", label: "Lịch phòng" },
    { to: "/bookings", label: "Đặt phòng" },
    { to: "/rooms", label: "Thông tin phòng" },
    { to: "/booking-history", label: "Lịch sử đặt" },
    { to: "/report-issue", label: "Báo cáo sự cố" },
    ...(canAccessAdminPage
      ? [
          {
            to: "/approvals",
            label: "Duyệt yêu cầu",
          },
          {
            to: "/admin",
            label: isAdmin ? "Quản trị" : "Quản lý ĐT & CSVC",
          },
        ]
      : []),
  ];

  const displayName = isAdmin
    ? "Admin"
    : (userProfile?.fullName || getUserEmail() || "Hồ sơ cá nhân");

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 32);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  const logout = () => {
    queryClient.clear();
    localStorage.removeItem("accessToken");
    localStorage.removeItem("testRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("tbd_admin_bookings");
    localStorage.removeItem("tbd_admin_rooms");
    navigate("/login");
  };

  const activePath = location.pathname;

  if (isLoginPage) {
    return (
      <>
        <ScrollToTop />
        <LoginPage />
      </>
    );
  }

  return (
    <Layout className="app-shell">
      <ScrollToTop />
      <header
        className={`tbd-navbar ${isHomePage && !scrolled ? "tbd-navbar--overlay" : "tbd-navbar--solid"}`}
      >
        <Link to="/" className="tbd-brand" aria-label="Đại học Thái Bình Dương">
          <img 
            src={STATIC_IMAGES.logo} 
            alt="Logo Đại học Thái Bình Dương" 
            onError={(e) => handleImageFallback(e, "/images/logo.png")}
          />
          <span>
            <strong>
              Đại học
              <br />
              Thái Bình Dương
            </strong>
            <small>TBD University</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {navigationItems.map((item) => (
            <Link
              className={`nav-item ${activePath === item.to.split("?")[0] && !(item.to.includes("?") && !location.search.includes("history")) ? "active" : ""}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          {isLoggedIn && <NotificationBell />}

          {isLoggedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 'max-content' }}>
              <Tooltip title={isAdmin ? "Tài khoản Quản trị viên (Admin)" : "Xem và cập nhật Hồ sơ cá nhân"}>
                <Button
                  type="text"
                  className="nav-user-button nav-user-button-desktop"
                  icon={<UserOutlined style={{ color: isProfileIncomplete && !isAdmin ? '#eab308' : '#38bdf8' }} />}
                  onClick={() => setProfileModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    maxWidth: 280,
                  }}
                >
                  <span
                    className="user-email-text"
                    title={displayName}
                    style={{
                      maxWidth: 220,
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                    }}
                  >
                    {displayName}
                  </span>
                  {isProfileIncomplete && !isAdmin && (
                    <span 
                      style={{ 
                        width: 7, 
                        height: 7, 
                        borderRadius: '50%', 
                        backgroundColor: '#ef4444', 
                        marginLeft: 4,
                        display: 'inline-block',
                        flexShrink: 0
                      }} 
                      title="Hồ sơ chưa hoàn thiện"
                    />
                  )}
                </Button>
              </Tooltip>
              <Tooltip title="Đăng xuất">
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                  aria-label="Đăng xuất"
                  style={{ color: '#ef4444', minWidth: 32, padding: '0 6px', flexShrink: 0 }}
                />
              </Tooltip>
            </div>
          ) : (
            <Button
              type="text"
              className="nav-user-button"
              icon={<UserOutlined />}
              onClick={() => navigate("/login")}
            >
              Đăng nhập
            </Button>
          )}
          <Button
            className="mobile-menu-button"
            type="text"
            icon={<MenuOutlined />}
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
          />
        </div>
      </header>

      <Drawer
        className="mobile-nav-drawer"
        title="TBD University"
        closeIcon={<CloseOutlined />}
        open={menuOpen}
        placement="right"
        onClose={() => setMenuOpen(false)}
      >
        <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
          {isLoggedIn && (
            <div 
              onClick={() => {
                setMenuOpen(false);
                setProfileModalOpen(true);
              }}
              style={{ 
                padding: '12px', 
                marginBottom: '16px', 
                background: '#f8fafc', 
                borderRadius: '8px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                cursor: 'pointer',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserOutlined style={{ fontSize: '20px', color: '#0d2e5c' }} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Hồ sơ người dùng</span>
                  {isProfileIncomplete && <Tag color="warning" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>Chưa hoàn tất</Tag>}
                </div>
                <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </div>
                <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: 2 }}>
                  <EditOutlined /> Cập nhật thông tin ›
                </div>
              </div>
            </div>
          )}
          {navigationItems.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.label}
            </Link>
          ))}
          <Button
            type="primary"
            icon={isLoggedIn ? <LogoutOutlined /> : <LoginOutlined />}
            onClick={() => {
              setMenuOpen(false);
              if (isLoggedIn) logout();
              else navigate('/login');
            }}
            style={{ marginTop: '24px' }}
          >
            {isLoggedIn ? 'Đăng xuất' : 'Đăng nhập'}
          </Button>
        </nav>
      </Drawer>

      <Content style={{ paddingTop: isHomePage ? 0 : "85px" }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route
            path="/calendar"
            element={
              isLoggedIn ? (
                <CalendarPage />
              ) : (
                <Navigate to="/login?redirect=/calendar" replace />
              )
            }
          />
          <Route
            path="/bookings"
            element={
              isLoggedIn ? (
                <BookingPage />
              ) : (
                <Navigate
                  to={`/login?redirect=/bookings${location.search}`}
                  replace
                />
              )
            }
          />
          <Route
            path="/booking-history"
            element={
              isLoggedIn ? (
                <BookingHistoryPage />
              ) : (
                <Navigate to={`/login?redirect=/booking-history`} replace />
              )
            }
          />
          <Route
            path="/admin"
            element={
              isLoggedIn ? (
                <AdminPage />
              ) : (
                <Navigate to="/login?redirect=/admin" replace />
              )
            }
          />
          <Route
            path="/approvals"
            element={
              isLoggedIn ? (
                <ApprovalsPage />
              ) : (
                <Navigate to="/login?redirect=/approvals" replace />
              )
            }
          />
          <Route
            path="/report-issue"
            element={
              isLoggedIn ? (
                <ReportIssuePage />
              ) : (
                <Navigate to="/login?redirect=/report-issue" replace />
              )
            }
          />
          <Route
            path="/notifications"
            element={
              isLoggedIn ? (
                <NotificationsPage />
              ) : (
                <Navigate to="/login?redirect=/notifications" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
      <SiteFooter />

      {/* Nút cố định chuyển nhanh lên đầu trang (Back to top) */}
      <FloatButton.BackTop
        tooltip="Lên đầu trang"
        visibilityHeight={200}
        icon={<VerticalAlignTopOutlined style={{ color: '#ffffff', fontSize: 16 }} />}
        style={{
          right: 24,
          bottom: 24,
          width: 44,
          height: 44,
          boxShadow: '0 4px 16px rgba(13, 46, 92, 0.35)',
        }}
      />

      <UserProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        userProfile={userProfile}
        isMandatory={false}
      />
    </Layout>
  );
}

export default App;
