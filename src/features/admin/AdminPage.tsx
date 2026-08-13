import { useState } from "react";
import {
  Typography,
  Tabs,
  Spin,
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Card,
  Row,
  Col,
  Statistic,
  Badge,
  Tooltip,
  Switch,
  Descriptions,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DashboardOutlined,
  HomeOutlined,
  CalendarOutlined,
  ToolOutlined,
  TeamOutlined,
  SettingOutlined,
  UserAddOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { http } from "../../api/http";
import { getUserRole } from "../../api/authUtils";
import AnalyticsDashboard from "./AnalyticsDashboard";
import type { Room } from "../../types/room";
import type { Booking, BookingStatus } from "../../types/booking";
import dayjs from "dayjs";
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

interface AccountItem {
  email: string;
  department: string;
  role: string;
  fullName?: string;
  phone?: string;
}

export default function AdminPage() {
  const activeUserRole = getUserRole();
  const isAdmin = activeUserRole === "admin";
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState("analytics");

  // Search & Filters state
  const [roomSearch, setRoomSearch] = useState("");
  const [roomBuildingFilter, setRoomBuildingFilter] = useState("all");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [equipmentSearch, setEquipmentSearch] = useState("");

  // Modals state
  const [isRoomModalVisible, setIsRoomModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomForm] = Form.useForm();

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

  // Config State
  const [systemConfig, setSystemConfig] = useState({
    maxAdvanceDays: 14,
    maxHoursPerBooking: 4,
    autoApproveClassroom: false,
    requireSpecialJustification: true,
    operatingHours: "07:00 - 21:00",
  });

  // Queries
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      try {
        const res = await http.get<Room[]>("/api/rooms");
        return getOfficialRooms(res.data);
      } catch {
        const localStr = localStorage.getItem("tbd_admin_rooms");
        return getOfficialRooms(localStr ? JSON.parse(localStr) : []);
      }
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      try {
        const res = await http.get<Booking[]>("/api/bookings");
        return res.data;
      } catch {
        const localStr = localStorage.getItem("tbd_admin_bookings");
        return localStr ? JSON.parse(localStr) : [];
      }
    },
  });

  const issuesQuery = useQuery({
    queryKey: ["equipment-issues"],
    queryFn: async () => {
      const localStr = localStorage.getItem("tbd_admin_equipment_issues");
      if (localStr) {
        try {
          return JSON.parse(localStr) as EquipmentIssue[];
        } catch {
          // fallback
        }
      }
      // Demo initial issues if empty
      return [
        {
          id: 101,
          roomId: 1,
          roomName: "A.101 - Phòng máy tính",
          equipmentId: 1,
          equipmentName: "Máy chiếu Panasonic",
          userEmail: "gv_nguyenvana@tbd.edu.vn",
          description: "Máy chiếu bị mờ hình và nhấp nháy liên tục khi bật",
          imageUrl: null,
          severity: "Medium",
          status: "Pending",
          assignedTo: null,
          repairNotes: null,
          createdAt: dayjs().subtract(1, "day").toISOString(),
          updatedAt: dayjs().subtract(1, "day").toISOString(),
        },
        {
          id: 102,
          roomId: 2,
          roomName: "B.202 - Phòng học Lý thuyết",
          equipmentId: 2,
          equipmentName: "Điều hòa Daikin",
          userEmail: "sv_tranvanb@tbd.edu.vn",
          description: "Điều hòa chảy nước và không có hơi lạnh",
          imageUrl: null,
          severity: "High",
          status: "Fixing",
          assignedTo: "Kỹ thuật viên Nguyễn Văn Bình",
          repairNotes: "Đang thay thế block lạnh",
          createdAt: dayjs().subtract(2, "days").toISOString(),
          updatedAt: dayjs().subtract(1, "hour").toISOString(),
        },
      ] as EquipmentIssue[];
    },
  });

  const equipmentsQuery = useQuery({
    queryKey: ["equipments"],
    queryFn: async () => {
      const localStr = localStorage.getItem("tbd_equipments");
      if (localStr) {
        try {
          return JSON.parse(localStr) as EquipmentItem[];
        } catch {
          // fallback
        }
      }
      return [
        {
          id: 1,
          code: "EQ-PJ-001",
          name: "Máy chiếu Panasonic PT-LB386",
          type: "Projector",
          roomId: 1,
          roomName: "A.101",
          quantity: 2,
          status: "Active",
          purchaseDate: "2023-05-10",
        },
        {
          id: 2,
          code: "EQ-AC-002",
          name: "Điều hòa Daikin Inverter 2.5 HP",
          type: "Air Conditioner",
          roomId: 2,
          roomName: "B.202",
          quantity: 2,
          status: "Maintenance",
          issueNotes: "Đang kiểm tra rò rỉ gas",
        },
        {
          id: 3,
          code: "EQ-SP-003",
          name: "Hệ thống âm thanh không dây JBL",
          type: "Sound System",
          roomId: null,
          roomName: "Kho thiết bị dùng chung",
          quantity: 5,
          status: "Active",
          purchaseDate: "2024-01-15",
        },
        {
          id: 4,
          code: "EQ-MC-004",
          name: "Micro không dây Shure SVX288",
          type: "Microphone",
          roomId: null,
          roomName: "Kho thiết bị dùng chung",
          quantity: 8,
          status: "Active",
        },
      ] as EquipmentItem[];
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const localStr = localStorage.getItem("tbd_accounts");
      if (localStr) {
        try {
          return JSON.parse(localStr) as AccountItem[];
        } catch {
          // fallback
        }
      }
      return [
        {
          email: "admin@tbd.edu.vn",
          department: "Ban BQL & Quản trị hệ thống",
          role: "admin",
          fullName: "Quản trị viên Hệ thống",
          phone: "0258 3727 147",
        },
        {
          email: "pheduyet@tbd.edu.vn",
          department: "Ban Quản lý Phòng học & Đào tạo",
          role: "approver",
          fullName: "Cán bộ Phê duyệt Đào tạo",
          phone: "0905 123 456",
        },
        {
          email: "gv_nguyenvana@tbd.edu.vn",
          department: "Khoa Công nghệ Thông tin",
          role: "lecturer",
          fullName: "TS. Nguyễn Văn A",
          phone: "0912 345 678",
        },
        {
          email: "sv_tranvanb@tbd.edu.vn",
          department: "Khoa Du lịch & Khách sạn",
          role: "student",
          fullName: "Trần Văn B (MSSV: 2200101)",
          phone: "0987 654 321",
        },
      ] as AccountItem[];
    },
  });

  // Booking Mutations
  const updateBookingStatus = async ({
    id,
    status,
    notes,
  }: {
    id: number;
    status: BookingStatus;
    notes?: string;
  }) => {
    try {
      await http.put(`/api/bookings/${id}/${String(status).toLowerCase()}`, {
        notes,
        rejectReason: notes,
      });
    } catch {
      const localBookings = bookingsQuery.data || [];
      const updated = localBookings.map((b: Booking) =>
        b.id === id ? { ...b, status, adminNotes: notes || b.adminNotes } : b
      );
      localStorage.setItem("tbd_admin_bookings", JSON.stringify(updated));
    }
  };

  const bookingMutation = useMutation({
    mutationFn: updateBookingStatus,
    onSuccess: () => {
      message.success("Đã cập nhật trạng thái đặt phòng thành công");
      setIsRejectModalVisible(false);
      rejectReasonForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
  });

  // Room Mutations
  const saveRoomMutation = useMutation({
    mutationFn: async (values: Partial<Room>) => {
      const localRooms = roomsQuery.data || [];
      if (editingRoom) {
        try {
          await http.put(`/api/rooms/${editingRoom.id}`, values);
        } catch {
          const updated = localRooms.map((r) =>
            r.id === editingRoom.id ? { ...r, ...values } : r
          );
          localStorage.setItem("tbd_admin_rooms", JSON.stringify(updated));
        }
      } else {
        try {
          await http.post("/api/rooms", values);
        } catch {
          const newRoom = { ...values, id: Date.now(), isActive: true } as Room;
          localStorage.setItem("tbd_admin_rooms", JSON.stringify([...localRooms, newRoom]));
        }
      }
    },
    onSuccess: () => {
      message.success(editingRoom ? "Đã cập nhật thông tin phòng" : "Đã thêm phòng học mới");
      setIsRoomModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  const deleteRoomMutation = useMutation({
    mutationFn: async (id: number) => {
      try {
        await http.delete(`/api/rooms/${id}`);
      } catch {
        const localRooms = roomsQuery.data || [];
        localStorage.setItem(
          "tbd_admin_rooms",
          JSON.stringify(localRooms.filter((r) => r.id !== id))
        );
      }
    },
    onSuccess: () => {
      message.success("Đã xóa phòng học khỏi hệ thống");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });

  // Equipment Mutations
  const saveEquipmentMutation = useMutation({
    mutationFn: async (values: Partial<EquipmentItem>) => {
      const list = equipmentsQuery.data || [];
      if (editingEquipment) {
        const updated = list.map((e) => (e.id === editingEquipment.id ? { ...e, ...values } : e));
        localStorage.setItem("tbd_equipments", JSON.stringify(updated));
      } else {
        const newItem = { ...values, id: Date.now() } as EquipmentItem;
        localStorage.setItem("tbd_equipments", JSON.stringify([...list, newItem]));
      }
    },
    onSuccess: () => {
      message.success(editingEquipment ? "Đã cập nhật thiết bị" : "Đã thêm thiết bị mới");
      setIsEquipmentModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: number) => {
      const list = equipmentsQuery.data || [];
      const filtered = list.filter((e) => e.id !== id);
      localStorage.setItem("tbd_equipments", JSON.stringify(filtered));
    },
    onSuccess: () => {
      message.success("Đã xóa thiết bị");
      queryClient.invalidateQueries({ queryKey: ["equipments"] });
    },
  });

  // Issue Resolution Mutation
  const saveIssueMutation = useMutation({
    mutationFn: async (values: Partial<EquipmentIssue>) => {
      const list = issuesQuery.data || [];
      if (editingIssue) {
        const updated = list.map((i) =>
          i.id === editingIssue.id
            ? { ...i, ...values, updatedAt: new Date().toISOString() }
            : i
        );
        localStorage.setItem("tbd_admin_equipment_issues", JSON.stringify(updated));
      }
    },
    onSuccess: () => {
      message.success("Đã cập nhật xử lý sự cố thiết bị");
      setIsIssueResolveModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["equipment-issues"] });
    },
  });

  // Account Mutation
  const saveUserMutation = useMutation({
    mutationFn: async (values: AccountItem) => {
      const list = accountsQuery.data || [];
      const existsIndex = list.findIndex((a) => a.email === values.email);
      let updatedList = [...list];
      if (existsIndex >= 0) {
        updatedList[existsIndex] = { ...list[existsIndex], ...values };
      } else {
        updatedList.push(values);
      }
      localStorage.setItem("tbd_accounts", JSON.stringify(updatedList));
    },
    onSuccess: () => {
      message.success("Đã lưu thông tin tài khoản");
      setIsUserModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const list = accountsQuery.data || [];
      const filtered = list.filter((a) => a.email !== email);
      localStorage.setItem("tbd_accounts", JSON.stringify(filtered));
    },
    onSuccess: () => {
      message.success("Đã xóa tài khoản");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  if (!isAdmin) {
    return (
      <div style={{ padding: 60, textAlign: "center" }}>
        <Title level={3} style={{ color: "#ef4444" }}>
          Truy Cập Bị Từ Chối
        </Title>
        <Paragraph style={{ color: "#64748b" }}>
          Trang này chỉ dành cho tài khoản có quyền Quản trị viên (Admin).
        </Paragraph>
      </div>
    );
  }

  // Filtered lists
  const roomsData = (roomsQuery.data || []).filter((r: Room) => {
    const matchSearch =
      r.name.toLowerCase().includes(roomSearch.toLowerCase()) ||
      (r.building && r.building.toLowerCase().includes(roomSearch.toLowerCase()));
    const matchBuilding = roomBuildingFilter === "all" || r.building === roomBuildingFilter;
    return matchSearch && matchBuilding;
  });

  const bookingsData = (bookingsQuery.data || []).filter((b: Booking) => {
    const matchSearch =
      b.roomName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      (b.userEmail && b.userEmail.toLowerCase().includes(bookingSearch.toLowerCase())) ||
      (b.purpose && b.purpose.toLowerCase().includes(bookingSearch.toLowerCase()));
    const matchStatus =
      bookingStatusFilter === "all" || String(b.status) === bookingStatusFilter;
    return matchSearch && matchStatus;
  });

  const accountsData = (accountsQuery.data || []).filter((a: AccountItem) => {
    const matchSearch =
      a.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (a.department && a.department.toLowerCase().includes(userSearch.toLowerCase())) ||
      (a.fullName && a.fullName.toLowerCase().includes(userSearch.toLowerCase()));
    const matchRole = userRoleFilter === "all" || a.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  const equipmentsData = (equipmentsQuery.data || []).filter((e: EquipmentItem) => {
    return (
      e.name.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      e.code.toLowerCase().includes(equipmentSearch.toLowerCase()) ||
      (e.roomName && e.roomName.toLowerCase().includes(equipmentSearch.toLowerCase()))
    );
  });

  const pendingBookingsCount = (bookingsQuery.data || []).filter(
    (b: Booking) => b.status === "Pending" || b.status === "PendingSpecial"
  ).length;

  const pendingIssuesCount = (issuesQuery.data || []).filter(
    (i: EquipmentIssue) => i.status === "Pending" || i.status === "Assigned" || i.status === "Fixing"
  ).length;

  // Table Columns
  const roomColumns = [
    {
      title: "Mã / Tên phòng",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Room) => (
        <div>
          <Text strong style={{ color: "#0d2e5c", fontSize: 15 }}>
            {text}
          </Text>
          {record.floor && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Tầng: {record.floor}
            </div>
          )}
        </div>
      ),
      sorter: (a: Room, b: Room) => a.name.localeCompare(b.name),
    },
    {
      title: "Khu vực",
      dataIndex: "building",
      key: "building",
      render: (val: string) => <Tag color="cyan">{val || "Khu A"}</Tag>,
    },
    {
      title: "Sức chứa",
      dataIndex: "capacity",
      key: "capacity",
      render: (val: number) => <Text>{val} chỗ ngồi</Text>,
      sorter: (a: Room, b: Room) => a.capacity - b.capacity,
    },
    {
      title: "Loại phòng",
      key: "roomType",
      render: (_: any, record: any) => {
        const label = record._displayType || record.roomType || "Phòng học";
        return (
          <Tag color="blue" style={{ borderRadius: 4 }}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        let color = "success";
        let text = "Đang hoạt động";
        if (status === "Maintenance") {
          color = "warning";
          text = "Đang bảo trì";
        } else if (status === "Closed") {
          color = "error";
          text = "Tạm đóng cửa";
        }
        return <Badge status={color as any} text={text} />;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_: any, record: Room) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa phòng">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: "#2563eb" }} />}
              onClick={() => {
                setEditingRoom(record);
                roomForm.setFieldsValue(record);
                setIsRoomModalVisible(true);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa phòng học"
            description="Bạn có chắc chắn muốn xóa phòng học này?"
            okText="Xóa"
            cancelText="Hủy"
            onConfirm={() => deleteRoomMutation.mutate(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const bookingColumns = [
    {
      title: "Mã & Phòng",
      key: "room",
      render: (_: any, record: Booking) => (
        <div>
          <Tag color="geekblue">#{record.id}</Tag>
          <Text strong style={{ display: "block", marginTop: 2, color: "#0d2e5c" }}>
            {record.roomName}
          </Text>
        </div>
      ),
    },
    {
      title: "Người đăng ký",
      key: "requester",
      render: (_: any, record: Booking) => (
        <div>
          <Text strong style={{ fontSize: 13 }}>
            {record.userEmail || "Người dùng"}
          </Text>
          {record.department && (
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {record.department}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Thời gian sử dụng",
      key: "time",
      render: (_: any, record: Booking) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {dayjs(record.startTime).format("DD/MM/YYYY")}
          </div>
          <div style={{ fontSize: 12, color: "#2563eb" }}>
            {dayjs(record.startTime).format("HH:mm")} -{" "}
            {dayjs(record.endTime).format("HH:mm")}
          </div>
        </div>
      ),
      sorter: (a: Booking, b: Booking) =>
        dayjs(a.startTime).valueOf() - dayjs(b.startTime).valueOf(),
    },
    {
      title: "Mục đích",
      dataIndex: "purpose",
      key: "purpose",
      ellipsis: true,
      render: (val: string) => val || <em>Chưa nhập</em>,
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, record: Booking) => {
        let color = "blue";
        let text = String(record.status);
        if (text === "Pending" || text === "PendingSpecial") {
          color = "gold";
          text = "Chờ duyệt";
        } else if (text === "Approved") {
          color = "green";
          text = "Đã duyệt";
        } else if (text === "Using") {
          color = "purple";
          text = "Đang sử dụng";
        } else if (text === "Completed") {
          color = "cyan";
          text = "Đã hoàn thành";
        } else if (text === "Rejected") {
          color = "red";
          text = "Từ chối";
        } else if (text === "Cancelled") {
          color = "default";
          text = "Đã hủy";
        }
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      width: 180,
      render: (_: any, record: Booking) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết đơn đăng ký">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: "#0d2e5c" }} />}
              onClick={() => {
                setSelectedBooking(record);
                setIsBookingDetailModalVisible(true);
              }}
            />
          </Tooltip>
          {String(record.status) === "Pending" || String(record.status) === "PendingSpecial" ? (
            <>
              <Popconfirm
                title="Phê duyệt yêu cầu"
                description="Bạn có chắc chắn muốn phê duyệt lượt đặt phòng này?"
                okText="Duyệt"
                cancelText="Hủy"
                onConfirm={() =>
                  bookingMutation.mutate({ id: record.id, status: "Approved" })
                }
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ background: "#10b981", borderColor: "#10b981" }}
                >
                  Duyệt
                </Button>
              </Popconfirm>
              <Button
                danger
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => {
                  setRejectBookingId(record.id);
                  setIsRejectModalVisible(true);
                }}
              >
                Từ chối
              </Button>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  const issueColumns = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    {
      title: "Vị trí & Thiết bị",
      key: "location",
      render: (_: any, record: EquipmentIssue) => (
        <div>
          <Text strong style={{ color: "#0d2e5c" }}>
            {record.roomName}
          </Text>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {record.equipmentName}
          </div>
        </div>
      ),
    },
    {
      title: "Người báo sự cố",
      dataIndex: "userEmail",
      key: "userEmail",
      ellipsis: true,
    },
    {
      title: "Mô tả sự cố",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Mức độ",
      dataIndex: "severity",
      key: "severity",
      render: (val: string) => {
        const colors: Record<string, string> = {
          Low: "blue",
          Medium: "gold",
          High: "orange",
          Critical: "red",
        };
        return <Tag color={colors[val] || "default"}>{val}</Tag>;
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (val: string) => {
        const map: Record<string, { label: string; color: string }> = {
          Pending: { label: "Chờ xử lý", color: "warning" },
          Assigned: { label: "Đã phân công", color: "processing" },
          Fixing: { label: "Đang sửa chữa", color: "purple" },
          Resolved: { label: "Đã khắc phục", color: "success" },
          Rejected: { label: "Không xử lý", color: "default" },
        };
        const item = map[val] || { label: val, color: "default" };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_: any, record: EquipmentIssue) => (
        <Button
          type="primary"
          ghost
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingIssue(record);
            issueResolveForm.setFieldsValue(record);
            setIsIssueResolveModalVisible(true);
          }}
        >
          Cập nhật
        </Button>
      ),
    },
  ];

  const equipmentColumns = [
    { title: "Mã TB", dataIndex: "code", key: "code", render: (text: string) => <Tag color="geekblue">{text}</Tag> },
    { title: "Tên thiết bị", dataIndex: "name", key: "name", render: (text: string) => <Text strong>{text}</Text> },
    { title: "Phòng/Kho", dataIndex: "roomName", key: "roomName", render: (val: string) => val || "Kho dùng chung" },
    { title: "Số lượng", dataIndex: "quantity", key: "quantity", sorter: (a: EquipmentItem, b: EquipmentItem) => a.quantity - b.quantity },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const map: Record<string, { label: string; color: string }> = {
          Active: { label: "Sử dụng tốt", color: "success" },
          InUse: { label: "Đang cho mượn", color: "processing" },
          Broken: { label: "Đang hỏng", color: "error" },
          Maintenance: { label: "Đang bảo trì", color: "warning" },
          Disposed: { label: "Đã thanh lý", color: "default" },
        };
        const item = map[status] || { label: status, color: "default" };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_: any, record: EquipmentItem) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: "#2563eb" }} />}
            onClick={() => {
              setEditingEquipment(record);
              equipmentForm.setFieldsValue(record);
              setIsEquipmentModalVisible(true);
            }}
          />
          <Popconfirm
            title="Xóa thiết bị"
            description="Bạn chắc chắn muốn xóa thiết bị này?"
            onConfirm={() => deleteEquipmentMutation.mutate(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const userColumns = [
    {
      title: "Họ tên & Email",
      key: "user",
      render: (_: any, record: AccountItem) => (
        <div>
          <Text strong style={{ color: "#0d2e5c", fontSize: 14 }}>
            {record.fullName || "Tài khoản hệ thống"}
          </Text>
          <div style={{ color: "#64748b", fontSize: 13 }}>{record.email}</div>
        </div>
      ),
    },
    {
      title: "Đơn vị / Khoa",
      dataIndex: "department",
      key: "department",
      render: (val: string) => val || <em>Chưa cập nhật</em>,
    },
    {
      title: "Vai trò",
      dataIndex: "role",
      key: "role",
      render: (role: string) => {
        let color = "blue";
        let label = role;
        if (role === "admin") {
          color = "gold";
          label = "Quản trị viên (Admin)";
        } else if (role === "approver") {
          color = "purple";
          label = "Cán bộ Phê duyệt";
        } else if (role === "lecturer") {
          color = "cyan";
          label = "Giảng viên";
        } else if (role === "student") {
          color = "green";
          label = "Sinh viên";
        }
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: "Số điện thoại",
      dataIndex: "phone",
      key: "phone",
      render: (val: string) => val || "--",
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_: any, record: AccountItem) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: "#2563eb" }} />}
            onClick={() => {
              setEditingUser(record);
              userForm.setFieldsValue(record);
              setIsUserModalVisible(true);
            }}
          />
          <Popconfirm
            title="Xóa tài khoản"
            description="Bạn có chắc muốn xóa tài khoản này?"
            onConfirm={() => deleteUserMutation.mutate(record.email)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isLoading = roomsQuery.isLoading || bookingsQuery.isLoading;

  const tabItems = [
    {
      key: "analytics",
      label: (
        <span>
          <DashboardOutlined /> Tổng quan & Báo cáo
        </span>
      ),
      children: isLoading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : (
        <AnalyticsDashboard
          rooms={roomsQuery.data ?? []}
          bookings={bookingsQuery.data ?? []}
          issues={issuesQuery.data ?? []}
          accounts={accountsQuery.data ?? []}
        />
      ),
    },
    {
      key: "bookings",
      label: (
        <span>
          <CalendarOutlined /> Quản lý Đặt phòng{" "}
          {pendingBookingsCount > 0 && (
            <Badge count={pendingBookingsCount} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          {/* Controls Bar */}
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8, background: "#f8fafc" }}
          >
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} md={16}>
                <Space wrap style={{ width: "100%" }}>
                  <Input
                    placeholder="Tìm phòng, email, mục đích..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    style={{ width: 260 }}
                    allowClear
                  />
                  <Select
                    value={bookingStatusFilter}
                    onChange={setBookingStatusFilter}
                    style={{ width: 170 }}
                  >
                    <Select.Option value="all">Tất cả trạng thái</Select.Option>
                    <Select.Option value="Pending">Chờ duyệt</Select.Option>
                    <Select.Option value="Approved">Đã duyệt</Select.Option>
                    <Select.Option value="Using">Đang sử dụng</Select.Option>
                    <Select.Option value="Completed">Đã hoàn thành</Select.Option>
                    <Select.Option value="Rejected">Từ chối</Select.Option>
                    <Select.Option value="Cancelled">Đã hủy</Select.Option>
                  </Select>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["bookings"] })}
                  >
                    Tải lại
                  </Button>
                </Space>
              </Col>
              <Col xs={24} md={8} style={{ textAlign: "right" }}>
                <Text type="secondary">
                  Hiển thị {bookingsData.length} / {bookingsQuery.data?.length || 0} yêu cầu
                </Text>
              </Col>
            </Row>
          </Card>

          <Table
            columns={bookingColumns}
            dataSource={bookingsData}
            rowKey="id"
            loading={bookingsQuery.isLoading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 900 }}
          />
        </div>
      ),
    },
    {
      key: "rooms",
      label: (
        <span>
          <HomeOutlined /> Quản lý Phòng học
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8, background: "#f8fafc" }}
          >
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} md={16}>
                <Space wrap>
                  <Input
                    placeholder="Tìm theo tên phòng hoặc khu vực..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    style={{ width: 280 }}
                    allowClear
                  />
                  <Select
                    value={roomBuildingFilter}
                    onChange={setRoomBuildingFilter}
                    style={{ width: 150 }}
                  >
                    <Select.Option value="all">Tất cả Khu vực</Select.Option>
                    <Select.Option value="Khu A">Khu A</Select.Option>
                    <Select.Option value="Khu B">Khu B</Select.Option>
                    <Select.Option value="Khu E">Khu E</Select.Option>
                  </Select>
                </Space>
              </Col>
              <Col xs={24} md={8} style={{ textAlign: "right" }}>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingRoom(null);
                    roomForm.resetFields();
                    setIsRoomModalVisible(true);
                  }}
                  style={{ background: "#0d2e5c" }}
                >
                  Thêm phòng mới
                </Button>
              </Col>
            </Row>
          </Card>

          <Table
            columns={roomColumns}
            dataSource={roomsData}
            rowKey="id"
            loading={roomsQuery.isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </div>
      ),
    },
    {
      key: "equipments",
      label: (
        <span>
          <ToolOutlined /> Thiết bị & Sự cố{" "}
          {pendingIssuesCount > 0 && (
            <Badge count={pendingIssuesCount} style={{ marginLeft: 6 }} />
          )}
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Tabs
            type="card"
            items={[
              {
                key: "issues_sub",
                label: `Sự cố báo hỏng (${pendingIssuesCount} cần xử lý)`,
                children: (
                  <div>
                    <Table
                      columns={issueColumns}
                      dataSource={issuesQuery.data || []}
                      rowKey="id"
                      loading={issuesQuery.isLoading}
                      pagination={{ pageSize: 8 }}
                      scroll={{ x: 800 }}
                    />
                  </div>
                ),
              },
              {
                key: "equip_sub",
                label: "Danh mục Thiết bị",
                children: (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                      <Input
                        placeholder="Tìm kiếm thiết bị..."
                        prefix={<SearchOutlined />}
                        value={equipmentSearch}
                        onChange={(e) => setEquipmentSearch(e.target.value)}
                        style={{ width: 280 }}
                        allowClear
                      />
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingEquipment(null);
                          equipmentForm.resetFields();
                          setIsEquipmentModalVisible(true);
                        }}
                        style={{ marginLeft: "auto", background: "#0d2e5c" }}
                      >
                        Thêm thiết bị
                      </Button>
                    </div>
                    <Table
                      columns={equipmentColumns}
                      dataSource={equipmentsData}
                      rowKey="id"
                      loading={equipmentsQuery.isLoading}
                      pagination={{ pageSize: 8 }}
                      scroll={{ x: 800 }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      ),
    },
    {
      key: "users",
      label: (
        <span>
          <TeamOutlined /> Quản lý Người dùng
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0" }}>
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 8, background: "#f8fafc" }}
          >
            <Row gutter={[16, 16]} align="middle" justify="space-between">
              <Col xs={24} md={16}>
                <Space wrap>
                  <Input
                    placeholder="Tìm email, họ tên, đơn vị..."
                    prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ width: 260 }}
                    allowClear
                  />
                  <Select
                    value={userRoleFilter}
                    onChange={setUserRoleFilter}
                    style={{ width: 170 }}
                  >
                    <Select.Option value="all">Tất cả vai trò</Select.Option>
                    <Select.Option value="admin">Quản trị viên</Select.Option>
                    <Select.Option value="approver">Cán bộ Duyệt</Select.Option>
                    <Select.Option value="lecturer">Giảng viên</Select.Option>
                    <Select.Option value="student">Sinh viên</Select.Option>
                  </Select>
                </Space>
              </Col>
              <Col xs={24} md={8} style={{ textAlign: "right" }}>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => {
                    setEditingUser(null);
                    userForm.resetFields();
                    setIsUserModalVisible(true);
                  }}
                  style={{ background: "#0d2e5c" }}
                >
                  Thêm tài khoản
                </Button>
              </Col>
            </Row>
          </Card>

          <Table
            columns={userColumns}
            dataSource={accountsData}
            rowKey="email"
            loading={accountsQuery.isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 800 }}
          />
        </div>
      ),
    },
    {
      key: "settings",
      label: (
        <span>
          <SettingOutlined /> Cấu hình Quy định
        </span>
      ),
      children: (
        <div style={{ padding: "16px 0", maxWidth: 800 }}>
          <Card
            title="Quy định Đặt phòng & Vận hành"
            style={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
          >
            <Form
              layout="vertical"
              initialValues={systemConfig}
              onFinish={(values) => {
                setSystemConfig(values);
                localStorage.setItem("tbd_system_config", JSON.stringify(values));
                message.success("Đã cập nhật cấu hình quy định hệ thống thành công!");
              }}
            >
              <Form.Item
                name="maxAdvanceDays"
                label="Số ngày được phép đăng ký trước tối đa"
                tooltip="Hệ thống sẽ không cho phép đặt phòng vượt quá số ngày này."
              >
                <InputNumber min={1} max={90} suffix="ngày" style={{ width: "100%" }} />
              </Form.Item>

              <Form.Item
                name="maxHoursPerBooking"
                label="Thời lượng đặt tối đa trong 1 lượt"
                tooltip="Mỗi buổi học/sự kiện không vượt quá số giờ quy định."
              >
                <InputNumber min={1} max={12} suffix="giờ" style={{ width: "100%" }} />
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
                label="Tự động duyệt lượt đặt phòng học thông thường đối với Giảng viên"
              >
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>

              <Form.Item
                name="requireSpecialJustification"
                valuePropName="checked"
                label="Bắt buộc nhập lý do & minh chứng khi đặt phòng ngoài giờ hoặc sự kiện đặc biệt"
              >
                <Switch checkedChildren="Bắt buộc" unCheckedChildren="Không" />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                icon={<CheckOutlined />}
                style={{ background: "#0d2e5c", marginTop: 8 }}
              >
                Lưu cấu hình hệ thống
              </Button>
            </Form>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        padding: "24px 24px",
        maxWidth: 1400,
        margin: "0 auto",
        width: "100%",
        minHeight: "85vh",
      }}
    >
      {/* Page Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #0d2e5c 0%, #1e40af 100%)",
          padding: "28px 32px",
          borderRadius: 16,
          color: "#fff",
          marginBottom: 24,
          boxShadow: "0 10px 25px -5px rgba(13, 46, 92, 0.2)",
        }}
      >
        <Row gutter={[24, 24]} align="middle" justify="space-between">
          <Col xs={24} md={14}>
            <Title level={2} style={{ color: "#fff", margin: 0 }}>
              Trung Tâm Quản Trị Hệ Thống
            </Title>
            <Paragraph style={{ color: "#e2e8f0", marginTop: 8, fontSize: 14, marginBottom: 0 }}>
              Quản lý tổng thể phòng học, phê duyệt lượt đặt phòng, giám sát thiết bị và cấu hình vận hành Trường Đại học Thái Bình Dương.
            </Paragraph>
          </Col>
          <Col xs={24} md={10}>
            <Row gutter={12}>
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "none",
                    textAlign: "center",
                  }}
                >
                  <Statistic
                    title={<span style={{ color: "#cbd5e1", fontSize: 12 }}>Chờ duyệt</span>}
                    value={pendingBookingsCount}
                    styles={{ content: { color: "#fde047", fontWeight: "bold" } }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "none",
                    textAlign: "center",
                  }}
                >
                  <Statistic
                    title={<span style={{ color: "#cbd5e1", fontSize: 12 }}>Tổng phòng</span>}
                    value={roomsQuery.data?.length || 0}
                    styles={{ content: { color: "#fff", fontWeight: "bold" } }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{
                    background: "rgba(255,255,255,0.12)",
                    border: "none",
                    textAlign: "center",
                  }}
                >
                  <Statistic
                    title={<span style={{ color: "#cbd5e1", fontSize: 12 }}>Sự cố cần sửa</span>}
                    value={pendingIssuesCount}
                    styles={{ content: { color: "#f87171", fontWeight: "bold" } }}
                  />
                </Card>
              </Col>
            </Row>
          </Col>
        </Row>
      </div>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={tabItems}
      />

      {/* MODAL: Add/Edit Room */}
      <Modal
        title={editingRoom ? "Cập nhật phòng học" : "Thêm phòng học mới"}
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
            rules={[{ required: true, message: "Vui lòng nhập tên phòng!" }]}
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
                    { value: "Khu E", label: "Khu E" },
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
                { value: "Lab", label: "Phòng Lab / Thí nghiệm" },
                { value: "ComputerLab", label: "Phòng máy tính" },
                { value: "LectureHall", label: "Hội trường" },
              ]}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label="Đường dẫn ảnh đại diện (URL)">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item name="description" label="Ghi chú & Trang thiết bị có sẵn">
            <Input.TextArea rows={3} placeholder="VD: Trang bị sẵn máy chiếu, 2 điều hòa, micro không dây..." />
          </Form.Item>
        </Form>
      </Modal>

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
            <Descriptions.Item label="Mục đích">
              {selectedBooking.purpose || "Chưa nhập"}
            </Descriptions.Item>
            <Descriptions.Item label="Thiết bị mượn kèm">
              {selectedBooking.requestedEquipments && selectedBooking.requestedEquipments.length > 0 ? (
                <div>
                  {selectedBooking.requestedEquipments.map((eq, idx) => (
                    <Tag color="blue" key={idx} style={{ marginBottom: 4 }}>
                      {eq}
                    </Tag>
                  ))}
                </div>
              ) : (
                <em>Không đăng ký mượn thiết bị</em>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Sự kiện đặc biệt">
              {selectedBooking.isSpecialRequest ? (
                <Tag color="volcano">Sự kiện ngoài giờ / Cần duyệt BQL</Tag>
              ) : (
                <Tag color="green">Thông thường</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú BQL">{selectedBooking.adminNotes || "Chưa có"}</Descriptions.Item>
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
              placeholder="VD: Phòng đã trùng lịch thi học kỳ / Đang trong lịch bảo trì đột xuất..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: Equipment Add/Edit */}
      <Modal
        title={editingEquipment ? "Chỉnh sửa thiết bị" : "Thêm thiết bị mới"}
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
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true }]} initialValue={1}>
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
            <Input placeholder="Kho thiết bị dùng chung hoặc mã phòng" />
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
                { value: "Assigned", label: "Đã phân công kỹ thuật" },
                { value: "Fixing", label: "Đang tiến hành sửa chữa" },
                { value: "Resolved", label: "Đã khắc phục hoàn tất" },
                { value: "Rejected", label: "Không đủ điều kiện xử lý" },
              ]}
            />
          </Form.Item>

          <Form.Item name="assignedTo" label="Cán bộ / Kỹ thuật viên phụ trách">
            <Input placeholder="VD: Kỹ thuật viên Nguyễn Văn Bình" />
          </Form.Item>

          <Form.Item name="repairNotes" label="Ghi chú kết quả sửa chữa / Phản hồi">
            <Input.TextArea rows={3} placeholder="VD: Đã thay bóng đèn máy chiếu mới, thiết bị hoạt động bình thường..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL: User Add/Edit */}
      <Modal
        title={editingUser ? "Cập nhật thông tin tài khoản" : "Thêm tài khoản mới"}
        open={isUserModalVisible}
        onCancel={() => setIsUserModalVisible(false)}
        onOk={() => userForm.submit()}
      >
        <Form
          form={userForm}
          layout="vertical"
          onFinish={(values) => saveUserMutation.mutate(values)}
        >
          <Form.Item
            name="email"
            label="Địa chỉ Email (TBD)"
            rules={[{ required: true, type: "email" }]}
          >
            <Input placeholder="email@tbd.edu.vn" disabled={!!editingUser} />
          </Form.Item>

          <Form.Item name="fullName" label="Họ và Tên">
            <Input placeholder="VD: Nguyễn Văn A" />
          </Form.Item>

          <Form.Item name="department" label="Khoa / Phòng ban">
            <Input placeholder="VD: Khoa Công nghệ Thông tin" />
          </Form.Item>

          <Form.Item name="role" label="Vai trò phân quyền" rules={[{ required: true }]} initialValue="lecturer">
            <Select
              options={[
                { value: "admin", label: "Quản trị viên (Admin)" },
                { value: "approver", label: "Cán bộ Phê duyệt (Ban QL)" },
                { value: "lecturer", label: "Giảng viên" },
                { value: "student", label: "Sinh viên" },
              ]}
            />
          </Form.Item>

          <Form.Item name="phone" label="Số điện thoại liên hệ">
            <Input placeholder="0905..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
