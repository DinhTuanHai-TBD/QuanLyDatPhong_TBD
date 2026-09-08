import { useState, useMemo } from 'react';
import {
  Input,
  Button,
  Segmented,
  Pagination,
  Skeleton,
  Empty,
  message,
  Typography,
  Breadcrumb,
} from 'antd';
import {
  SearchOutlined,
  CheckOutlined,
  ReloadOutlined,
  BellOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  InfoCircleFilled,
  ClockCircleFilled,
  RightOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

import { http } from '../../api/http';
import { getUserEmail, getUserRole } from '../../api/authUtils';
import { isBookingUrgent, isPendingBooking } from '../../utils/bookingStatusUtils';
import type { Booking } from '../../types/booking';

dayjs.extend(relativeTime);
dayjs.locale('vi');

const { Title, Paragraph } = Typography;

export interface NotificationItem {
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

type MainFilter = 'all' | 'unread' | 'booking' | 'issue';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userEmail = getUserEmail();
  const userRole = getUserRole();
  const isAdmin = userRole === 'admin' || userRole === 'approver';
  const accessToken = localStorage.getItem('accessToken');

  const [activeTab, setActiveTab] = useState<MainFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Track locally marked read IDs
  const [localReadIds, setLocalReadIds] = useState<Set<string | number>>(() => {
    try {
      const saved = localStorage.getItem('tbd_read_notification_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Query notifications
  const { data: rawNotifications = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['notifications', userEmail],
    queryFn: async () => {
      if (!accessToken) return [];
      const res = await http.get('/api/notifications');
      if (res.status === 204) return [];

      let items: NotificationItem[] = [];
      if (Array.isArray(res.data)) {
        items = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        items = res.data.data;
      } else if (res.data && Array.isArray(res.data.items)) {
        items = res.data.items;
      } else if (res.data && Array.isArray(res.data.notifications)) {
        items = res.data.notifications;
      }
      return items;
    },
    enabled: !!accessToken,
  });

  // Admin urgent bookings query
  const { data: adminBookings = [] } = useQuery<Booking[]>({
    queryKey: ['admin-urgent-bookings-notifications'],
    queryFn: async () => {
      try {
        const res = await http.get<Booking[]>('/api/bookings');
        return res.data;
      } catch {
        return [];
      }
    },
    enabled: !!accessToken && isAdmin,
  });

  // Generate urgent notifications for admin
  const urgentNotifications: NotificationItem[] = useMemo(() => {
    if (!isAdmin || !Array.isArray(adminBookings)) return [];
    return adminBookings
      .filter((b) => isPendingBooking(b) && isBookingUrgent(b))
      .map((b) => ({
        id: `urgent-booking-${b.id}`,
        title: 'Cần duyệt gấp (< 2h)',
        message: `Đơn đặt phòng #${b.id} tại ${b.roomName} chỉ còn dưới 2 tiếng nữa sẽ diễn ra, cần phê duyệt ngay!`,
        type: 'urgent',
        isUnread: true,
        createdAt: b.startTime,
        link: '/approvals',
      }));
  }, [isAdmin, adminBookings]);

  // Combine and deduplicate
  const allNotifications = useMemo(() => {
    const existingUrgentIds = new Set(
      rawNotifications
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

    return [...urgentFiltered, ...rawNotifications];
  }, [urgentNotifications, rawNotifications]);

  // Check read status
  const isItemRead = (item: NotificationItem) => {
    if (localReadIds.has(item.id)) return true;
    if (typeof item.isUnread === 'boolean') return !item.isUnread;
    if (typeof item.read === 'boolean') return item.read;
    if (typeof item.isRead === 'boolean') return item.isRead;
    return true;
  };

  // Helper classification
  const getNotificationCategory = (item: NotificationItem) => {
    const title = (item.title || '').toLowerCase();
    const message = (item.message || item.content || '').toLowerCase();
    const type = (item.type || '').toLowerCase();
    const full = `${title} ${message} ${type}`;

    if (
      String(item.id).startsWith('urgent-booking-') ||
      full.includes('cần duyệt gấp') ||
      full.includes('duyệt gấp') ||
      full.includes('< 2h')
    ) {
      return 'urgent';
    }
    if (full.includes('sự cố') || full.includes('thiết bị') || full.includes('báo hỏng') || full.includes('hỏng')) {
      return 'issue';
    }
    if (
      full.includes('đặt phòng') ||
      full.includes('phê duyệt') ||
      full.includes('từ chối') ||
      full.includes('hết hạn') ||
      full.includes('booking')
    ) {
      return 'booking';
    }
    return 'system';
  };

  // Filtered list based on tab & search
  const filteredNotifications = useMemo(() => {
    return allNotifications.filter((item) => {
      const isRead = isItemRead(item);
      const cat = getNotificationCategory(item);
      const title = (item.title || '').toLowerCase();
      const content = (item.message || item.content || '').toLowerCase();
      const q = searchKeyword.trim().toLowerCase();

      // Tab matching
      if (activeTab === 'unread' && isRead) return false;
      if (activeTab === 'booking' && cat !== 'booking' && cat !== 'urgent') return false;
      if (activeTab === 'issue' && cat !== 'issue') return false;

      // Keyword matching
      if (q && !title.includes(q) && !content.includes(q)) {
        return false;
      }

      return true;
    });
  }, [allNotifications, activeTab, searchKeyword, localReadIds]);

  // Pagination slice
  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  // Counts for tabs
  const unreadCount = useMemo(() => {
    return allNotifications.filter((n) => !isItemRead(n)).length;
  }, [allNotifications, localReadIds]);

  const bookingCount = useMemo(() => {
    return allNotifications.filter((n) => {
      const cat = getNotificationCategory(n);
      return cat === 'booking' || cat === 'urgent';
    }).length;
  }, [allNotifications]);

  const issueCount = useMemo(() => {
    return allNotifications.filter((n) => getNotificationCategory(n) === 'issue').length;
  }, [allNotifications]);

  // Mark single as read
  const markAsRead = (item: NotificationItem) => {
    if (!isItemRead(item)) {
      setLocalReadIds((prev) => {
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

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (allNotifications.length === 0) return;
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      allNotifications.forEach((n) => next.add(n.id));
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

    message.success('Đã đánh dấu tất cả thông báo là đã đọc');
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  // Click notification to navigate
  const handleItemClick = (item: NotificationItem) => {
    markAsRead(item);

    if (item.link) {
      navigate(item.link);
      return;
    }

    const title = (item.title || '').toLowerCase();
    const messageText = (item.message || item.content || '').toLowerCase();
    const full = `${title} ${messageText}`;
    const cat = getNotificationCategory(item);

    if (cat === 'urgent') {
      navigate('/approvals');
      return;
    }

    if (full.includes('hết hạn') || full.includes('expired')) {
      navigate('/bookings');
      return;
    }

    if (full.includes('từ chối') || full.includes('phê duyệt') || full.includes('đã duyệt')) {
      navigate('/booking-history');
      return;
    }

    if (cat === 'issue' || full.includes('sự cố') || full.includes('thiết bị')) {
      navigate(isAdmin ? '/admin' : '/report-issue');
      return;
    }

    if (full.includes('cần duyệt') || full.includes('yêu cầu mới')) {
      navigate(isAdmin ? '/approvals' : '/booking-history');
      return;
    }

    navigate(isAdmin ? '/approvals' : '/booking-history');
  };

  // Visual badges & icons
  const getItemVisuals = (item: NotificationItem) => {
    const title = (item.title || '').toLowerCase();
    const msg = (item.message || item.content || '').toLowerCase();
    const full = `${title} ${msg}`;
    const cat = getNotificationCategory(item);

    if (cat === 'urgent') {
      return {
        icon: <ClockCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />,
        tagText: 'CẦN DUYỆT GẤP',
        tagBg: '#fef2f2',
        tagColor: '#dc2626',
        tagBorder: '#fecaca',
        actionLabel: 'Phê duyệt ngay',
      };
    }

    if (full.includes('hết hạn') || full.includes('expired')) {
      return {
        icon: <ExclamationCircleFilled style={{ color: '#f59e0b', fontSize: 18 }} />,
        tagText: 'HẾT HẠN',
        tagBg: '#fffbeb',
        tagColor: '#d97706',
        tagBorder: '#fde68a',
        actionLabel: 'Đặt lại ca khác',
      };
    }

    if (full.includes('từ chối') || full.includes('rejected') || full.includes('bác bỏ')) {
      return {
        icon: <CloseCircleFilled style={{ color: '#ef4444', fontSize: 18 }} />,
        tagText: 'TỪ CHỐI',
        tagBg: '#fef2f2',
        tagColor: '#dc2626',
        tagBorder: '#fecaca',
        actionLabel: 'Xem chi tiết',
      };
    }

    if (full.includes('phê duyệt') || full.includes('đã duyệt') || full.includes('thành công') || full.includes('chấp thuận')) {
      return {
        icon: <CheckCircleFilled style={{ color: '#10b981', fontSize: 18 }} />,
        tagText: 'PHÊ DUYỆT',
        tagBg: '#ecfdf5',
        tagColor: '#059669',
        tagBorder: '#a7f3d0',
        actionLabel: 'Xem phiếu mượn',
      };
    }

    if (cat === 'issue') {
      return {
        icon: <ExclamationCircleFilled style={{ color: '#ea580c', fontSize: 18 }} />,
        tagText: 'SỰ CỐ THIẾT BỊ',
        tagBg: '#fff7ed',
        tagColor: '#c2410c',
        tagBorder: '#ffedd5',
        actionLabel: 'Xem sự cố',
      };
    }

    if (cat === 'booking') {
      return {
        icon: <InfoCircleFilled style={{ color: '#0284c7', fontSize: 18 }} />,
        tagText: 'ĐẶT PHÒNG',
        tagBg: '#f0f9ff',
        tagColor: '#0369a1',
        tagBorder: '#bae6fd',
        actionLabel: 'Xem chi tiết',
      };
    }

    return {
      icon: <InfoCircleFilled style={{ color: '#6366f1', fontSize: 18 }} />,
      tagText: 'HỆ THỐNG',
      tagBg: '#eef2ff',
      tagColor: '#4f46e5',
      tagBorder: '#e0e7ff',
      actionLabel: 'Xem thông báo',
    };
  };

  return (
    <div
      style={{
        backgroundColor: '#f8fafc',
        minHeight: 'calc(100vh - 140px)',
        padding: '28px 16px 48px',
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
        {/* Breadcrumb */}
        <Breadcrumb
          style={{ marginBottom: 16, fontSize: 13 }}
          items={[
            {
              title: (
                <span
                  style={{ cursor: 'pointer', color: '#64748b' }}
                  onClick={() => navigate('/')}
                >
                  <HomeOutlined style={{ marginRight: 4 }} />
                  Trang chủ
                </span>
              ),
            },
            {
              title: <span style={{ color: '#0f172a', fontWeight: 600 }}>Thông báo</span>,
            },
          ]}
        />

        {/* Header Section */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            marginBottom: 24,
            paddingBottom: 20,
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: '#0d2e5c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: 18,
                }}
              >
                <BellOutlined />
              </div>
              <Title
                level={2}
                style={{
                  margin: 0,
                  color: '#0d2e5c',
                  fontWeight: 700,
                  fontSize: 24,
                  letterSpacing: '-0.3px',
                }}
              >
                Trung Tâm Thông Báo
              </Title>
            </div>
            <Paragraph style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              Cập nhật kịp thời trạng thái đơn đặt phòng, lịch giảng dạy và các sự cố cơ sở vật chất TBD.
            </Paragraph>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              icon={<ReloadOutlined spin={isRefetching} />}
              onClick={() => {
                refetch();
                message.info('Đang cập nhật danh sách thông báo...');
              }}
              style={{
                borderRadius: 6,
                fontWeight: 500,
                borderColor: '#cbd5e1',
                color: '#334155',
              }}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                backgroundColor: unreadCount > 0 ? '#0d2e5c' : '#94a3b8',
                borderColor: unreadCount > 0 ? '#0d2e5c' : '#94a3b8',
              }}
            >
              Đánh dấu tất cả đã đọc
            </Button>
          </div>
        </div>

        {/* Toolbar: Segmented Filters + Search Input */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 10,
            padding: '14px 18px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Segmented filter */}
          <Segmented
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val as MainFilter);
              setCurrentPage(1);
            }}
            options={[
              {
                label: `Tất cả (${allNotifications.length})`,
                value: 'all',
              },
              {
                label: (
                  <span style={{ fontWeight: unreadCount > 0 ? 700 : 400 }}>
                    Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
                  </span>
                ),
                value: 'unread',
              },
              {
                label: `Đặt phòng (${bookingCount})`,
                value: 'booking',
              },
              {
                label: `Sự cố thiết bị (${issueCount})`,
                value: 'issue',
              },
            ]}
            style={{
              backgroundColor: '#f1f5f9',
              padding: 3,
              borderRadius: 8,
              fontWeight: 500,
            }}
          />

          {/* Search Box */}
          <Input
            placeholder="Tìm kiếm thông báo theo nội dung..."
            prefix={<SearchOutlined style={{ color: '#94a3b8', marginRight: 4 }} />}
            value={searchKeyword}
            onChange={(e) => {
              setSearchKeyword(e.target.value);
              setCurrentPage(1);
            }}
            allowClear
            style={{
              width: 280,
              maxWidth: '100%',
              borderRadius: 6,
            }}
          />
        </div>

        {/* Notifications List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoading ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 10,
                padding: 24,
                border: '1px solid #e2e8f0',
              }}
            >
              <Skeleton active avatar paragraph={{ rows: 2 }} />
              <div style={{ margin: '16px 0' }} />
              <Skeleton active avatar paragraph={{ rows: 2 }} />
              <div style={{ margin: '16px 0' }} />
              <Skeleton active avatar paragraph={{ rows: 2 }} />
            </div>
          ) : paginatedNotifications.length === 0 ? (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 10,
                padding: '48px 24px',
                textAlign: 'center',
                border: '1px solid #e2e8f0',
              }}
            >
              <Empty
                description={
                  <div>
                    <div style={{ fontWeight: 600, color: '#334155', fontSize: 15, marginBottom: 4 }}>
                      Không có thông báo nào phù hợp
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>
                      {searchKeyword
                        ? 'Vui lòng thử tìm kiếm bằng từ khóa khác hoặc xóa bộ lọc.'
                        : 'Bạn đã đọc hết các thông báo hoặc chưa có thông báo mới.'}
                    </div>
                  </div>
                }
              />
            </div>
          ) : (
            paginatedNotifications.map((item) => {
              const isRead = isItemRead(item);
              const visuals = getItemVisuals(item);
              const rawDate = item.createdAt || item.created_at;
              const dateObj = rawDate ? dayjs(rawDate) : null;
              const relativeText = dateObj && dateObj.isValid() ? dateObj.fromNow() : 'Vừa xong';
              const fullDateText = dateObj && dateObj.isValid() ? dateObj.format('HH:mm - DD/MM/YYYY') : '';

              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  style={{
                    backgroundColor: isRead ? '#ffffff' : '#f0f7ff',
                    borderRadius: 10,
                    padding: '16px 20px',
                    border: isRead ? '1px solid #e2e8f0' : '1px solid #bae6fd',
                    boxShadow: isRead
                      ? '0 1px 2px rgba(0, 0, 0, 0.02)'
                      : '0 2px 8px rgba(2, 132, 199, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 16,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isRead
                      ? '0 1px 2px rgba(0, 0, 0, 0.02)'
                      : '0 2px 8px rgba(2, 132, 199, 0.08)';
                  }}
                >
                  {/* Status Icon */}
                  <div
                    style={{
                      marginTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    {visuals.icon}
                  </div>

                  {/* Main Content Area */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {/* Category Tag */}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            backgroundColor: visuals.tagBg,
                            color: visuals.tagColor,
                            border: `1px solid ${visuals.tagBorder}`,
                            letterSpacing: '0.3px',
                          }}
                        >
                          {visuals.tagText}
                        </span>

                        {/* Title */}
                        <span
                          style={{
                            fontWeight: isRead ? 600 : 700,
                            fontSize: 14.5,
                            color: isRead ? '#1e293b' : '#0f172a',
                          }}
                        >
                          {item.title || 'Thông báo mới'}
                        </span>

                        {/* Unread indicator dot */}
                        {!isRead && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: '#0284c7',
                              display: 'inline-block',
                            }}
                          />
                        )}
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500, color: isRead ? '#94a3b8' : '#0369a1' }}>
                          {relativeText}
                        </span>
                        {fullDateText && (
                          <span style={{ marginLeft: 6, color: '#cbd5e1' }}>
                            ({fullDateText})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Message Body */}
                    <Paragraph
                      style={{
                        color: isRead ? '#475569' : '#1e293b',
                        fontSize: 13.5,
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {item.message || item.content || 'Nội dung thông báo'}
                    </Paragraph>
                  </div>

                  {/* Navigation Action Arrow */}
                  <div
                    style={{
                      alignSelf: 'center',
                      color: '#94a3b8',
                      fontSize: 13,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      paddingLeft: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#0284c7' }} className="hover-action">
                      {visuals.actionLabel}
                    </span>
                    <RightOutlined style={{ fontSize: 11, color: '#0284c7' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {filteredNotifications.length > pageSize && (
          <div
            style={{
              marginTop: 24,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredNotifications.length}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
