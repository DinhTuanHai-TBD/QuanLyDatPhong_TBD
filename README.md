# QuanLyDatPhong_TBD

Workspace moi cho he thong dat phong TBD. MVC cu van duoc giu nguyen o thu muc goc de tham chieu; source nay la ban tach frontend/backend de phat trien tiep.

## Cau truc

```text
QuanLyDatPhong_TBD/
|- frontend/                         React + TypeScript + Vite + Ant Design
|  |- src/features/auth              Dang nhap va dang ky JWT
|  |- src/features/home              Trang gioi thieu chuyen tu MVC cu
|  |- src/features/rooms             Tra cuu phong
|  `- src/features/bookings          Dat phong va lich su yeu cau
|- backend/
|  `- src/
|     |- QuanLyDatPhong_TBD.Api         Web API, JWT, Swagger/OpenAPI
|     |- QuanLyDatPhong_TBD.Application Use cases va contracts
|     |- QuanLyDatPhong_TBD.Domain      Entities va enums
|     `- QuanLyDatPhong_TBD.Infrastructure EF Core, PostgreSQL, Identity
|- docker-compose.yml                PostgreSQL + API + Nginx frontend
`- .env.example                      Bien moi truong cho Docker
```

## Chay bang Docker

1. Mo Docker Desktop va cho Engine chuyen sang trang thai Running.
2. Tao file `.env` tu `.env.example`, sau do dat password PostgreSQL va JWT secret rieng.
3. Chay lenh sau tai thu muc nay:

```powershell
docker compose up --build
```

Frontend: `http://localhost:8080`  
Swagger: `http://localhost:7000/swagger`  
PostgreSQL container: `localhost:5433`

Backend se tu dong chay EF migration va tao mau 3 phong khi chay Development. Tai khoan quan tri mau: `admin@tbd.edu.vn` / `Admin@123`. Hay doi mat khau nay truoc khi dua len server that.

## Chay local khong dung Docker

Backend dung PostgreSQL local theo chuoi ket noi trong `backend/src/QuanLyDatPhong_TBD.Api/appsettings.Development.json`. Cap nhat username/password neu PostgreSQL cua ban khac `postgres/postgres`, sau do:

```powershell
cd backend
dotnet ef database update --project src/QuanLyDatPhong_TBD.Infrastructure --startup-project src/QuanLyDatPhong_TBD.Api
dotnet run --project src/QuanLyDatPhong_TBD.Api --urls http://localhost:7000
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

File `frontend/.env.example` da dung API local `http://localhost:7000`.

## Luu y trien khai VPS/Azure

Khong dung password mac dinh, khong dat `ASPNETCORE_ENVIRONMENT=Development`, va dua JWT secret vao bien moi truong cua server. Nginx trong frontend da proxy `/api` den API container; khi them domain that hay ket thuc HTTPS bang reverse proxy va chung chi TLS.
