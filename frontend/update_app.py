import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Replace:
# {isLoggedIn ? (
#   <Button type="text" className="nav-user-button" icon={<LogoutOutlined />} onClick={logout}>Đăng xuất</Button>
# ) : (

old_str = """          {isLoggedIn ? (
            <Button type="text" className="nav-user-button" icon={<LogoutOutlined />} onClick={logout}>Đăng xuất</Button>
          ) : ("""

new_str = """          {isLoggedIn ? (
            <Button type="text" className="nav-user-button" icon={<LogoutOutlined />} onClick={logout}>
              <span className="user-email-text">{getUserEmail() || 'Đăng xuất'}</span>
            </Button>
          ) : ("""

if old_str in content:
    content = content.replace(old_str, new_str)
    
    # ensure getUserEmail is imported
    if "getUserEmail" not in content:
        content = content.replace("import { http } from './api/http'", "import { http } from './api/http'\nimport { getUserEmail } from './api/authUtils'")
    
    with open('src/App.tsx', 'w') as f:
        f.write(content)
    print("Updated App.tsx")
else:
    print("Could not find the target string in App.tsx")

