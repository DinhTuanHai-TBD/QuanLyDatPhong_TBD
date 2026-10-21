import { useState, useEffect } from 'react'
import { Modal, Form, Input, Button, Alert, Typography, App, Steps, Tag } from 'antd'
import {
  MailOutlined,
  KeyOutlined,
  LockOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'
import { forgotPassword, resetPassword } from '../../api/authApi'
import { formatApiError } from '../../api/http'

interface ForgotPasswordModalProps {
  open: boolean
  onClose: () => void
  initialEmail?: string
  onSuccessReset?: (newPassword: string, email: string) => void
}

export default function ForgotPasswordModal({
  open,
  onClose,
  initialEmail = '',
  onSuccessReset,
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<0 | 1>(0)
  const [emailForm] = Form.useForm()
  const [resetForm] = Form.useForm()
  const { message } = App.useApp()

  const [currentEmail, setCurrentEmail] = useState('')
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // Đếm ngược thời gian OTP (5 phút = 300 giây)
  useEffect(() => {
    let timer: any = null
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [countdown])

  // Khởi tạo lại trạng thái khi mở modal
  useEffect(() => {
    if (open) {
      setStep(0)
      setDebugOtp(null)
      setCountdown(0)
      const email = initialEmail || ''
      setCurrentEmail(email)
      emailForm.setFieldsValue({ email })
      resetForm.resetFields()
    }
  }, [open, initialEmail, emailForm, resetForm])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Bước 1: Gửi yêu cầu mã OTP
  const handleSendOtp = async (values: { email: string }) => {
    try {
      setIsSendingOtp(true)
      const targetEmail = values.email.trim()
      setCurrentEmail(targetEmail)
      
      const res = await forgotPassword({ email: targetEmail })
      message.success(res.message || 'Mã xác thực OTP đã được gửi thành công!')
      
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp)
      }

      setCountdown(300) // 5 phút
      setStep(1)
      resetForm.setFieldsValue({
        otp: res.debugOtp || '',
      })
    } catch (err: any) {
      message.error(formatApiError(err))
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (!currentEmail) return
    try {
      setIsSendingOtp(true)
      const res = await forgotPassword({ email: currentEmail })
      message.success(res.message || 'Mã OTP mới đã được gửi lại!')
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp)
        resetForm.setFieldsValue({ otp: res.debugOtp })
      }
      setCountdown(300)
    } catch (err: any) {
      message.error(formatApiError(err))
    } finally {
      setIsSendingOtp(false)
    }
  }

  // Bước 2: Xác nhận OTP và đặt lại mật khẩu
  const handleResetPassword = async (values: any) => {
    try {
      setIsResetting(true)
      const res = await resetPassword({
        email: currentEmail,
        otp: values.otp.trim(),
        newPassword: values.newPassword,
      })
      
      message.success(res.message || 'Đặt lại mật khẩu thành công!')
      if (onSuccessReset) {
        onSuccessReset(values.newPassword, currentEmail)
      }
      onClose()
    } catch (err: any) {
      message.error(formatApiError(err))
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!isSendingOtp && !isResetting) onClose()
      }}
      footer={null}
      width={520}
      centered
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
              fontSize: 20,
            }}
          >
            <KeyOutlined />
          </div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#0d2e5c', fontSize: 17, fontWeight: 700 }}>
              Khôi phục Mật khẩu Tài khoản
            </Typography.Title>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 400 }}>
              Đại học Thái Bình Dương (Xác thực OTP qua Email)
            </div>
          </div>
        </div>
      }
    >
      <div style={{ paddingTop: 10 }}>
        {/* Thanh tiến trình Steps */}
        <Steps
          current={step}
          size="small"
          style={{ marginBottom: 20 }}
          items={[
            {
              title: 'Gửi mã OTP',
              icon: <MailOutlined />,
            },
            {
              title: 'Đặt mật khẩu mới',
              icon: <LockOutlined />,
            },
          ]}
        />

        {step === 0 ? (
          /* ==================== BƯỚC 1: NHẬP EMAIL ĐỂ NHẬN OTP ==================== */
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 18, borderRadius: 8, fontSize: 13, border: '1px solid #bae6fd', background: '#f0f9ff' }}
              title={
                <div style={{ color: '#0369a1' }}>
                  <strong>Xác thực tài khoản:</strong> Nhập địa chỉ email trường cấp của bạn (ví dụ: <code>@tbd.edu.vn</code>). Hệ thống sẽ tạo một mã xác thực OTP gồm 6 chữ số có hiệu lực trong 5 phút.
                </div>
              }
            />

            <Form
              form={emailForm}
              layout="vertical"
              onFinish={handleSendOtp}
            >
              <Form.Item
                label={<strong style={{ color: '#334155' }}>Địa chỉ Email trường cấp <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="email"
                rules={[
                  { required: true, message: 'Vui lòng nhập địa chỉ email của bạn!' },
                  { type: 'email', message: 'Địa chỉ email không đúng định dạng!' },
                ]}
              >
                <Input
                  prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ví dụ: hai.230057@tbd.edu.vn"
                  size="large"
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <Button onClick={onClose} disabled={isSendingOtp} size="large">
                  Hủy bỏ
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<MailOutlined />}
                  loading={isSendingOtp}
                  size="large"
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    padding: '0 24px',
                  }}
                >
                  Gửi mã xác thực OTP
                </Button>
              </div>
            </Form>
          </div>
        ) : (
          /* ==================== BƯỚC 2: NHẬP OTP & ĐẶT MẬT KHẨU MỚI ==================== */
          <div>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginBottom: 14, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12.5, color: '#64748b' }}>Mã OTP đã gửi đến: </span>
                <strong style={{ color: '#0f172a', fontSize: 13 }}>{currentEmail}</strong>
              </div>
              <Button
                type="link"
                size="small"
                onClick={() => setStep(0)}
                style={{ padding: 0, fontSize: 12, color: '#0d2e5c' }}
              >
                Đổi email khác
              </Button>
            </div>

            {/* Thông báo hiển thị mã OTP thử nghiệm trong môi trường DEV */}
            {debugOtp && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 14, borderRadius: 8, border: '1px solid #bbf7d0', background: '#f0fdf4' }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#166534', fontSize: 13 }}>
                      Mã OTP xác thực: <Tag color="green" style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>{debugOtp}</Tag>
                    </span>
                    <span style={{ fontSize: 11.5, color: '#15803d' }}>(Môi trường thử nghiệm)</span>
                  </div>
                }
              />
            )}

            <Form
              form={resetForm}
              layout="vertical"
              onFinish={handleResetPassword}
            >
              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <strong style={{ color: '#334155' }}>Mã OTP (6 chữ số) <span style={{ color: '#dc2626' }}>*</span></strong>
                    <span style={{ fontSize: 12, color: countdown > 0 ? '#d97706' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClockCircleOutlined />
                      {countdown > 0 ? `Hiệu lực: ${formatCountdown(countdown)}` : 'Hết hạn'}
                    </span>
                  </div>
                }
                name="otp"
                rules={[
                  { required: true, message: 'Vui lòng nhập mã OTP 6 số!' },
                  { len: 6, message: 'Mã OTP phải chính xác 6 chữ số!' },
                ]}
              >
                <Input
                  prefix={<SafetyCertificateOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập 6 số mã OTP..."
                  maxLength={6}
                  size="large"
                  style={{
                    letterSpacing: '4px',
                    fontSize: '16px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                />
              </Form.Item>

              <Form.Item
                label={<strong style={{ color: '#334155' }}>Mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới!' },
                  { min: 6, message: 'Mật khẩu phải tối thiểu từ 6 ký tự!' },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Nhập mật khẩu mới..."
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label={<strong style={{ color: '#334155' }}>Xác nhận mật khẩu mới <span style={{ color: '#dc2626' }}>*</span></strong>}
                name="confirmPassword"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu mới!' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'))
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <Button
                  type="link"
                  disabled={isSendingOtp}
                  onClick={handleResendOtp}
                  style={{ padding: 0, fontSize: 13, color: '#0d2e5c' }}
                >
                  {isSendingOtp ? 'Đang gửi lại mã...' : 'Chưa nhận được? Gửi lại mã OTP'}
                </Button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
                <Button
                  onClick={() => setStep(0)}
                  disabled={isResetting}
                  size="large"
                  icon={<ArrowLeftOutlined />}
                >
                  Quay lại
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckCircleOutlined />}
                  loading={isResetting}
                  size="large"
                  style={{
                    backgroundColor: '#0d2e5c',
                    borderColor: '#0d2e5c',
                    fontWeight: 600,
                    padding: '0 24px',
                  }}
                >
                  Xác nhận đặt lại mật khẩu
                </Button>
              </div>
            </Form>
          </div>
        )}
      </div>
    </Modal>
  )
}
