import { useState, useEffect, useMemo } from 'react';
import { Badge, Popover, Button, Spin, Result } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { http } from '../../api/http';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

import { getUserEmail, getUserRole } from '../../api/authUtils';
import { isBookingUrgent, isPendingBooking } from '../../utils/bookingStatusUtils';
import type { Booking } from '../../types/booking';

dayjs.extend(relativeTime);
dayjs.locale('vi');

export interface RealNotification {
  id: string | number;
  title?: string;
  message?: string;
  content?: string;
  type?: string;
  read?: boolean;
  isRead?: boolean;
  isUnread?: boolean;
  createdAt?: string;
  created_at?: string;
  link?: string;
}

export type NotificationCategory = 'urgent' | 'expired' | 'approved' | 'rejected' | 'system';

interface CategoryConfig {
  tagText: string;
  dotColor: string;
  tagColor: string;
  tagBg: string;
  tagBorder: string;
  actionText: string;
  actionLink: string;
  isUrgent?: boolean;
}

function classifyNotification(item: RealNotification): NotificationCategory {
  const title = (item.title || '').toLowerCase();
  const message = (item.message || item.content || '').toLowerCase();
  const type = (item.type || '').toLowerCase();
  const idStr = String(item.id);
  const full = `${title} ${message} ${type}`;

  // 1. Cần duyệt gấp (< 2h)
  if (
    idStr.startsWith('urgent-booking-') ||
    full.includes('cần duyệt gấp') ||
    full.includes('duyệt gấp') ||
    full.includes('< 2h') ||
    full.includes('< 2 tiếng')
  ) {
    return 'urgent';
  }

  // 2. Hết hạn (quá giờ bắt đầu)
  if (
    full.includes('hết hạn') ||
    full.includes('expired') ||
    full.includes('quá giờ')
  ) {
    return 'expired';
  }

  // 3. Từ chối / Hủy
  if (
    full.includes('từ chối') ||
    full.includes('rejected') ||
    full.includes('bác bỏ') ||
    full.includes('bị từ chối') ||
    full.includes('đã hủy') ||
    full.includes('bị hủy')
  ) {
    return 'rejected';
  }

  // 4. Phê duyệt thành công
  if (
    full.includes('phê duyệt thành công') ||
    full.includes('đã được phê duyệt') ||
    full.includes('đã được duyệt') ||
    full.includes('đơn đặt phòng được duyệt') ||
    full.includes('chấp thuận') ||
    type === 'approved' ||
    (type === 'success' && !full.includes('chờ duyệt') && !full.includes('yêu cầu mới'))
  ) {
    return 'approved';
  }

  // 5. Thông báo hệ thống / sự cố / bảo trì
  return 'system';
}

