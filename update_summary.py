import re

with open('src/features/bookings/BookingPage.tsx', 'r') as f:
    content = f.read()

old_summary = r"""                  \{\(!selectedRoom \|\| !startTime \|\| !endTime\) \? \(
                    <div style=\{\{ color: '#94a3b8', fontSize: 13, marginBottom: 16 \}\}>
                      Vui lòng chọn phòng và thời gian trên bảng để xem tóm tắt\.
                    </div>
                  \) : \(
                    <div style=\{\{ fontSize: 13, color: '#475569', marginBottom: 16 \}\}>
                      <div><strong>Phòng:</strong> \{selectedRoom\.name\}</div>
                      <div><strong>Ngày:</strong> \{selectedDate\.format\('DD/MM/YYYY'\)\}</div>
                      <div><strong>Thời gian:</strong> \{startTime\} - \{endTime\} \(Tổng \{currentDuration\?\.toFixed\(1\)\} giờ\)</div>
                    </div>
                  \)\}"""

new_summary = r"""                  <Form.Item shouldUpdate style={{ marginBottom: 16 }}>
                    {() => {
                      const values = form.getFieldsValue();
                      if (!selectedRoom || !startTime || !endTime) {
                        return (
                          <div style={{ color: '#94a3b8', fontSize: 13 }}>
                            Vui lòng chọn phòng và thời gian trên bảng để xem tóm tắt.
                          </div>
                        );
                      }
                      
                      const eq = values.requestedEquipments || [];
                      
                      return (
                        <div style={{ fontSize: 13, color: '#475569' }}>
                          <Row gutter={8}>
                            <Col span={12}>
                              <div><strong>Phòng:</strong> {selectedRoom.name}</div>
                              <div><strong>Ngày:</strong> {selectedDate.format('DD/MM/YYYY')}</div>
                            </Col>
                            <Col span={12}>
                              <div><strong>Thời gian:</strong> {startTime} - {endTime} ({currentDuration?.toFixed(1)}h)</div>
                              <div><strong>Số người:</strong> {values.participantCount || 0}</div>
                            </Col>
                          </Row>
                          {eq.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <strong>Thiết bị:</strong> {eq.join(', ')}
                            </div>
                          )}
                        </div>
                      );
                    }}
                  </Form.Item>"""

content = re.sub(old_summary, new_summary, content, flags=re.DOTALL)

with open('src/features/bookings/BookingPage.tsx', 'w') as f:
    f.write(content)
