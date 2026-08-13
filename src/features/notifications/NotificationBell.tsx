import { useState, useEffect } from 'react';
import { Badge, Drawer, Button, Spin, Result } from 'antd';
import { BellOutlined, CheckCircleOutlined, InfoCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { http } from '../../api/http';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

import { getUserEmail } from '../../api/authUtils';

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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const userEmail = getUserEmail();
  const accessToken = localStorage.getItem('accessToken');

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

  // Re-fetch when opening drawer just in case
  useEffect(() => {
    if (open && accessToken) {
      refetch();
    }
  }, [open, accessToken, refetch]);

  if (!accessToken) {
    return null;
  }

  const unreadCount = notifications.filter(n => {
    if (typeof n.isUnread === 'boolean') return n.isUnread;
    if (typeof n.read === 'boolean') return !n.read;
    if (typeof n.isRead === 'boolean') return !n.isRead;
    return false; // Assumes read if undefined
  }).length;

  const handleNotificationClick = (item: RealNotification) => {
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const getIcon = (type?: string) => {
    const t = type?.toLowerCase();
    switch (t) {
      case 'success': return <CheckCircleOutlined style={{ color: '#10b981' }} />;
      case 'warning': return <WarningOutlined style={{ color: '#f59e0b' }} />;
      case 'error': return <CloseCircleOutlined style={{ color: '#ef4444' }} />;
      default: return <InfoCircleOutlined style={{ color: '#3b82f6' }} />;
    }
  };

  const getMessage = (item: RealNotification) => item.message || item.content || '';
  const getCreatedAt = (item: RealNotification) => item.createdAt || item.created_at || '';
  const isRead = (item: RealNotification) => {
    if (typeof item.isUnread === 'boolean') return !item.isUnread;
    if (typeof item.read === 'boolean') return item.read;
    if (typeof item.isRead === 'boolean') return item.isRead;
    return true; 
  };

  let errorSubTitle = "Đã có lỗi xảy ra khi kết nối đến máy chủ.";
  if (apiError) {
    const status = (apiError as any)?.response?.status;
    if (status === 401) {
      errorSubTitle = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    } else if (status === 403) {
      errorSubTitle = "Bạn không có quyền xem thông báo.";
    } else if (status === 404) {
      errorSubTitle = "Backend chưa nhận endpoint thông báo. Hãy kiểm tra backend đã được khởi động lại.";
    } else if (status === 500) {
      errorSubTitle = "Backend gặp lỗi khi lấy thông báo.";
    } else if (apiError.message === 'Network Error' || (apiError as any).code === 'ERR_NETWORK') {
      errorSubTitle = "Không thể kết nối đến backend. Hãy kiểm tra VITE_API_URL, backend và ngrok.";
    } else if ((apiError as any)?.response?.data?.message) {
      errorSubTitle = (apiError as any).response.data.message;
    }
  }

  return (
    <>
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <Button 
          type="text" 
          icon={<BellOutlined style={{ fontSize: 18 }} />} 
          style={{ padding: '4px 8px', color: '#ffffff' }} 
          onClick={() => setOpen(true)}
        />
      </Badge>

      <Drawer
        title={<div style={{ fontWeight: 600 }}>Thông báo</div>}
        placement="right"
        onClose={() => setOpen(false)}
        open={open}
        size="default"
        styles={{ body: { padding: 0, backgroundColor: '#f8fafc' } }}
      >
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin size="large" /></div>
        ) : apiError ? (
          <div style={{ padding: 40 }}>
            <Result
              status="error"
              title="Không thể tải thông báo"
              subTitle={errorSubTitle}
              extra={[
                <Button type="primary" key="retry" onClick={() => refetch()}>
                  Thử lại
                </Button>
              ]}
            />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <BellOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 14 }}>Bạn chưa có thông báo nào.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {notifications.map(item => {
              const readStatus = isRead(item);
              const message = getMessage(item);
              const time = getCreatedAt(item);
              
              return (
                <div
                  key={item.id}
                  style={{
                    cursor: item.link ? 'pointer' : 'default',
                    padding: '16px 24px',
                    backgroundColor: readStatus ? '#ffffff' : '#eff6ff',
                    borderBottom: '1px solid #e2e8f0',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    gap: 16
                  }}
                  onClick={() => handleNotificationClick(item)}
                  onMouseEnter={(e) => {
                    if (item.link) e.currentTarget.style.backgroundColor = readStatus ? '#f8fafc' : '#e0f2fe';
                  }}
                  onMouseLeave={(e) => {
                    if (item.link) e.currentTarget.style.backgroundColor = readStatus ? '#ffffff' : '#eff6ff';
                  }}
                >
                  <div style={{ fontSize: 24, marginTop: 4 }}>{getIcon(item.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: readStatus ? 500 : 700, color: '#0f172a' }}>{item.title || 'Thông báo mới'}</span>
                    </div>
                    <div>
                      {message && <div style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{message}</div>}
                      {time && <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>{dayjs(time).fromNow()}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Drawer>
    </>
  );
}

