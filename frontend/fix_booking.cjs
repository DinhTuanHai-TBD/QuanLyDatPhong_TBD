const fs = require('fs');

let file = fs.readFileSync('BookingPage.tsx.bak', 'utf8');

// 1. Imports
file = file.replace(/Checkbox, Modal \} from 'antd'/, "Checkbox, Modal, Collapse } from 'antd'");

// 2. Remove states
file = file.replace(/const \[confirmModalVisible.*?\n/, "");
file = file.replace(/const \[pendingSubmitValues.*?\n/, "");
file = file.replace(/const \[agreedInModal.*?\n/, "");

// 3. Replace submitBooking and doSubmitBooking
const startSubmit = file.indexOf('  const submitBooking = (values: SubmitFormValues) => {');
const endSubmit = file.indexOf('  const handleBookingSuccess = ');

const newSubmitLogic = `  const submitBooking = (values: SubmitFormValues) => {
    if (!values.agreedToRules) {
      message.error('Vui lòng đồng ý với nội quy sử dụng phòng.');
      return;
    }
    if (checkLimitQuery.data && !checkLimitQuery.data.canBook) {
      message.error('Vượt quá giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }
    if (checkLimitQuery.error) {
      message.error('Không thể kiểm tra giới hạn đặt phòng, không thể gửi yêu cầu.');
      return;
    }

    if (!selectedRoom) return;
    if (!startTime || !endTime) {
      message.error('Vui lòng chọn đầy đủ thời gian bắt đầu và kết thúc trên bảng.');
      return;
    }

    const st = dayjs(\`\${values.date.format('YYYY-MM-DD')} \${startTime}\`);
    const et = dayjs(\`\${values.date.format('YYYY-MM-DD')} \${endTime}\`);

    if (et.isSameOrBefore(st)) {
      message.error('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }

    if (values.participantCount > selectedRoom.capacity) {
      message.error(\`Số lượng người vượt quá sức chứa của phòng (\${selectedRoom.capacity} người).\`);
      return;
    }

    const limitViolations = checkTimeLimits(values.date, startTime, endTime, getUserRole(), selectedRoom.roomType);

    const newBooking: Booking = {
      id: Date.now(),
      roomId: selectedRoom.id,
      roomName: selectedRoom.name,
      startTime: st.toISOString(),
      endTime: et.toISOString(),
      purpose: values.purpose,
      status: limitViolations.length > 0 ? 'PendingSpecial' : 'Pending',
      participantCount: values.participantCount,
      requestedEquipments: values.requestedEquipments || [],
      department: values.department,
      personInCharge: values.personInCharge,
      notes: values.notes,
      isSpecialRequest: limitViolations.length > 0,
      specialRequestReason: values.specialRequestReason,
      userEmail: userEmail,
    };

    createMutation.mutate({
      roomId: selectedRoom.id,
      startTime: st.toISOString(),
      endTime: et.toISOString(),
      purpose: values.purpose,
      participantCount: values.participantCount,
      requestedEquipments: values.requestedEquipments,
      isSpecialRequest: limitViolations.length > 0,
      specialRequestReason: values.specialRequestReason,
      agreedToRules: values.agreedToRules,
    }, {
      onSuccess: () => {
        handleBookingSuccess(newBooking, userEmail);
      },
      onError: (err: any) => {
        console.error(err);
        const backendError = err.response?.data?.error || err.response?.data?.message || err.message;
        message.error('Đặt phòng thất bại: ' + backendError);
      }
    });
  }

`;

file = file.substring(0, startSubmit) + newSubmitLogic + file.substring(endSubmit);

// 4. Form and Layout
const formStartStr = '      <Row gutter={[32, 32]}>\n        <Col xs={24} lg={8}>';
const formEndStr = '            </Form>\n          </Card>\n        </Col>\n        <Col xs={24} lg={16}>';

const formStart = file.indexOf(formStartStr);
const formEnd = file.indexOf(formEndStr) + formEndStr.length;

if (formStart === -1 || formEnd === -1) {
    console.error("Layout tokens not found");
    process.exit(1);
}

const newLayout = `      <Row gutter={[32, 32]}>
        <Col xs={24} lg={10}>
          <div style={{ position: 'sticky', top: 24, zIndex: 1 }}>
            <Card 
              title={<strong style={{ color: '#0d2e5c' }}><InfoCircleOutlined /> Thông tin đặt phòng</strong>}
              style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}
              styles={{ body: { padding: 0 } }}
            >
              <Form form={form} layout="vertical" onFinish={submitBooking} initialValues={{ date: selectedDate }}>
                <Collapse 
                  defaultActiveKey={['1', '2']} 
                  ghost 
                  expandIconPosition="end"
                  items={[
                    {
                      key: '1',
                      label: <strong style={{ color: '#0f172a' }}>1. Thông tin buổi đặt</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Row gutter={16}>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Phòng</strong>} 
                                name="roomId"
                                rules={[{ required: true, message: 'Vui lòng chọn phòng!' }]}
                              >
                                <Select 
                                  placeholder="Chọn phòng" 
                                  showSearch 
                                  optionFilterProp="children"
                                  filterOption={(input, option) => (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())}
                                  options={rooms.map((r) => ({
                                    value: r.id,
                                    label: \`Phòng \${r.name} - \${r.building}\`
                                  }))}
                                  onChange={(val) => {
                                    setSearchParams({ roomId: String(val) })
                                    setStartTime(null)
                                    setEndTime(null)
                                  }}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Ngày sử dụng</strong>} 
                                name="date"
                                rules={[{ required: true, message: 'Vui lòng chọn ngày!' }]}
                              >
                                <DatePicker 
                                  format="DD/MM/YYYY" 
                                  style={{ width: '100%' }} 
                                  onChange={(d) => {
                                    if (d) setSelectedDate(d)
                                    setStartTime(null)
                                    setEndTime(null)
                                  }}
                                  disabledDate={current => current && current < dayjs().startOf('day')}
                                />
                              </Form.Item>
                            </Col>
                          </Row>

                          {selectedRoom && (
                            <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                                {selectedRoom.imageUrl ? (
                                  <img src={selectedRoom.imageUrl} alt={selectedRoom.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                                ) : (
                                  <div style={{ width: 48, height: 48, background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <EnvironmentOutlined style={{ color: '#94a3b8', fontSize: 20 }} />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600, color: '#0d2e5c', fontSize: 14 }}>{selectedRoom.name}</div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>{selectedRoom.building} | <TeamOutlined /> {selectedRoom.capacity} người</div>
                                </div>
                              </div>
                              {roomEquipments.length > 0 && <div style={{ fontSize: 12, color: '#475569' }}><strong>Thiết bị có sẵn:</strong> {roomEquipments.join(', ')}</div>}
                            </div>
                          )}

                          <Row gutter={16}>
                            <Col xs={24} sm={8}>
                              <Form.Item label={<strong style={{ color: '#334155' }}>Giờ bắt đầu</strong>} name="startTime" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                                <Input readOnly placeholder="00:00" value={startTime || ''} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item label={<strong style={{ color: '#334155' }}>Giờ kết thúc</strong>} name="endTime" rules={[{ required: true, message: 'Chọn giờ!' }]}>
                                <Input readOnly placeholder="00:00" value={endTime || ''} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={8}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Số người</strong>} 
                                name="participantCount"
                                rules={[{ required: true, message: 'Nhập số!' }]}
                              >
                                <InputNumber min={1} max={500} style={{ width: '100%' }} placeholder="VD: 40" />
                              </Form.Item>
                            </Col>
                          </Row>

                          {limitViolations.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                              <Alert
                                type="warning"
                                showIcon
                                title={<strong style={{ color: '#9a3412' }}>Yêu cầu phê duyệt đặc biệt</strong>}
                                description={
                                  <div>
                                    <div style={{ marginBottom: 8, color: '#9a3412' }}>Thời gian bạn chọn đã vượt quy định:</div>
                                    <ul style={{ margin: 0, paddingLeft: 20, color: '#9a3412' }}>
                                      {limitViolations.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                  </div>
                                }
                              />
                              <Form.Item
                                label={<strong style={{ color: '#334155' }}>Lý do (Bắt buộc)</strong>}
                                name="specialRequestReason"
                                rules={[{ required: true, message: 'Vui lòng nhập lý do phê duyệt đặc biệt!' }]}
                                style={{ marginTop: 16, marginBottom: 0 }}
                              >
                                <Input.TextArea rows={2} placeholder="Trình bày lý do..." />
                              </Form.Item>
                            </div>
                          )}
                        </div>
                      )
                    },
                    {
                      key: '2',
                      label: <strong style={{ color: '#0f172a' }}>2. Thông tin sử dụng</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Form.Item 
                            label={<strong style={{ color: '#334155' }}>Mục đích sử dụng</strong>} 
                            name="purpose"
                            rules={[{ required: true, message: 'Vui lòng nhập mục đích!' }]}
                          >
                            <Input.TextArea rows={2} placeholder="VD: Họp giao ban, sinh hoạt CLB..." />
                          </Form.Item>

                          <Row gutter={16}>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Lớp, khoa, ban, CLB</strong>} 
                                name="department"
                                rules={[{ required: true, message: 'Vui lòng nhập!' }]}
                              >
                                <Input placeholder="VD: Khoa CNTT..." />
                              </Form.Item>
                            </Col>
                            <Col xs={24} sm={12}>
                              <Form.Item 
                                label={<strong style={{ color: '#334155' }}>Người phụ trách</strong>} 
                                name="personInCharge"
                                rules={[{ required: true, message: 'Vui lòng nhập!' }]}
                              >
                                <Input placeholder="Tên - SĐT" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </div>
                      )
                    },
                    {
                      key: '3',
                      label: <strong style={{ color: '#0f172a' }}>3. Thiết bị và ghi chú</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <Form.Item label={<strong style={{ color: '#334155' }}>Mượn thêm thiết bị</strong>} name="requestedEquipments">
                            <EquipmentSelector 
                              equipments={equipmentsQuery.data || []}
                              allBookings={bookingsQuery.data || []}
                              selectedDate={selectedDate}
                              startTime={startTime}
                              endTime={endTime}
                              selectedRoomId={selectedRoom?.id || null}
                            />
                          </Form.Item>
                          <Form.Item 
                            label={<strong style={{ color: '#334155' }}>Ghi chú</strong>} 
                            name="notes"
                            rules={[{ required: true, message: 'Vui lòng nhập ghi chú (nhập Không có nếu không có)!' }]}
                          >
                            <Input.TextArea rows={2} placeholder="Các yêu cầu khác..." />
                          </Form.Item>
                        </div>
                      )
                    },
                    {
                      key: '4',
                      label: <strong style={{ color: '#0f172a' }}>4. Nội quy sử dụng phòng</strong>,
                      children: (
                        <div style={{ padding: '0 16px' }}>
                          <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', marginBottom: 16 }}>
                            <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#475569', display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <li>Sử dụng đúng mục đích đã đăng ký.</li>
                              <li>Không tự ý chuyển phòng hoặc chuyển quyền sử dụng.</li>
                              <li>Không vượt quá sức chứa.</li>
                              <li>Giữ vệ sinh và trật tự.</li>
                              <li>Không tự ý di chuyển thiết bị.</li>
                              <li>Tuân thủ quy định đồ ăn và thức uống của từng phòng.</li>
                              <li>Tắt điện, điều hòa và thiết bị sau khi sử dụng.</li>
                              <li>Báo ngay khi xảy ra sự cố.</li>
                              <li>Người đặt chịu trách nhiệm đối với hư hỏng do sử dụng sai.</li>
                            </ul>
                          </div>
                          <Form.Item 
                            name="agreedToRules" 
                            valuePropName="checked"
                            rules={[
                              { validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Vui lòng đồng ý với nội quy!')) }
                            ]}
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox><strong style={{ color: '#0d2e5c' }}>Tôi đã đọc và đồng ý với nội quy sử dụng phòng</strong></Checkbox>
                          </Form.Item>
                        </div>
                      )
                    }
                  ]}
                />

                <div style={{ padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                  <Typography.Text strong style={{ display: 'block', marginBottom: 8, color: '#0d2e5c' }}>
                    Tóm tắt yêu cầu
                  </Typography.Text>
                  
                  {(!selectedRoom || !startTime || !endTime) ? (
                    <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
                      Vui lòng chọn phòng và thời gian trên bảng để xem tóm tắt.
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                      <div><strong>Phòng:</strong> {selectedRoom.name}</div>
                      <div><strong>Ngày:</strong> {selectedDate.format('DD/MM/YYYY')}</div>
                      <div><strong>Thời gian:</strong> {startTime} - {endTime} (Tổng {currentDuration?.toFixed(1)} giờ)</div>
                    </div>
                  )}

                  {checkLimitQuery.error && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={<strong style={{ color: '#9a3412', fontSize: 13 }}>Lỗi kiểm tra giới hạn</strong>}
                      description={<div style={{ fontSize: 12 }}>{(checkLimitQuery.error as any).message}</div>}
                    />
                  )}

                  {checkLimitQuery.data && (
                    <Alert
                      type={checkLimitQuery.data.canBook ? 'success' : 'error'}
                      showIcon
                      style={{ marginBottom: 16 }}
                      title={<strong style={{ fontSize: 13 }}>{checkLimitQuery.data.canBook ? 'Đủ điều kiện đặt phòng' : 'Vượt quá giới hạn đặt phòng'}</strong>}
                      description={
                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                          <li>Số yêu cầu chờ: {checkLimitQuery.data.pendingCount}/{checkLimitQuery.data.maxPending}</li>
                          <li>Lượt trong tuần: {checkLimitQuery.data.weeklyApprovedCount}/{checkLimitQuery.data.maxWeeklyApproved}</li>
                          {checkLimitQuery.data.hasOverlap && <li><strong>Trùng lịch!</strong></li>}
                          {!checkLimitQuery.data.canBook && checkLimitQuery.data.reason && <li>Lý do: {checkLimitQuery.data.reason}</li>}
                        </ul>
                      }
                    />
                  )}

                  <Form.Item shouldUpdate style={{ marginBottom: 0 }}>
                    {() => {
                      const agreed = form.getFieldValue('agreedToRules');
                      const disabled = !agreed || !!checkLimitQuery.error || (checkLimitQuery.data && !checkLimitQuery.data.canBook) || checkLimitQuery.isFetching;
                      return (
                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          size="large" 
                          disabled={disabled} 
                          loading={createMutation.isPending || checkLimitQuery.isFetching} 
                          icon={<ThunderboltOutlined />} 
                          style={{ width: '100%', background: disabled ? undefined : '#0d2e5c' }}
                        >
                          Xác Nhận Đặt Phòng
                        </Button>
                      )
                    }}
                  </Form.Item>
                </div>
              </Form>
            </Card>
          </div>
        </Col>
        <Col xs={24} lg={14}>`;

file = file.substring(0, formStart) + newLayout + file.substring(formEnd);

// 5. Remove right column summary
const summaryStart = file.indexOf('{startTime && endTime && (\n                  <Alert \n                    type="info"');
if (summaryStart !== -1) {
    const summaryEnd = file.indexOf(')}', file.indexOf('</Alert>', summaryStart)) + 2;
    file = file.substring(0, summaryStart) + file.substring(summaryEnd);
}

// 6. Remove modal
const modalStart = file.indexOf('<Modal');
if (modalStart !== -1) {
    const modalEnd = file.indexOf('</Modal>', modalStart) + '</Modal>'.length;
    file = file.substring(0, modalStart) + file.substring(modalEnd);
}

fs.writeFileSync('src/features/bookings/BookingPage.tsx', file);
