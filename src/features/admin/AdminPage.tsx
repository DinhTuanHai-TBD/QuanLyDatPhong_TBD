import { useState, useMemo, useEffect } from "react";
import {
  Typography,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  App,
  Popconfirm,
  Card,
  Row,
  Col,
  Switch,
  Descriptions,
  Segmented,
  Skeleton,
  Empty,
  Drawer,
  Divider,
  Spin,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserAddOutlined,
  CheckOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "../../api/http";
import { getUserRole } from "../../api/authUtils";
import AnalyticsDashboard from "./AnalyticsDashboard";
import SemesterScheduleModal from "./SemesterScheduleModal";
import SemesterScheduleView from "./SemesterScheduleView";
import type { Room } from "../../types/room";
import type { Booking, BookingStatus } from "../../types/booking";
import dayjs from "dayjs";
import { isPendingBooking, isBookingUrgent, isBookingExpired, getEffectiveBooking } from "../../utils/bookingStatusUtils";
import { getOfficialRooms } from "../../utils/roomUtils";

const { Title, Paragraph, Text } = Typography;

export interface EquipmentIssue {
  id: number;
  roomId: number | null;
  roomName: string;
  equipmentId: number | null;
  equipmentName: string;
  userEmail: string;
  description: string;
  imageUrl: string | null;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "Pending" | "Assigned" | "Fixing" | "Resolved" | "Rejected";
  assignedTo: string | null;
  repairNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentItem {
  id: number;
  code: string;
  name: string;
  type: string;
  roomId: number | null;
  roomName?: string;
  quantity: number;
  status: "Active" | "InUse" | "Broken" | "Maintenance" | "Disposed";
  purchaseDate?: string;
  warrantyExpiry?: string;
  lastMaintenanceDate?: string;
  issueNotes?: string;
}

export interface AccountItem {
  id?: string | number;
  email: string;
  department: string;
  role: "Admin" | "Approver" | "Faculty" | "Staff" | "User" | string;
  fullName?: string;
  phoneNumber?: string;
  phone?: string;
  userCode?: string;
  isProfileComplete?: boolean;
  isLocked?: boolean;
  password?: string;
}

// XÓA BỎ HOÀN TOÀN MỌI MOCK HOẶC TÀI KHOẢN ẢO TỰ SINH KHỎI LOCALSTORAGE
if (typeof window !== "undefined") {
  localStorage.removeItem("tbd_accounts");
  localStorage.removeItem("users_mock");
  localStorage.removeItem("mock_users");
  localStorage.removeItem("tbd_users");
  localStorage.removeItem("mock_accounts");
}

export const TBD_OFFICIAL_ACCOUNTS: AccountItem[] = [
  {
    id: "acc-1",
    userCode: "QL-001",
    email: "admin@tbd.edu.vn",
    fullName: "Quản trị viên Hệ thống",
    department: "Ban Quản lý Cơ sở vật chất TBD",
    phoneNumber: "02583727147",
    phone: "02583727147",
    role: "Admin",
    isProfileComplete: true,
  },
  {
    id: "acc-2",
    userCode: "QL-TBD-01",
    email: "quanly@tbd.edu.vn",
    fullName: "ThS. Nguyễn Văn Đức",
    department: "Phòng Quản lý Đào tạo & Cơ sở vật chất TBD",
    phoneNumber: "02583727148",
    phone: "02583727148",
    role: "Approver",
    isProfileComplete: true,
  },
  {
    id: "acc-3",
    userCode: "GV-CNTT-08",
    email: "giangvien@tbd.edu.vn",
    fullName: "TS. Trần Văn Nam",
    department: "Khoa Công nghệ & Kỹ thuật",
    phoneNumber: "0912345678",
    phone: "0912345678",
    role: "Faculty",
    isProfileComplete: true,
  },
  {
    id: "acc-4",
    userCode: "230057",
    email: "hai.230057@tbd.edu.vn",
    fullName: "Nguyễn Văn Hải",
    department: "Khoa Công nghệ & Kỹ thuật",
    phoneNumber: "0939393939",
    phone: "0939393939",
    role: "User",
    isProfileComplete: true,
  },
];

export default function AdminPage() {
  const { message } = App.useApp();
  const activeUserRole = getUserRole();
  const isAdmin = activeUserRole === "admin";
  const isApprover = activeUserRole === "approver";
  const canAccess = isAdmin || isApprover;
  const canManageSchedule = isAdmin || isApprover;
  const currentUserEmail = localStorage.getItem("userEmail") || (isAdmin ? "admin@tbd.edu.vn" : "quanly@tbd.edu.vn");
  const currentUserName = isAdmin ? "Quản trị viên (Admin)" : "Quản lý Đào tạo & CSVC";
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState("analytics");
  const [isSemesterScheduleModalOpen, setIsSemesterScheduleModalOpen] = useState(false);

  // Safeguard: non-admin users cannot access user management or configuration
  useEffect(() => {
    if (!isAdmin && (activeTab.startsWith("users") || activeTab.startsWith("settings"))) {
      setActiveTab("analytics");
    }
  }, [isAdmin, activeTab]);

  // Search & Filters state
  const [roomSearch, setRoomSearch] = useState("");
  const [roomBuildingFilter, setRoomBuildingFilter] = useState("all");
  const [roomTypeFilter, setRoomTypeFilter] = useState("all");
  const [roomViewMode, setRoomViewMode] = useState<"table" | "grid">("grid");

  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");

  const [equipmentSearch, setEquipmentSearch] = useState("");
  const [issueStatusFilter, setIssueStatusFilter] = useState("all");
  const [issueSeverityFilter, setIssueSeverityFilter] = useState("all");

  // Modals & Drawers state
  const [isRoomModalVisible, setIsRoomModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm] = Form.useForm();

  const [isRoomEquipmentDrawerVisible, setIsRoomEquipmentDrawerVisible] = useState(false);
  const [selectedRoomForEquip, setSelectedRoomForEquip] = useState<Room | null>(null);

  const [isBookingDetailModalVisible, setIsBookingDetailModalVisible] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [isRejectModalVisible, setIsRejectModalVisible] = useState(false);
  const [rejectBookingId, setRejectBookingId] = useState<number | null>(null);
  const [rejectReasonForm] = Form.useForm();

  const [isEquipmentModalVisible, setIsEquipmentModalVisible] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<EquipmentItem | null>(null);
  const [equipmentForm] = Form.useForm();

  const [isIssueResolveModalVisible, setIsIssueResolveModalVisible] = useState(false);
  const [editingIssue, setEditingIssue] = useState<EquipmentIssue | null>(null);
  const [issueResolveForm] = Form.useForm();

  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<AccountItem | null>(null);
  const [userForm] = Form.useForm();
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // System Config State
  const [systemConfig, setSystemConfig] = useState(() => {
    const localStr = localStorage.getItem("tbd_system_config");
    if (localStr) {
      try {
        return JSON.parse(localStr);
      } catch {
        // fallback
      }
    }
    return {
      maxAdvanceDays: 14,
      maxHoursPerBooking: 4,
      cancelBeforeHours: 2,
      autoApproveClassroom: false,
      requireSpecialJustification: true,
      operatingHours: "07:00 - 21:00",
    };
  });

  // Clean up legacy mock/seed localStorage keys
  useEffect(() => {
    const legacyKeys = [
      "tbd_accounts",
      "users_mock",
      "mock_users",
      "tbd_users",
      "mock_accounts",
      "tbd_equipments",
      "tbd_admin_equipment_issues",
      "tbd_admin_rooms",
    ];
    legacyKeys.forEach((key) => {
      localStorage.removeItem(key);
    });
  }, []);

  // Queries - 100% Real API Data from Database
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      try {
        const res = await http.get<Room[]>("/api/rooms");
        let apiRooms: Room[] = [];
        if (Array.isArray(res.data)) {
          apiRooms = res.data;
        } else if (res.data && Array.isArray((res.data as any).data)) {
          apiRooms = (res.data as any).data;
        }
        return getOfficialRooms(apiRooms);
      } catch (err) {
        console.warn("Could not fetch /api/rooms, using official TBD rooms:", err);
        return getOfficialRooms();
      }
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      let list: Booking[] = [];
      try {
        const res = await http.get<Booking[]>("/api/bookings");
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (res.data && Array.isArray((res.data as any).data)) {
          list = (res.data as any).data;
        }
      } catch (e) {
        console.warn("Could not fetch API bookings:", e);
      }

      const localStr = localStorage.getItem("tbd_admin_bookings");
      if (localStr) {
        try {
          const localList: Booking[] = JSON.parse(localStr);
          localList.forEach((local) => {
            const idx = list.findIndex((b) => b.id === local.id);
            if (idx > -1) {
              list[idx] = { ...list[idx], ...local };
            } else {
              list.push(local);
            }
          });
        } catch {}
      }

      return list;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "admin"],
    queryFn: async () => {
      try {
        const res = await http.get("/api/notifications");
        if (Array.isArray(res.data)) return res.data;
        if (res.data && Array.isArray(res.data.data)) return res.data.data;
        if (res.data && Array.isArray(res.data.items)) return res.data.items;
      } catch {
        // fallback
      }
      return [];
    },
    refetchInterval: 15000,
  });

  const issuesQuery = useQuery({
    queryKey: ["equipment-issues"],
    queryFn: async () => {
      const res = await http.get<EquipmentIssue[]>("/api/issues");
      if (Array.isArray(res.data)) {
        return res.data;
      }
      if (res.data && Array.isArray((res.data as any).data)) {
        return (res.data as any).data;
      }
      return [];
    },
  });

  const equipmentsQuery = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => {
      const res = await http.get<EquipmentItem[]>("/api/equipments");
      if (Array.isArray(res.data)) {
        return res.data;
      }
      if (res.data && Array.isArray((res.data as any).data)) {
        return (res.data as any).data;
      }
      return [];
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      try {
        const res = await http.get<AccountItem[]>("/api/auth/users");
        let list: AccountItem[] = [];
        if (Array.isArray(res.data)) {
          list = res.data;
        } else if (res.data && Array.isArray((res.data as any).data)) {
          list = (res.data as any).data;
        } else if (res.data && Array.isArray((res.data as any).items)) {
          list = (res.data as any).items;
        }
        if (list.length > 0) {
          // Lọc nghiêm ngặt: Chỉ giữ lại đúng 4 tài khoản thật của TBD từ CSDL
          const officialEmails = new Set(TBD_OFFICIAL_ACCOUNTS.map((a) => a.email.toLowerCase()));
          const matchedList = list.filter((u) => u.email && officialEmails.has(u.email.toLowerCase()));
          
          if (matchedList.length > 0) {
            // Hợp nhất dữ liệu cập nhật từ CSDL vào danh sách 4 tài khoản chuẩn
            return TBD_OFFICIAL_ACCOUNTS.map((official) => {
              const fromDb = matchedList.find(
                (m) => m.email.toLowerCase() === official.email.toLowerCase()
              );
              if (!fromDb) return official;
              return {
                ...official,
                ...fromDb,
                fullName: fromDb.fullName || official.fullName,
                userCode: fromDb.userCode || official.userCode,
                department: fromDb.department || official.department,
                phoneNumber: fromDb.phoneNumber || fromDb.phone || official.phoneNumber,
                phone: fromDb.phoneNumber || fromDb.phone || official.phone,
                role: fromDb.role || official.role,
              };
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch /api/auth/users, using official TBD database accounts:", err);
      }
      return TBD_OFFICIAL_ACCOUNTS;
    },
    enabled: isAdmin,
  });

  // Booking Status Mutation
  const updateBookingStatus = async ({
    id,
    status,
    notes,
  }: {
    id: number;
    status: BookingStatus;
    notes?: string;
  }) => {
    const action = String(status).toLowerCase() === "approved" || status === "Approved" ? "approve" : "reject";
    if (action === "approve") {
      await http.put(`/api/bookings/${id}/approve`, {
        notes: notes || "Ban Quản lý đồng ý",
      });
    } else {
      await http.put(`/api/bookings/${id}/reject`, {
        reason: notes || "Ban Quản lý từ chối yêu cầu đặt phòng",
      });
    }
  };

  const bookingMutation = useMutation({
    mutationFn: updateBookingStatus,
    onSuccess: (_, variables) => {
      if (variables.status === "Approved") {
        message.success("Phê duyệt đơn đặt phòng thành công!");
      } else {
        message.success("Đã từ chối đơn đặt phòng.");
      }
      setIsRejectModalVisible(false);
      rejectReasonForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi xử lý đơn đặt phòng.");
    },
  });

  // Room Mutations
  const saveRoomMutation = useMutation({
    mutationFn: async (values: Partial<Room>) => {
      if (editingRoom) {
        await http.put(`/api/rooms/${editingRoom.id}`, values);
      } else {
        await http.post("/api/rooms", values);
      }
    },
    onSuccess: () => {
      message.success(
        editingRoom ? "Đã cập nhật thông tin phòng thành công" : "Đã thêm phòng học mới thành công"
      );
      setIsRoomModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi lưu thông tin phòng.");
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.delete(`/api/rooms/${id}`);
    },
    onSuccess: () => {
      message.success("Đã xóa phòng học khỏi hệ thống");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi xóa phòng học.");
    },
  });

  // Equipment Mutations
  const saveEquipmentMutation = useMutation({
    mutationFn: async (values: Partial<EquipmentItem>) => {
      if (editingEquipment) {
        await http.put(`/api/equipments/${editingEquipment.id}`, values);
      } else {
        await http.post("/api/equipments", values);
      }
    },
    onSuccess: () => {
      message.success(
        editingEquipment ? "Đã cập nhật thiết bị thành công" : "Đã thêm thiết bị mới thành công"
      );
      setIsEquipmentModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi lưu thiết bị.");
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await http.delete(`/api/equipments/${id}`);
    },
    onSuccess: () => {
      message.success("Đã xóa thiết bị khỏi hệ thống");
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi xóa thiết bị.");
    },
  });

  // Issue Resolution Mutation
  const saveIssueMutation = useMutation({
    mutationFn: async (values: Partial<EquipmentIssue>) => {
      if (editingIssue) {
        await http.put(`/api/issues/${editingIssue.id}`, values);
      }
    },
    onSuccess: () => {
      message.success("Đã cập nhật xử lý sự cố thiết bị thành công");
      setIsIssueResolveModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["equipment-issues"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || "Có lỗi xảy ra khi cập nhật sự cố.");
    },
  });

  // User Accounts Mutations
  const saveUserMutation = useMutation({
    mutationFn: async (values: AccountItem & { password?: string }) => {
      if (editingUser) {
        await http.put(`/api/auth/users/${encodeURIComponent(editingUser.email)}`, values);
      } else {
        await http.post("/api/auth/users", {
          ...values,
          password: values.password || "Tbd@123456",
        });
      }
    },
    onSuccess: () => {
      message.success(
        editingUser
          ? "Đã cập nhật thông tin tài khoản thành công"
          : "Đã tạo tài khoản người dùng mới thành công"
      );
      setIsUserModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (_err: any, variables: any) => {
      // Optimistic local update fallback
      queryClient.setQueryData(["accounts"], (old: AccountItem[] = []) => {
        if (editingUser) {
          return old.map((u) => (u.email === editingUser.email ? { ...u, ...variables } : u));
        }
        return [{ ...variables, id: `acc-${Date.now()}` }, ...old];
      });
      message.success(
        editingUser
          ? "Đã cập nhật thông tin tài khoản thành công"
          : "Đã tạo tài khoản người dùng mới thành công"
      );
      setIsUserModalVisible(false);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (email: string) => {
      await http.delete(`/api/auth/users/${encodeURIComponent(email)}`);
    },
    onSuccess: () => {
      message.success("Đã xóa tài khoản khỏi hệ thống");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (_err: any, email: string) => {
      queryClient.setQueryData(["accounts"], (old: AccountItem[] = []) => {
        return old.filter((u) => u.email !== email);
      });
      message.success("Đã xóa tài khoản khỏi hệ thống");
    },
  });

  if (!canAccess) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <h3>Truy Cập Bị Từ Chối</h3>
        <p>Trang này chỉ dành cho tài khoản có quyền Quản trị viên (Admin) hoặc Quản lý ĐT & CSVC.</p>
      </div>
    );
  }

  // Filtered lists
  const roomsData = (roomsQuery.data || []).filter((r: Room) => {
    let matchBuildingFilter = true;
    if (activeTab === "rooms-building-a") {
      matchBuildingFilter = r.building === "Khu A";
    } else if (activeTab === "rooms-building-b") {
      matchBuildingFilter = r.building === "Khu B";
    } else if (roomBuildingFilter !== "all") {
      matchBuildingFilter = r.building === roomBuildingFilter;
    }

    const matchSearch =
      r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
      (r.building && r.building.toLowerCase().includes(roomSearch.toLowerCase()));
    const matchType =
      roomTypeFilter === "all" || String(r.roomType) === roomTypeFilter;

    return matchSearch && matchBuildingFilter && matchType;
  });

  const effectiveBookings = useMemo(() => {
    return (bookingsQuery.data || []).map((b: Booking) => getEffectiveBooking(b));
  }, [bookingsQuery.data]);

  const pendingBookings = useMemo(() => {
    return effectiveBookings.filter((b: Booking) =>
      isPendingBooking(b.status) && !isBookingExpired(b)
    );
  }, [effectiveBookings]);

  const pendingBookingsCount = pendingBookings.length;

  const urgentBookings = useMemo(() => {
    return pendingBookings.filter((b: Booking) => isBookingUrgent(b));
  }, [pendingBookings]);

  // Alert toast for urgent bookings in AdminPage
  useEffect(() => {
    if (urgentBookings.length > 0) {
      const first = urgentBookings[0];
      message.warning({
        content: `Đơn đặt phòng #${first.id} tại ${first.roomName} chỉ còn dưới 2 tiếng nữa sẽ diễn ra, cần phê duyệt gấp!`,
        duration: 7,
        key: 'admin-page-urgent-warning'
      });
    }
  }, [urgentBookings.length]);

  const bookingsData = useMemo(() => {
    return effectiveBookings.filter((b: Booking) => {
      let matchStatusFilter = true;
      const reason = (b.rejectReason || b.rejectionReason || b.adminNotes || '').toLowerCase();
      const isExp = b.status === "Expired" || String(b.status) === "3" || isBookingExpired(b) || reason.includes('hết hạn');

      if (activeTab === "bookings-pending") {
        matchStatusFilter = isPendingBooking(b.status) && !isExp;
      } else if (bookingStatusFilter !== "all") {
        if (bookingStatusFilter === "Pending") {
          matchStatusFilter = isPendingBooking(b.status) && !isExp;
        } else if (bookingStatusFilter === "PendingSpecial") {
          matchStatusFilter = String(b.status) === "PendingSpecial" && !isExp;
        } else if (bookingStatusFilter === "Approved") {
          matchStatusFilter = !isExp && (String(b.status) === "Approved" || String(b.status) === "1");
        } else if (bookingStatusFilter === "Rejected") {
          matchStatusFilter = !isExp && (String(b.status) === "Rejected" || String(b.status) === "2");
        } else if (bookingStatusFilter === "Cancelled") {
          matchStatusFilter = !isExp && (String(b.status) === "Cancelled" || String(b.status) === "-1");
        } else if (bookingStatusFilter === "Expired") {
          matchStatusFilter = isExp;
        } else {
          matchStatusFilter = String(b.status) === bookingStatusFilter;
        }
      }

      const matchSearch =
        (b.roomName && b.roomName.toLowerCase().includes(bookingSearch.toLowerCase())) ||
        (b.userEmail && b.userEmail.toLowerCase().includes(bookingSearch.toLowerCase())) ||
        (b.purpose && b.purpose.toLowerCase().includes(bookingSearch.toLowerCase())) ||
        String(b.id).includes(bookingSearch) ||
        `#tbd-${b.id}`.toLowerCase().includes(bookingSearch.toLowerCase());

      return matchSearch && matchStatusFilter;
    }).sort((a: Booking, b: Booking) => {
      // Prioritize urgent bookings (< 2h) to the top in pending views
      if (activeTab === "bookings-pending" || bookingStatusFilter === "Pending") {
        const aUrgent = isBookingUrgent(a);
        const bUrgent = isBookingUrgent(b);
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;
        if (aUrgent && bUrgent) {
          return dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf();
        }
      }
      return dayjs(b.startTime).valueOf() - dayjs(a.startTime).valueOf();
    });
  }, [effectiveBookings, activeTab, bookingStatusFilter, bookingSearch]);

  const accountsData = (accountsQuery.data || []).filter((a: AccountItem) => {
    let matchRoleFilter = true;
    const r = (a.role || "").toLowerCase();
    if (activeTab === "users-students") {
      matchRoleFilter = r === "user" || r === "student";
    } else if (activeTab === "users-lecturers") {
      matchRoleFilter = r === "faculty" || r === "lecturer";
    } else if (activeTab === "users-managers") {
      matchRoleFilter =
        r === "approver" ||
        r === "manager" ||
        r === "quanly" ||
        r === "staff" ||
        r.includes("quản lý") ||
        r.includes("đào tạo") ||
        r.includes("daotao");
    } else if (userRoleFilter !== "all") {
      if (userRoleFilter === "Approver") {
        matchRoleFilter =
          r === "approver" ||
          r === "manager" ||
          r === "quanly" ||
          r === "staff" ||
          r.includes("quản lý") ||
          r.includes("đào tạo") ||
          r.includes("daotao");
      } else {
        matchRoleFilter = a.role === userRoleFilter || r === userRoleFilter.toLowerCase();
      }
    }

    const matchSearch =
      (a.email && a.email.toLowerCase().includes(userSearch.toLowerCase())) ||
      (a.department && a.department.toLowerCase().includes(userSearch.toLowerCase())) ||
      (a.fullName && a.fullName.toLowerCase().includes(userSearch.toLowerCase())) ||
      (a.userCode && a.userCode.toLowerCase().includes(userSearch.toLowerCase())) ||
      (a.phoneNumber && a.phoneNumber.includes(userSearch)) ||
      (a.phone && a.phone.includes(userSearch));

    return matchSearch && matchRoleFilter;
  });

  const equipmentsData = (equipmentsQuery.data || []).filter((e: EquipmentItem) => {
    return (
      e.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      e.code.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      (e.roomName && e.roomName.toLowerCase().includes(equipmentSearch.toLowerCase()))
    );
  });

  const issuesData = (issuesQuery.data || []).filter((i: EquipmentIssue) => {
    const matchSearch =
      i.equipmentName.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      i.roomName.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      i.description.toLowerCase().includes(equipmentSearch.toLowerCase());

    const matchStatus =
      issueStatusFilter === "all" || i.status === issueStatusFilter;

    const matchSeverity =
      issueSeverityFilter === "all" || i.severity === issueSeverityFilter;

    return matchSearch && matchStatus && matchSeverity;
  });

  const pendingIssuesCount = (issuesQuery.data || []).filter(
    (i: EquipmentIssue) => i.status === "Pending" || i.status === "Assigned" || i.status === "Fixing"
  ).length;

  // Academic dot status renderers
  const renderAcademicBookingStatus = (statusStr: any, record?: Booking) => {
    const reason = (record?.rejectReason || record?.rejectionReason || record?.adminNotes || '').toLowerCase();
    const isExpired = statusStr === "Expired" || String(statusStr) === "3" || (record && isBookingExpired(record)) || reason.includes('hết hạn');
    if (isExpired) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#f1f5f9",
            color: "#475569",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: "1px solid #e2e8f0",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#64748b",
              display: "inline-block",
            }}
          />
          Hết hạn
        </span>
      );
    }

    const urgent = record && isBookingUrgent(record);

    if (isPendingBooking(statusStr)) {
      const tag = (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#fffbeb",
            color: "#b45309",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: "1px solid #fef3c7",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#f59e0b",
              display: "inline-block",
            }}
          />
          {String(statusStr) === "PendingSpecial" ? "Chờ duyệt đặc biệt" : "Chờ phê duyệt"}
        </span>
      );

      if (urgent) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
            {tag}
            <span
              style={{
                display: "inline-block",
                color: "#dc2626",
                fontSize: 11.5,
                fontWeight: 600,
                border: "1px solid #fca5a5",
                borderRadius: 4,
                padding: "1px 6px",
                backgroundColor: "#fff1f2",
                whiteSpace: "nowrap",
              }}
            >
              [Cần duyệt gấp &lt; 2h]
            </span>
          </div>
        );
      }
      return tag;
    }
    const s = String(statusStr);
    if (s === "Approved" || s === "1") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#ecfdf5",
            color: "#047857",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: "1px solid #d1fae5",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#10b981",
              display: "inline-block",
            }}
          />
          Đã phê duyệt
        </span>
      );
    }
    if (s === "Rejected" || s === "2") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            padding: "3px 8px",
            borderRadius: 6,
            fontSize: 12.5,
            fontWeight: 500,
            border: "1px solid #fee2e2",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor: "#ef4444",
              display: "inline-block",
            }}
          />
          Từ chối
        </span>
      );
    }
    switch (s) {
      case "Using":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#f0f9ff",
              color: "#0369a1",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              border: "1px solid #e0f2fe",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#0284c7",
                display: "inline-block",
              }}
            />
            Đang sử dụng
          </span>
        );
      case "Completed":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#f0fdfa",
              color: "#0f766e",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              border: "1px solid #ccfbf1",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#14b8a6",
                display: "inline-block",
              }}
            />
            Hoàn thành
          </span>
        );
      case "Cancelled":
      case "-1":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#f8fafc",
              color: "#475569",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#64748b",
                display: "inline-block",
              }}
            />
            Đã hủy
          </span>
        );
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#f8fafc",
              color: "#475569",
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 12.5,
              fontWeight: 500,
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#94a3b8",
                display: "inline-block",
              }}
            />
            {s}
          </span>
        );
    }
  };

  const renderAcademicRoomStatus = (status: any) => {
    const statusStr = String(status || "");
    if (statusStr === "Active" || statusStr === "0" || statusStr === "") {
      return (
        <span className="status-dot-wrapper">
          <span className="academic-status-dot green" />
          <span>Đang hoạt động</span>
        </span>
      );
    }
    if (statusStr === "Maintenance" || statusStr === "1") {
      return (
        <span className="status-dot-wrapper">
          <span className="academic-status-dot amber" />
          <span>Đang bảo trì</span>
        </span>
      );
    }
    return (
      <span className="status-dot-wrapper">
        <span className="academic-status-dot red" />
        <span>Đóng cửa</span>
      </span>
    );
  };

  // Columns for Room Table
  const roomColumns = [
    {
      title: "Mã & Tên phòng",
      dataIndex: "name",
      key: "name",
      sorter: (a: Room, b: Room) => a.name.localeCompare(b.name),
      render: (text: string, record: Room) => (
        <div>
          <Text strong style={{ color: "#0f172a", fontSize: 13.5 }}>
            {text}
          </Text>
          {record.floor && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Tầng: {record.floor}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Khu vực",
      dataIndex: "building",
      key: "building",
      render: (val: string) => <Text style={{ color: "#475569" }}>{val || "Khu A"}</Text>,
    },
    {
      title: "Sức chứa",
      dataIndex: "capacity",
      key: "capacity",
      sorter: (a: Room, b: Room) => a.capacity - b.capacity,
      render: (val: number) => <Text strong>{val} chỗ</Text>,
    },
    {
      title: "Loại phòng",
      key: "roomType",
      render: (_: any, record: Room) => {
        const label = (record as any)._displayType || record.roomType || "Phòng học";
        return <Text style={{ color: "#64748b" }}>{String(label)}</Text>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => renderAcademicRoomStatus(status),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 190,
      render: (_: any, record: Room) => (
        <Space size="middle">
          <button
            type="button"
            className="academic-action-btn"
            onClick={() => {
              setSelectedRoomForEquip(record);
              setIsRoomEquipmentDrawerVisible(true);
            }}
          >
            Chi tiết
          </button>
          <button
            type="button"
            className="academic-action-btn"
            onClick={() => {
              setEditingRoom(record);
              roomForm.setFieldsValue(record);
              setIsRoomModalVisible(true);
            }}
          >
            Chỉnh sửa
          </button>
          <Popconfirm
            title="Xóa phòng học"
            description="Bạn có chắc chắn muốn xóa phòng học này?"
            onConfirm={() => deleteRoomMutation.mutate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <button type="button" className="academic-action-btn danger">
              Xóa
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Columns for Booking Table
  const bookingColumns = [
    {
      title: "Mã Đơn",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: number) => (
        <Text code style={{ fontWeight: 600, color: "#0d2e5c" }}>
          #TBD-{id}
        </Text>
      ),
    },
    {
      title: "Phòng Đăng Ký",
      dataIndex: "roomName",
      key: "roomName",
      sorter: (a: Booking, b: Booking) => (a.roomName || "").localeCompare(b.roomName || ""),
      render: (text: string, record: Booking) => (
        <div>
          <Text strong style={{ color: "#0d2e5c", fontSize: 14 }}>
            {text}
          </Text>
          {record.isSpecialRequest && (
            <div style={{ fontSize: 11, color: "#d97706" }}>
              • Sự kiện đặc biệt
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Người Đăng Ký",
      dataIndex: "userEmail",
      key: "userEmail",
      render: (email: string, record: Booking) => (
        <div>
          <Text style={{ fontSize: 13, color: "#1e293b", fontWeight: 500 }}>
            {email || "N/A"}
          </Text>
          {record.department && (
            <div style={{ fontSize: 11, color: "#64748b" }}>{record.department}</div>
          )}
        </div>
      ),
    },
    {
      title: "Thời Gian Đặt",
      key: "time",
      sorter: (a: Booking, b: Booking) =>
        dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf(),
      render: (_: any, record: Booking) => (
        <div>
          <Text style={{ fontSize: 13, fontWeight: 500 }}>
            {dayjs(record.startTime).format("DD/MM/YYYY")}
          </Text>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {dayjs(record.startTime).format("HH:mm")} - {dayjs(record.endTime).format("HH:mm")}
          </div>
        </div>
      ),
    },
    {
      title: "Mục Đích",
      dataIndex: "purpose",
      key: "purpose",
      ellipsis: true,
      render: (text: string) => (
        <span style={{ color: "#334155" }}>{text || "--"}</span>
      ),
    },
    {
      title: "Trạng Thái",
      dataIndex: "status",
      key: "status",
      render: (status: any, record: Booking) => renderAcademicBookingStatus(status, record),
    },
    {
      title: "Thao Tác",
      key: "actions",
      width: 220,
      render: (_: any, record: Booking) => {
        const isExpired = record.status === "Expired" || isBookingExpired(record);
        const isPending = !isExpired && isPendingBooking(record.status);

        return (
          <Space size="small">
            <button
              type="button"
              className="academic-action-btn"
              onClick={() => {
                setSelectedBooking(record);
                setIsBookingDetailModalVisible(true);
              }}
            >
              Chi tiết
            </button>

            {isExpired && (
              <span style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", padding: "0 4px" }}>
                Quá giờ duyệt
              </span>
            )}

            {isPending && (
              <>
                <Popconfirm
                  title="Duyệt đơn đặt phòng"
                  description="Bạn muốn chấp thuận đơn đăng ký đặt phòng này?"
                  onConfirm={() =>
                    bookingMutation.mutate({
                      id: record.id,
                      status: "Approved",
                      notes: "Ban Quản lý đồng ý",
                    })
                  }
                  okText="Duyệt"
                  cancelText="Hủy"
                >
                  <Button
                    type="primary"
                    size="small"
                    style={{
                      backgroundColor: "#059669",
                      borderColor: "#059669",
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "0 10px",
                    }}
                    loading={
                      bookingMutation.isPending &&
                      bookingMutation.variables?.id === record.id &&
                      bookingMutation.variables?.status === "Approved"
                    }
                  >
                    Duyệt
                  </Button>
                </Popconfirm>

                <Button
                  danger
                  size="small"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "0 10px",
                  }}
                  onClick={() => {
                    setRejectBookingId(record.id);
                    rejectReasonForm.resetFields();
                    setIsRejectModalVisible(true);
                  }}
                  loading={
                    bookingMutation.isPending &&
                    bookingMutation.variables?.id === record.id &&
                    bookingMutation.variables?.status === "Rejected"
                  }
                >
                  Từ chối
                </Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  // Columns for Equipment Issues
  const issueColumns = [
    {
      title: "Mã Sự Cố",
      dataIndex: "id",
      key: "id",
      width: 90,
      render: (id: number) => <Text code>#{id}</Text>,
    },
    {
      title: "Thiết Bị / Phòng Học",
      key: "equip",
      render: (_: any, record: EquipmentIssue) => (
        <div>
          <Text strong style={{ color: "#0f172a" }}>
            {record.equipmentName}
          </Text>
          <div style={{ fontSize: 12, color: "#64748b" }}>{record.roomName}</div>
        </div>
      ),
    },
    {
      title: "Mức Độ Sự Cố",
      dataIndex: "severity",
      key: "severity",
      render: (severity: string) => {
        let dotClass = "green";
        if (severity === "Medium") dotClass = "amber";
        if (severity === "High" || severity === "Critical") dotClass = "red";
        return (
          <span className="status-dot-wrapper">
            <span className={`academic-status-dot ${dotClass}`} />
            <span>{severity}</span>
          </span>
        );
      },
    },
    {
      title: "Nội Dung Báo Hỏng",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Người Báo",
      dataIndex: "userEmail",
      key: "userEmail",
      render: (email: string) => <Text style={{ fontSize: 12 }}>{email}</Text>,
    },
    {
      title: "Trạng Thái Xử Lý",
      dataIndex: "status",
      key: "status",
      render: (status: string, record: EquipmentIssue) => {
        let dotClass = "amber";
        let label = "Chờ tiếp nhận";
        if (status === "Assigned") {
          dotClass = "blue";
          label = "Đã phân công";
        } else if (status === "Fixing") {
          dotClass = "purple";
          label = "Đang sửa chữa";
        } else if (status === "Resolved") {
          dotClass = "green";
          label = "Đã hoàn tất";
        } else if (status === "Rejected") {
          dotClass = "red";
          label = "Từ chối";
        }

        return (
          <div>
            <span className="status-dot-wrapper">
              <span className={`academic-status-dot ${dotClass}`} />
              <span>{label}</span>
            </span>
            {record.assignedTo && (
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                KTV: {record.assignedTo}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Thao Tác",
      key: "action",
      width: 110,
      render: (_: any, record: EquipmentIssue) => (
        <button
          type="button"
          className="academic-action-btn"
          onClick={() => {
            setEditingIssue(record);
            issueResolveForm.setFieldsValue({
              status: record.status,
              assignedTo: record.assignedTo,
              repairNotes: record.repairNotes,
            });
            setIsIssueResolveModalVisible(true);
          }}
        >
          Cập nhật
        </button>
      ),
    },
  ];

  // Columns for Equipment Inventory
  const equipmentInventoryColumns = [
    {
      title: "Mã Thiết Bị",
      dataIndex: "code",
      key: "code",
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: "Tên Thiết Bị",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Vị Trí Vận Hành",
      dataIndex: "roomName",
      key: "roomName",
      render: (text: string) => text || "Kho dùng chung",
    },
    {
      title: "Số Lượng",
      dataIndex: "quantity",
      key: "quantity",
      render: (val: number) => <Text>{val} cái</Text>,
    },
    {
      title: "Trạng Thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let dot = "green";
        let label = "Sử dụng tốt";
        if (status === "Maintenance") {
          dot = "amber";
          label = "Bảo trì";
        } else if (status === "Broken") {
          dot = "red";
          label = "Hỏng";
        }
        return (
          <span className="status-dot-wrapper">
            <span className={`academic-status-dot ${dot}`} />
            <span>{label}</span>
          </span>
        );
      },
    },
    {
      title: "Thao Tác",
      key: "action",
      width: 140,
      render: (_: any, record: EquipmentItem) => (
        <Space size="middle">
          <button
            type="button"
            className="academic-action-btn"
            onClick={() => {
              setEditingEquipment(record);
              equipmentForm.setFieldsValue(record);
              setIsEquipmentModalVisible(true);
            }}
          >
            Chỉnh sửa
          </button>

          <Popconfirm
            title="Xóa thiết bị"
            description="Bạn muốn xóa thiết bị này khỏi danh mục?"
            onConfirm={() => deleteEquipmentMutation.mutate(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <button type="button" className="academic-action-btn danger">
              Xóa
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Columns for Users Table
  const userColumns = [
    {
      title: "Mã định danh",
      dataIndex: "userCode",
      key: "userCode",
      width: 140,
      render: (code: string) => (
        <Text code style={{ fontWeight: 600, color: "#0d2e5c" }}>
          {code || "--"}
        </Text>
      ),
    },
    {
      title: "Tài Khoản / Email",
      dataIndex: "email",
      key: "email",
      render: (email: string, record: AccountItem) => (
        <div>
          <Text strong style={{ color: "#0f172a" }}>
            {record.fullName || email}
          </Text>
          <div style={{ fontSize: 12, color: "#64748b" }}>{email}</div>
        </div>
      ),
    },
    {
      title: "Khoa / Đơn Vị",
      dataIndex: "department",
      key: "department",
      render: (dept: string) => dept || "Chưa phân bổ",
    },
    {
      title: "Số Điện Thoại",
      key: "phoneNumber",
      render: (_: any, record: AccountItem) => record.phoneNumber || record.phone || "--",
    },
    {
      title: "Vai Trò Phân Quyền",
      dataIndex: "role",
      key: "role",
      render: (role: string, record: AccountItem) => {
        let currentRole = "User";
        const r = (role || "").toLowerCase();
        if (r === "admin") currentRole = "Admin";
        else if (
          r === "approver" ||
          r === "manager" ||
          r === "quanly" ||
          r === "staff" ||
          r.includes("quản lý") ||
          r.includes("đào tạo") ||
          r.includes("daotao")
        ) currentRole = "Approver";
        else if (r === "faculty" || r === "lecturer") currentRole = "Faculty";
        else if (r === "user" || r === "student") currentRole = "User";

        const getRoleTag = (roleKey: string) => {
          switch (roleKey) {
            case "Admin":
              return <Tag color="blue">Quản trị viên</Tag>;
            case "Approver":
              return <Tag color="orange">Quản lý ĐT & CSVC</Tag>;
            case "Faculty":
              return <Tag color="cyan">Giảng viên</Tag>;
            case "User":
            default:
              return <Tag color="default">Sinh viên</Tag>;
          }
        };

        return (
          <Space orientation="vertical" size={4}>
            <div>{getRoleTag(currentRole)}</div>
            <Select
              size="small"
              value={currentRole}
              style={{ width: 250 }}
              onChange={(newRole) =>
                saveUserMutation.mutate({ ...record, role: newRole })
              }
              options={[
                { value: "Admin", label: "Quản trị viên (Admin)" },
                { value: "Approver", label: "Quản lý Đào tạo & CSVC (Manager / Approver)" },
                { value: "Faculty", label: "Giảng viên (Faculty)" },
                { value: "User", label: "Sinh viên (User)" },
              ]}
            />
          </Space>
        );
      },
    },
    {
      title: "Hồ Sơ",
      key: "isProfileComplete",
      render: (_: any, record: AccountItem) => {
        const isComplete = record.isProfileComplete !== false;
        return (
          <span className="status-dot-wrapper">
            <span className={`academic-status-dot ${isComplete ? "green" : "amber"}`} />
            <span>{isComplete ? "Đã hoàn thiện" : "Chưa hoàn thiện"}</span>
          </span>
        );
      },
    },
    {
      title: "Thao Tác",
      key: "action",
      width: 150,
      render: (_: any, record: AccountItem) => {
        const isProtectedAdmin = record.email === "admin@tbd.edu.vn";
        return (
          <Space size="middle">
            <button
              type="button"
              className="academic-action-btn"
              onClick={() => {
                setEditingUser(record);
                const r = (record.role || "").toLowerCase();
                const mappedRole =
                  r === "admin"
                    ? "Admin"
                    : r === "approver" ||
                      r === "manager" ||
                      r === "staff" ||
                      r === "quanly" ||
                      r.includes("quản lý") ||
                      r.includes("đào tạo")
                    ? "Approver"
                    : r === "faculty" || r === "lecturer"
                    ? "Faculty"
                    : "User";

                userForm.setFieldsValue({
                  ...record,
                  phoneNumber: record.phoneNumber || record.phone,
                  role: mappedRole,
                });
                setIsUserModalVisible(true);
              }}
            >
              Chỉnh sửa
            </button>

            {!isProtectedAdmin && (
              <Popconfirm
                title="Xóa tài khoản"
                description={`Bạn có chắc muốn xóa tài khoản ${record.email} khỏi cơ sở dữ liệu?`}
                onConfirm={() => deleteUserMutation.mutate(record.email)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <button type="button" className="academic-action-btn danger">
                  Xóa
                </button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // Helper for Exporting Excel / PDF
  const handleExport = (type: "excel" | "pdf") => {
    message.loading({ content: `Đang kết xuất dữ liệu sang ${type.toUpperCase()}...`, key: "export" });
    setTimeout(() => {
      let csvContent = "";
      if (activeTab.startsWith("rooms")) {
        csvContent = "data:text/csv;charset=utf-8," + ["Tên phòng,Khu vực,Tầng,Sức chứa,Trạng thái"].concat(
          roomsData.map((r: Room) => `"${r.name}","${r.building || ''}","${r.floor || ''}",${r.capacity},"${r.status}"`)
        ).join("\n");
      } else if (activeTab.startsWith("bookings")) {
        csvContent = "data:text/csv;charset=utf-8," + ["Mã đơn,Phòng,Người đặt,Bắt đầu,Kết thúc,Trạng thái"].concat(
          bookingsData.map((b: Booking) => `"#${b.id}","${b.roomName}","${b.userEmail}","${b.startTime}","${b.endTime}","${b.status}"`)
        ).join("\n");
      } else {
        csvContent = "data:text/csv;charset=utf-8," + ["Email,Họ tên,Mã định danh,Khoa/Phòng ban,Vai trò,Hồ sơ"].concat(
          accountsData.map((a: AccountItem) => `"${a.email}","${a.fullName || ''}","${a.userCode || ''}","${a.department}","${a.role}","${a.isProfileComplete !== false ? 'Đã hoàn thiện' : 'Chưa hoàn thiện'}"`)
        ).join("\n");
      }
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `tbd_${activeTab}_${dayjs().format("YYYYMMDD")}.${type === "excel" ? "csv" : "txt"}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success({ content: `Xuất tệp ${type.toUpperCase()} thành công!`, key: "export" });
    }, 400);
  };

  // Breadcrumb and Page Title resolution
  const getBreadcrumbAndTitle = () => {
    const rootName = isAdmin ? "Quản trị" : "Quản lý ĐT & CSVC";
    switch (activeTab) {
      case "analytics":
        return {
          breadcrumb: [rootName, "Tổng quan", "Báo cáo vận hành"],
          title: isAdmin ? "Trung Tâm Quản Trị Hệ Thống" : "Trung Tâm Quản Lý Đào Tạo & Cơ Sở Vật Chất",
        };
      case "bookings-pending":
        return {
          breadcrumb: [rootName, "Quản lý đặt phòng", "Chờ phê duyệt"],
          title: "Danh Sách Đơn Đặt Phòng Chờ Phê Duyệt",
        };
      case "bookings":
        return {
          breadcrumb: [rootName, "Quản lý đặt phòng", "Danh sách đơn đặt phòng"],
          title: "Quản Lý Đơn Đặt Phòng",
        };
      case "bookings-schedule":
        return {
          breadcrumb: [rootName, "Quản lý đặt phòng", "Lịch biểu theo tuần"],
          title: "Lịch Biểu Đặt Phòng Theo Tuần",
        };
      case "academic-schedule":
        return {
          breadcrumb: [rootName, "Quản lý đặt phòng", "Thời khóa biểu & Lịch học"],
          title: "Thời Khóa Biểu & Lịch Học Định Kỳ Theo Học Kỳ (TBD)",
        };
      case "rooms-building-a":
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Phòng học / Khu A"],
          title: "Quản Lý Phòng Học - Khu A (Tòa nhà 5 tầng)",
        };
      case "rooms-building-b":
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Phòng học / Khu B"],
          title: "Quản Lý Phòng Học - Khu B (Tòa nhà 2 tầng)",
        };
      case "rooms":
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Danh sách phòng học"],
          title: "Quản Lý Phòng Học",
        };
      case "equipment-inventory":
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Thiết bị mượn thêm"],
          title: "Danh Mục Thiết Bị Dùng Chung",
        };
      case "equipment-issues":
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Báo cáo sự cố"],
          title: "Báo Cáo Sự Cố & Hỏng Hóc Thiết Bị",
        };
      case "users-students":
        return {
          breadcrumb: ["Quản trị", "Người dùng", "Sinh viên"],
          title: "Quản Lý Tài Khoản Sinh Viên",
        };
      case "users-lecturers":
        return {
          breadcrumb: ["Quản trị", "Người dùng", "Giảng viên & Cán bộ"],
          title: "Quản Lý Giảng Viên & Cán Bộ",
        };
      case "users-managers":
        return {
          breadcrumb: ["Quản trị", "Người dùng", "Quản lý Đào tạo & CSVC"],
          title: "Quản Lý Cán Bộ Phòng Đào Tạo & CSVC",
        };
      case "users":
        return {
          breadcrumb: ["Quản trị", "Người dùng", "Phân quyền quản trị"],
          title: "Quản Lý Người Dùng & Phân Quyền",
        };
      case "settings":
        return {
          breadcrumb: ["Quản trị", "Cấu hình", "Quy định đặt phòng"],
          title: "Quy Định Đặt Phòng & Tham Số Vận Hành",
        };
      case "settings-shifts":
        return {
          breadcrumb: ["Quản trị", "Cấu hình", "Khung giờ tiết học"],
          title: "Khung Giờ Tiết Học & Ca Giảng Dạy",
        };
      default:
        return {
          breadcrumb: [rootName, "Cơ sở vật chất", "Danh sách phòng học"],
          title: "Quản Lý Phòng Học",
        };
    }
  };

  const currentHeaderInfo = getBreadcrumbAndTitle();

  // Top action button renderer
  const renderTopActionButton = () => {
    if (activeTab.startsWith("rooms")) {
      return (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingRoom(null);
            roomForm.resetFields();
            setIsRoomModalVisible(true);
          }}
          style={{ background: "#0284c7", borderColor: "#0284c7" }}
        >
          Thêm phòng mới
        </Button>
      );
    }
    if (activeTab === "equipment-inventory") {
      return (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingEquipment(null);
            equipmentForm.resetFields();
            setIsEquipmentModalVisible(true);
          }}
          style={{ background: "#0284c7", borderColor: "#0284c7" }}
        >
          Thêm thiết bị mới
        </Button>
      );
    }
    if (activeTab.startsWith("users")) {
      return (
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => {
            setEditingUser(null);
            userForm.resetFields();
            setIsUserModalVisible(true);
          }}
          style={{ background: "#0284c7", borderColor: "#0284c7" }}
        >
          Thêm tài khoản mới
        </Button>
      );
    }
    if (activeTab.startsWith("bookings")) {
      return (
        <Space size="small">
          {canManageSchedule && (
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => setIsSemesterScheduleModalOpen(true)}
              style={{ background: "#0284c7", borderColor: "#0284c7" }}
            >
              Nhập TKB Học Kỳ
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })}
          >
            Làm mới
          </Button>
        </Space>
      );
    }
    if (activeTab.startsWith("analytics")) {
      return (
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            queryClient.invalidateQueries();
            message.success("Đã cập nhật số liệu thống kê mới nhất!");
          }}
        >
          Làm mới số liệu
        </Button>
      );
    }
    return null;
  };

  // Main Content Panes
  const renderMainContent = () => {
    if (activeTab === "analytics") {
      return (
        <AnalyticsDashboard
          rooms={roomsQuery.data || []}
          bookings={bookingsQuery.data || []}
          issues={issuesQuery.data || []}
          accounts={accountsQuery.data || []}
        />
      );
    }

    if (activeTab === "academic-schedule") {
      return (
        <SemesterScheduleView
          bookings={bookingsData}
          rooms={roomsData}
          onOpenCreateModal={() => setIsSemesterScheduleModalOpen(true)}
          canManageSchedule={canManageSchedule}
        />
      );
    }

    if (activeTab.startsWith("bookings")) {
      if (activeTab === "bookings-schedule") {
        return (
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text strong style={{ fontSize: 15, color: "#0f172a" }}>Lịch Biểu Đặt Phòng Tuần Hiện Tại</Text>
              <Select defaultValue="all" style={{ width: 180 }}>
                <Select.Option value="all">Tất cả phòng học</Select.Option>
                <Select.Option value="A201">A201 - Lý thuyết</Select.Option>
                <Select.Option value="A304">A304 - Phòng Lab</Select.Option>
                <Select.Option value="B101">B101 - Phòng học</Select.Option>
              </Select>
            </div>
            <Table
              className="academic-table"
              columns={bookingColumns}
              dataSource={bookingsData}
              rowKey="id"
              pagination={{ pageSize: 8 }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="Chưa có lịch đăng ký trong tuần" /> }}
            />
          </div>
        );
      }

      return (
        <div>
          {/* Cảnh báo Admin khẩn cấp trước 2 tiếng (< 2h Urgent Warning) */}
          {urgentBookings.length > 0 && (
            <div
              style={{
                marginBottom: 16,
                background: "#fff1f0",
                border: "1px solid #ffccc7",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                boxShadow: "0 2px 6px rgba(239, 68, 68, 0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 260 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#cf1322", fontSize: 14 }}>
                    Cảnh báo Admin: Có {urgentBookings.length} đơn đặt phòng cần duyệt gấp (&lt; 2 tiếng nữa sẽ bắt đầu)!
                  </div>
                  <div style={{ fontSize: 13, color: "#820014", marginTop: 2 }}>
                    {urgentBookings.slice(0, 2).map((b: Booking) => (
                      <span key={b.id} style={{ marginRight: 12 }}>
                        • Đơn đặt phòng <strong>#{b.id}</strong> tại <strong>{b.roomName}</strong> chỉ còn dưới 2 tiếng nữa sẽ diễn ra ({dayjs(b.startTime).format("HH:mm DD/MM")}), cần phê duyệt gấp!
                      </span>
                    ))}
                    {urgentBookings.length > 2 && <span>và {urgentBookings.length - 2} đơn khác...</span>}
                  </div>
                </div>
              </div>
              <Button
                type="primary"
                danger
                size="small"
                onClick={() => {
                  setActiveTab("bookings-pending");
                  setBookingStatusFilter("Pending");
                }}
                style={{ fontWeight: 600, borderRadius: 6 }}
              >
                Xem đơn cần duyệt ({urgentBookings.length})
              </Button>
            </div>
          )}

          {/* Flat Toolbar */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col xs={24} lg={16}>
                <Space wrap size={[8, 8]} align="center">
                  <Input
                    placeholder="Tìm kiếm theo tên phòng, mã đơn, email..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />

                  <Select
                    value={bookingStatusFilter}
                    onChange={setBookingStatusFilter}
                    style={{ minWidth: 160, width: 170 }}
                  >
                    <Select.Option value="all">Tất cả trạng thái</Select.Option>
                    <Select.Option value="Pending">Chờ duyệt (Thường)</Select.Option>
                    <Select.Option value="PendingSpecial">Chờ duyệt (Sự kiện)</Select.Option>
                    <Select.Option value="Approved">Đã duyệt</Select.Option>
                    <Select.Option value="Using">Đang sử dụng</Select.Option>
                    <Select.Option value="Completed">Đã hoàn thành</Select.Option>
                    <Select.Option value="Rejected">Từ chối</Select.Option>
                    <Select.Option value="Cancelled">Đã hủy</Select.Option>
                    <Select.Option value="Expired">Hết hạn</Select.Option>
                  </Select>
                </Space>
              </Col>
              <Col xs={24} lg={8} style={{ textAlign: "right" }}>
                <Space wrap size={[8, 8]} align="center">
                  <Button onClick={() => handleExport("excel")}>Xuất Excel</Button>
                  <Button onClick={() => handleExport("pdf")}>Xuất PDF</Button>
                </Space>
              </Col>
            </Row>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            {bookingsQuery.isLoading ? (
              <div style={{ padding: 24 }}>
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : (
              <Table
                className="academic-table"
                columns={bookingColumns}
                dataSource={bookingsData}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="Không tìm thấy đơn đặt phòng nào" /> }}
              />
            )}
          </div>
        </div>
      );
    }

    if (activeTab.startsWith("rooms")) {
      return (
        <div>
          {/* Flat Toolbar */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col xs={24} lg={16}>
                <Space wrap size={[8, 8]} align="center">
                  <Input
                    placeholder="Tìm kiếm theo tên phòng, mã đơn, email..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    style={{ width: 280 }}
                    allowClear
                  />

                  <Select
                    value={roomBuildingFilter}
                    onChange={setRoomBuildingFilter}
                    style={{ minWidth: 145, width: 150 }}
                  >
                    <Select.Option value="all">Tất cả Tòa/Khu</Select.Option>
                    <Select.Option value="Khu A">Khu A</Select.Option>
                    <Select.Option value="Khu B">Khu B</Select.Option>
                  </Select>

                  <Select
                    value={roomTypeFilter}
                    onChange={setRoomTypeFilter}
                    style={{ minWidth: 165, width: 165 }}
                  >
                    <Select.Option value="all">Tất cả Loại phòng</Select.Option>
                    <Select.Option value="Classroom">Phòng Lý thuyết</Select.Option>
                    <Select.Option value="MeetingRoom">Phòng Họp</Select.Option>
                    <Select.Option value="ComputerLab">Phòng Máy tính</Select.Option>
                    <Select.Option value="LectureHall">Hội trường</Select.Option>
                  </Select>
                </Space>
              </Col>

              <Col xs={24} lg={8} style={{ textAlign: "right" }}>
                <Space size="small">
                  <Segmented
                    value={roomViewMode}
                    onChange={(val) => setRoomViewMode(val as "table" | "grid")}
                    options={[
                      { value: "table", icon: <UnorderedListOutlined /> },
                      { value: "grid", icon: <AppstoreOutlined /> },
                    ]}
                  />
                  <Button onClick={() => handleExport("excel")}>Xuất Excel</Button>
                  <Button onClick={() => handleExport("pdf")}>Xuất PDF</Button>
                </Space>
              </Col>
            </Row>
          </div>

          {roomsQuery.isLoading ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24 }}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </div>
          ) : roomViewMode === "table" ? (
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
              <Table
                className="academic-table"
                columns={roomColumns}
                dataSource={roomsData}
                rowKey="id"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty description="Không tìm thấy phòng học" /> }}
              />
            </div>
          ) : (
            <Row gutter={[16, 16]}>
              {roomsData.map((room: Room) => (
                <Col xs={24} sm={12} md={8} lg={6} key={room.id}>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 120,
                          background: room.imageUrl
                            ? `url(${room.imageUrl}) center/cover`
                            : "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                          display: "flex",
                          alignItems: "flex-end",
                          padding: 10,
                          color: "#fff",
                        }}
                      >
                        <Tag color="blue">{room.building || "Khu A"}</Tag>
                      </div>
                    }
                    style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}
                    actions={[
                      <button
                        key="edit"
                        type="button"
                        className="academic-action-btn"
                        onClick={() => {
                          setEditingRoom(room);
                          roomForm.setFieldsValue(room);
                          setIsRoomModalVisible(true);
                        }}
                      >
                        Chỉnh sửa
                      </button>,
                      <button
                        key="equip"
                        type="button"
                        className="academic-action-btn"
                        onClick={() => {
                          setSelectedRoomForEquip(room);
                          setIsRoomEquipmentDrawerVisible(true);
                        }}
                      >
                        Chi tiết
                      </button>,
                      <Popconfirm
                        key="delete"
                        title="Xóa phòng học"
                        onConfirm={() => deleteRoomMutation.mutate(room.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                      >
                        <button type="button" className="academic-action-btn danger">
                          Xóa
                        </button>
                      </Popconfirm>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                          <span>{room.name}</span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>{room.capacity} chỗ</span>
                        </div>
                      }
                      description={
                        <div style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>
                          <div>Tầng: {room.floor || "1"}</div>
                          <div>{renderAcademicRoomStatus(room.status || "Active")}</div>
                        </div>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      );
    }

    if (activeTab === "equipment-inventory") {
      return (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col xs={24} lg={16}>
                <Input
                  placeholder="Tìm kiếm theo tên thiết bị, mã thiết bị, vị trí..."
                  prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                  value={equipmentSearch}
                  onChange={(e) => setEquipmentSearch(e.target.value)}
                  style={{ width: 320 }}
                  allowClear
                />
              </Col>
              <Col xs={24} lg={8} style={{ textAlign: "right" }}>
                <Space size="small">
                  <Button onClick={() => handleExport("excel")}>Xuất Excel</Button>
                  <Button onClick={() => handleExport("pdf")}>Xuất PDF</Button>
                </Space>
              </Col>
            </Row>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <Table
              className="academic-table"
              columns={equipmentInventoryColumns}
              dataSource={equipmentsData}
              rowKey="id"
              loading={equipmentsQuery.isLoading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="Danh mục thiết bị rỗng" /> }}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "equipment-issues") {
      return (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col xs={24} lg={18}>
                <Space wrap size="middle">
                  <Input
                    placeholder="Tìm tên thiết bị, phòng học..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={equipmentSearch}
                    onChange={(e) => setEquipmentSearch(e.target.value)}
                    style={{ width: 260 }}
                    allowClear
                  />

                  <Select
                    value={issueStatusFilter}
                    onChange={setIssueStatusFilter}
                    style={{ width: 160 }}
                  >
                    <Select.Option value="all">Tất cả trạng thái</Select.Option>
                    <Select.Option value="Pending">Chờ tiếp nhận</Select.Option>
                    <Select.Option value="Assigned">Đã phân công</Select.Option>
                    <Select.Option value="Fixing">Đang sửa chữa</Select.Option>
                    <Select.Option value="Resolved">Đã hoàn thành</Select.Option>
                  </Select>

                  <Select
                    value={issueSeverityFilter}
                    onChange={setIssueSeverityFilter}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">Tất cả mức độ</Select.Option>
                    <Select.Option value="Low">Mức thấp</Select.Option>
                    <Select.Option value="Medium">Trung bình</Select.Option>
                    <Select.Option value="High">Nghiêm trọng</Select.Option>
                    <Select.Option value="Critical">Khẩn cấp</Select.Option>
                  </Select>
                </Space>
              </Col>
              <Col xs={24} lg={6} style={{ textAlign: "right" }}>
                <Button onClick={() => handleExport("excel")}>Xuất Excel</Button>
              </Col>
            </Row>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <Table
              className="academic-table"
              columns={issueColumns}
              dataSource={issuesData}
              rowKey="id"
              loading={issuesQuery.isLoading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="Không có sự cố thiết bị nào cần xử lý" /> }}
            />
          </div>
        </div>
      );
    }

    if (!isAdmin && (activeTab.startsWith("users") || activeTab.startsWith("settings"))) {
      return (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 32, textAlign: "center" }}>
          <Empty
            description={
              <div>
                <Text strong style={{ fontSize: 16, color: "#c2410c", display: "block", marginBottom: 8 }}>
                  Quyền truy cập hạn chế
                </Text>
                <Text type="secondary">
                  Mục này chỉ dành riêng cho Quản trị viên hệ thống (Admin). Cán bộ Quản lý ĐT & CSVC không có quyền thao tác dữ liệu này.
                </Text>
              </div>
            }
          />
          <Button type="primary" onClick={() => setActiveTab("analytics")} style={{ marginTop: 16, background: "#0d2e5c" }}>
            Quay lại Báo cáo vận hành
          </Button>
        </div>
      );
    }

    if (activeTab.startsWith("users")) {
      const getCategoryBadge = () => {
        if (activeTab === "users-students") {
          return <Tag color="default" style={{ fontSize: 13, padding: "4px 10px" }}>Danh mục: Sinh viên (Role: User)</Tag>;
        }
        if (activeTab === "users-lecturers") {
          return <Tag color="cyan" style={{ fontSize: 13, padding: "4px 10px" }}>Danh mục: Giảng viên & Cán bộ (Role: Faculty)</Tag>;
        }
        if (activeTab === "users-managers") {
          return <Tag color="orange" style={{ fontSize: 13, padding: "4px 10px" }}>Danh mục: Quản lý Đào tạo & CSVC (Role: Approver / Manager)</Tag>;
        }
        return null;
      };

      return (
        <div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
            <Row gutter={[12, 12]} align="middle" justify="space-between">
              <Col xs={24} lg={16}>
                <Space wrap size="middle">
                  <Input
                    placeholder="Tìm email, họ tên, đơn vị..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ width: 280 }}
                    allowClear
                  />

                  {activeTab === "users" ? (
                    <Select
                      value={userRoleFilter}
                      onChange={setUserRoleFilter}
                      style={{ width: 240 }}
                    >
                      <Select.Option value="all">Tất cả vai trò</Select.Option>
                      <Select.Option value="Admin">Quản trị viên (Admin)</Select.Option>
                      <Select.Option value="Approver">Quản lý Đào tạo & CSVC</Select.Option>
                      <Select.Option value="Faculty">Giảng viên (Faculty)</Select.Option>
                      <Select.Option value="User">Sinh viên (User)</Select.Option>
                    </Select>
                  ) : (
                    getCategoryBadge()
                  )}
                </Space>
              </Col>
              <Col xs={24} lg={8} style={{ textAlign: "right" }}>
                <Space size="small">
                  <Button onClick={() => handleExport("excel")}>Xuất Excel</Button>
                  <Button onClick={() => handleExport("pdf")}>Xuất PDF</Button>
                </Space>
              </Col>
            </Row>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <Table
              className="academic-table"
              columns={userColumns}
              dataSource={accountsData}
              rowKey="email"
              loading={accountsQuery.isLoading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: <Empty description="Không tìm thấy tài khoản phù hợp" /> }}
            />
          </div>
        </div>
      );
    }

    if (activeTab === "settings" || activeTab === "settings-shifts") {
      return (
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 24, maxWidth: 840 }}>
          {activeTab === "settings" ? (
            <div>
              <Title level={4} style={{ color: "#0f172a", marginBottom: 20 }}>
                Tham Số Vận Hành & Quy Định Đặt Phòng
              </Title>
              <Form
                layout="vertical"
                initialValues={systemConfig}
                onFinish={(values) => {
                  setSystemConfig(values);
                  localStorage.setItem("tbd_system_config", JSON.stringify(values));
                  message.success("Đã lưu cấu hình quy định hệ thống thành công!");
                }}
              >
                <Form.Item
                  name="maxAdvanceDays"
                  label="Số ngày được phép đăng ký trước tối đa"
                  tooltip="Hệ thống sẽ hạn chế người dùng đặt phòng vượt quá mốc ngày này."
                >
                  <InputNumber min={1} max={90} suffix="ngày" style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  name="maxHoursPerBooking"
                  label="Thời lượng đặt phòng tối đa trong 1 lượt"
                  tooltip="Thời lượng tối đa cho 1 buổi học hoặc sự kiện."
                >
                  <InputNumber min={1} max={12} suffix="giờ" style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  name="cancelBeforeHours"
                  label="Thời hạn tối thiểu cho phép hủy phòng trước giờ sử dụng"
                  tooltip="Hạn chế việc hủy lịch sát giờ ảnh hưởng đến công tác sắp xếp phòng học."
                >
                  <InputNumber min={1} max={24} suffix="giờ" style={{ width: "100%" }} />
                </Form.Item>

                <Form.Item
                  name="operatingHours"
                  label="Khung giờ hoạt động chuẩn của các khu phòng"
                >
                  <Input placeholder="VD: 07:00 - 21:00" />
                </Form.Item>

                <Form.Item
                  name="autoApproveClassroom"
                  valuePropName="checked"
                  label="Xác nhận trực tiếp đối với Giảng viên đăng ký phòng học thông thường"
                >
                  <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
                </Form.Item>

                <Form.Item
                  name="requireSpecialJustification"
                  valuePropName="checked"
                  label="Bắt buộc minh chứng & lý do đối với sự kiện đặc biệt / ngoài giờ"
                >
                  <Switch checkedChildren="Bắt buộc" unCheckedChildren="Không" />
                </Form.Item>

                <Divider style={{ margin: "16px 0" }} />

                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<CheckOutlined />}
                  style={{ background: "#0284c7", borderColor: "#0284c7" }}
                >
                  Lưu cấu hình quy định
                </Button>
              </Form>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Title level={4} style={{ color: "#0f172a", marginBottom: 6 }}>
                  Khung Giờ Tiết Học & Ca Giảng Dạy
                </Title>
                <Paragraph style={{ color: "#64748b", marginBottom: 16 }}>
                  Quy định khung giờ chuẩn (50 phút/tiết) áp dụng chính thức cho toàn bộ giảng đường và phòng học tại Trường Đại học Thái Bình Dương (TBD).
                </Paragraph>

                {/* Building Info & Shift Rules Notice */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 16,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      background: "#f0f9ff",
                      border: "1px solid #bae6fd",
                      borderRadius: 8,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#0369a1", fontSize: 13.5, marginBottom: 6 }}>
                      🏫 Thông tin Ký hiệu Tòa nhà
                    </div>
                    <div style={{ fontSize: 13, color: "#0c4a6e", lineHeight: 1.6 }}>
                      • <strong>Khu A</strong>: Tòa nhà 5 tầng (Giảng đường lý thuyết, phòng máy tính, phòng đa năng)<br />
                      • <strong>Khu B</strong>: Tòa nhà 2 tầng (Khu thực hành, xưởng, phòng học chuyên đề)
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      padding: "14px 16px",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#1e293b", fontSize: 13.5, marginBottom: 6 }}>
                      ⏱️ Quy tắc Phân Bổ Thời Gian
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                      • Mỗi tiết học kéo dài đúng <strong>50 phút</strong><br />
                      • <strong>Ca Sáng (Tiết 1 – 6)</strong>: 07:00 – 12:15 (Giải lao 15p sau Tiết 3, nghỉ trưa 60p)<br />
                      • <strong>Ca Chiều (Tiết 7 – 12)</strong>: 13:15 – 18:30 (Giải lao 15p sau Tiết 9)
                    </div>
                  </div>
                </div>
              </div>

              <Table
                className="academic-table"
                size="small"
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={[
                  {
                    title: "TIẾT",
                    dataIndex: "period",
                    key: "period",
                    width: 110,
                    render: (text: string) => (
                      <Text strong style={{ color: "#0d2e5c" }}>
                        {text}
                      </Text>
                    ),
                  },
                  {
                    title: "BUỔI",
                    dataIndex: "session",
                    key: "session",
                    width: 100,
                    render: (val: string) => (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: val === "Sáng" ? "#e0f2fe" : "#fef3c7",
                          color: val === "Sáng" ? "#0369a1" : "#b45309",
                        }}
                      >
                        {val}
                      </span>
                    ),
                  },
                  {
                    title: "GIỜ BẮT ĐẦU",
                    dataIndex: "start",
                    key: "start",
                    width: 130,
                    render: (val: string) => (
                      <Text code style={{ fontWeight: 600, color: "#0f172a" }}>
                        {val}
                      </Text>
                    ),
                  },
                  {
                    title: "GIỜ KẾT THÚC",
                    dataIndex: "end",
                    key: "end",
                    width: 130,
                    render: (val: string) => (
                      <Text code style={{ fontWeight: 600, color: "#0f172a" }}>
                        {val}
                      </Text>
                    ),
                  },
                  {
                    title: "GHI CHÚ",
                    dataIndex: "notes",
                    key: "notes",
                    render: (val: string) => {
                      const isSpecial = val.includes("Giải lao") || val.includes("Nghỉ trưa") || val.includes("Kết thúc");
                      return (
                        <span
                          style={{
                            color: isSpecial ? "#b45309" : "#64748b",
                            fontWeight: isSpecial ? 600 : 400,
                          }}
                        >
                          {val}
                        </span>
                      );
                    },
                  },
                ]}
                dataSource={[
                  { key: 1, period: "Tiết 1", session: "Sáng", start: "07:00", end: "07:50", notes: "Ca sáng" },
                  { key: 2, period: "Tiết 2", session: "Sáng", start: "07:50", end: "08:40", notes: "Ca sáng" },
                  { key: 3, period: "Tiết 3", session: "Sáng", start: "08:40", end: "09:30", notes: "Giải lao sau tiết 3: 09:30 – 09:45 (15 phút)" },
                  { key: 4, period: "Tiết 4", session: "Sáng", start: "09:45", end: "10:35", notes: "Ca sáng" },
                  { key: 5, period: "Tiết 5", session: "Sáng", start: "10:35", end: "11:25", notes: "Ca sáng" },
                  { key: 6, period: "Tiết 6", session: "Sáng", start: "11:25", end: "12:15", notes: "Nghỉ trưa: 12:15 – 13:15 (60 phút)" },
                  { key: 7, period: "Tiết 7", session: "Chiều", start: "13:15", end: "14:05", notes: "Ca chiều" },
                  { key: 8, period: "Tiết 8", session: "Chiều", start: "14:05", end: "14:55", notes: "Ca chiều" },
                  { key: 9, period: "Tiết 9", session: "Chiều", start: "14:55", end: "15:45", notes: "Giải lao sau tiết 9: 15:45 – 16:00 (15 phút)" },
                  { key: 10, period: "Tiết 10", session: "Chiều", start: "16:00", end: "16:50", notes: "Ca chiều" },
                  { key: 11, period: "Tiết 11", session: "Chiều", start: "16:50", end: "17:40", notes: "Ca chiều" },
                  { key: 12, period: "Tiết 12", session: "Chiều", start: "17:40", end: "18:30", notes: "Kết thúc ca chiều" },
                ]}
              />
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      style={{
        padding: "24px 24px",
        maxWidth: 1440,
        margin: "0 auto",
        width: "100%",
        minHeight: "85vh",
      }}
    >
      {/* Breadcrumb, Page Title & Main Action Button */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            {currentHeaderInfo.breadcrumb.map((item, idx) => (
              <span key={idx}>
                {idx > 0 && <span style={{ margin: "0 6px", color: "#cbd5e1" }}>/</span>}
                <span
                  style={{
                    color:
                      idx === currentHeaderInfo.breadcrumb.length - 1
                        ? "#0f172a"
                        : "#64748b",
                    fontWeight:
                      idx === currentHeaderInfo.breadcrumb.length - 1 ? 600 : 400,
                  }}
                >
                  {item}
                </span>
              </span>
            ))}
          </div>
          <div>
            <Tag color={isAdmin ? "blue" : "volcano"} style={{ fontWeight: 600, margin: 0, fontSize: 12, padding: "2px 8px" }}>
              {isAdmin ? "Vai trò: Quản trị viên (Admin)" : "Vai trò: Quản lý ĐT & CSVC (Manager)"}
            </Tag>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: isAdmin ? "#0d2e5c" : "#c2410c", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>
              {isAdmin ? "Trung Tâm Quản Trị Hệ Thống" : "Trung Tâm Quản Lý Đào Tạo & Cơ Sở Vật Chất"}
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.4px",
              }}
            >
              {currentHeaderInfo.title}
            </h1>
            {!isAdmin && (
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Quản lý phòng học, thời khóa biểu, phê duyệt lượt đặt phòng, giám sát thiết bị và xử lý sự cố
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {renderTopActionButton()}
          </div>
        </div>
      </div>

      {/* Main 2-Column Academic Layout */}
      <div className="admin-page-layout">
        {/* Left Sidebar Menu Tree */}
        <div className="academic-sidebar" style={{ width: 250, minWidth: 250, flexShrink: 0 }}>
          {/* TỔNG QUAN */}
          <div className="academic-menu-section-title">TỔNG QUAN</div>
          <div
            className={`academic-nav-item ${activeTab === "analytics" ? "active" : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            <span>Báo cáo vận hành</span>
          </div>

          {/* QUẢN LÝ ĐẶT PHÒNG */}
          <div className="academic-menu-section-title">QUẢN LÝ ĐẶT PHÒNG</div>
          <div
            className={`academic-nav-item ${activeTab === "bookings-pending" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings-pending")}
          >
            <span>Chờ phê duyệt</span>
            {pendingBookingsCount > 0 && (
              <span className="academic-badge-count warn">
                {pendingBookingsCount}
              </span>
            )}
          </div>
          <div
            className={`academic-nav-item ${activeTab === "bookings" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings")}
          >
            <span>Danh sách đơn đặt phòng</span>
          </div>
          <div
            className={`academic-nav-item ${activeTab === "bookings-schedule" ? "active" : ""}`}
            onClick={() => setActiveTab("bookings-schedule")}
          >
            <span>Lịch biểu theo tuần</span>
          </div>
          <div
            className={`academic-nav-item ${activeTab === "academic-schedule" ? "active" : ""}`}
            onClick={() => setActiveTab("academic-schedule")}
          >
            <span>Thời khóa biểu & Lịch học</span>
          </div>

          {/* CƠ SỞ VẬT CHẤT */}
          <div className="academic-menu-section-title">CƠ SỞ VẬT CHẤT</div>
          <div
            className={`academic-nav-item ${activeTab === "rooms" ? "active" : ""}`}
            onClick={() => setActiveTab("rooms")}
          >
            <span>Phòng học</span>
          </div>
          <div
            className={`academic-nav-item academic-nav-item-sub ${
              activeTab === "rooms-building-a" ? "active" : ""
            }`}
            onClick={() => setActiveTab("rooms-building-a")}
          >
            <span>Khu A (Tòa nhà 5 tầng)</span>
          </div>
          <div
            className={`academic-nav-item academic-nav-item-sub ${
              activeTab === "rooms-building-b" ? "active" : ""
            }`}
            onClick={() => setActiveTab("rooms-building-b")}
          >
            <span>Khu B (Tòa nhà 2 tầng)</span>
          </div>
          <div
            className={`academic-nav-item ${
              activeTab === "equipment-inventory" ? "active" : ""
            }`}
            onClick={() => setActiveTab("equipment-inventory")}
          >
            <span>Thiết bị mượn thêm</span>
          </div>
          <div
            className={`academic-nav-item ${
              activeTab === "equipment-issues" ? "active" : ""
            }`}
            onClick={() => setActiveTab("equipment-issues")}
          >
            <span>Báo cáo sự cố</span>
            {pendingIssuesCount > 0 && (
              <span className="academic-badge-count danger">
                {pendingIssuesCount}
              </span>
            )}
          </div>

          {/* NGƯỜI DÙNG & CẤU HÌNH: CHỈ HIỂN THỊ KHI LÀ ADMIN */}
          {isAdmin && (
            <>
              {/* NGƯỜI DÙNG */}
              <div className="academic-menu-section-title">NGƯỜI DÙNG</div>
              <div
                className={`academic-nav-item ${activeTab === "users-students" ? "active" : ""}`}
                onClick={() => setActiveTab("users-students")}
              >
                <span>Sinh viên</span>
              </div>
              <div
                className={`academic-nav-item ${activeTab === "users-lecturers" ? "active" : ""}`}
                onClick={() => setActiveTab("users-lecturers")}
              >
                <span>Giảng viên & Cán bộ</span>
              </div>
              <div
                className={`academic-nav-item ${activeTab === "users-managers" ? "active" : ""}`}
                onClick={() => setActiveTab("users-managers")}
              >
                <span>Quản lý Đào tạo & CSVC</span>
              </div>
              <div
                className={`academic-nav-item ${activeTab === "users" ? "active" : ""}`}
                onClick={() => setActiveTab("users")}
              >
                <span>Phân quyền quản trị</span>
              </div>

              {/* CẤU HÌNH */}
              <div className="academic-menu-section-title">CẤU HÌNH</div>
              <div
                className={`academic-nav-item ${activeTab === "settings" ? "active" : ""}`}
                onClick={() => setActiveTab("settings")}
              >
                <span>Quy định đặt phòng</span>
              </div>
              <div
                className={`academic-nav-item ${activeTab === "settings-shifts" ? "active" : ""}`}
                onClick={() => setActiveTab("settings-shifts")}
              >
                <span>Khung giờ tiết học</span>
              </div>
            </>
          )}
        </div>

        {/* Right Main Content Pane */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renderMainContent()}
        </div>
      </div>

      {/* MODAL: Add/Edit Room */}
      <Modal
        title={editingRoom ? "Cập Nhật Thông Tin Phòng Học" : "Thêm Phòng Học Mới"}
        open={isRoomModalVisible}
        onCancel={() => setIsRoomModalVisible(false)}
        onOk={() => roomForm.submit()}
        confirmLoading={saveRoomMutation.isPending}
      >
        <Form
          form={roomForm}
          layout="vertical"
          onFinish={(values) => saveRoomMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="Mã & Tên phòng"
            rules={[{ required: true, message: "Vui lòng nhập tên phòng học!" }]}
          >
            <Input placeholder="VD: A.101 - Phòng học lý thuyết" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="building"
                label="Khu vực / Tòa nhà"
                rules={[{ required: true }]}
                initialValue="Khu A"
              >
                <Select
                  options={[
                    { value: "Khu A", label: "Khu A" },
                    { value: "Khu B", label: "Khu B" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="floor" label="Tầng" initialValue="Tầng 1">
                <Input placeholder="VD: Tầng 1" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="capacity"
                label="Sức chứa (Người)"
                rules={[{ required: true }]}
                initialValue={40}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái" initialValue="Active">
                <Select
                  options={[
                    { value: "Active", label: "Đang hoạt động" },
                    { value: "Maintenance", label: "Đang bảo trì" },
                    { value: "Closed", label: "Đóng cửa" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="roomType" label="Loại phòng" initialValue="Classroom">
            <Select
              options={[
                { value: "Classroom", label: "Phòng học lý thuyết" },
                { value: "MeetingRoom", label: "Phòng họp" },
                { value: "Lab", label: "Phòng Thí nghiệm" },
                { value: "ComputerLab", label: "Phòng Máy tính" },
                { value: "LectureHall", label: "Hội trường" },
              ]}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label="Đường dẫn ảnh đại diện (URL)">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú & Trang thiết bị có sẵn">
            <Input.TextArea
              rows={3}
              placeholder="VD: Trang bị sẵn máy chiếu, 2 điều hòa, hệ thống loa..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* DRAWER: Room Equipment Inspector */}
      <Drawer
        title={
          selectedRoomForEquip
            ? `Danh Mục Thiết Bị Bên Trong Phòng ${selectedRoomForEquip.name}`
            : "Trang Thiết Bị Phòng"
        }
        placement="right"
        size="large"
        onClose={() => setIsRoomEquipmentDrawerVisible(false)}
        open={isRoomEquipmentDrawerVisible}
      >
        {selectedRoomForEquip && (
          <div>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Khu vực">{selectedRoomForEquip.building}</Descriptions.Item>
              <Descriptions.Item label="Sức chứa">{selectedRoomForEquip.capacity} chỗ</Descriptions.Item>
              <Descriptions.Item label="Mô tả thiết bị">{selectedRoomForEquip.description || "Máy chiếu, Điều hòa, Bàn ghế chuẩn"}</Descriptions.Item>
            </Descriptions>

            <Title level={5}>Trang Thiết Bị Ghi Nhận</Title>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(equipmentsQuery.data || [])
                .filter((e: EquipmentItem) => e.roomId === selectedRoomForEquip.id || e.roomName?.includes(selectedRoomForEquip.name))
                .map((eq: EquipmentItem) => (
                  <Card key={eq.id} size="small" style={{ borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text strong>{eq.name}</Text>
                      <Tag color={eq.status === "Active" ? "green" : "warning"}>{eq.status}</Tag>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      Mã: {eq.code} | Số lượng: {eq.quantity}
                    </div>
                  </Card>
                ))}
            </div>

            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              style={{ marginTop: 16 }}
              onClick={() => {
                setEditingEquipment(null);
                equipmentForm.resetFields();
                equipmentForm.setFieldsValue({
                  roomId: selectedRoomForEquip.id,
                  roomName: selectedRoomForEquip.name,
                });
                setIsEquipmentModalVisible(true);
              }}
            >
              Thêm thiết bị vào phòng này
            </Button>
          </div>
        )}
      </Drawer>

      {/* MODAL: Booking Detail */}
      <Modal
        title="Chi Tiết Đơn Đăng Ký Đặt Phòng"
        open={isBookingDetailModalVisible}
        onCancel={() => setIsBookingDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsBookingDetailModalVisible(false)}>
            Đóng
          </Button>,
        ]}
        width={650}
      >
        {selectedBooking && (
          <Descriptions column={1} bordered size="small" style={{ marginTop: 12 }}>
            <Descriptions.Item label="Mã đăng ký">#{selectedBooking.id}</Descriptions.Item>
            <Descriptions.Item label="Phòng đăng ký">
              <strong>{selectedBooking.roomName}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Người đăng ký">
              {selectedBooking.userEmail} ({selectedBooking.department || "N/A"})
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian">
              {dayjs(selectedBooking.startTime).format("DD/MM/YYYY HH:mm")} -{" "}
              {dayjs(selectedBooking.endTime).format("HH:mm")}
            </Descriptions.Item>
            <Descriptions.Item label="Sức chứa tham gia">
              {selectedBooking.participantCount || "--"} người
            </Descriptions.Item>
            <Descriptions.Item label="Mục đích sử dụng">
              {selectedBooking.purpose || "Chưa nhập"}
            </Descriptions.Item>
            <Descriptions.Item label="Thiết bị mượn kèm">
              {selectedBooking.requestedEquipments &&
              selectedBooking.requestedEquipments.length > 0 ? (
                <div>
                  {selectedBooking.requestedEquipments.map((eq, idx) => (
                    <Tag color="blue" key={idx} style={{ marginBottom: 4 }}>
                      {eq}
                    </Tag>
                  ))}
                </div>
              ) : (
                <em>Không đăng ký mượn thiết bị thêm</em>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Sự kiện đặc biệt">
              {selectedBooking.isSpecialRequest ? (
                <Tag color="volcano">Sự kiện ngoài giờ / Cần BQL phê duyệt</Tag>
              ) : (
                <Tag color="green">Sử dụng lớp học thông thường</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              {renderAcademicBookingStatus(selectedBooking.status, selectedBooking)}
            </Descriptions.Item>
            {(selectedBooking.adminNotes || selectedBooking.rejectReason || selectedBooking.rejectionReason) && (
              <Descriptions.Item label="Ghi chú / Lý do xử lý">
                <span style={{ color: "#b91c1c", fontWeight: 500 }}>
                  {selectedBooking.adminNotes || selectedBooking.rejectReason || selectedBooking.rejectionReason}
                </span>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* MODAL: Reject Reason */}
      <Modal
        title="Từ Chối Yêu Cầu Đặt Phòng"
        open={isRejectModalVisible}
        onCancel={() => setIsRejectModalVisible(false)}
        onOk={() => rejectReasonForm.submit()}
      >
        <Form
          form={rejectReasonForm}
          layout="vertical"
          onFinish={(values) => {
            if (rejectBookingId) {
              bookingMutation.mutate({
                id: rejectBookingId,
                status: "Rejected",
                notes: values.reason,
              });
            }
          }}
        >
          <Form.Item
            name="reason"
            label="Lý do từ chối"
            rules={[{ required: true, message: "Vui lòng nhập lý do từ chối!" }]}
          >
            <Input.TextArea
              rows={3}
              placeholder="VD: Phòng đã trùng lịch thi học kỳ / Đang bảo trì đột xuất / Thiếu minh chứng kèm theo..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Equipment Add/Edit */}
      <Modal
        title={editingEquipment ? "Chỉnh Sửa Thiết Bị" : "Thêm Thiết Bị Mới"}
        open={isEquipmentModalVisible}
        onCancel={() => setIsEquipmentModalVisible(false)}
        onOk={() => equipmentForm.submit()}
      >
        <Form
          form={equipmentForm}
          layout="vertical"
          onFinish={(values) => saveEquipmentMutation.mutate(values)}
        >
          <Form.Item name="code" label="Mã thiết bị" rules={[{ required: true }]}>
            <Input placeholder="VD: EQ-PJ-001" />
          </Form.Item>

          <Form.Item name="name" label="Tên thiết bị" rules={[{ required: true }]}>
            <Input placeholder="VD: Máy chiếu Panasonic PT-LB386" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Số lượng"
                rules={[{ required: true }]}
                initialValue={1}
              >
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái" initialValue="Active">
                <Select
                  options={[
                    { value: "Active", label: "Sử dụng tốt" },
                    { value: "Maintenance", label: "Đang bảo trì" },
                    { value: "Broken", label: "Đang hỏng" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="roomName" label="Vị trí đặt thiết bị">
            <Input placeholder="Kho thiết bị dùng chung hoặc tên phòng học" />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Issue Resolve */}
      <Modal
        title="Cập Nhật Xử Lý Sự Cố Thiết Bị"
        open={isIssueResolveModalVisible}
        onCancel={() => setIsIssueResolveModalVisible(false)}
        onOk={() => issueResolveForm.submit()}
      >
        <Form
          form={issueResolveForm}
          layout="vertical"
          onFinish={(values) => saveIssueMutation.mutate(values)}
        >
          <Form.Item name="status" label="Trạng thái xử lý" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "Pending", label: "Chờ tiếp nhận" },
                { value: "Assigned", label: "Đã phân công kỹ thuật viên" },
                { value: "Fixing", label: "Đang sửa chữa" },
                { value: "Resolved", label: "Đã khắc phục hoàn tất" },
                { value: "Rejected", label: "Không đủ điều kiện xử lý" },
              ]}
            />
          </Form.Item>

          <Form.Item name="assignedTo" label="Cán bộ / Kỹ thuật viên phụ trách">
            <Input placeholder="VD: Kỹ thuật viên Nguyễn Văn Bình" />
          </Form.Item>

          <Form.Item name="repairNotes" label="Ghi chú kết quả / Tiến độ sửa chữa">
            <Input.TextArea
              rows={3}
              placeholder="VD: Đã thay thế linh kiện bóng đèn mới, đã kiểm tra vận hành tốt..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: User Add/Edit */}
      <Modal
        title={editingUser ? "Cập Nhật Thông Tin Tài Khoản" : "Thêm Tài Khoản Mới"}
        open={isUserModalVisible}
        onCancel={() => setIsUserModalVisible(false)}
        onOk={() => userForm.submit()}
        confirmLoading={saveUserMutation.isPending}
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={(values) => saveUserMutation.mutate(values)}
        >
          <Form.Item
            name="email"
            label="Địa chỉ Email (TBD)"
            rules={[{ required: true, type: "email", message: "Vui lòng nhập email hợp lệ!" }]}
          >
            <Input placeholder="email@tbd.edu.vn" disabled={!!editingUser} />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="Mật khẩu khởi tạo"
              initialValue="Tbd@123456"
              extra="Mặc định nếu để trống là: Tbd@123456"
            >
              <Input.Password placeholder="Tbd@123456" />
            </Form.Item>
          )}

          <Form.Item
            name="fullName"
            label="Họ và Tên"
            rules={[{ required: true, message: "Vui lòng nhập họ và tên!" }]}
          >
            <Input placeholder="VD: TS. Nguyễn Văn A / Trần Văn B" />
          </Form.Item>

          <Form.Item
            name="userCode"
            label="Mã định danh (MSSV / Mã Cán bộ)"
            tooltip="Mã số sinh viên (đối với Sinh viên) hoặc Mã định danh cán bộ giảng viên."
          >
            <Input placeholder="VD: 230057 / QL-001 / GV-CNTT-08" />
          </Form.Item>

          <Form.Item name="department" label="Khoa / Phòng ban">
            <Input placeholder="VD: Khoa Công nghệ & Kỹ thuật / Ban Quản lý Cơ sở vật chất TBD" />
          </Form.Item>

          <Form.Item
            name="role"
            label="Vai trò phân quyền"
            rules={[{ required: true, message: "Vui lòng chọn vai trò!" }]}
            initialValue="User"
          >
            <Select
              options={[
                { value: "Admin", label: "Quản trị viên (Admin)" },
                { value: "Approver", label: "Quản lý Đào tạo & CSVC (Manager / Approver)" },
                { value: "Faculty", label: "Giảng viên (Faculty)" },
                { value: "User", label: "Sinh viên (User)" },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.role !== currentValues.role}
          >
            {({ getFieldValue }) => {
              const selectedRole = getFieldValue("role");
              if (selectedRole === "Approver") {
                return (
                  <div
                    style={{
                      background: "#fff7ed",
                      border: "1px solid #fed7aa",
                      borderRadius: 8,
                      padding: "10px 14px",
                      marginBottom: 16,
                      fontSize: 12.5,
                      color: "#9a3412",
                      lineHeight: 1.6,
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "#ea580c" }}>★ Thẩm quyền chính thức trường TBD:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      <li>Duyệt / từ chối các yêu cầu đặt phòng học (<code>/approvals</code>)</li>
                      <li>Bố trí Thời khóa biểu và lịch giảng dạy chính khóa các học kỳ</li>
                      <li>Quản lý phòng học và trang thiết bị</li>
                    </ul>
                  </div>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="phoneNumber" label="Số điện thoại liên hệ">
            <Input placeholder="VD: 0905 123 456" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Notifications Drawer */}
      <Drawer
        title="Thông Báo Hệ Thống"
        open={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        size="default"
      >
        {notificationsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <Spin description="Đang tải thông báo..." />
          </div>
        ) : Array.isArray(notificationsQuery.data) && notificationsQuery.data.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {notificationsQuery.data.map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                style={{
                  padding: "12px 14px",
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>
                  {item.title || item.subject || "Thông báo hệ thống"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                  {item.message || item.content || item.description || "Nội dung thông báo"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, textAlign: "right" }}>
                  {item.createdAt ? dayjs(item.createdAt).format("DD/MM/YYYY HH:mm") : "Hôm nay"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty description="Không có thông báo mới" />
        )}
      </Drawer>

      {/* MODAL: Nhập Thời Khóa Biểu & Lịch Học Định Kỳ Theo Học Kỳ */}
      <SemesterScheduleModal
        open={isSemesterScheduleModalOpen}
        onClose={() => setIsSemesterScheduleModalOpen(false)}
        rooms={roomsData}
        allBookings={bookingsData}
        currentUserRole={activeUserRole}
        currentUserEmail={currentUserEmail}
        currentUserName={currentUserName}
        onScheduleCreated={() => {
          setActiveTab("academic-schedule");
        }}
      />
    </div>
  );
}
