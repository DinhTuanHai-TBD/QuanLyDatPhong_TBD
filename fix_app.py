import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Button, Drawer, Layout, Tooltip, } from 'antd'", "import { Button, Drawer, Layout, Tooltip, Dropdown } from 'antd'")
content = content.replace("  FormOutlined\n} from '@ant-design/icons'", "  FormOutlined,\n  DownOutlined\n} from '@ant-design/icons'")

old_nav = """        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {activeNavigationItems.map((item) => (
            <Link
              className={activePath === item.to.split('?')[0] && !(item.to.includes('?') && !location.search.includes('history')) ? 'active' : ''}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>"""

new_nav = """        <nav className="desktop-nav" aria-label="Điều hướng chính">
          {activeNavigationItems.map((item, index) => (
            <Link
              className={`nav-item ${activePath === item.to.split('?')[0] && !(item.to.includes('?') && !location.search.includes('history')) ? 'active' : ''} ${index >= 4 ? 'nav-item-more' : ''}`}
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
          {activeNavigationItems.length > 4 && (
            <Dropdown 
              menu={{ 
                items: activeNavigationItems.slice(4).map(item => ({
                  key: item.to,
                  label: <Link to={item.to} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{item.icon} {item.label}</Link>
                })) 
              }} 
              placement="bottomRight"
            >
              <a className="nav-item nav-more-dropdown" onClick={(e) => e.preventDefault()} style={{ cursor: 'pointer' }}>
                Thêm <DownOutlined style={{ fontSize: 12, marginLeft: 2 }} />
              </a>
            </Dropdown>
          )}
        </nav>"""

content = content.replace(old_nav, new_nav)

old_actions = """          {isLoggedIn ? (
            <Button type="text" className="nav-user-button" icon={<LogoutOutlined />} onClick={logout}>
              <span className="user-email-text">{getUserEmail() || 'Đăng xuất'}</span>
            </Button>
          ) : ("""

new_actions = """          {isLoggedIn ? (
            <>
              <Tooltip title={getUserEmail()}>
                <Button type="text" className="nav-user-button nav-user-button-desktop" icon={<LogoutOutlined />} onClick={logout}>
                  <span className="user-email-text">{getUserEmail() || 'Đăng xuất'}</span>
                </Button>
              </Tooltip>
              <Dropdown 
                menu={{ 
                  items: [
                    { key: 'email', label: <strong>{getUserEmail()}</strong>, disabled: true },
                    { type: 'divider' },
                    { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, onClick: logout }
                  ] 
                }} 
                placement="bottomRight"
                trigger={['click']}
              >
                <Button type="text" className="nav-user-button user-dropdown-trigger" icon={<UserOutlined />} />
              </Dropdown>
            </>
          ) : ("""

content = content.replace(old_actions, new_actions)

with open('src/App.tsx', 'w') as f:
    f.write(content)
