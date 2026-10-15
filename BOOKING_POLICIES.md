# Quy định đặt phòng có hiệu lực

Đã triển khai 6 nhóm: đặt trước tối đa, đặt trước tối thiểu, thời lượng, hạn hủy, giờ hoạt động, ngày hoạt động/nghỉ/bảo trì.

Mặc định mới: 14 ngày; 30 phút; 4 giờ/lượt; hủy trước 2 giờ; **07:00–20:00 giờ Việt Nam**; thứ Hai đến thứ Bảy. Khoảng nghỉ có `roomId: null` áp dụng toàn trường, có roomId thì chỉ áp dụng phòng đó. Một ngày nghỉ đầy đủ dùng 00:00 đến 00:00 ngày kế tiếp.

## API

- `GET /api/booking-settings`: người dùng đăng nhập đọc quy định.
- `PUT /api/booking-settings`: chỉ vai trò `Admin` được sửa; body giống response GET, phải giữ `revision` đã đọc. Lỗi 409 yêu cầu tải lại vì admin khác đã sửa.
- `PUT /api/bookings/{id}/cancel`: chủ đơn hủy với body `{ "reason": "..." }`. Backend kiểm tra trạng thái và hạn hủy.

Ví dụ body cấu hình (revision phải lấy từ GET):

```json
{
  "maxAdvanceDays": 14,
  "minAdvanceMinutes": 30,
  "maxHoursPerBooking": 4,
  "minCancelHours": 2,
  "openTime": "07:00",
  "closeTime": "20:00",
  "workingDays": [1, 2, 3, 4, 5, 6],
  "closedPeriods": [],
  "revision": 0
}
```

Khoảng nghỉ: `{ "roomId": null, "start": "2026-12-31T17:00:00Z", "end": "2027-01-01T17:00:00Z", "reason": "Nghỉ ngày 01/01" }`.

Không dùng localStorage làm nguồn quy định. Frontend đọc lại sau khi lưu, khi focus và mỗi 30 giây trên các trang đang dùng quy định. Backend đọc DB mỗi thao tác nên không phụ thuộc cache trình duyệt. Một lần lưu và nhật ký thay đổi được ghi trong cùng transaction. Các nút cấu hình tự duyệt/ngoại lệ cũ chưa triển khai đã được bỏ khỏi panel này.

## Phạm vi

- Tạo/sửa đơn thường kiểm tra toàn bộ quy định liên quan; Admin cũng không tự bỏ qua giới hạn.
- Duyệt đơn kiểm tra giờ hoạt động, ngày nghỉ, thời lượng, giới hạn ngày và xung đột; không áp lại thời gian đặt trước tối thiểu vì đơn đã được nộp trước đó.
- Thời khóa biểu chính khóa miễn giới hạn đặt trước và thời lượng; vẫn kiểm tra giờ/ngày hoạt động, bảo trì và phòng hoạt động. Các buổi vi phạm được báo trong kết quả nhập và không được tạo.
- Cập nhật quy định không tự thay đổi/hủy lịch đã duyệt. Admin cần xử lý riêng các lịch cũ bị ảnh hưởng bởi lịch nghỉ mới.
- Giờ chuỗi trong nhập thời khóa biểu được chuyển từ giờ Việt Nam sang UTC trước khi lưu. Không sửa dữ liệu lịch sử tự động.

## Triển khai

Migration `20260914125847_EnforceBookingPolicies` đã được áp dụng lên Supabase trong phiên làm việc này. Không cần chạy lại seed mẫu. Backend đang chạy trước khi sửa cần khởi động lại; frontend AI Studio phải đồng bộ mã nguồn mới để hiện form mới.

Nếu chạy bằng CLI, thêm `--Database:InitializeOnStartup=false` vào tham số ứng dụng sau `--` vì migration đã được áp dụng.

Tệp giao diện chính: `frontend/src/features/settings/BookingSettingsPanel.tsx`, hook/kiểm tra: `frontend/src/api/bookingSettings.ts`.

## Kiểm tra

Tại thư mục gốc:

```powershell
dotnet run --project backend/tests/PolicyChecks -c Release
dotnet run --project backend/tests/PolicyChecks -c Release -- --database
```

Lệnh thứ hai dùng cấu hình kết nối backend, kiểm tra lưu/đọc, tạo/sửa/duyệt/hủy trong transaction và rollback dữ liệu thử. Không bật tiến trình ứng dụng/worker bằng bộ kiểm tra này. Không chứa mật khẩu hoặc JWT trong tài liệu.
