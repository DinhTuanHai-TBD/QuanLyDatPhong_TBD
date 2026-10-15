const fs = require('fs');

let file = fs.readFileSync('src/features/home/HomePage.tsx', 'utf8');

// Replace icon import
file = file.replace(/HistoryOutlined,/, 'HistoryOutlined,\n  ToolOutlined,');

// Replace card content
const oldCard = `<Col xs={24} sm={12} lg={6}>
              <div className="feature-card" onClick={() => handleNavigate('/booking-history', true)}>
                <div className="feature-icon-wrapper">
                  <HistoryOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Theo dõi yêu cầu</h3>
                <p className="feature-desc">Theo dõi phê duyệt và lịch sử đặt phòng.</p>
              </div>
            </Col>`;

const newCard = `<Col xs={24} sm={12} lg={6}>
              <div className="feature-card" onClick={() => handleNavigate('/report-issue', true)}>
                <div className="feature-icon-wrapper">
                  <ToolOutlined className="feature-icon" />
                </div>
                <h3 className="feature-title">Báo sự cố</h3>
                <p className="feature-desc">Thông báo nhanh sự cố phòng học hoặc thiết bị để được hỗ trợ kịp thời.</p>
              </div>
            </Col>`;

file = file.replace(oldCard, newCard);
fs.writeFileSync('src/features/home/HomePage.tsx', file);
