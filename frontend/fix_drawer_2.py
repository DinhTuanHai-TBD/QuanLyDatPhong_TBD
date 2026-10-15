import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace the content of the Drawer
start_tag = '<nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">'
end_tag = '</nav>'

start_idx = content.find(start_tag)
end_idx = content.find(end_tag, start_idx) + len(end_tag)

new_drawer = """<nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
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
        </nav>"""

content = content[:start_idx] + new_drawer + content[end_idx:]

with open('src/App.tsx', 'w') as f:
    f.write(content)
