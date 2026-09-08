import { useState } from 'react'
import { LockOutlined, MailOutlined, SafetyOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Form, Input, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { http } from '../../api/http'

interface AuthFormValues {
  email: string
  password: string
}

interface AuthResponse {
  accessToken: string
  expiresAtUtc: string
}

async function login(values: AuthFormValues) {
  const response = await http.post<AuthResponse>('/api/auth/login', values)
  return response.data
}

export default function LoginPage() {
  const [form] = Form.useForm<AuthFormValues>()
  const navigate = useNavigate()
  const { message } = App.useApp()

  const saveToken = (data: AuthResponse) => {
    localStorage.setItem('accessToken', data.accessToken)
    
    // Set the testRole override to match the token role
    const isLocalAdmin = data.accessToken.includes('"admin"')
    localStorage.setItem('testRole', isLocalAdmin ? 'admin' : 'user')
    
    message.success('Đăng nhập thành công')
    navigate('/')
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: saveToken,
  })

  const getLoginErrorDetails = () => {
    if (!loginMutation.isError) return null
    const err = loginMutation.error as any
    const serverMessage = err?.response?.data?.message || err?.response?.data?.title || err?.response?.data?.error
    const status = err?.response?.status
    const isNetworkError = err?.code === 'ERR_NETWORK' || !err?.response

    if (isNetworkError) {
      return {
        title: 'Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra đường truyền mạng hoặc thử lại sau.',
        isNetwork: true,
      }
    }

    if (serverMessage) {
      const lower = String(serverMessage).toLowerCase()
      if (lower.includes('mật khẩu') || lower.includes('password')) {
        return {
          title: 'Mật khẩu không chính xác. Vui lòng kiểm tra lại (chú ý phím Caps Lock).',
          isNetwork: false,
        }
      }
      return {
        title: serverMessage,
        isNetwork: false,
      }
    }

    if (status === 401 || status === 400 || status === 404) {
      return {
        title: 'Tài khoản không tồn tại trong hệ thống Đại học Thái Bình Dương hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.',
        isNetwork: false,
      }
    }

    return {
      title: 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.',
      isNetwork: false,
    }
  }

  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2) // từ -1 đến 1
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2) // từ -1 đến 1
    setMouseOffset({ x: x * 20, y: y * 15 })
  }

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 })
  }

  return (
    <div className="login-split-layout">
      {/* 1. Cột Trái (Thương hiệu & Khuôn viên TBD - 58%) - Parallax Wave & Campus Shift */}
      <div 
        className="login-split-left"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Lớp Ảnh Campus phía sau */}
        <div 
          className="login-split-bg"
          style={{
            transform: `scale(1.05) translate(${mouseOffset.x * 0.4}px, ${mouseOffset.y * 0.4}px)`,
            transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.4, 1)',
          }}
        />

        {/* Lớp Vân Gợn Sóng TBD */}
        <div 
          className="login-split-wave"
          style={{
            transform: `translate(${-mouseOffset.x * 1.2}px, ${-mouseOffset.y * 1.2}px)`,
            transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.4, 1)',
            pointerEvents: 'none',
          }}
        />

        {/* Khối nội dung trung tâm */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 580, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          
          {/* 1. Logo Trường Đại học Thái Bình Dương (Đặt chính giữa phía trên) */}
          <img 
            src="/images/logo.png" 
            alt="Logo Đại học Thái Bình Dương" 
            style={{ 
              width: 80, 
              height: 80, 
              objectFit: 'contain', 
              margin: '0 auto 16px', 
              filter: 'brightness(0) invert(1) drop-shadow(0 4px 12px rgba(0,0,0,0.3))' 
            }}
          />
          <div style={{ 
            fontSize: 13, 
            textTransform: 'uppercase', 
            letterSpacing: '1.5px', 
            color: '#e2e8f0', 
            fontWeight: 600, 
            margin: '0 auto' 
          }}>
            TRƯỜNG ĐẠI HỌC THÁI BÌNH DƯƠNG
          </div>

          {/* 2. Huy hiệu & Tiêu đề chính */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'rgba(255, 255, 255, 0.12)',
            padding: '5px 16px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            margin: '16px auto 12px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff'
          }}>
            CỔNG DỊCH VỤ TRỰC TUYẾN TBD
          </div>

          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.3,
            color: '#ffffff',
            margin: '0 0 16px',
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            ĐẠI HỌC THÁI BÌNH DƯƠNG
          </h1>

          {/* 3. Đoạn mô tả giới thiệu */}
          <p style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: '#cbd5e1',
            margin: '0 auto',
            maxWidth: 480,
            textAlign: 'center'
          }}>
            Hệ thống Quản lý &amp; Đặt phòng trực tuyến — Tối ưu hóa không gian học tập, giảng dạy và nghiên cứu khoa học.
          </p>

          {/* 4. 3 Thẻ thông số (Pill tags) phía dưới */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 32
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff'
            }}>
              24+ Phòng học hiện đại
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff'
            }}>
              Phê duyệt minh bạch
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#ffffff'
            }}>
              Hỗ trợ 24/7
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cột Phải (Form Đăng Nhập Tinh Gọn - 42%) */}
      <div className="login-split-right">
        <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column' }}>
          {/* Header Form */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <img 
              src="/images/logo.png" 
              alt="Logo Đại học Thái Bình Dương" 
              style={{ height: 50, objectFit: 'contain' }}
            />
            <h2 style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#0d2e5c',
              margin: '8px 0 2px',
              letterSpacing: '0.2px'
            }}>
              ĐĂNG NHẬP HỆ THỐNG
            </h2>
            <p style={{
              fontSize: 13,
              color: '#64748b',
              margin: 0
            }}>
              Cổng thông tin đặt phòng Đại học Thái Bình Dương
            </p>
          </div>

          {/* Form Đăng Nhập */}
          <Form 
            form={form}
            layout="vertical" 
            onFinish={(values) => loginMutation.mutate(values as AuthFormValues)} 
            onValuesChange={() => {
              if (loginMutation.isError) loginMutation.reset()
            }}
            requiredMark={false}
            style={{ marginBottom: 0 }}
          >
            <Form.Item
              label={
                <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>
                  Địa chỉ Email
                </span>
              }
              name="email"
              rules={[
                { required: true, message: 'Vui lòng nhập email!' },
                { type: 'email', message: 'Địa chỉ email không hợp lệ!' },
              ]}
              style={{ marginBottom: 12 }}
            >
              <Input 
                prefix={<MailOutlined style={{ color: '#0d2e5c' }} />} 
                placeholder="example@tbd.edu.vn" 
                style={{ 
                  borderRadius: 8, 
                  height: 40,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px'
                }}
              />
            </Form.Item>

            <Form.Item
              label={
                <span style={{ color: '#334155', fontSize: '13px', fontWeight: 600 }}>
                  Mật khẩu
                </span>
              }
              name="password"
              rules={[
                { required: true, message: 'Vui lòng nhập mật khẩu!' },
                { min: 6, message: 'Mật khẩu phải tối thiểu từ 6 ký tự!' }
              ]}
              style={{ marginBottom: 14 }}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: '#0d2e5c' }} />} 
                placeholder="Nhập mật khẩu..." 
                style={{ 
                  borderRadius: 8, 
                  height: 40,
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px'
                }}
              />
            </Form.Item>

            {loginMutation.isError && (() => {
              const errorInfo = getLoginErrorDetails()
              return (
                <Alert
                  showIcon
                  type="error"
                  title={
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#991b1b', lineHeight: 1.4 }}>
                      {errorInfo?.title}
                    </span>
                  }
                  description={
                    <div style={{ marginTop: 5, fontSize: '11.5px', lineHeight: 1.5, color: '#475569' }}>
                      Nếu bạn chưa được cấp tài khoản hoặc quên mật khẩu, vui lòng liên hệ Phòng Công tác Sinh viên (CTSV) qua email{' '}
                      <a 
                        href="mailto:ctsv@tbd.edu.vn" 
                        style={{ color: '#0d2e5c', fontWeight: 600, textDecoration: 'underline' }}
                      >
                        ctsv@tbd.edu.vn
                      </a>{' '}
                      hoặc Hotline <strong>0258 3727 147</strong> để được cấp mới.
                    </div>
                  }
                  style={{ 
                    marginBottom: 14, 
                    borderRadius: 8, 
                    padding: '8px 12px',
                    border: '1px solid #fecaca',
                    backgroundColor: '#fef2f2'
                  }}
                />
              )
            })()}

            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loginMutation.isPending} 
              block
              style={{ 
                height: 42, 
                backgroundColor: '#0d2e5c',
                borderColor: '#0d2e5c',
                fontWeight: 700,
                borderRadius: 8,
                fontSize: '14px',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                boxShadow: '0 4px 10px rgba(13, 46, 92, 0.25)'
              }}
            >
              Đăng Nhập Hệ Thống
            </Button>
          </Form>

          {/* Ghi chú hỗ trợ nhỏ gọn */}
          <div style={{
            marginTop: 16,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748b',
            lineHeight: 1.45,
            padding: '0 4px'
          }}>
            Tài khoản do Nhà trường cấp. Quên mật khẩu vui lòng liên hệ Phòng CTSV để được cấp mới.
          </div>

          {/* Chân trang */}
          <div style={{
            marginTop: 14,
            paddingTop: 10,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => navigate('/')}
              style={{
                color: '#0d2e5c',
                fontWeight: 600,
                padding: 0,
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              Quay lại trang chủ
            </Button>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              color: '#64748b',
              fontSize: '11.5px',
              fontWeight: 500
            }}>
              <SafetyOutlined style={{ color: '#10b981' }} />
              <span>Kết nối bảo mật TBD</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
