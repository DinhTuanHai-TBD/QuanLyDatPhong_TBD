# Quy định Đặt phòng Đại học Thái Bình Dương (TBD)

Hệ thống quản lý đặt phòng học và thiết bị áp dụng các quy chuẩn quản lý cơ sở vật chất dành riêng cho Sinh viên, Giảng viên và Cán bộ Nhà trường.

---

## 1. Khung giờ & Ngày hoạt động
- **Giờ mở cửa – đóng cửa:** **07:00 – 20:00 (giờ Việt Nam)** từ Thứ Hai đến Thứ Bảy.
- **Sau 20:00 hoặc Chủ Nhật:** Hệ thống khóa đặt phòng thường; chỉ mở cho các sự kiện đặc biệt có phê duyệt của Ban Giám hiệu / P. Quản lý Đào tạo & CSVC.
- **Khoảng nghỉ / Bảo trì:** Hỗ trợ khóa toàn trường (`roomId: null`) hoặc từng phòng cụ thể (`roomId: number`).

---

## 2. Ma trận phân quyền đặt phòng theo đối tượng

| Tiêu chuẩn quy định | Sinh viên (Students) | Giảng viên / Cán bộ (Faculty/Staff) |
| :--- | :--- | :--- |
| **Đặt trước tối đa** | Tối đa **7 ngày** | Tối đa **30 ngày** |
| **Đặt trước tối thiểu** | Trước ít nhất **1 giờ** (60 phút) | Trước ít nhất **30 phút** |
| **Thời lượng tối đa / lượt** | Tối đa **3 giờ / lượt** (tối đa 6 giờ / tuần) | Tối đa **6 giờ / lượt** |
| **Phạm vi phòng** | Phòng học thường (Classroom), phòng nhóm | Toàn bộ: Phòng học, Lab, gửi duyệt Hội trường |
| **Hội trường / Lab chuyên dụng** | Cần đơn yêu cầu đặc biệt của Khoa | Đặt trực tiếp; Hội trường cần duyệt CSVC |
| **Cơ chế xét duyệt** | Tự động duyệt phòng học thường nếu trống lịch | Tự động duyệt ngay (Auto-approve) |
| **Thời hạn hủy phòng** | Trước giờ sử dụng ít nhất **2 giờ** | Trước giờ sử dụng ít nhất **1 giờ** |

---

## 3. Quy định Check-in & Chống giữ chỗ ảo (No-show)
- **Quy tắc 15 phút (Auto-release):** Người đặt phòng phải bấm nút **Check-in** trên hệ thống trong vòng 15 phút đầu tiên kể từ giờ bắt đầu. Sau 15 phút chưa check-in, đơn đặt phòng tự động bị hủy và chuyển sang trạng thái "Trống" cho người khác sử dụng.
- **Chế tài xử phạt (Three-strikes policy):** Tài khoản vi phạm No-show quá 3 lần trong vòng 30 ngày sẽ bị **tạm khóa quyền đặt phòng trong 14 ngày**.

---

## 4. Thứ tự ưu tiên & Giải quyết xung đột
1. **Mức 1 (Cao nhất):** Thời khóa biểu chính khóa và Lịch thi tập trung của Trường.
2. **Mức 2:** Sự kiện, hội thảo khoa học cấp Trường có phê duyệt của Ban Giám hiệu.
3. **Mức 3:** Giảng viên đặt lịch giảng dạy bù, ôn tập, bảo vệ khóa luận.
4. **Mức 4:** Hoạt động chính thức của Đoàn Thanh niên / Hội Sinh viên / Câu lạc bộ.
5. **Mức 5:** Lịch học nhóm / tự học cá nhân của Sinh viên.

---

## 5. API & Cấu hình Hệ thống
- `GET /api/booking-settings`: Người dùng đã đăng nhập đọc toàn bộ quy định.
- `PUT /api/booking-settings`: Quản trị viên (`Admin`) cập nhật quy định với kiểm tra `revision` chống xung đột.
- `PUT /api/bookings/{id}/cancel`: Người đặt phòng hủy lịch kèm lý do. Hệ thống kiểm tra thời hạn hủy theo vai trò.
- `PUT /api/bookings/{id}/check-in`: Người đặt phòng xác nhận nhận phòng trong khung giờ ân hạn 15 phút.

Ví dụ payload cấu hình chuẩn:
```json
{
  "openTime": "07:00",
  "closeTime": "20:00",
  "workingDays": [1, 2, 3, 4, 5, 6],
  "minAdvanceMinutes": 30,
  "maxAdvanceDays": 14,
  "maxHoursPerBooking": 4.0,
  "minCancelHours": 2.0,
  "studentMaxAdvanceDays": 7,
  "studentMaxHoursPerBooking": 3.0,
  "facultyMaxAdvanceDays": 30,
  "facultyMaxHoursPerBooking": 6.0,
  "autoApproveForFaculty": true,
  "checkInGraceMinutes": 15,
  "maxPendingBookingsPerUser": 3,
  "maxBookedHoursPerUserPerWeek": 20.0,
  "approvalReminderHours": 1.0,
  "closedPeriods": [],
  "revision": 0
}
```
