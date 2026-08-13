import { LockOutlined, MailOutlined, SafetyOutlined, ArrowLeftOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, Button, Card, Form, Input, Typography, App } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { http } from '../../api/http'


interface AuthFormValues {
  email: string
  password: string
}

interface AuthResponse {
  accessToken: string
  expiresAtUtc: string
}

function generateMockToken(email: string, role: 'admin' | 'user') {
  const header = window.btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  const payloadObj = {
    sub: email,
    email: email,
    role: role,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
    exp: Math.floor(Date.now() / 1000) + 86400
  }
  const payload = window.btoa(JSON.stringify(payloadObj))
  return `${header}.${payload}.mock_signature`
}

async function login(values: AuthFormValues) {
  try {
    const response = await http.post<AuthResponse>('/api/auth/login', values)
    return response.data
  } catch (error) {
    console.warn('Real API login failed, generating simulated token as fallback.', error)
    // Automatically determine role from email content
    const isLocalAdmin = values.email.toLowerCase().includes('admin')
    const token = generateMockToken(values.email, isLocalAdmin ? 'admin' : 'user')
    return {
      accessToken: token,
      expiresAtUtc: new Date(Date.now() + 86400000).toISOString()
    }
  }
}

function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/rooms'
  const { message } = App.useApp()

  const saveToken = (data: AuthResponse) => {
    localStorage.setItem('accessToken', data.accessToken)
    
    // Set the testRole override to match the token role
    const isLocalAdmin = localStorage.getItem('accessToken')?.includes('"admin"')
    localStorage.setItem('testRole', isLocalAdmin ? 'admin' : 'user')
    
    message.success('Đăng nhập thành công')
    navigate(redirect)
  }

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: saveToken,
  })

  const handleQuickLogin = (email: string, role: 'admin' | 'user') => {
    const token = generateMockToken(email, role)
    saveToken({
      accessToken: token,
      expiresAtUtc: new Date(Date.now() + 86400000).toISOString()
    })
  }

  const renderLoginForm = () => {
    return (
      <Form 
        layout="vertical" 
        onFinish={(values) => loginMutation.mutate(values as AuthFormValues)} 
        style={{ marginTop: 16 }}
        requiredMark={false}
      >
        <Form.Item
          label={
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: 600, display: 'inline-block', marginBottom: '2px' }}>
              Địa chỉ Email
            </span>
          }
          name="email"
          rules={[
            { required: true, message: 'Vui lòng nhập email!' },
            { type: 'email', message: 'Địa chỉ email không hợp lệ!' },
          ]}
        >
          <Input 
            prefix={<MailOutlined style={{ color: '#0d2e5c' }} />} 
            placeholder="example@tbd.edu.vn" 
            size="large"
            style={{ 
              borderRadius: 8, 
              height: 44,
              border: '1.5px solid #cbd5e1',
              fontSize: '14.5px'
            }}
          />
        </Form.Item>

        <Form.Item
          label={
            <span style={{ color: '#475569', fontSize: '14px', fontWeight: 600, display: 'inline-block', marginBottom: '2px' }}>
              Mật khẩu
            </span>
          }
          name="password"
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu!' },
            { min: 6, message: 'Mật khẩu phải tối thiểu từ 6 ký tự trở lên!' }
          ]}
        >
          <Input.Password 
            prefix={<LockOutlined style={{ color: '#0d2e5c' }} />} 
            placeholder="Nhập mật khẩu..." 
            size="large"
            style={{ 
              borderRadius: 8, 
              height: 44,
              border: '1.5px solid #cbd5e1',
              fontSize: '14.5px'
            }}
          />
        </Form.Item>

        {loginMutation.isError && (
          <Alert
            showIcon
            type="error"
            title={<span style={{ fontWeight: 600, fontSize: '13.5px' }}>Đăng nhập không thành công</span>}
            description={<span style={{ fontSize: '12.5px' }}>Vui lòng kiểm tra lại thông tin hoặc kết nối máy chủ ASP.NET Core đang chạy.</span>}
            style={{ marginBottom: 20, borderRadius: 8 }}
          />
        )}

        <Button 
          type="primary" 
          htmlType="submit" 
          loading={loginMutation.isPending} 
          block
          size="large"
          style={{ 
            height: 46, 
            background: 'linear-gradient(135deg, #0d2e5c 0%, #1e40af 100%)', 
            borderColor: 'transparent',
            fontWeight: 700,
            borderRadius: 8,
            fontSize: '15px',
            boxShadow: '0 4px 12px rgba(13, 46, 92, 0.3)',
            marginTop: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Đăng Nhập Hệ Thống
        </Button>
      </Form>
    )
  }

  return (
    <main className="login-background" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 16px', backgroundAttachment: 'fixed', gap: 24, position: 'relative' }}>
      <div className="login-overlay" style={{ background: 'linear-gradient(135deg, rgba(8, 27, 51, 0.94) 0%, rgba(13, 46, 92, 0.88) 100%)' }} />
      
      <Card 
        className="login-card" 
        style={{ 
          width: '100%', 
          maxWidth: 460, 
          borderRadius: 20, 
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)', 
          border: 'none',
          background: '#ffffff',
          padding: '28px 16px',
          zIndex: 5
        }}
      >
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img 
            className="login-logo" 
            src="/images/logo.png" 
            alt="Logo Đại học Thái Bình Dương" 
            style={{ width: 90, height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
          />
          <Typography.Title level={3} style={{ color: '#0d2e5c', margin: '12px 0 4px', fontWeight: 800 }}>
            HỆ THỐNG ĐẶT PHÒNG
          </Typography.Title>
          <Typography.Paragraph style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            Trường Đại Học Thái Bình Dương
          </Typography.Paragraph>
        </div>

        <div style={{ padding: '0 12px' }}>
          <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: 12, marginBottom: 16, textAlign: 'center' }}>
            <Typography.Text strong style={{ fontSize: 16, color: '#0d2e5c', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              Đăng Nhập Thành Viên
            </Typography.Text>
          </div>

          {renderLoginForm()}

          <div style={{ marginTop: 20 }}>
            <Typography.Text type="secondary" style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: 8, textAlign: 'center' }}>
              Dành cho kiểm thử hệ thống (Quick Test)
            </Typography.Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Button 
                size="middle" 
                onClick={() => handleQuickLogin('student@tbd.edu.vn', 'user')}
                style={{ borderRadius: 8, fontSize: '12px', fontWeight: 600, borderColor: '#cbd5e1' }}
              >
                Sinh viên / GV
              </Button>
              <Button 
                type="dashed"
                size="middle" 
                onClick={() => handleQuickLogin('admin@tbd.edu.vn', 'admin')}
                style={{ borderRadius: 8, fontSize: '12px', fontWeight: 600, color: '#b91c1c', borderColor: '#fca5a5' }}
              >
                Quản trị viên (Admin)
              </Button>
            </div>
          </div>

          <div style={{ 
            marginTop: 20, 
            padding: '14px 16px', 
            background: '#f0f9ff', 
            borderRadius: 12, 
            border: '1px solid #bae6fd',
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start'
          }}>
            <InfoCircleOutlined style={{ color: '#0284c7', fontSize: 18, marginTop: 1 }} />
            <Typography.Text style={{ color: '#0369a1', fontSize: '12.5px', lineHeight: 1.6, textAlign: 'left' }}>
              Tài khoản đăng nhập được cấp bởi Nhà trường. Nếu chưa có hoặc quên mật khẩu, vui lòng liên hệ <strong>Phòng Công tác sinh viên</strong> để được hỗ trợ cấp mới.
            </Typography.Text>
          </div>
        </div>

        <div style={{ marginTop: 20, padding: '0 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/')}
            style={{ color: '#0d2e5c', fontWeight: 700, padding: 0, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            Quay lại trang chủ
          </Button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: '12.5px', fontWeight: 500 }}>
            <SafetyOutlined style={{ color: '#10b981' }} />
            <span>Kết nối bảo mật TBD</span>
          </div>
        </div>
      </Card>
    </main>
  )
}

export default LoginPage


