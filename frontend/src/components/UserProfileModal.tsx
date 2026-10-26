import { useEffect, useState } from 'react'
import { Modal, Form, Input, Button, Alert, Typography, App, Tabs, Tooltip } from 'antd'
import { 
  UserOutlined, 
  PhoneOutlined, 
  BankOutlined, 
  IdcardOutlined, 
  SafetyCertificateOutlined,
  SaveOutlined,
  LockOutlined,
  KeyOutlined,
  CheckCircleOutlined,
  MailOutlined
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateUserProfile, getCachedUserProfile, type UserProfileData } from '../api/userProfile'
import { getUserEmail } from '../api/authUtils'
import { normalizeDepartmentName } from '../utils/academicPrograms'
import { changePassword } from '../api/authApi'
import { formatApiError } from '../api/http'

interface UserProfileModalProps {
  open: boolean
  onClose: () => void
  userProfile?: UserProfileData | null
  isMandatory?: boolean
  initialTab?: 'profile' | 'password'
}

export default function UserProfileModal({
  open,
  onClose,
  userProfile,
  isMandatory = false,
  initialTab = 'profile',
}: UserProfileModalProps) {
  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(initialTab)

  // Kết hợp giữa API userProfile và Fallback Cache để đảm bảo 100% luôn có đủ thông tin
  const cachedFallback = getCachedUserProfile()
  const emailResolved = userProfile?.email || cachedFallback?.email || getUserEmail() || ''
  const fullNameResolved = userProfile?.fullName || cachedFallback?.fullName || ''
  const deptResolved = normalizeDepartmentName(userProfile?.department || cachedFallback?.department) || ''
  const userCodeResolved = userProfile?.userCode || cachedFallback?.userCode || ''
  const phoneResolved = userProfile?.phoneNumber || cachedFallback?.phoneNumber || ''

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      profileForm.setFieldsValue({
        phoneNumber: phoneResolved,
      })
      passwordForm.resetFields()
    }
  }, [open, phoneResolved, initialTab, profileForm, passwordForm])

  const updateMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      message.success('Cập nhật số điện thoại thành công!')
      setIsSubmitting(false)
      onClose()
    },
    onError: (err: any) => {
      setIsSubmitting(false)
      message.error('Không thể cập nhật hồ sơ: ' + (err.message || 'Lỗi không xác định'))
    }
  })

  const handleFinishProfile = async (values: any) => {
    try {
      setIsSubmitting(true)
      // Giữ nguyên thông tin định danh do Admin cấp, chỉ cập nhật số điện thoại
      await updateMutation.mutateAsync({
        fullName: fullNameResolved,
        department: deptResolved,
        phoneNumber: values.phoneNumber?.trim(),
        userCode: userCodeResolved,
      })
    } catch {
      setIsSubmitting(false)
    }
  }

  const handleFinishPassword = async (values: any) => {
    try {
      setIsChangingPassword(true)
      const res = await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      message.success(res.message || 'Đổi mật khẩu thành công!')
      passwordForm.resetFields()
      onClose()
    } catch (err: any) {
      message.error(formatApiError(err))
    } finally {
      setIsChangingPassword(false)
    }
  }

  const lockedTooltipText = 'Thông tin được cố định theo tài khoản'

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!isSubmitting && !isChangingPassword) onClose()
      }}
      footer={null}
      width={660}
      centered
      className="user-profile-modal-compact"
      mask={{ closable: !isMandatory }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
          <div 
            style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 8, 
              backgroundColor: '#eff6ff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#0d2e5c',
              fontSize: 20
            }}
          >
            {activeTab === 'profile' ? <SafetyCertificateOutlined /> : <KeyOutlined />}
          </div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#0d2e5c', fontSize: 17, fontWeight: 700 }}>
              Thông tin Tài khoản & Bảo mật TBD
            </Typography.Title>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 400 }}>
              Hệ thống Quản lý Đặt phòng Thông minh & Cơ sở vật chất
            </div>
          </div>
        </div>
      }
    >
      <div style={{ paddingTop: 8 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'profile' | 'password')}
          items={[
            {
              key: 'profile',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <UserOutlined />
                  Hồ sơ cá nhân
                </span>
              ),
            },
            {
              key: 'password',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                  <LockOutlined />
                  Đổi mật khẩu
                </span>
              ),
            },
          ]}
          style={{ marginBottom: 12 }}
        />

        {activeTab === 'profile' ? (
          <div>
            {/* Hộp thông báo cố định thông tin định danh */}
            <Alert
              type="info"
              showIcon
              style={{
                marginBottom: 12,
                borderRadius: 8,
                fontSize: 12.5,
                padding: '6px 12px',
                border: '1px solid #bae6fd',
                background: '#f0f9ff'
              }}
              title={
                <div style={{ color: '#0369a1', lineHeight: 1.45 }}>
                  <strong>Thông tin tài khoản:</strong> Các mục Họ và tên, Khoa và Mã sinh viên/cán bộ được cố định theo hồ sơ Nhà trường cấp. Nếu có sai sót, vui lòng liên hệ <strong>Ban Quản lý</strong> hoặc <strong>Phòng CTSV</strong> để được hỗ trợ.
                </div>
              }
            />

            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleFinishProfile}
              requiredMark={false}
            >
              {/* Bố cục 2 cột gọn gàng - Hiển thị toàn bộ không cần cuộn */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', marginBottom: 8 }}>
                {/* 1. Họ và tên */}
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                    Họ và tên
                  </label>
                  <Tooltip title={lockedTooltipText} placement="topLeft">
                    <Input 
                      value={fullNameResolved}
                      disabled
                      prefix={<UserOutlined style={{ color: '#94a3b8' }} />} 
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 6,
                        fontWeight: 600,
                        height: 36
                      }}
                    />
                  </Tooltip>
                </div>

                {/* 2. Mã sinh viên / Mã cán bộ */}
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                    Mã sinh viên / Mã cán bộ
                  </label>
                  <Tooltip title={lockedTooltipText} placement="topLeft">
                    <Input 
                      value={userCodeResolved}
                      disabled
                      prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} 
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 6,
                        fontWeight: 600,
                        height: 36
                      }}
                    />
                  </Tooltip>
                </div>

                {/* 3. Email đăng nhập */}
                <div>
                  <label style={{ display: 'block', marginBottom: 3, fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                    Email đăng nhập
                  </label>
                  <Tooltip title={lockedTooltipText} placement="topLeft">
                    <Input
                      value={emailResolved}
                      disabled
                      prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#334155',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 6,
                        fontWeight: 600,
                        height: 36
                      }}
                    />
                  </Tooltip>
                </div>

                {/* 4. Số điện thoại liên hệ (Cho phép chỉnh sửa) */}
                <div>
                  <Form.Item
                    label={
                      <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                        Số điện thoại liên hệ <span style={{ color: '#dc2626' }}>*</span>
                      </span>
                    }
                    name="phoneNumber"
                    style={{ marginBottom: 0 }}
                    rules={[
                      { required: true, message: 'Vui lòng nhập số điện thoại!' },
                      { pattern: /^(0[3|5|7|8|9])[0-9]{8}$/, message: 'Số điện thoại gồm 10 số (bắt đầu 03, 05, 07, 08, 09)!' }
                    ]}
                  >
                    <Input 
                      prefix={<PhoneOutlined style={{ color: '#0d2e5c' }} />} 
                      placeholder="Ví dụ: 0912345678" 
                      maxLength={10} 
                      style={{
                        borderRadius: 6,
                        border: '1.5px solid #94a3b8',
                        fontWeight: 600,
                        color: '#0f172a',
                        height: 36
                      }}
                    />
                  </Form.Item>
                </div>

                {/* 5. Khoa / Phòng ban / Đơn vị (chiếm trọn 2 cột ngang) */}
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ display: 'block', marginBottom: 3, fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                    Khoa / Phòng ban / Đơn vị
                  </label>
                  <Tooltip title={lockedTooltipText} placement="topLeft">
                    <Input 
                      value={deptResolved}
                      disabled
                      prefix={<BankOutlined style={{ color: '#94a3b8' }} />} 
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 6,
                        fontWeight: 600,
                        height: 36
                      }}
                    />
                  </Tooltip>
                </div>
              </div>

              {/* Hàng nút bấm */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={onClose} disabled={isSubmitting} style={{ height: 36, borderRadius: 6, fontWeight: 500 }}>
                  Đóng
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={isSubmitting}
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    height: 36,
                    borderRadius: 6,
                    padding: '0 20px'
                  }}
                >
                  Cập nhật số điện thoại
                </Button>
              </div>
            </Form>
          </div>
        ) : (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12, borderRadius: 8, fontSize: 12.5, padding: '6px 12px', border: '1px solid #fed7aa', background: '#fffbeb' }}
              title={
                <div style={{ color: '#b45309', lineHeight: 1.45 }}>
                  <strong>Bảo mật mật khẩu:</strong> Mật khẩu mới cần có độ dài tối thiểu từ 6 ký tự. Sau khi đổi thành công, bạn sẽ sử dụng mật khẩu mới để đăng nhập.
                </div>
              }
            />

            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleFinishPassword}
            >
              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>Mật khẩu hiện tại <span style={{ color: '#dc2626' }}>*</span></span>}
                name="currentPassword"
                style={{ marginBottom: 10 }}
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu hiện tại của bạn!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập mật khẩu hiện tại..."
                  style={{ height: 36, borderRadius: 6 }}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>Mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></span>}
                name="newPassword"
                style={{ marginBottom: 10 }}
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự!' }
                ]}
              >
                <Input.Password
                  prefix={<KeyOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  style={{ height: 36, borderRadius: 6 }}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>Xác nhận mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></span>}
                name="confirmPassword"
                dependencies={['newPassword']}
                style={{ marginBottom: 12 }}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận lại mật khẩu mới!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp với mật khẩu mới!'))
                    },
                  }),
                ]}
              >
                <Input.Password
                  prefix={<CheckCircleOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập lại mật khẩu mới..."
                  style={{ height: 36, borderRadius: 6 }}
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={onClose} disabled={isChangingPassword} style={{ height: 36, borderRadius: 6, fontWeight: 500 }}>
                  Hủy bỏ
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<KeyOutlined />}
                  loading={isChangingPassword}
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    height: 36,
                    borderRadius: 6,
                    padding: '0 20px'
                  }}
                >
                  Xác nhận đổi mật khẩu
                </Button>
              </div>
            </Form>
          </div>
        )}
      </div>
    </Modal>
  )
}
