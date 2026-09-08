import { useEffect, useState } from 'react'
import { Modal, Form, Input, Button, Alert, Typography, App } from 'antd'
import { 
  UserOutlined, 
  PhoneOutlined, 
  BankOutlined, 
  IdcardOutlined, 
  SafetyCertificateOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateUserProfile, type UserProfileData } from '../api/userProfile'
import { getUserEmail } from '../api/authUtils'

interface UserProfileModalProps {
  open: boolean
  onClose: () => void
  userProfile?: UserProfileData | null
  isMandatory?: boolean
}

export default function UserProfileModal({
  open,
  onClose,
  userProfile,
  isMandatory = false,
}: UserProfileModalProps) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const currentEmail = userProfile?.email || getUserEmail()

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        fullName: userProfile?.fullName || '',
        department: userProfile?.department || '',
        phoneNumber: userProfile?.phoneNumber || '',
        userCode: userProfile?.userCode || '',
      })
    }
  }, [open, userProfile, form])

  const updateMutation = useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      message.success('Đã lưu hồ sơ cá nhân thành công!')
      setIsSubmitting(false)
      onClose()
    },
    onError: (err: any) => {
      setIsSubmitting(false)
      message.error('Không thể cập nhật hồ sơ: ' + (err.message || 'Lỗi không xác định'))
    }
  })

  const handleFinish = async (values: any) => {
    try {
      setIsSubmitting(true)
      await updateMutation.mutateAsync({
        fullName: values.fullName?.trim(),
        department: values.department?.trim(),
        phoneNumber: values.phoneNumber?.trim(),
        userCode: values.userCode?.trim(),
      })
    } catch {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!isSubmitting) onClose()
      }}
      footer={null}
      width={560}
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
            <SafetyCertificateOutlined />
          </div>
          <div>
            <Typography.Title level={4} style={{ margin: 0, color: '#0d2e5c', fontSize: 17, fontWeight: 700 }}>
              Hoàn thiện Hồ sơ Người dùng Đại học Thái Bình Dương
            </Typography.Title>
            <div style={{ fontSize: 12.5, color: '#64748b', fontWeight: 400 }}>
              Hệ thống Quản lý Đặt phòng Thông minh & Cơ sở vật chất
            </div>
          </div>
        </div>
      }
    >
      <div style={{ paddingTop: 10 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8, fontSize: 13, border: '1px solid #bae6fd', background: '#f0f9ff' }}
          title={
            <div style={{ color: '#0369a1' }}>
              <strong>Lưu ý xác thực hồ sơ:</strong> Nhằm phục vụ công tác đối chiếu danh tính khi tiếp nhận bàn giao phòng học và mượn thiết bị, Quý Thầy/Cô và các bạn Sinh viên vui lòng hoàn thiện đầy đủ các trường thông tin bên dưới.
            </div>
          }
        />

        <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, marginBottom: 18, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            Email đăng nhập: <strong style={{ color: '#0f172a' }}>{currentEmail}</strong>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          requiredMark="optional"
        >
          <Form.Item
            label={<strong style={{ color: '#334155' }}>Họ và tên <span style={{ color: '#dc2626' }}>*</span></strong>}
            name="fullName"
            rules={[
              { required: true, message: 'Vui lòng nhập họ và tên của bạn!' },
              { min: 3, message: 'Họ và tên quá ngắn!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />} 
              placeholder="Ví dụ: TS. Nguyễn Văn A hoặc Trần Thị Mai" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            label={<strong style={{ color: '#334155' }}>Khoa / Phòng ban / Đơn vị <span style={{ color: '#dc2626' }}>*</span></strong>}
            name="department"
            rules={[{ required: true, message: 'Vui lòng nhập Khoa / Phòng ban hoặc Đơn vị trực thuộc!' }]}
          >
            <Input 
              prefix={<BankOutlined style={{ color: '#94a3b8' }} />} 
              placeholder="Ví dụ: Khoa Công nghệ & Kỹ thuật, Phòng Quản trị thiết bị, Lớp 21CNTT..." 
              size="large"
            />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <Form.Item
              label={<strong style={{ color: '#334155' }}>Số điện thoại liên hệ <span style={{ color: '#dc2626' }}>*</span></strong>}
              name="phoneNumber"
              rules={[
                { required: true, message: 'Vui lòng nhập số điện thoại!' },
                { pattern: /^(0[3|5|7|8|9])[0-9]{8}$/, message: 'Số điện thoại không hợp lệ (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09)!' }
              ]}
            >
              <Input 
                prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />} 
                placeholder="Ví dụ: 0912345678" 
                maxLength={10} 
                size="large"
              />
            </Form.Item>

            <Form.Item
              label={<strong style={{ color: '#334155' }}>Mã sinh viên / Mã cán bộ <span style={{ color: '#dc2626' }}>*</span></strong>}
              name="userCode"
              rules={[{ required: true, message: 'Vui lòng nhập Mã sinh viên hoặc Mã cán bộ!' }]}
            >
              <Input 
                prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />} 
                placeholder="Ví dụ: 21010012 hoặc CB-9901" 
                size="large"
              />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 14, borderTop: '1px solid #e2e8f0' }}>
            {!isMandatory && (
              <Button onClick={onClose} disabled={isSubmitting} size="large">
                Hủy bỏ
              </Button>
            )}
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
              Lưu hồ sơ
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  )
}
