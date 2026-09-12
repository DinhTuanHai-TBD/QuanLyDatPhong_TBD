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
} from "@ant-design/icons";
import { Button, Drawer, Layout, Tooltip, Tag } from "antd";
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
import { useQuery } from "@tanstack/react-query";
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

const { Content } = Layout;

function SiteFooter() {
  return (
    <footer className="footer-dark">
      <div className="footer-content">
        <section>
          <h3>ĐH Thái Bình Dương</h3>
          <p>Hệ thống đặt phòng thông minh.</p>
          <ul>
            <li>
              <EnvironmentOutlined /> 08 Pasteur, Xương Huân, Nha Trang
            </li>
            <li>
              <PhoneOutlined /> 0258 3727 147
            </li>
            <li>
              <MailOutlined /> tuyensinh@tbd.edu.vn
            </li>
          </ul>
        </section>
        <section>
          <h3>Liên kết</h3>
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
          </ul>
        </section>
        <section>
          <h3>Hỗ trợ</h3>
          <ul className="footer-links">
            <li>
              <Link to="/login">Tài khoản</Link>
            </li>
            <li>
              <Link to="/booking-history">Lịch phòng của tôi</Link>
            </li>
            <li>
              <Link to="/report-issue">Báo cáo sự cố</Link>
            </li>
          </ul>
        </section>
        <section>
          <h3>Kết nối</h3>
          <p>Theo dõi chúng tôi:</p>
          <div className="social-links" aria-label="Kênh mạng xã hội TBD">
            <Tooltip title="Facebook">
              <a
                href="https://www.facebook.com/daihocTBD"
                target="_blank"
                rel="noreferrer"
              >
                <FacebookFilled />
              </a>
            </Tooltip>
            <Tooltip title="YouTube">
              <a
                href="https://www.youtube.com"
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
        © 2025 - TBD Room Booking. All Rights Reserved.
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
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLoggedIn = Boolean(localStorage.getItem("accessToken"));
  const isLoginPage = location.pathname === "/login";
  const isHomePage = location.pathname === "/";

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

  // Kiểm tra xem hồ sơ có thiếu thông tin không:
  // Nếu tài khoản đã có đầy đủ Họ và tên, Khoa / Phòng ban, và Số điện thoại thì KHÔNG tự động bật Modal
  const isProfileIncomplete = Boolean(
    isLoggedIn &&
    userProfile &&
    (!userProfile.fullName?.trim() ||
      !userProfile.phoneNumber?.trim() ||
      !userProfile.department?.trim())
  );

  // 2. Tự động hiển thị Modal "Hoàn thiện Hồ sơ" khi tài khoản mới tạo và còn thiếu một trong các thông tin trên
  useEffect(() => {
    if (isLoggedIn && userProfile && !isLoginPage) {
      if (isProfileIncomplete) {
        setProfileModalOpen(true);
      }
    }
  }, [isLoggedIn, userProfile, isLoginPage, isProfileIncomplete]);

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
    localStorage.removeItem("accessToken");
    localStorage.removeItem("testRole"); // Clean test role on logout
    navigate("/");
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
          <img src="/images/logo.png" alt="Logo Đại học Thái Bình Dương" />
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
                    maxWidth: 140,
                  }}
                >
                  <span
                    className="user-email-text"
                    style={{
                      maxWidth: 90,
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
          <Route path="/calendar" element={<CalendarPage />} />
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

      <UserProfileModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        userProfile={userProfile}
        isMandatory={isProfileIncomplete}
      />
    </Layout>
  );
}

export default App;
