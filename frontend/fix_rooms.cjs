const fs = require('fs');

let file = fs.readFileSync('src/features/rooms/RoomsPage.tsx', 'utf8');

file = file.replace(/import \{ InfoCircleOutlined \} from '@ant-design\/icons'/, "import { InfoCircleOutlined, ToolOutlined } from '@ant-design/icons'");

const oldModalFooter = `footer={[
          <Button key="close" onClick={() => setSelectedRoom(null)}>Đóng</Button>,
          <Button 
            key="book" 
            type="primary" 
            icon={<CalendarOutlined />}
            style={{ background: '#0d2e5c', borderColor: '#0d2e5c' }}
            disabled={selectedRoom ? (String(selectedRoom.status) !== '0' && selectedRoom.status !== 'Active') : false}
            onClick={() => {
              if (selectedRoom) {
                if (isLoggedIn) {
                  navigate(\`/bookings?roomId=\${selectedRoom.id}\`)
                } else {
                  navigate(\`/login?redirect=/bookings?roomId=\${selectedRoom.id}\`)
                }
              }
            }}
          >
            Đặt phòng này
          </Button>
        ]}`;

const newModalFooter = `footer={[
          <Button key="close" onClick={() => setSelectedRoom(null)}>Đóng</Button>,
          <Button 
            key="report"
            danger
            icon={<ToolOutlined />}
            onClick={() => {
              if (selectedRoom) {
                const target = \`/report-issue?roomId=\${selectedRoom.id}\`;
                if (isLoggedIn) {
                  navigate(target);
                } else {
                  navigate(\`/login?redirect=\${encodeURIComponent(target)}\`);
                }
              }
            }}
          >
            Báo sự cố
          </Button>,
          <Button 
            key="book" 
            type="primary" 
            icon={<CalendarOutlined />}
            style={{ background: '#0d2e5c', borderColor: '#0d2e5c' }}
            disabled={selectedRoom ? (String(selectedRoom.status) !== '0' && selectedRoom.status !== 'Active') : false}
            onClick={() => {
              if (selectedRoom) {
                const target = \`/bookings?roomId=\${selectedRoom.id}\`;
                if (isLoggedIn) {
                  navigate(target)
                } else {
                  navigate(\`/login?redirect=\${encodeURIComponent(target)}\`)
                }
              }
            }}
          >
            Đặt phòng này
          </Button>
        ]}`;

file = file.replace(oldModalFooter, newModalFooter);

const oldButtons = `<div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Button 
                        icon={<InfoCircleOutlined />}
                        onClick={() => setSelectedRoom(room)}
                        style={{ 
                          flex: '1 1 calc(50% - 4px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                        }}
                      >
                        Chi tiết
                      </Button>
                      <Button 
                        type={isAvailable ? "primary" : "dashed"}
                        disabled={!isAvailable}
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          if (isLoggedIn) {
                            navigate(\`/bookings?roomId=\${room.id}\`)
                          } else {
                            navigate(\`/login?redirect=/bookings?roomId=\${room.id}\`)
                          }
                        }}
                        style={{ 
                          flex: '1 1 calc(50% - 4px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: isAvailable ? '#0d2e5c' : undefined,
                          borderColor: isAvailable ? '#0d2e5c' : undefined,
                        }}
                      >
                        Đặt phòng
                      </Button>
                    </div>`;

const newButtons = `<div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      <Button 
                        icon={<InfoCircleOutlined />}
                        onClick={() => setSelectedRoom(room)}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                        }}
                      >
                        Chi tiết
                      </Button>
                      <Button 
                        danger
                        icon={<ToolOutlined />}
                        onClick={() => {
                          const target = \`/report-issue?roomId=\${room.id}\`;
                          if (isLoggedIn) {
                            navigate(target);
                          } else {
                            navigate(\`/login?redirect=\${encodeURIComponent(target)}\`);
                          }
                        }}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                        }}
                      >
                        Sự cố
                      </Button>
                      <Button 
                        type={isAvailable ? "primary" : "dashed"}
                        disabled={!isAvailable}
                        icon={<CalendarOutlined />}
                        onClick={() => {
                          const target = \`/bookings?roomId=\${room.id}\`;
                          if (isLoggedIn) {
                            navigate(target)
                          } else {
                            navigate(\`/login?redirect=\${encodeURIComponent(target)}\`)
                          }
                        }}
                        style={{ 
                          flex: '1 1 calc(33% - 6px)', 
                          height: 40,
                          fontWeight: 600,
                          borderRadius: 6,
                          background: isAvailable ? '#0d2e5c' : undefined,
                          borderColor: isAvailable ? '#0d2e5c' : undefined,
                        }}
                      >
                        Đặt phòng
                      </Button>
                    </div>`;

file = file.replace(oldButtons, newButtons);

fs.writeFileSync('src/features/rooms/RoomsPage.tsx', file);
