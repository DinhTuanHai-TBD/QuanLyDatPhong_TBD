import { getUserEmail } from "./api/authUtils";
import {
  CheckCircleOutlined,
  CalendarOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  GlobalOutlined,
  HistoryOutlined,
  LoginOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuOutlined,
  PhoneOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  ToolOutlined,
  YoutubeFilled,
  FormOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { Button, Drawer, Layout, Tooltip, Dropdown } from "antd";
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
import BookingPage from "./features/bookings/BookingPage";
import BookingHistoryPage from "./features/bookings/BookingHistoryPage";
import HomePage from "./features/home/HomePage";
import LoginPage from "./features/auth/LoginPage";
import RoomsPage from "./features/rooms/RoomsPage";
import AdminPage from "./features/admin/AdminPage";
import ApprovalsPage from "./features/approvals/ApprovalsPage";
import CalendarPage from "./features/calendar/CalendarPage";
import ReportIssuePage from "./features/issues/ReportIssuePage";
import { getUserRole } from "./api/authUtils";

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

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLoggedIn = Boolean(localStorage.getItem("accessToken"));
  const isLoginPage = location.pathname === "/login";
  const isHomePage = location.pathname === "/";

  const userRole = getUserRole();
  const isAdmin = isLoggedIn && userRole === "admin";
  const isApprover = isLoggedIn && userRole === "approver";
  const canAccessAdminPage = isAdmin || isApprover;

  const activeNavigationItems = [
    { to: "/", label: "Trang chủ", icon: <GlobalOutlined /> },
    { to: "/calendar", label: "Lịch phòng", icon: <CalendarOutlined /> },
    { to: "/bookings", label: "Đặt phòng", icon: <FormOutlined /> },
    { to: "/rooms", label: "Thông tin phòng", icon: <TeamOutlined /> },
    {
      to: "/booking-history",
      label: "Lịch sử đặt phòng",
      icon: <HistoryOutlined />,
    },
    { to: "/report-issue", label: "Báo cáo sự cố", icon: <ToolOutlined /> },
    ...(canAccessAdminPage
      ? [
          {
            to: "/approvals",
            label: "Duyệt yêu cầu",
            icon: <CheckCircleOutlined />,
          },
          { to: "/admin", label: "Quản trị", icon: <SettingOutlined /> },
        ]
      : []),
  ];

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
    return <LoginPage />;
  }

  return (
    <Layout className="app-shell">
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
          {activeNavigationItems.map((item, index) => (
            <Link
              className={`nav-item ${activePath === item.to.split("?")[0] && !(item.to.includes("?") && !location.search.includes("history")) ? "active" : ""} ${index >= 4 ? "nav-item-more" : ""}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
          {activeNavigationItems.length > 4 && (
            <Dropdown
              menu={{
                items: activeNavigationItems.slice(4).map((item) => ({
                  key: item.to,
                  label: (
                    <Link
                      to={item.to}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      {item.icon} {item.label}
                    </Link>
                  ),
                })),
              }}
              placement="bottomRight"
            >
              <a
                className="nav-item nav-more-dropdown"
                onClick={(e) => e.preventDefault()}
                style={{ cursor: "pointer" }}
              >
                Thêm <DownOutlined style={{ fontSize: 12, marginLeft: 2 }} />
              </a>
            </Dropdown>
          )}
        </nav>

        <div
          className="nav-actions"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          {isLoggedIn && <NotificationBell />}

          {isLoggedIn ? (
            <>
              <Tooltip title={getUserEmail()}>
                <Button
                  type="text"
                  className="nav-user-button nav-user-button-desktop"
                  icon={<LogoutOutlined />}
                  onClick={logout}
                >
                  <span className="user-email-text">
                    {getUserEmail() || "Đăng xuất"}
                  </span>
                </Button>
              </Tooltip>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "email",
                      label: <strong>{getUserEmail()}</strong>,
                      disabled: true,
                    },
                    { type: "divider" },
                    {
                      key: "logout",
                      label: "Đăng xuất",
                      icon: <LogoutOutlined />,
                      onClick: logout,
                    },
                  ],
                }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button
                  type="text"
                  className="nav-user-button user-dropdown-trigger"
                  icon={<UserOutlined />}
                />
              </Dropdown>
            </>
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
            <div style={{ padding: '12px', marginBottom: '16px', background: '#f8fafc', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserOutlined style={{ fontSize: '20px', color: '#64748b' }} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Tài khoản</div>
                <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getUserEmail()}
                </div>
              </div>
            </div>
          )}
          {activeNavigationItems.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
              {item.icon} {item.label}
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Content>
      <SiteFooter />
    </Layout>
  );
}

export default App;
