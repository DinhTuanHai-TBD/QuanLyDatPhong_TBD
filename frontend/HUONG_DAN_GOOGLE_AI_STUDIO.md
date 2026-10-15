# Đưa frontend vào Google AI Studio

## Cách khuyến nghị: Import từ GitHub

1. Giải nén thư mục này.
2. Tạo một repository GitHub mới và đưa toàn bộ nội dung trong thư mục lên repository đó.
3. Mở Google AI Studio, chọn **Build**.
4. Trong ô nhập yêu cầu, bấm dấu **+** rồi chọn **Import from GitHub**.
5. Chọn repository vừa tạo.
6. Sau khi dự án được nhập, mở `AI_STUDIO_PROMPT.md`, sao chép toàn bộ nội dung và gửi cho AI.

## Những điều không được thay đổi

- Chỉ sửa frontend; không tạo hoặc sửa backend.
- Giữ React, TypeScript, Vite, Ant Design, React Router, Axios và TanStack Query.
- Giữ nguyên các đường dẫn API và khóa `accessToken` trong `localStorage`.
- Không thêm Firebase, mock API hoặc cơ sở dữ liệu mới.
- Không đưa mật khẩu, token, API key hoặc file `.env` thật vào AI Studio/GitHub.

## Chạy lại trên máy sau khi tải code về

```bash
npm install
npm run dev
```

Địa chỉ backend được khai báo bằng `VITE_API_URL`. Hãy sao chép `.env.example` thành `.env` trên máy và sửa URL nếu backend của bạn chạy ở cổng khác.