function getCategoryConfig(category: NotificationCategory, item: RealNotification): CategoryConfig {
  const fullText = `${item.title || ''} ${item.message || item.content || ''}`.toLowerCase();
  const role = getUserRole();
  const isAdmin = role === 'admin' || role === 'approver';

  switch (category) {
    case 'urgent':
      return {
        tagText: '• [CẦN DUYỆT GẤP]',
        dotColor: '#ef4444',
        tagColor: '#dc2626',
        tagBg: '#fef2f2',
        tagBorder: '#fecaca',
        actionText: 'Phê duyệt ngay',
        actionLink: '/approvals',
        isUrgent: true,
      };
    case 'expired':
      return {
        tagText: '• [HẾT HẠN]',
        dotColor: '#f59e0b',
        tagColor: '#d97706',
        tagBg: '#fffbeb',
        tagBorder: '#fde68a',
        actionText: 'Đặt lại ca khác',
        actionLink: '/bookings',
      };
    case 'rejected':
      return {
        tagText: '• [TỪ CHỐI]',
        dotColor: '#ef4444',
        tagColor: '#dc2626',
        tagBg: '#fef2f2',
        tagBorder: '#fecaca',
        actionText: 'Xem chi tiết',
        actionLink: '/booking-history',
      };
    case 'approved':
      return {
        tagText: '• [PHÊ DUYỆT]',
        dotColor: '#10b981',
        tagColor: '#059669',
        tagBg: '#ecfdf5',
        tagBorder: '#a7f3d0',
        actionText: 'Xem phiếu mượn',
        actionLink: '/booking-history',
      };
    case 'system':
    default: {
      const isIssue = fullText.includes('sự cố') || fullText.includes('thiết bị') || fullText.includes('hỏng');
      return {
        tagText: '• [HỆ THỐNG]',
        dotColor: '#3b82f6',
        tagColor: '#2563eb',
        tagBg: '#eff6ff',
        tagBorder: '#bfdbfe',
        actionText: isIssue ? 'Xem sự cố' : 'Xem chi tiết',
        actionLink: isIssue ? (isAdmin ? '/admin' : '/report-issue') : (isAdmin ? '/approvals' : '/booking-history'),
      };
    }
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const navigate = useNavigate();
  const userEmail = getUserEmail();
  const accessToken = localStorage.getItem('accessToken');

  // Track locally marked read IDs for instant UI feedback and persistence
  const [localReadIds, setLocalReadIds] = useState<Set<string | number>>(() => {
    try {
      const saved = localStorage.getItem('tbd_read_notification_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Fetch notifications from API
  const { data: notifications = [], isLoading, error: apiError, refetch } = useQuery({
    queryKey: ['notifications', userEmail],
    queryFn: async () => {
      if (!accessToken) return [];
      const response = await http.get('/api/notifications');
      if (response.status === 204) return [];
      
      let items = [];
      if (Array.isArray(response.data)) {
        items = response.data;
      } else if (response.data && Array.isArray(response.data.data)) {
        items = response.data.data;
      } else if (response.data && Array.isArray(response.data.items)) {
        items = response.data.items;
      } else if (response.data && Array.isArray(response.data.notifications)) {
        items = response.data.notifications;
      }
      return items as RealNotification[];
    },
    enabled: !!accessToken,
    refetchInterval: 10000,
  });

  // Re-fetch when opening popover
  useEffect(() => {
    if (open && accessToken) {
      refetch();
    }
  }, [open, accessToken, refetch]);

  const userRole = getUserRole();
  const isAdminOrApprover = userRole === 'admin' || userRole === 'approver';

  // Query bookings for admin to detect urgent pending bookings (< 2h)
  const { data: adminBookings = [] } = useQuery<Booking[]>({
    queryKey: ['admin-urgent-bookings-notifications'],
    queryFn: async () => {
      try {
        const res = await http.get<Booking[]>('/api/bookings');
        return res.data;
      } catch {
        const local = localStorage.getItem('tbd_admin_bookings');
        if (local) {
          try {
            return JSON.parse(local) as Booking[];
          } catch {}
        }
        return [];
      }
    },
    enabled: !!accessToken && isAdminOrApprover,
    refetchInterval: 15000,
  });

  const urgentNotifications: RealNotification[] = useMemo(() => {
    if (!isAdminOrApprover || !Array.isArray(adminBookings)) return [];
    return adminBookings
      .filter((b) => isPendingBooking(b) && isBookingUrgent(b))
      .map((b) => ({
        id: `urgent-booking-${b.id}`,
        title: 'Cần duyệt gấp (< 2h)',
        message: `Đơn đặt phòng #${b.id} tại ${b.roomName} chỉ còn dưới 2 tiếng nữa sẽ diễn ra, cần phê duyệt ngay!`,
        type: 'error',
        isUnread: true,
        createdAt: b.startTime,
        link: '/approvals'
      }));
  }, [isAdminOrApprover, adminBookings]);

  const allNotifications = useMemo(() => {
    const existingUrgentIds = new Set(
      notifications
        .map((n) => {
          const match = (n.message || '').match(/#(\d+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean)
    );

    const urgentFiltered = urgentNotifications.filter((un) => {
      const idStr = String(un.id).replace('urgent-booking-', '');
      return !existingUrgentIds.has(idStr);
    });

    return [...urgentFiltered, ...notifications];
  }, [urgentNotifications, notifications]);

  const isItemRead = (item: RealNotification) => {
    if (localReadIds.has(item.id)) return true;
    if (typeof item.isUnread === 'boolean') return !item.isUnread;
    if (typeof item.read === 'boolean') return item.read;
    if (typeof item.isRead === 'boolean') return item.isRead;
    return true; 
  };

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => !isItemRead(n)).length;
  }, [allNotifications, localReadIds]);

  const displayedNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return allNotifications.filter(n => !isItemRead(n));
    }
    return allNotifications;
  }, [allNotifications, filterTab, localReadIds]);

  const markItemAsRead = (item: RealNotification) => {
    if (!isItemRead(item)) {
      setLocalReadIds(prev => {
        const next = new Set(prev);
        next.add(item.id);
        try {
          localStorage.setItem('tbd_read_notification_ids', JSON.stringify(Array.from(next)));
        } catch {}
        return next;
      });
      http.put(`/api/notifications/${item.id}/read`).catch(() => {});
      http.post(`/api/notifications/${item.id}/read`).catch(() => {});
    }
  };

  const handleMarkAllAsRead = async () => {
    if (allNotifications.length === 0) return;
    setLocalReadIds(prev => {
      const next = new Set(prev);
      allNotifications.forEach(n => next.add(n.id));
      try {
        localStorage.setItem('tbd_read_notification_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    try {
      await http.put('/api/notifications/read-all');
    } catch {}
    try {
      await http.post('/api/notifications/read-all');
    } catch {}
    refetch();
  };

  const handleNotificationClick = (item: RealNotification, customLink?: string) => {
    markItemAsRead(item);
    setOpen(false);

    if (customLink) {
      navigate(customLink);
      return;
    }

    const category = classifyNotification(item);
    const title = (item.title || '').toLowerCase();
    const message = (item.message || item.content || '').toLowerCase();
    const fullText = `${title} ${message}`;
    const role = getUserRole();
    const isAdmin = role === 'admin' || role === 'approver';

    if (category === 'urgent') {
      navigate('/approvals');
      return;
    }
    if (category === 'expired') {
      navigate('/bookings');
      return;
    }
    if (category === 'approved' || category === 'rejected') {
      navigate('/booking-history');
      return;
    }

    // Equipment issue notifications
    if (fullText.includes('sự cố') || fullText.includes('thiết bị') || fullText.includes('hỏng')) {
      navigate(isAdmin ? '/admin' : '/report-issue');
      return;
    }

    // Booking approval needed for admin/approver
    if (fullText.includes('cần duyệt') || fullText.includes('yêu cầu mới') || (isAdmin && (fullText.includes('đặt phòng') || fullText.includes('yêu cầu')))) {
      navigate('/approvals');
      return;
    }

    // Explicit link if available
    if (item.link) {
      navigate(item.link);
      return;
    }

    // Fallback based on role
    navigate(isAdmin ? '/approvals' : '/booking-history');
  };

  const getMessage = (item: RealNotification) => item.message || item.content || '';
  const getCreatedAt = (item: RealNotification) => item.createdAt || item.created_at || '';

  if (!accessToken) {
    return null;
  }

  let errorSubTitle = "Đã có lỗi xảy ra khi kết nối đến máy chủ.";
  if (apiError) {
    const status = (apiError as any)?.response?.status;
    if (status === 401) {
      errorSubTitle = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    } else if (status === 403) {
      errorSubTitle = "Bạn không có quyền xem thông báo.";
    } else if (status === 404) {
      errorSubTitle = "Backend chưa nhận endpoint thông báo.";
    } else if (status === 500) {
      errorSubTitle = "Backend gặp lỗi khi lấy thông báo.";
    } else if (apiError.message === 'Network Error' || (apiError as any).code === 'ERR_NETWORK') {
      errorSubTitle = "Không thể kết nối đến backend.";
    } else if ((apiError as any)?.response?.data?.message) {
      errorSubTitle = (apiError as any).response.data.message;
    }
  }

  const dropdownContent = (
    <div style={{ width: 390, maxWidth: 'calc(100vw - 24px)', display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff' }}>
      {/* Header Hộp Thông Báo (Tối giản & Có Tab lọc) */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
        {/* Dòng 1: Tiêu đề + Đánh dấu đã đọc tất cả */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Thông báo</span>

          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0}
            style={{
              background: 'none',
              border: 'none',
              color: unreadCount > 0 ? '#0284c7' : '#94a3b8',
              fontSize: 12,
              fontWeight: 500,
              cursor: unreadCount > 0 ? 'pointer' : 'default',
              padding: 0,
              transition: 'color 0.15s ease',
            }}
          >
            Đánh dấu đã đọc tất cả
          </button>
        </div>

        {/* Dòng 2: Thanh Tab lọc nhanh dạng chữ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              color: filterTab === 'all' ? '#0d2e5c' : '#64748b',
              fontWeight: filterTab === 'all' ? 700 : 500,
              borderBottom: filterTab === 'all' ? '2px solid #0d2e5c' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Tất cả ({allNotifications.length})
          </button>
          <span style={{ color: '#cbd5e1', userSelect: 'none' }}>|</span>
          <button
            type="button"
            onClick={() => setFilterTab('unread')}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              color: filterTab === 'unread' ? '#0d2e5c' : '#64748b',
              fontWeight: filterTab === 'unread' ? 700 : 500,
              borderBottom: filterTab === 'unread' ? '2px solid #0d2e5c' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Chưa đọc ({unreadCount})
          </button>
        </div>
      </div>

      {/* Danh sách thông báo (Smooth Scroll) */}
      <div
        style={{
          maxHeight: 420,
          overflowY: 'auto',
          backgroundColor: '#ffffff',
        }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin size="medium" />
          </div>
        ) : apiError ? (
          <div style={{ padding: '24px 16px' }}>
            <Result
              status="error"
              title={<span style={{ fontSize: 14, fontWeight: 600 }}>Không thể tải thông báo</span>}
              subTitle={<span style={{ fontSize: 12 }}>{errorSubTitle}</span>}
              extra={[
                <Button size="small" type="primary" key="retry" onClick={() => refetch()}>
                  Thử lại
                </Button>
              ]}
            />
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            <BellOutlined style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }} />
            <div style={{ fontSize: 13 }}>
              {filterTab === 'unread' ? 'Bạn không có thông báo chưa đọc nào.' : 'Bạn chưa có thông báo nào.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayedNotifications.map((item) => {
              const readStatus = isItemRead(item);
              const message = getMessage(item);
              const time = getCreatedAt(item);
              const category = classifyNotification(item);
              const config = getCategoryConfig(category, item);

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item, config.actionLink)}
                  style={{
                    cursor: 'pointer',
                    padding: '12px 16px',
                    backgroundColor: readStatus ? '#ffffff' : '#f0f7ff',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = readStatus ? '#f8fafc' : '#e0f2fe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = readStatus ? '#ffffff' : '#f0f7ff';
                  }}
                >
                  {/* Hàng 1: Phân loại học thuật (Nhãn chữ + Chấm tròn) & Thời gian */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '2px 7px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        color: config.tagColor,
                        backgroundColor: config.tagBg,
                        border: `1px solid ${config.tagBorder}`,
                      }}
                    >
                      <span
                        className={config.isUrgent ? 'dot-pulse-red' : ''}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: config.dotColor,
                          display: 'inline-block',
                        }}
                      />
                      {config.tagText}
                    </span>

                    <span style={{ color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>
                      {time ? dayjs(time).fromNow() : ''}
                    </span>
                  </div>

                  {/* Hàng 2: Tiêu đề in đậm rõ ràng */}
                  <div
                    style={{
                      fontWeight: readStatus ? 600 : 700,
                      color: '#0f172a',
                      fontSize: 13,
                      lineHeight: 1.4,
                      marginTop: 2,
                    }}
                  >
                    {item.title || 'Thông báo mới'}
                  </div>

                  {/* Hàng 3: Nội dung mô tả (Phòng, ngày giờ) hiển thị gọn gàng tối đa 2 dòng */}
                  {message && (
                    <div
                      style={{
                        color: '#475569',
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {message}
                    </div>
                  )}

                  {/* Hàng 4: Nút hành động nhanh 1-chạm (Actionable Link) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNotificationClick(item, config.actionLink);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 5,
                        padding: '2px 9px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: '#0d2e5c',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0d2e5c';
                        e.currentTarget.style.color = '#ffffff';
                        e.currentTarget.style.borderColor = '#0d2e5c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.color = '#0d2e5c';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      {config.actionText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Hộp Thông Báo */}
      <div
        style={{
          padding: '10px 16px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            navigate('/notifications');
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#0284c7',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 12px',
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#0369a1';
            e.currentTarget.style.backgroundColor = '#e0f2fe';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#0284c7';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Xem tất cả thông báo
        </button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={{ pointAtCenter: true }}
      styles={{
        root: {
          width: 390,
          maxWidth: 'calc(100vw - 24px)',
        },
        container: {
          padding: 0,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 14px 36px -4px rgba(15, 23, 42, 0.18), 0 6px 16px -2px rgba(15, 23, 42, 0.08)',
          border: '1px solid #e2e8f0',
        },
      }}
      content={dropdownContent}
    >
      <Badge 
        count={unreadCount} 
        size="small" 
        offset={[-4, 4]}
        style={unreadCount > 0 ? { backgroundColor: '#ef4444', boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)' } : undefined}
      >
        <Button 
          type="text" 
          icon={
            <BellOutlined 
              className={unreadCount > 0 ? 'bell-shake-active' : ''} 
              style={{ fontSize: 18 }} 
            />
          } 
          style={{ padding: '4px 8px', color: '#ffffff' }} 
        />
      </Badge>
    </Popover>
  );
}
