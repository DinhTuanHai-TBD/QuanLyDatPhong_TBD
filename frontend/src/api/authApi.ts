import { http } from './http'

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  email: string
  otp: string
  newPassword: string
}

export interface AuthApiResponse {
  success: boolean
  message: string
  debugOtp?: string
}

/**
 * Đổi mật khẩu cho người dùng hiện tại (yêu cầu đã đăng nhập có JWT token).
 */
export async function changePassword(data: ChangePasswordRequest): Promise<AuthApiResponse> {
  const res = await http.post<AuthApiResponse>('/api/auth/change-password', {
    CurrentPassword: data.currentPassword,
    NewPassword: data.newPassword,
  })
  return res.data
}

/**
 * Yêu cầu mã OTP 6 chữ số để khôi phục mật khẩu qua Email.
 */
export async function forgotPassword(data: ForgotPasswordRequest): Promise<AuthApiResponse> {
  const res = await http.post<AuthApiResponse>('/api/auth/forgot-password', {
    Email: data.email,
  })
  return res.data
}

/**
 * Xác thực mã OTP và cập nhật mật khẩu mới vào cơ sở dữ liệu Supabase.
 */
export async function resetPassword(data: ResetPasswordRequest): Promise<AuthApiResponse> {
  const res = await http.post<AuthApiResponse>('/api/auth/reset-password', {
    Email: data.email,
    Otp: data.otp,
    NewPassword: data.newPassword,
  })
  return res.data
}
