# Kết nối frontend với backend qua ngrok

Luồng kết nối: React (local hoặc AI Studio) → HTTPS ngrok → API .NET tại 127.0.0.1:7001 → PostgreSQL Supabase.

Backend đã cấu hình Supabase project `jpijxwxsoxrmssosgblj` trong cấu hình Development. Không đưa chuỗi kết nối database hoặc JWT secret vào frontend.

## Khởi động

Tại thư mục gốc, mở terminal thứ nhất:

```powershell
dotnet run --project backend/src/QuanLyDatPhong_TBD.Api -- --urls=http://127.0.0.1:7001 --Database:InitializeOnStartup=false
```

Cờ `Database:InitializeOnStartup=false` bỏ qua migration và dữ liệu mẫu, dùng schema/dữ liệu Supabase hiện có. Nếu schema thiếu, xử lý migration riêng trước khi tiếp tục.

Sau khi đồng ý công khai API, mở terminal thứ hai:

```powershell
ngrok http 5250 --url=https://subsector-unholy-compacter.ngrok-free.dev
```

Lệnh yêu cầu ngrok đã đăng nhập và tài khoản sở hữu domain trên. Tunnel chỉ hoạt động khi máy, backend và ngrok đang chạy; Ctrl+C trong terminal ngrok sẽ đóng tunnel.

## Frontend local / AI Studio

Đặt biến môi trường tại dự án frontend:

```dotenv
VITE_API_URL=https://subsector-unholy-compacter.ngrok-free.dev
```

Không thêm `/api` vào cuối vì các lời gọi hiện tại đã có tiền tố `/api`. Khởi động lại preview hoặc build lại sau khi thay đổi biến Vite.

`frontend/src/api/http.ts` đã có header `ngrok-skip-browser-warning: true` và tự gắn JWT từ `localStorage.accessToken`. Backend hiện cho phép CORS mọi origin; các API bảo vệ vẫn yêu cầu JWT và quyền tương ứng.

```powershell
cd frontend
npm run dev
```

## Xác minh

```powershell
Invoke-RestMethod http://127.0.0.1:5250/api/health
Invoke-RestMethod http://127.0.0.1:5250/api/rooms
Invoke-RestMethod https://subsector-unholy-compacter.ngrok-free.dev/api/health -Headers @{'ngrok-skip-browser-warning'='true'}
```

Health chỉ xác minh API; `/api/rooms` xác minh thêm khả năng đọc database. Trong DevTools của frontend, kiểm tra request `/api/rooms` trả JSON từ domain ngrok và không có lỗi CORS.

