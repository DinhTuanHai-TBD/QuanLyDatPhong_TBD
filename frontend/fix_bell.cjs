const fs = require('fs');

let file = fs.readFileSync('src/features/notifications/NotificationBell.tsx', 'utf8');
file = file.replace("import { Badge, Drawer, List, Button, Spin } from 'antd';", "import { Badge, Drawer, Button, Spin } from 'antd';");

const oldList = `<List
            dataSource={notifications}
            renderItem={item => (
              <List.Item
                style={{
                  cursor: 'pointer',
                  padding: '16px 24px',
                  backgroundColor: item.read ? '#ffffff' : '#eff6ff',
                  borderBottom: '1px solid #e2e8f0',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => handleNotificationClick(item)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.read ? '#f8fafc' : '#e0f2fe'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = item.read ? '#ffffff' : '#eff6ff'}
              >
                <List.Item.Meta
                  avatar={<div style={{ fontSize: 24, marginTop: 4 }}>{getIcon(item.type)}</div>}
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: item.read ? 500 : 700, color: '#0f172a' }}>{item.title}</span>
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{item.message}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{dayjs(item.createdAt).fromNow()}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />`;

const newList = `<div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map(item => (
              <div
                key={item.id}
                style={{
                  cursor: 'pointer',
                  padding: '16px 24px',
                  backgroundColor: item.read ? '#ffffff' : '#eff6ff',
                  borderBottom: '1px solid #e2e8f0',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  gap: 16
                }}
                onClick={() => handleNotificationClick(item)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.read ? '#f8fafc' : '#e0f2fe'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = item.read ? '#ffffff' : '#eff6ff'}
              >
                <div style={{ fontSize: 24, marginTop: 4 }}>{getIcon(item.type)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: item.read ? 500 : 700, color: '#0f172a' }}>{item.title}</span>
                  </div>
                  <div>
                    <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{item.message}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{dayjs(item.createdAt).fromNow()}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>`;

file = file.replace(oldList, newList);
fs.writeFileSync('src/features/notifications/NotificationBell.tsx', file);
