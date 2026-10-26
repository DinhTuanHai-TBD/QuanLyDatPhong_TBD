import { useState, useMemo } from 'react';
import {
  Modal,
  Upload,
  Button,
  Table,
  Tag,
  Space,
  Row,
  Col,
  Statistic,
  Progress,
  Alert,
  Tooltip,
  App,
  Typography
} from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileExcelOutlined,
  ReloadOutlined,
  UserAddOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { http } from '../../api/http';
import { normalizeDepartmentName, ACADEMIC_FACULTIES } from '../../utils/academicPrograms';
import type { AccountItem } from './AdminPage';

const { Dragger } = Upload;
const { Text } = Typography;

export interface ParsedUserRow {
  rowNumber: number;
  email: string;
  fullName: string;
  userCode: string;
  department: string;
  role: 'Admin' | 'Approver' | 'Faculty' | 'User';
  roleLabel: string;
  phone: string;
  password?: string;
  isValid: boolean;
  errors: string[];
}

interface UserExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  existingAccounts: AccountItem[];
}

export default function UserExcelImportModal({
  open,
  onClose,
  onSuccess,
  existingAccounts = []
}: UserExcelImportModalProps) {
  const { message } = App.useApp();
  const [fileList, setFileList] = useState<any[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedUserRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // Set các email đã tồn tại trong CSDL để kiểm tra trùng lặp
  const existingEmailSet = useMemo(() => {
    return new Set(existingAccounts.map((a) => (a.email || '').toLowerCase().trim()));
  }, [existingAccounts]);

  // Chuẩn hóa chuỗi tìm kiếm tiêu đề cột trong file Excel
  const normalizeKey = (key: string) => {
    return key
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Xác định vai trò chuẩn hóa
  const parseRole = (rawRole: string): { role: 'Admin' | 'Approver' | 'Faculty' | 'User'; roleLabel: string } => {
    const norm = (rawRole || '').toLowerCase().trim();
    if (norm.includes('admin') || norm.includes('quan tri')) {
      return { role: 'Admin', roleLabel: 'Quản trị viên (Admin)' };
    }
    if (norm.includes('quan ly') || norm.includes('approver') || norm.includes('manager') || norm.includes('dao tao')) {
      return { role: 'Approver', roleLabel: 'Quản lý ĐT & CSVC' };
    }
    if (norm.includes('giang vien') || norm.includes('faculty') || norm.includes('lecturer') || norm.includes('gv')) {
      return { role: 'Faculty', roleLabel: 'Giảng viên' };
    }
    return { role: 'User', roleLabel: 'Sinh viên' };
  };

  // Xử lý đọc và phân tích file Excel/CSV
  const handleProcessFile = async (file: File) => {
    setIsProcessingFile(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });

      if (rawRows.length === 0) {
        message.warning('Tệp tải lên không chứa dòng dữ liệu nào.');
        setParsedRows([]);
        setIsProcessingFile(false);
        return;
      }

      const seenEmailsInFile = new Set<string>();
      const results: ParsedUserRow[] = [];

      rawRows.forEach((row, idx) => {
        const rowNumber = idx + 2; // Dòng 1 là tiêu đề
        let email = '';
        let fullName = '';
        let userCode = '';
        let department = '';
        let rawRole = '';
        let phone = '';
        let password = '';

        // Tự động nhận diện cột dựa trên các tên phổ biến
        Object.keys(row).forEach((colName) => {
          const val = String(row[colName] || '').trim();
          const nk = normalizeKey(colName);

          if (nk.includes('email') || nk.includes('taikhoan') || nk.includes('mail')) {
            if (!email) email = val;
          } else if (nk.includes('hoten') || nk.includes('fullname') || nk.includes('ten') || nk.includes('name')) {
            if (!fullName) fullName = val;
          } else if (nk.includes('mssv') || nk.includes('madinhdanh') || nk.includes('macanbo') || nk.includes('usercode') || nk.includes('code')) {
            if (!userCode) userCode = val;
          } else if (nk.includes('khoa') || nk.includes('phongban') || nk.includes('donvi') || nk.includes('department')) {
            if (!department) department = val;
          } else if (nk.includes('vaitro') || nk.includes('phanquyen') || nk.includes('role')) {
            if (!rawRole) rawRole = val;
          } else if (nk.includes('sdt') || nk.includes('dienthoai') || nk.includes('phone')) {
            if (!phone) phone = val;
          } else if (nk.includes('matkhau') || nk.includes('password')) {
            if (!password) password = val;
          }
        });

        // Bỏ qua dòng trống hoàn toàn
        if (!email && !fullName && !userCode) {
          return;
        }

        const errors: string[] = [];
        const cleanEmail = email.toLowerCase().trim();

        // 1. Kiểm tra Email
        if (!cleanEmail) {
          errors.push('Thiếu địa chỉ email');
        } else {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(cleanEmail)) {
            errors.push('Định dạng email không hợp lệ');
          } else if (seenEmailsInFile.has(cleanEmail)) {
            errors.push('Trùng lặp email với một dòng khác trong file');
          } else if (existingEmailSet.has(cleanEmail)) {
            errors.push('Email đã tồn tại trong hệ thống');
          } else {
            seenEmailsInFile.add(cleanEmail);
          }
        }

        // 2. Kiểm tra Họ và Tên
        if (!fullName) {
          errors.push('Thiếu họ và tên');
        }

        const roleInfo = parseRole(rawRole);
        const normDept = department ? normalizeDepartmentName(department) : '';

        results.push({
          rowNumber,
          email: cleanEmail || email,
          fullName,
          userCode,
          department: normDept,
          role: roleInfo.role,
          roleLabel: roleInfo.roleLabel,
          phone,
          password: password || 'Tbd@123456',
          isValid: errors.length === 0,
          errors
        });
      });

      setParsedRows(results);
      if (results.length > 0) {
        const validCount = results.filter((r) => r.isValid).length;
        message.success(`Đã phân tích ${results.length} dòng dữ liệu (${validCount} tài khoản hợp lệ).`);
      }
    } catch (err) {
      console.error('Error reading excel file:', err);
      message.error('Không thể đọc file. Vui lòng kiểm tra file có đúng định dạng Excel/CSV không.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Tải file Excel mẫu chuẩn TBD
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Dữ liệu mẫu
      const sampleHeaders = [
        ['TRƯỜNG ĐẠI HỌC THÁI BÌNH DƯƠNG (TBD) - BIỂU MẪU NHẬP DANH SÁCH TÀI KHOẢN HỆ THỐNG'],
        ['(*) Các cột có dấu sao là bắt buộc. Mật khẩu để trống sẽ tự động lấy mặc định là: Tbd@123456'],
        ['STT', 'Email (*)', 'Họ và Tên (*)', 'Mã định danh (MSSV/Mã CB)', 'Khoa / Phòng ban', 'Vai trò (*)', 'Số điện thoại', 'Mật khẩu ban đầu']
      ];

      const sampleData = [
        [1, 'nguyenvana.sample@tbd.edu.vn', 'Nguyễn Văn A', '230088', 'Khoa Công nghệ thông tin và Bán dẫn', 'Sinh viên', '0912345678', 'Tbd@123456'],
        [2, 'tranthib.sample@tbd.edu.vn', 'ThS. Trần Thị B', 'GV-CNTT-09', 'Khoa Công nghệ thông tin và Bán dẫn', 'Giảng viên', '0987654321', 'Tbd@123456'],
        [3, 'lecanbo.sample@tbd.edu.vn', 'Lê Văn C', 'QL-TBD-02', 'Phòng Quản lý Đào tạo & Cơ sở vật chất TBD', 'Quản lý', '02583727149', 'Tbd@123456'],
        [4, 'sinhvien.kinhte@tbd.edu.vn', 'Phạm Minh D', '230105', 'Khoa Kinh tế và Quản trị', 'Sinh viên', '0933445566', '']
      ];

      const wsData = XLSX.utils.aoa_to_sheet([...sampleHeaders, ...sampleData]);

      // Định dạng độ rộng cột
      wsData['!cols'] = [
        { wch: 6 },  // STT
        { wch: 32 }, // Email
        { wch: 24 }, // Họ tên
        { wch: 24 }, // Mã định danh
        { wch: 38 }, // Khoa/Phòng ban
        { wch: 18 }, // Vai trò
        { wch: 16 }, // SĐT
        { wch: 20 }, // Mật khẩu
      ];

      XLSX.utils.book_append_sheet(wb, wsData, 'DanhSach_TaiKhoan');

      // Sheet 2: Danh mục hướng dẫn
      const guideHeaders = [
        ['HƯỚNG DẪN CÁC GIÁ TRỊ VAI TRÒ & DANH MỤC KHOA TẠI TBD'],
        [''],
        ['1. CÁC VAI TRÒ HỢP LỆ:'],
        ['- Sinh viên: Nhập "Sinh viên", "User", hoặc "Student"'],
        ['- Giảng viên: Nhập "Giảng viên", "Faculty", hoặc "Lecturer"'],
        ['- Quản lý ĐT & CSVC: Nhập "Quản lý", "Approver", hoặc "Manager"'],
        ['- Quản trị viên: Nhập "Quản trị viên", "Admin"'],
        [''],
        ['2. DANH MỤC KHOA CHÍNH KHÓA TẠI ĐẠI HỌC THÁI BÌNH DƯƠNG (TBD):'],
        ...ACADEMIC_FACULTIES.map((f, i) => [`${i + 1}. ${f.name}`]),
        ['10. Phòng Quản lý Đào tạo & Cơ sở vật chất TBD'],
        ['11. Ban Quản lý Cơ sở vật chất TBD']
      ];
      const wsGuide = XLSX.utils.aoa_to_sheet(guideHeaders);
      wsGuide['!cols'] = [{ wch: 60 }];
      XLSX.utils.book_append_sheet(wb, wsGuide, 'HuongDan_Va_DanhMuc');

      XLSX.writeFile(wb, 'Mau_DanhSach_TaiKhoan_TBD.xlsx');
      message.success('Đã tải xuống file mẫu "Mau_DanhSach_TaiKhoan_TBD.xlsx" thành công!');
    } catch (err) {
      console.error('Error exporting template:', err);
      message.error('Không thể tạo file mẫu Excel.');
    }
  };

  // Thực hiện nhập hàng loạt tài khoản vào hệ thống
  const handleBatchImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      message.warning('Không có tài khoản hợp lệ nào để nhập.');
      return;
    }

    setIsSubmitting(true);
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let failCount = 0;
    const failDetails: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await http.post('/api/auth/users', {
          email: row.email,
          fullName: row.fullName,
          userCode: row.userCode || undefined,
          department: row.department || undefined,
          role: row.role,
          phone: row.phone || undefined,
          phoneNumber: row.phone || undefined,
          password: row.password || 'Tbd@123456'
        });
        successCount++;
      } catch (err: any) {
        failCount++;
        const errMsg = err.response?.data?.message || err.message || 'Lỗi không xác định';
        failDetails.push(`${row.email}: ${errMsg}`);
      }

      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setIsSubmitting(false);

    if (successCount > 0) {
      message.success(`Đã nhập thành công ${successCount}/${validRows.length} tài khoản mới vào hệ thống!`);
      onSuccess?.();
      if (failCount === 0) {
        handleReset();
        onClose();
      } else {
        // Cập nhật lại trạng thái các dòng thất bại
        setParsedRows((prev) =>
          prev.map((r) => {
            const fail = failDetails.find((f) => f.startsWith(r.email));
            if (fail) {
              return { ...r, isValid: false, errors: [...r.errors, fail] };
            }
            return r;
          })
        );
      }
    } else {
      message.error(`Không thể nhập tài khoản. Có ${failCount} lỗi xảy ra.`);
    }
  };

  // Xóa và đặt lại trạng thái
  const handleReset = () => {
    setFileList([]);
    setParsedRows([]);
    setImportProgress(null);
    setShowErrorsOnly(false);
  };

  // Thống kê số lượng
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter((r) => r.isValid).length;
    const invalid = total - valid;
    return { total, valid, invalid };
  }, [parsedRows]);

  // Lọc danh sách hiển thị
  const displayRows = useMemo(() => {
    if (showErrorsOnly) {
      return parsedRows.filter((r) => !r.isValid);
    }
    return parsedRows;
  }, [parsedRows, showErrorsOnly]);

  const columns = [
    {
      title: 'Dòng',
      dataIndex: 'rowNumber',
      key: 'rowNumber',
      width: 65,
      render: (num: number) => <Text code>#{num}</Text>
    },
    {
      title: 'Họ và Tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (name: string, record: ParsedUserRow) => (
        <div>
          <Text strong style={{ color: record.isValid ? '#0f172a' : '#b91c1c' }}>
            {name || '(Trống)'}
          </Text>
          {record.userCode && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Mã: <span style={{ fontFamily: 'monospace' }}>{record.userCode}</span>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Email (TBD)',
      dataIndex: 'email',
      key: 'email',
      render: (email: string) => (
        <span style={{ fontSize: 12.5, color: '#0369a1', fontWeight: 500 }}>
          {email || '(Trống)'}
        </span>
      )
    },
    {
      title: 'Khoa / Đơn vị',
      dataIndex: 'department',
      key: 'department',
      ellipsis: true,
      render: (dept: string) => (
        <span style={{ fontSize: 12, color: '#475569' }}>
          {dept || '--'}
        </span>
      )
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: string, record: ParsedUserRow) => {
        let color = 'default';
        if (role === 'Admin') color = 'red';
        else if (role === 'Approver') color = 'orange';
        else if (role === 'Faculty') color = 'green';
        else if (role === 'User') color = 'blue';

        return <Tag color={color}>{record.roleLabel}</Tag>;
      }
    },
    {
      title: 'Kiểm tra',
      key: 'status',
      width: 140,
      render: (_: any, record: ParsedUserRow) => {
        if (record.isValid) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Hợp lệ
            </Tag>
          );
        }
        return (
          <Tooltip title={record.errors.join('; ')}>
            <Tag color="error" icon={<CloseCircleOutlined />} style={{ cursor: 'pointer' }}>
              Lỗi ({record.errors.length})
            </Tag>
          </Tooltip>
        );
      }
    }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 6 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18
            }}
          >
            <FileExcelOutlined />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Nhập Danh Sách Tài Khoản Người Dùng (Excel / CSV)
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Thêm hàng loạt sinh viên, giảng viên và cán bộ vào hệ thống TBD
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={() => {
        if (!isSubmitting) {
          handleReset();
          onClose();
        }
      }}
      width={900}
      centered
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {parsedRows.length > 0 && (
              <Button onClick={handleReset} disabled={isSubmitting} icon={<ReloadOutlined />}>
                Chọn lại file khác
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose} disabled={isSubmitting}>
              Đóng
            </Button>
            {parsedRows.length > 0 && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleBatchImport}
                loading={isSubmitting}
                disabled={stats.valid === 0}
                style={{ background: '#059669', borderColor: '#059669', fontWeight: 600 }}
              >
                Nhập {stats.valid} tài khoản hợp lệ
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <div style={{ marginTop: 12 }}>
        {/* THANH TIỆN ÍCH TẢI FILE MẪU */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>
              Tải mẫu file Excel chuẩn theo định dạng TBD
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Biểu mẫu gồm các cột: Email, Họ tên, Mã định danh, Khoa/Đơn vị, Vai trò, Số điện thoại.
            </div>
          </div>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownloadTemplate}
            style={{ color: '#059669', borderColor: '#059669', fontWeight: 600 }}
          >
            Tải file mẫu Excel (.xlsx)
          </Button>
        </div>

        {/* KHUNG TẢI LÊN FILE */}
        {parsedRows.length === 0 ? (
          <Dragger
            disabled={isProcessingFile}
            accept=".xlsx, .xls, .csv"
            maxCount={1}
            fileList={fileList}
            beforeUpload={(file) => {
              setFileList([file]);
              handleProcessFile(file);
              return false; // Chặn upload tự động
            }}
            onRemove={() => handleReset()}
            style={{ padding: '24px 0', background: '#fafafa', borderRadius: 8 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: '#059669', fontSize: 44 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
              Nhấp hoặc kéo thả file danh sách (.xlsx, .xls, .csv) vào đây
            </p>
            <p className="ant-upload-hint" style={{ fontSize: 12.5, color: '#64748b' }}>
              Hệ thống sẽ tự động đọc dữ liệu, đối soát email và kiểm tra trùng lặp trước khi nhập vào CSDL.
            </p>
          </Dragger>
        ) : (
          <div>
            {/* THỐNG KÊ KẾT QUẢ PHÂN TÍCH */}
            <Row gutter={12} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <Statistic title="Tổng số bản ghi đọc được" value={stats.total} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }} />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <Statistic title="Hợp lệ (Sẵn sàng nhập)" value={stats.valid} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }} />
                </div>
              </Col>
              <Col span={8}>
                <div style={{ background: stats.invalid > 0 ? '#fef2f2' : '#f8fafc', padding: '10px 14px', borderRadius: 8, border: stats.invalid > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0' }}>
                  <Statistic title="Dòng có lỗi / Trùng lặp" value={stats.invalid} valueStyle={{ fontSize: 20, fontWeight: 700, color: stats.invalid > 0 ? '#dc2626' : '#64748b' }} />
                </div>
              </Col>
            </Row>

            {/* TIẾN TRÌNH NHẬP */}
            {importProgress && (
              <div style={{ marginBottom: 16, background: '#f0fdf4', padding: '12px 16px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>
                  <span>Đang nhập tài khoản vào hệ thống...</span>
                  <span>{importProgress.current} / {importProgress.total}</span>
                </div>
                <Progress percent={Math.round((importProgress.current / importProgress.total) * 100)} status="active" strokeColor="#059669" />
              </div>
            )}

            {stats.invalid > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<ExclamationCircleOutlined />}
                message={`Có ${stats.invalid} dòng dữ liệu chưa hợp lệ (thiếu thông tin hoặc trùng lặp email). Chỉ những dòng hợp lệ (${stats.valid} tài khoản) sẽ được nhập vào hệ thống.`}
                style={{ marginBottom: 12, borderRadius: 6 }}
                action={
                  <Button size="small" type="link" onClick={() => setShowErrorsOnly(!showErrorsOnly)}>
                    {showErrorsOnly ? 'Hiển thị tất cả' : 'Chỉ xem các dòng lỗi'}
                  </Button>
                }
              />
            )}

            {/* BẢNG XEM TRƯỚC DỮ LIỆU */}
            <Table
              size="small"
              columns={columns}
              dataSource={displayRows}
              rowKey="rowNumber"
              pagination={{ pageSize: 6, showSizeChanger: false }}
              scroll={{ x: 750 }}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
