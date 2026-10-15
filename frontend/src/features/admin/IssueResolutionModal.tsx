import React, { useState, useEffect, useMemo } from "react";
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Steps,
  Row,
  Col,
  Tag,
  Alert,
  Timeline,
  Image,
  Space,
  App,
  AutoComplete,
} from "antd";
import {
  ClockCircleOutlined,
  UserOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ToolOutlined,
  HistoryOutlined,
  MailOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  PictureOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { http } from "../../api/http";
import type { EquipmentIssue, AccountItem } from "./AdminPage";

export interface IssueResolutionModalProps {
  open: boolean;
  issue: EquipmentIssue | null;
  onClose: () => void;
  onSuccess?: () => void;
  accounts?: AccountItem[];
  canUpdate?: boolean;
}

// 6 mẫu ghi chú quy chuẩn theo yêu cầu
const NOTE_TEMPLATES = [
  {
    key: "tiep-nhan",
    label: "Tiếp nhận",
    content: "Đã tiếp nhận báo cáo và đang kiểm tra tình trạng thiết bị.",
  },
  {
    key: "dang-sua-chua",
    label: "Đang sửa chữa",
    content: "Đã kiểm tra và đang tiến hành khắc phục sự cố.",
  },
  {
    key: "cho-linh-kien",
    label: "Chờ linh kiện",
    content: "Đang chờ linh kiện thay thế để tiếp tục sửa chữa.",
  },
  {
    key: "hoan-thanh",
    label: "Hoàn thành",
    content:
      "Đã khắc phục sự cố, kiểm tra vận hành và xác nhận thiết bị hoạt động bình thường.",
  },
  {
    key: "bao-cao-trung",
    label: "Báo cáo trùng",
    content: "Báo cáo trùng với sự cố mã […]. Tiếp tục theo dõi tại báo cáo gốc.",
  },
  {
    key: "chua-xac-dinh-loi",
    label: "Chưa xác định lỗi",
    content:
      "Chưa ghi nhận được lỗi khi kiểm tra. Cần bổ sung thông tin để tiếp tục xác minh.",
  },
];

// Ánh xạ trạng thái hiển thị
const STATUS_META: Record<
  string,
  { label: string; color: string; stepIndex: number; tagColor: string }
> = {
  Pending: {
    label: "Chờ tiếp nhận",
    color: "#f59e0b",
    stepIndex: 0,
    tagColor: "warning",
  },
  Assigned: {
    label: "Đã phân công",
    color: "#2563eb",
    stepIndex: 1,
    tagColor: "processing",
  },
  Fixing: {
    label: "Đang xử lý",
    color: "#7c3aed",
    stepIndex: 2,
    tagColor: "purple",
  },
  Resolved: {
    label: "Đã giải quyết",
    color: "#10b981",
    stepIndex: 3,
    tagColor: "success",
  },
  Rejected: {
    label: "Từ chối báo cáo",
    color: "#ef4444",
    stepIndex: -1,
    tagColor: "error",
  },
};

export const IssueResolutionModal: React.FC<IssueResolutionModalProps> = ({
  open,
  issue,
  onClose,
  onSuccess,
  accounts = [],
  canUpdate = true,
}) => {
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);

  // Theo dõi giá trị trạng thái đang chọn trên form để đồng bộ thanh tiến trình và validation
  const currentStatus = Form.useWatch("status", form);

  // Khởi tạo giá trị form khi mở modal hoặc thay đổi issue
  useEffect(() => {
    if (open && issue) {
      form.setFieldsValue({
        status: issue.status || "Pending",
        assignedTo: issue.assignedTo || "",
        repairNotes: issue.repairNotes || "",
      });
      setSelectedTemplateKey(null);
    }
  }, [open, issue, form]);

  // Danh sách gợi ý nhân sự thực tế từ CSDL
  const personnelOptions = useMemo(() => {
    if (!accounts || accounts.length === 0) return [];
    return accounts.map((acc) => {
      const deptText = acc.department ? ` - ${acc.department}` : "";
      return {
        value: acc.fullName || acc.email,
        label: (
          <div style={{ padding: "2px 0" }}>
            <div style={{ fontWeight: 500, color: "#0f172a" }}>
              {acc.fullName || acc.email}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {acc.email} {deptText} [{acc.role}]
            </div>
          </div>
        ),
      };
    });
  }, [accounts]);

  // Xử lý khi người dùng chọn mẫu ghi chú
  const handleSelectTemplate = (templateKey: string) => {
    const template = NOTE_TEMPLATES.find((t) => t.key === templateKey);
    if (!template) return;

    const currentNotes = form.getFieldValue("repairNotes") || "";

    // Nếu ô ghi chú đã có nội dung, không âm thầm ghi đè mà hiển thị hộp thoại xác nhận
    if (currentNotes.trim().length > 0) {
      modal.confirm({
        title: "Ghi chú đã có nội dung",
        icon: <InfoCircleOutlined style={{ color: "#2563eb" }} />,
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>
              Ô ghi chú hiện đang chứa nội dung. Bạn muốn áp dụng mẫu này như thế nào?
            </p>
            <div
              style={{
                background: "#f1f5f9",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                color: "#334155",
                fontStyle: "italic",
              }}
            >
              Mẫu được chọn: "{template.content}"
            </div>
          </div>
        ),
        okText: "Ghi đè",
        cancelText: "Nối tiếp vào sau",
        okButtonProps: { danger: true },
        onOk() {
          form.setFieldsValue({ repairNotes: template.content });
          setSelectedTemplateKey(templateKey);
          message.info(`Đã thay thế ghi chú bằng mẫu "${template.label}"`);
        },
        onCancel(e) {
          // Nếu bấm nút Cancel ("Nối tiếp vào sau")
          if (e.triggerCancel) {
            setSelectedTemplateKey(null);
            return;
          }
          const appendedNotes = `${currentNotes.trim()}\n- ${template.content}`;
          form.setFieldsValue({ repairNotes: appendedNotes });
          setSelectedTemplateKey(templateKey);
          message.info(`Đã nối tiếp mẫu "${template.label}" vào ghi chú`);
        },
      });
    } else {
      form.setFieldsValue({ repairNotes: template.content });
      setSelectedTemplateKey(templateKey);
      message.info(`Đã điền mẫu ghi chú: "${template.label}"`);
    }
  };

  // Xử lý lưu cập nhật
  const handleSave = async () => {
    if (!issue) return;
    if (!canUpdate) {
      message.error("Bạn không có quyền cập nhật trạng thái xử lý sự cố.");
      return;
    }

    try {
      // Validate form
      const values = await form.validateFields();
      setIsSaving(true);

      const payload = {
        status: values.status,
        assignedTo: values.assignedTo?.trim() || null,
        repairNotes: values.repairNotes?.trim() || null,
      };

      // Gửi PUT tới API thực tế của hệ thống
      await http.put(`/api/issues/${issue.id}`, payload);

      message.success("Đã cập nhật xử lý sự cố thiết bị thành công!");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      // Nếu là lỗi validation từ Ant Form (do chưa thỏa mãn rules)
      if (err?.errorFields) {
        return;
      }

      // Phân loại lỗi mạng / mất kết nối
      const isNetworkError =
        !err.response ||
        err.code === "ECONNABORTED" ||
        err.message?.toLowerCase().includes("network error") ||
        err.message?.toLowerCase().includes("failed to fetch") ||
        err.message?.toLowerCase().includes("connection refused");

      if (isNetworkError) {
        message.error(
          "Không thể kết nối với máy chủ. Cập nhật chưa được lưu. Vui lòng thử lại sau."
        );
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        message.error(
          "Bạn không có quyền thực hiện thao tác này. Vui lòng liên hệ Quản trị viên."
        );
      } else if (err.response?.status === 400) {
        message.error(
          err.response?.data?.message ||
            "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại thông tin."
        );
      } else {
        message.error(
          err.response?.data?.message || "Có lỗi xảy ra khi cập nhật sự cố."
        );
      }
      // Giữ nguyên popup và dữ liệu form đang nhập để người dùng có thể thử lại
    } finally {
      setIsSaving(false);
    }
  };

  if (!issue) return null;

  // Tính toán bước tiến trình hiện tại
  const statusKey = currentStatus || issue.status || "Pending";
  const isRejected = statusKey === "Rejected";
  const currentStep = STATUS_META[statusKey]?.stepIndex ?? 0;

  // Định nghĩa 4 bước chính trong tiến trình chuẩn
  const stepItems = [
    {
      title: "Chờ tiếp nhận",
      content: "Tiếp nhận phiếu",
      icon: <ClockCircleOutlined />,
    },
    {
      title: "Đã phân công",
      content: "Giao KTV",
      icon: <UserOutlined />,
    },
    {
      title: "Đang xử lý",
      content: "Sửa chữa / Kiểm tra",
      icon: <SyncOutlined spin={statusKey === "Fixing"} />,
    },
    {
      title: "Đã giải quyết",
      content: "Hoàn tất",
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!isSaving) {
          onClose();
        }
      }}
      width={740}
      centered
      style={{
        top: 16,
        maxHeight: "calc(100dvh - 32px)",
        paddingBottom: 0,
      }}
      styles={{
        container: {
          borderRadius: 12,
          overflow: "hidden",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100dvh - 32px)",
          boxShadow: "0 20px 25px -5px rgba(13, 46, 92, 0.2), 0 8px 10px -6px rgba(13, 46, 92, 0.1)",
        },
        header: {
          padding: "16px 24px",
          borderBottom: "1px solid #e2e8f0",
          margin: 0,
          background: "#0d2e5c",
        },
        body: {
          flex: 1,
          overflowY: "auto",
          maxHeight: "calc(100dvh - 170px)",
          padding: "20px 24px",
          background: "#ffffff",
        },
        footer: {
          padding: "12px 24px",
          borderTop: "1px solid #e2e8f0",
          margin: 0,
          background: "#f8fafc",
        },
      }}
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "rgba(255, 255, 255, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
              }}
            >
              <ToolOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>
                Cập nhật xử lý sự cố
              </div>
              <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.8)", marginTop: 1 }}>
                Phiếu sự cố <span style={{ fontFamily: "monospace", fontWeight: 600 }}>#INC-{issue.id}</span>
              </div>
            </div>
          </div>
          <div style={{ marginRight: 24 }}>
            <Tag color={STATUS_META[issue.status]?.tagColor || "default"} style={{ fontWeight: 600 }}>
              {STATUS_META[issue.status]?.label || issue.status}
            </Tag>
          </div>
        </div>
      }
      closeIcon={<CloseOutlined style={{ color: "#ffffff", fontSize: 16 }} />}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {canUpdate ? (
              <span>Thay đổi sẽ được lưu trực tiếp vào cơ sở dữ liệu</span>
            ) : (
              <span style={{ color: "#c2410c" }}>Tài khoản chỉ có quyền xem thông tin</span>
            )}
          </div>
          <Space size="middle">
            <Button
              onClick={onClose}
              disabled={isSaving}
              style={{
                borderRadius: 6,
                fontWeight: 500,
                color: "#475569",
                borderColor: "#cbd5e1",
              }}
            >
              Đóng
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={isSaving || !canUpdate}
              icon={<SaveOutlined />}
              style={{
                borderRadius: 6,
                fontWeight: 600,
                background: "#0d2e5c",
                borderColor: "#0d2e5c",
                boxShadow: "0 2px 4px rgba(13, 46, 92, 0.25)",
              }}
            >
              Lưu cập nhật
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* 1. THÔNG TIN SỰ CỐ THỰC TẾ */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0d2e5c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileTextOutlined /> Thông tin sự cố ghi nhận
          </div>

          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Mã sự cố:</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0d2e5c", fontFamily: "monospace" }}>
                #INC-{issue.id}
              </div>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Thời gian báo:</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#1e293b" }}>
                {issue.createdAt ? dayjs(issue.createdAt).format("HH:mm DD/MM/YYYY") : "Chưa có thông tin"}
              </div>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Phòng học:</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                <EnvironmentOutlined style={{ color: "#0d2e5c", marginRight: 4 }} />
                {issue.roomName || (issue.roomId ? `Phòng ID ${issue.roomId}` : "Chưa xác định")}
              </div>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Thiết bị / Hạng mục:</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>
                {issue.equipmentName || issue.issueType || "Sự cố chung / Không gắn thiết bị"}
              </div>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Người gửi báo cáo:</div>
              <div style={{ fontSize: 13, color: "#334155" }}>
                <MailOutlined style={{ color: "#64748b", marginRight: 4 }} />
                {issue.userEmail || "Hệ thống"}
              </div>
            </Col>

            <Col xs={24} sm={12}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Mức độ ảnh hưởng:</div>
              <div>
                <Tag
                  color={
                    issue.severity === "Critical"
                      ? "error"
                      : issue.severity === "High"
                      ? "volcano"
                      : issue.severity === "Medium"
                      ? "gold"
                      : "default"
                  }
                  style={{ fontWeight: 600, marginTop: 2 }}
                >
                  {issue.severity || issue.priority || "Trung bình"}
                </Tag>
              </div>
            </Col>

            <Col xs={24}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Nội dung mô tả:</div>
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: "#1e293b",
                  lineHeight: 1.6,
                }}
              >
                {issue.description || "Không có mô tả chi tiết từ người báo."}
              </div>
            </Col>

            {/* Hiển thị ảnh đính kèm nếu có trong bản ghi thực tế */}
            {issue.imageUrl && (
              <Col xs={24}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <PictureOutlined /> Ảnh hiện trường sự cố do người báo đính kèm:
                </div>
                <div
                  style={{
                    display: "inline-block",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "1px solid #cbd5e1",
                    background: "#0f172a",
                  }}
                >
                  <Image
                    src={issue.imageUrl}
                    alt={`Sự cố #INC-${issue.id}`}
                    width={180}
                    height={120}
                    style={{ objectFit: "cover" }}
                    placeholder={
                      <div
                        style={{
                          width: 180,
                          height: 120,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                        }}
                      >
                        Đang tải ảnh...
                      </div>
                    }
                  />
                </div>
              </Col>
            )}
          </Row>
        </div>

        {/* 2. THANH TIẾN TRÌNH XỬ LÝ (STEPS) */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0d2e5c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Tiến trình xử lý sự cố</span>
            {isRejected && (
              <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontWeight: 600 }}>
                Nhánh từ chối
              </Tag>
            )}
          </div>

          {isRejected ? (
            <Alert
              type="error"
              showIcon
              icon={<CloseCircleOutlined style={{ fontSize: 20 }} />}
              title={<span style={{ fontWeight: 700 }}>Nhánh xử lý: Từ chối báo cáo</span>}
              description={
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  Báo cáo này được xác định không đủ điều kiện xử lý, không thể khắc phục hoặc thông tin không chính xác.
                  Trạng thái này là một nhánh phân tách riêng biệt, <strong>không hiển thị như hoàn thành sửa chữa thiết bị</strong>.
                  Vui lòng nhập rõ lý do từ chối vào ô ghi chú bên dưới để phản hồi người gửi.
                </div>
              }
              style={{ borderRadius: 8, border: "1px solid #fca5a5", background: "#fef2f2" }}
            />
          ) : (
            <Steps
              current={currentStep}
              size="small"
              items={stepItems}
              style={{ padding: "4px 0" }}
            />
          )}
        </div>

        {/* 3. BIỂU MẪU CẬP NHẬT */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "18px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0d2e5c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 16,
            }}
          >
            Cập nhật trạng thái & phân công
          </div>

          <Form form={form} layout="vertical" disabled={!canUpdate}>
            <Row gutter={[16, 0]}>
              {/* Trạng thái xử lý: Bắt buộc */}
              <Col xs={24} sm={12}>
                <Form.Item
                  name="status"
                  label={<strong style={{ color: "#1e293b" }}>Trạng thái xử lý <span style={{ color: "#ef4444" }}>*</span></strong>}
                  rules={[{ required: true, message: "Vui lòng chọn trạng thái xử lý!" }]}
                >
                  <Select
                    placeholder="Chọn trạng thái..."
                    options={[
                      { value: "Pending", label: "Chờ tiếp nhận" },
                      { value: "Assigned", label: "Đã phân công" },
                      { value: "Fixing", label: "Đang xử lý" },
                      { value: "Resolved", label: "Đã giải quyết" },
                      { value: "Rejected", label: "Từ chối báo cáo" },
                    ]}
                  />
                </Form.Item>
              </Col>

              {/* Cán bộ / Kỹ thuật viên phụ trách: Bắt buộc khi Assigned hoặc Fixing */}
              <Col xs={24} sm={12}>
                <Form.Item
                  name="assignedTo"
                  label={
                    <strong style={{ color: "#1e293b" }}>
                      Cán bộ / Kỹ thuật viên phụ trách
                      {(currentStatus === "Assigned" || currentStatus === "Fixing") && (
                        <span style={{ color: "#ef4444" }}> *</span>
                      )}
                    </strong>
                  }
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const status = getFieldValue("status");
                        if ((status === "Assigned" || status === "Fixing") && (!value || !value.trim())) {
                          return Promise.reject(
                            new Error("Bắt buộc nhập hoặc chọn cán bộ / KTV khi chuyển sang Đã phân công hoặc Đang xử lý!")
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                  tooltip="Chọn từ danh sách nhân sự thực tế trong hệ thống hoặc nhập họ tên cán bộ kỹ thuật phụ trách."
                >
                  <AutoComplete
                    options={personnelOptions}
                    placeholder="VD: Quản trị viên Hệ thống / KTV Nguyễn Văn Bình"
                    filterOption={(inputValue, option) => {
                      if (!option?.value) return false;
                      return String(option.value).toLowerCase().includes(inputValue.toLowerCase());
                    }}
                    allowClear
                  />
                </Form.Item>
              </Col>

              {/* Mẫu ghi chú xử lý: Dropdown */}
              <Col xs={24}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                      Mẫu ghi chú xử lý nhanh:
                    </label>
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      Chọn mẫu để tự động điền, không làm thay đổi trạng thái
                    </span>
                  </div>
                  <Select
                    placeholder="-- Nhấp để chọn mẫu ghi chú quy chuẩn --"
                    value={selectedTemplateKey}
                    onChange={handleSelectTemplate}
                    style={{ width: "100%" }}
                    options={NOTE_TEMPLATES.map((t) => ({
                      value: t.key,
                      label: (
                        <span>
                          <strong style={{ color: "#0d2e5c" }}>[{t.label}]</strong> {t.content}
                        </span>
                      ),
                    }))}
                  />
                </div>
              </Col>

              {/* Ghi chú tiến độ / kết quả: Textarea */}
              <Col xs={24}>
                <Form.Item
                  name="repairNotes"
                  label={
                    <strong style={{ color: "#1e293b" }}>
                      Ghi chú tiến độ / Kết quả xử lý
                      {currentStatus === "Resolved" && (
                        <span style={{ color: "#ef4444" }}> * (Bắt buộc khi Đã giải quyết)</span>
                      )}
                      {currentStatus === "Rejected" && (
                        <span style={{ color: "#ef4444" }}> * (Bắt buộc lý do khi Từ chối)</span>
                      )}
                    </strong>
                  }
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const status = getFieldValue("status");
                        if (status === "Resolved" && (!value || !value.trim())) {
                          return Promise.reject(
                            new Error("Bắt buộc nhập ghi chú kết quả khi chọn Đã giải quyết!")
                          );
                        }
                        if (status === "Rejected" && (!value || !value.trim())) {
                          return Promise.reject(
                            new Error("Bắt buộc nhập lý do khi chọn Từ chối báo cáo!")
                          );
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                  extra={
                    <span style={{ fontSize: 12, color: "#64748b" }}>
                      Bạn có thể chỉnh sửa tự do nội dung ghi chú sau khi áp dụng mẫu.
                    </span>
                  }
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Nhập tiến độ sửa chữa, kết quả thử nghiệm hoặc lý do từ chối..."
                    style={{ borderRadius: 6 }}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>

        {/* 4. LỊCH SỬ XỬ LÝ (TIMELINE) */}
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "16px 18px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#0d2e5c",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <HistoryOutlined /> Lịch sử xử lý & nhật ký cập nhật
          </div>

          <Timeline
            items={[
              {
                color: "#2563eb",
                icon: <ClockCircleOutlined style={{ fontSize: 14, color: "#2563eb" }} />,
                content: (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ color: "#0f172a" }}>Khởi tạo báo cáo sự cố</strong>
                      <Tag color="warning" style={{ fontSize: 11 }}>Chờ tiếp nhận</Tag>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {issue.createdAt ? dayjs(issue.createdAt).format("HH:mm DD/MM/YYYY") : "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                      Người gửi: <strong>{issue.userEmail || "Hệ thống"}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#64748b",
                        background: "#ffffff",
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #e2e8f0",
                        marginTop: 6,
                      }}
                    >
                      {issue.description}
                    </div>
                  </div>
                ),
              },
              // Hiển thị mốc cập nhật gần nhất nếu đã có thông tin cập nhật
              ...(issue.status !== "Pending" || issue.repairNotes || issue.assignedTo
                ? [
                    {
                      color:
                        issue.status === "Resolved"
                          ? "#10b981"
                          : issue.status === "Rejected"
                          ? "#ef4444"
                          : "#7c3aed",
                      icon:
                        issue.status === "Resolved" ? (
                          <CheckCircleOutlined style={{ fontSize: 14, color: "#10b981" }} />
                        ) : issue.status === "Rejected" ? (
                          <CloseCircleOutlined style={{ fontSize: 14, color: "#ef4444" }} />
                        ) : (
                          <SyncOutlined style={{ fontSize: 14, color: "#7c3aed" }} />
                        ),
                      content: (
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ color: "#0f172a" }}>Cập nhật trạng thái gần nhất</strong>
                            <Tag color={STATUS_META[issue.status]?.tagColor || "default"} style={{ fontSize: 11 }}>
                              {STATUS_META[issue.status]?.label || issue.status}
                            </Tag>
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              {issue.updatedAt
                                ? dayjs(issue.updatedAt).format("HH:mm DD/MM/YYYY")
                                : "Thời điểm ghi nhận gần nhất"}
                            </span>
                          </div>
                          {issue.assignedTo && (
                            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                              Cán bộ / KTV phụ trách: <strong>{issue.assignedTo}</strong>
                            </div>
                          )}
                          {issue.repairNotes && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#1e293b",
                                background: "#ffffff",
                                padding: "8px 10px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                marginTop: 6,
                              }}
                            >
                              <strong>Ghi chú xử lý:</strong> {issue.repairNotes}
                            </div>
                          )}
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {/* Minh bạch kỹ thuật theo yêu cầu 5 */}
          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 6,
              background: "#ffffff",
              border: "1px dashed #cbd5e1",
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "#0d2e5c" }}>Kiến trúc dữ liệu:</strong> Mốc thời gian và trạng thái được lưu trữ
            thực tế trên máy chủ backend (trường <code>CreatedAt</code>, <code>UpdatedAt</code>, <code>Status</code>,{" "}
            <code>RepairNotes</code>). Để lưu giữ toàn bộ chuỗi lịch sử từng lần chỉnh sửa (Audit Trail / Multi-revision
            History), backend cần mở rộng bảng <code>EquipmentIssueHistories</code> và endpoint{" "}
            <code>GET /api/issues/{issue.id}/history</code>. Giao diện đã được thiết kế sẵn sàng tích hợp ngay khi
            backend phát hành API này.
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default IssueResolutionModal;
