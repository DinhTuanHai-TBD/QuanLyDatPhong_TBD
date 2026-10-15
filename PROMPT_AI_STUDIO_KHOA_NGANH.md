# Prompt cập nhật Google AI Studio

Sao chép nội dung bên dưới vào trợ lý của dự án Google AI Studio:

---

Hãy sửa trực tiếp mã nguồn ứng dụng quản lý đặt phòng TBD, phần Thời khóa biểu / Nhập thời khóa biểu hàng loạt, để cập nhật danh mục khoa và ngành học theo danh sách sau. Đây là yêu cầu chỉnh sửa ứng dụng, không phải huấn luyện mô hình.

- Khoa Thiết kế và Truyền thông: Thiết kế đồ họa; Truyền thông đa phương tiện.
- Khoa Du lịch: Du lịch; Quản trị khách sạn.
- Khoa Luật: Luật; Luật kinh tế; Quản lý nhà nước.
- Khoa Công nghệ thông tin và Bán dẫn: Công nghệ thông tin; Công nghệ bán dẫn*; Trí tuệ nhân tạo; Kỹ thuật phần mềm; Kỹ thuật cơ điện tử.
- Khoa Ngôn ngữ và Văn hóa: Ngôn ngữ Anh; Tiếng Hàn Quốc (Đông phương học)*; Tiếng Trung Quốc (Đông phương học)*.
- Khoa Kinh doanh và Quản lý: Kế toán; Marketing; Quản trị kinh doanh; Tài chính - Ngân hàng; Logistics và Quản lý chuỗi cung ứng.
- Khoa Nhân văn: Quản lý văn hóa.
- Khoa Khoa học xã hội và Hành vi: Tâm lý học.
- Khoa Khoa học sức khỏe: Khoa học Y sinh.

Yêu cầu triển khai:
1. Tên chính xác là “Khoa Công nghệ thông tin và Bán dẫn”; thay tên cũ của khoa này trong form thời khóa biểu, giá trị mặc định, dữ liệu ví dụ và mẫu Excel. Không sửa hàng loạt lịch sử trong database.
2. Tạo một danh mục dùng chung gồm 9 khoa và 23 ngành nêu trên; không tự thêm ngành. Giữ dấu * ở nhãn theo ảnh gốc, bỏ dấu * khi lưu giá trị; không tự giải thích ý nghĩa dấu *.
3. Form có hai lựa chọn riêng “Khoa / Đơn vị” và “Ngành học”. Ngành chỉ hiển thị những ngành thuộc khoa đang chọn; hỗ trợ tìm kiếm. Đổi khoa phải xóa lựa chọn ngành cũ. Cho phép để trống ngành để tương thích lịch cũ. Giữ đơn vị “Phòng Quản lý Đào tạo & CSVC” riêng, không coi là khoa và không gán ngành cho đơn vị này.
4. Giữ nguyên tên môn học, mã lớp học phần, giảng viên, học kỳ và logic phòng, tiết học, lịch lặp, xung đột, phân quyền hiện tại. Không dùng ngành để thay thế tên môn học.
5. API hiện chỉ có department và notes, chưa có trường major lưu trong database. Gửi khoa bằng department; lưu ngành vào notes dạng “Ngành học: <tên ngành>”, sau đó xuống dòng và giữ ghi chú người dùng. Không gửi một trường major rồi giả định backend sẽ lưu. Không yêu cầu migration cho thay đổi này.
6. Đồng bộ nhập Excel/CSV: thêm cột tùy chọn “Ngành học”, nhận alias nganhhoc/nganh/major, kiểm tra ngành thuộc khoa trước khi gửi. File cũ không có cột ngành vẫn nhập được. Thêm sheet “DanhMuc_Khoa_Nganh” vào mẫu Excel chứa đủ danh mục để người dùng tra cứu; cập nhật khoa/ngành trong các dòng ví dụ.
7. Giữ cấu hình VITE_API_URL, header ngrok-skip-browser-warning và JWT Authorization hiện có. Không đưa thông tin kết nối Supabase vào frontend. Không tự thay domain API hoặc tạo dữ liệu giả thay kết nối thật.
8. Chạy kiểm tra TypeScript và build; kiểm tra đổi khoa xóa ngành, danh mục có đủ 9 khoa/23 ngành, ngành được giữ trong payload notes, file Excel cũ vẫn tương thích và file mới báo lỗi nếu ngành không thuộc khoa. Báo rõ tệp đã sửa và kết quả kiểm tra thực tế.

Trong source hiện tại, các tệp liên quan là frontend/src/features/admin/BatchScheduleModal.tsx, frontend/src/utils/academicPrograms.ts và frontend/src/types/booking.ts. Nếu dự án AI Studio đặt src ở gốc, dùng đường dẫn tương ứng.
