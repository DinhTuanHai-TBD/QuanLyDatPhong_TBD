import { getUserRole } from '../api/authUtils';

export interface NotificationLike {
  id?: string | number;
  title?: string;
  message?: string;
  content?: string;
  type?: string;
  link?: string;
  url?: string;
  path?: string;
  data?: any;
}

/**
 * Determine the exact destination page for any notification based on its content, type, and current user role.
 */
export function getNotificationTargetUrl(item: NotificationLike, overrideRole?: string): string {
  // 1. Explicit link directly provided by API or creator
  const explicitLink = item.link || item.url || item.path;
  if (explicitLink && typeof explicitLink === 'string' && explicitLink.trim()) {
    return explicitLink.trim();
  }

  const role = (overrideRole || getUserRole() || '').toLowerCase();
  const isAdminOrApprover = 
    role === 'admin' || 
    role === 'approver' || 
    role === 'staff' ||
    role.includes('manager') || 
    role.includes('quản lý') ||
    role.includes('cán bộ') ||
    role.includes('đào tạo');

  const title = (item.title || '').toLowerCase();
  const message = (item.message || item.content || '').toLowerCase();
  const type = (item.type || '').toLowerCase();
  const idStr = String(item.id || '').toLowerCase();
  const full = `${title} ${message} ${type} ${idStr}`;

  // 2. Sự cố kỹ thuật / Thiết bị hỏng / Báo cáo sự cố
  if (
    full.includes('sự cố') ||
    full.includes('thiết bị') ||
    full.includes('hỏng') ||
    full.includes('báo cáo sự cố') ||
    full.includes('bảo trì thiết bị') ||
    full.includes('sửa chữa') ||
    type === 'issue' ||
    type === 'equipment' ||
    type === 'broken'
  ) {
    return isAdminOrApprover ? '/admin?tab=equipment-issues' : '/report-issue';
  }

  // 3. Thời khóa biểu / Lịch học / Lịch phòng / Đổi phòng học
  if (
    full.includes('thời khóa biểu') ||
    full.includes('lịch học') ||
    full.includes('lịch phòng') ||
    full.includes('đổi phòng') ||
    full.includes('chuyển phòng') ||
    full.includes('tiết học') ||
    full.includes('giảng đường') ||
    type === 'schedule' ||
    type === 'timetable' ||
    type === 'calendar'
  ) {
    return '/calendar';
  }

  // 4. Khẩn cấp: Đơn cần duyệt gấp (< 1h / < 2h)
  if (
    idStr.startsWith('urgent-booking-') ||
    full.includes('cần duyệt gấp') ||
    full.includes('duyệt gấp') ||
    full.includes('< 1h') ||
    full.includes('< 2h') ||
    full.includes('khẩn cấp') ||
    type === 'urgent'
  ) {
    return isAdminOrApprover ? '/approvals?status=Pending' : '/booking-history?status=pending';
  }

  // 5. Đơn đặt phòng hết hạn (quá giờ chưa duyệt)
  if (
    full.includes('hết hạn') ||
    full.includes('expired') ||
    full.includes('quá giờ') ||
    type === 'expired'
  ) {
    // Nếu là sinh viên/giảng viên: nếu thông báo có nhắc đặt lại phòng thì chuyển sang trang đặt phòng
    if (!isAdminOrApprover && (full.includes('đặt lại') || full.includes('ca khác'))) {
      return '/bookings';
    }
    return isAdminOrApprover ? '/approvals?status=Expired' : '/booking-history?status=expired';
  }

  // 6. Đơn đặt phòng đã được phê duyệt / Chấp thuận
  if (
    full.includes('phê duyệt thành công') ||
    full.includes('đã được phê duyệt') ||
    full.includes('đã được duyệt') ||
    full.includes('đơn đặt phòng được duyệt') ||
    full.includes('chấp thuận') ||
    type === 'approved' ||
    (type === 'success' && !full.includes('chờ duyệt') && !full.includes('yêu cầu mới'))
  ) {
    return isAdminOrApprover ? '/approvals?status=Approved' : '/booking-history?status=approved';
  }

  // 7. Đơn đặt phòng bị từ chối / Bị bác bỏ
  if (
    full.includes('từ chối') ||
    full.includes('rejected') ||
    full.includes('bác bỏ') ||
    full.includes('bị từ chối') ||
    type === 'rejected'
  ) {
    return isAdminOrApprover ? '/approvals?status=Rejected' : '/booking-history?status=rejected';
  }

  // 8. Đã hủy / Hủy đặt phòng
  if (
    full.includes('đã hủy') ||
    full.includes('bị hủy') ||
    full.includes('hủy đơn') ||
    full.includes('hủy đặt phòng') ||
    type === 'cancelled'
  ) {
    return isAdminOrApprover ? '/approvals?status=Cancelled' : '/booking-history?status=cancelled';
  }

  // 9. Nhận phòng / Check-in / Sắp tới giờ sử dụng phòng
  if (
    full.includes('check-in') ||
    full.includes('checkin') ||
    full.includes('nhận phòng') ||
    full.includes('sắp tới giờ') ||
    full.includes('chuẩn bị sử dụng')
  ) {
    return isAdminOrApprover ? '/approvals' : '/booking-history?status=approved';
  }

  // 10. Yêu cầu đặt phòng mới / Chờ duyệt
  if (
    full.includes('yêu cầu mới') ||
    full.includes('cần duyệt') ||
    full.includes('chờ duyệt') ||
    full.includes('chờ phê duyệt') ||
    full.includes('đặt phòng') ||
    type === 'booking' ||
    type === 'pending'
  ) {
    return isAdminOrApprover ? '/approvals?status=Pending' : '/booking-history?status=pending';
  }

  // 11. Quản lý phòng học / Danh mục phòng / Cơ sở vật chất
  if (
    full.includes('phòng học') ||
    full.includes('danh mục phòng') ||
    full.includes('thêm phòng') ||
    type === 'room'
  ) {
    return isAdminOrApprover ? '/admin?tab=rooms' : '/rooms';
  }

  // 12. Tài khoản / Người dùng / Phân quyền
  if (
    full.includes('tài khoản') ||
    full.includes('người dùng') ||
    full.includes('phân quyền') ||
    type === 'user' ||
    type === 'account'
  ) {
    return isAdminOrApprover ? '/admin?tab=users' : '/';
  }

  // 13. Mặc định theo phân quyền
  return isAdminOrApprover ? '/approvals' : '/booking-history';
}
