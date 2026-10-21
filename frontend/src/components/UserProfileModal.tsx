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
      width={580}
      centered
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
                marginBottom: 16,
                borderRadius: 8,
                fontSize: 13,
                border: '1px solid #bae6fd',
                background: '#f0f9ff'
              }}
              title={
                <div style={{ color: '#0369a1', lineHeight: 1.5 }}>
                  <strong>Thông tin tài khoản:</strong> Các mục Họ và tên, Khoa và Mã sinh viên/cán bộ được cố định theo hồ sơ do Nhà trường cấp. Nếu có sai sót thông tin, vui lòng liên hệ <strong>Ban Quản lý</strong> hoặc <strong>Phòng CTSV</strong> để được hỗ trợ điều chỉnh.
                </div>
              }
            />

            {/* Email tài khoản cố định */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#334155', fontSize: 13 }}>
                Email đăng nhập
              </label>
              <Tooltip title={lockedTooltipText} placement="topLeft">
                <div>
                  <Input
                    value={emailResolved}
                    disabled
                    prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                    size="large"
                    style={{
                      backgroundColor: '#f8fafc',
                      color: '#334155',
                      cursor: 'not-allowed',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 8,
                      fontWeight: 600,
                    }}
                  />
                </div>
              </Tooltip>
            </div>

            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleFinishProfile}
              requiredMark={false}
            >
              {/* Họ và tên: Khóa cố định, luôn hiển thị rõ ràng */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#334155', fontSize: 13 }}>
                  Họ và tên
                </label>
                <Tooltip title={lockedTooltipText} placement="topLeft">
                  <div>
                    <Input 
                      value={fullNameResolved}
                      disabled
                      prefix={<UserOutlined style={{ color: '#94a3b8' }} />} 
                      size="large"
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </Tooltip>
              </div>

              {/* Khoa / Phòng ban: Khóa cố định, luôn hiển thị rõ ràng */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: '#334155', fontSize: 13 }}>
                  Khoa / Phòng ban / Đơn vị
                </label>
                <Tooltip title={lockedTooltipText} placement="topLeft">
                  <div>
                    <Input 
                      value={deptResolved}
                      disabled
                      prefix={<BankOutlined style={{ color: '#94a3b8' }} />} 
                      size="large"
                      style={{
                        backgroundColor: '#f8fafc',
                        color: '#1e293b',
                        cursor: 'not-allowed',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: 8,
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </Tooltip>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {/* Số điện thoại liên hệ: Cho phép chỉnh sửa */}
                <Form.Item
                  label={
                    <strong style={{ color: '#334155' }}>
                      Số điện thoại liên hệ <span style={{ color: '#dc2626' }}>*</span>
                    </strong>
                  }
                  name="phoneNumber"
                  rules={[
                    { required: true, message: 'Vui lòng nhập số điện thoại liên hệ!' },
                    { pattern: /^(0[3|5|7|8|9])[0-9]{8}$/, message: 'Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09)!' }
                  ]}
                >
                  <Input 
                    prefix={<PhoneOutlined style={{ color: '#0d2e5c' }} />} 
                    placeholder="Ví dụ: 0912345678" 
                    maxLength={10} 
                    size="large"
                    style={{
                      borderRadius: 8,
                      border: '1.5px solid #cbd5e1',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  />
                </Form.Item>

                {/* Mã sinh viên / Mã cán bộ: Khóa cố định */}
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#334155', fontSize: 14 }}>
                    Mã sinh viên / Mã cán bộ
                  </label>
                  <Tooltip title={lockedTooltipText} placement="topLeft">
                    <div>
                      <Input 
                        value={userCodeResolved}
                        disabled
                        prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} 
                        size="large"
                        style={{
                          backgroundColor: '#f8fafc',
                          color: '#1e293b',
                          cursor: 'not-allowed',
                          border: '1.5px solid #cbd5e1',
                          borderRadius: 8,
                          fontWeight: 600,
                        }}
                      />
                    </div>
                  </Tooltip>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={onClose} disabled={isSubmitting} size="large">
                  Đóng
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={isSubmitting}
                  size="large"
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    padding: '0 24px'
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
              style={{ marginBottom: 16, borderRadius: 8, fontSize: 13, border: '1px solid #fed7aa', background: '#fffbeb' }}
              title={
                <div style={{ color: '#b45309' }}>
                  <strong>Bảo mật mật khẩu:</strong> Mật khẩu mới cần có độ dài tối thiểu từ 6 ký tự. Sau khi đổi thành công, bạn sẽ sử dụng mật khẩu mới cho các lần đăng nhập tiếp theo.
                </div>
              }
            />

            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handleFinishPassword}
            >
              <Form.Item
                label={<strong style={{ color: '#334155' }}>Mật khẩu hiện tại <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="currentPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu hiện tại của bạn!' }
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập mật khẩu hiện tại..."
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label={<strong style={{ color: '#334155' }}>Mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu mới phải có tối thiểu 6 ký tự!' }
                ]}
              >
                <Input.Password
                  prefix={<KeyOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label={<strong style={{ color: '#334155' }}>Xác nhận mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="confirmPassword"
                dependencies={['newPassword']}
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
                  size="large"
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={onClose} disabled={isChangingPassword} size="large">
                  Hủy bỏ
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<KeyOutlined />}
                  loading={isChangingPassword}
                  size="large"
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    padding: '0 24px'
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
