using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Domain.Enums;
using QuanLyDatPhong_TBD.Infrastructure.Identity;

namespace QuanLyDatPhong_TBD.Infrastructure.Persistence;

public static class DatabaseInitializer
{
    public static async Task InitializeAsync(IServiceProvider serviceProvider, bool seedSampleData)
    {
        var dbContext = serviceProvider.GetRequiredService<ApplicationDbContext>();
        await dbContext.Database.MigrateAsync();

        if (!seedSampleData)
        {
            return;
        }

        var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        foreach (var role in new[] { "Admin", "User", "Faculty", "Staff", "Approver", "Manager" })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }

        var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        
        // 1. Seed Admin Account
        const string adminEmail = "admin@tbd.edu.vn";
        var admin = await userManager.FindByEmailAsync(adminEmail);
        if (admin is null)
        {
            admin = new ApplicationUser
            {
                UserName = adminEmail,
                Email = adminEmail,
                EmailConfirmed = true,
                FullName = "Quản trị viên Hệ thống",
                Department = "Ban Quản lý Cơ sở vật chất TBD",
                PhoneNumber = "02583727147",
                UserCode = "QL-001",
                IsProfileComplete = true
            };

            var createResult = await userManager.CreateAsync(admin, "Admin@123");
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            admin.FullName ??= "Quản trị viên Hệ thống";
            admin.Department ??= "Ban Quản lý Cơ sở vật chất TBD";
            admin.PhoneNumber ??= "02583727147";
            admin.UserCode ??= "QL-001";
            admin.IsProfileComplete = true;
            await userManager.UpdateAsync(admin);
        }

        if (!await userManager.IsInRoleAsync(admin, "Admin"))
        {
            await userManager.AddToRoleAsync(admin, "Admin");
        }

        // 2. Seed Student Account (hai.230057@tbd.edu.vn)
        const string studentEmail = "hai.230057@tbd.edu.vn";
        var student = await userManager.FindByEmailAsync(studentEmail);
        if (student is null)
        {
            student = new ApplicationUser
            {
                UserName = studentEmail,
                Email = studentEmail,
                EmailConfirmed = true,
                FullName = "Nguyễn Văn Hải",
                Department = "Khoa Công nghệ & Kỹ thuật",
                PhoneNumber = "0939393939",
                UserCode = "230057",
                IsProfileComplete = true
            };

            var createResult = await userManager.CreateAsync(student, "tbd12345");
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            student.FullName ??= "Nguyễn Văn Hải";
            student.Department ??= "Khoa Công nghệ & Kỹ thuật";
            student.PhoneNumber ??= "0939393939";
            student.UserCode ??= "230057";
            student.IsProfileComplete = true;
            student.PasswordHash = userManager.PasswordHasher.HashPassword(student, "tbd12345");
            await userManager.UpdateAsync(student);
        }

        if (!await userManager.IsInRoleAsync(student, "User"))
        {
            await userManager.AddToRoleAsync(student, "User");
        }

        // 3. Seed Faculty / Lecturer Account (giangvien@tbd.edu.vn)
        const string facultyEmail = "giangvien@tbd.edu.vn";
        var faculty = await userManager.FindByEmailAsync(facultyEmail);
        if (faculty is null)
        {
            faculty = new ApplicationUser
            {
                UserName = facultyEmail,
                Email = facultyEmail,
                EmailConfirmed = true,
                FullName = "TS. Trần Văn Nam",
                Department = "Khoa Công nghệ & Kỹ thuật",
                PhoneNumber = "0912345678",
                UserCode = "GV-CNTT-08",
                IsProfileComplete = true
            };

            var createResult = await userManager.CreateAsync(faculty, "Gv@123456");
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            faculty.FullName ??= "TS. Trần Văn Nam";
            faculty.Department ??= "Khoa Công nghệ & Kỹ thuật";
            faculty.PhoneNumber ??= "0912345678";
            faculty.UserCode ??= "GV-CNTT-08";
            faculty.IsProfileComplete = true;
            faculty.PasswordHash = userManager.PasswordHasher.HashPassword(faculty, "Gv@123456");
            await userManager.UpdateAsync(faculty);
        }

        if (!await userManager.IsInRoleAsync(faculty, "Faculty"))
        {
            await userManager.AddToRoleAsync(faculty, "Faculty");
        }

        // 4. Seed Staff Account (nhanvien@tbd.edu.vn)
        // 4. Seed Quản lý Đào tạo & Cơ sở vật chất (quanly@tbd.edu.vn)
        const string managerEmail = "quanly@tbd.edu.vn";
        var manager = await userManager.FindByEmailAsync(managerEmail);
        if (manager is null)
        {
            manager = new ApplicationUser
            {
                UserName = managerEmail,
                Email = managerEmail,
                EmailConfirmed = true,
                FullName = "ThS. Nguyễn Văn Đức",
                Department = "Phòng Quản lý Đào tạo & Cơ sở vật chất TBD",
                PhoneNumber = "02583727148",
                UserCode = "QL-TBD-01",
                IsProfileComplete = true
            };

            var createResult = await userManager.CreateAsync(manager, "Quanly@123");
            if (!createResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", createResult.Errors.Select(error => error.Description)));
            }
        }
        else
        {
            manager.FullName = "ThS. Nguyễn Văn Đức";
            manager.Department = "Phòng Quản lý Đào tạo & Cơ sở vật chất TBD";
            manager.PhoneNumber = "02583727148";
            manager.UserCode = "QL-TBD-01";
            manager.IsProfileComplete = true;
            manager.PasswordHash = userManager.PasswordHasher.HashPassword(manager, "Quanly@123");
            await userManager.UpdateAsync(manager);
        }

        if (!await userManager.IsInRoleAsync(manager, "Approver"))
        {
            await userManager.AddToRoleAsync(manager, "Approver");
        }
        if (!await userManager.IsInRoleAsync(manager, "Manager"))
        {
            await userManager.AddToRoleAsync(manager, "Manager");
        }
        if (!await userManager.IsInRoleAsync(manager, "Staff"))
        {
            await userManager.AddToRoleAsync(manager, "Staff");
        }

        // 6. Seed extra borrowable equipments if not present
        if (!await dbContext.Equipments.AnyAsync(e => e.Code == "TB-004"))
        {
            dbContext.Equipments.AddRange(
                new Equipment
                {
                    Code = "TB-004",
                    Name = "Bút trình chiếu Laser Logitech R400",
                    Type = "Presenter",
                    Quantity = 10,
                    Status = "Active",
                    Description = "Bút trình chiếu thuyết trình slide"
                },
                new Equipment
                {
                    Code = "TB-005",
                    Name = "Bộ cáp chuyển đổi Type-C / HDMI / VGA",
                    Type = "Adapter",
                    Quantity = 8,
                    Status = "Active",
                    Description = "Cáp chuyển đa năng cho Macbook & Laptop"
                },
                new Equipment
                {
                    Code = "TB-006",
                    Name = "Ổ cắm điện công nghiệp nối dài 5m",
                    Type = "PowerStrip",
                    Quantity = 15,
                    Status = "Active",
                    Description = "Ổ cắm 6 chấu nối dài"
                },
                new Equipment
                {
                    Code = "TB-007",
                    Name = "Micro cài áo / đeo tai không dây Sony",
                    Type = "Mic",
                    Quantity = 5,
                    Status = "Active",
                    Description = "Micro cài áo cho diễn giả"
                },
                new Equipment
                {
                    Code = "TB-008",
                    Name = "Bảng phụ di động Flipchart A0",
                    Type = "Whiteboard",
                    Quantity = 6,
                    Status = "Active",
                    Description = "Bảng vẽ thảo luận nhóm"
                },
                new Equipment
                {
                    Code = "TB-009",
                    Name = "Webcam họp trực tuyến Logitech C920 4K",
                    Type = "Webcam",
                    Quantity = 4,
                    Status = "Active",
                    Description = "Webcam họp Zoom / Teams góc rộng"
                },
                new Equipment
                {
                    Code = "TB-010",
                    Name = "Loa họp hội nghị đa hướng Jabra Speak 510",
                    Type = "Speaker",
                    Quantity = 5,
                    Status = "Active",
                    Description = "Loa kèm micro thu âm 360 độ"
                },
                new Equipment
                {
                    Code = "TB-011",
                    Name = "Bộ bút viết bảng 4 màu & đồ bôi bảng",
                    Type = "Stationary",
                    Quantity = 20,
                    Status = "Active",
                    Description = "Bộ dụng cụ trình bày nhóm"
                },
                new Equipment
                {
                    Code = "TB-012",
                    Name = "Chân đế Tripod máy ảnh / điện thoại 1m5",
                    Type = "Stand",
                    Quantity = 5,
                    Status = "Active",
                    Description = "Chân đế quay phim / livestream"
                }
            );
            await dbContext.SaveChangesAsync();
        }

        // Xóa phòng Hội trường TBD (Tòa Trung tâm, 180 chỗ) khỏi Database
        var legacyHoiTruong = await dbContext.Rooms
            .Where(r => r.Name == "Hội trường TBD" || r.Name.Contains("Hội trường TBD") || (r.Building == "Tòa Trung tâm" && r.Capacity == 180))
            .ToListAsync();
        if (legacyHoiTruong.Count > 0)
        {
            foreach (var lr in legacyHoiTruong)
            {
                var relatedBookings = await dbContext.Bookings.Where(b => b.RoomId == lr.Id).ToListAsync();
                if (relatedBookings.Count > 0) dbContext.Bookings.RemoveRange(relatedBookings);

                var relatedEquips = await dbContext.Equipments.Where(e => e.RoomId == lr.Id).ToListAsync();
                foreach (var eq in relatedEquips) { eq.RoomId = null; }
            }
            dbContext.Rooms.RemoveRange(legacyHoiTruong);
            await dbContext.SaveChangesAsync();
        }

        // Tự động chuẩn hóa tên và khu vực nếu còn sót lại từ bản ghi cũ
        var corruptedRooms = await dbContext.Rooms
            .Where(r => r.Name == "A.101" || r.Building == "Tòa A" || r.Building == "Tòa B" || (r.Building != null && r.Building.Contains("T?a")))
            .ToListAsync();
        if (corruptedRooms.Count > 0)
        {
            foreach (var cr in corruptedRooms)
            {
                if (cr.Name == "A.101") cr.Name = "A101";
                if (cr.Building == "Tòa A" || (cr.Building != null && cr.Building.Contains("T?a A"))) cr.Building = "Khu A";
                if (cr.Building == "Tòa B" || (cr.Building != null && cr.Building.Contains("T?a B"))) cr.Building = "Khu B";
            }
            await dbContext.SaveChangesAsync();
        }

        if (await dbContext.Rooms.AnyAsync())
        {
            return;
        }

        var roomA101 = new Room
        {
            Name = "A101",
            Building = "Khu A",
            Capacity = 45,
            RoomType = RoomType.Classroom,
            Status = RoomStatus.Active,
            Description = "Phòng học lý thuyết Tòa A",
            ImageUrl = "/images/hinh4.png"
        };

        var roomLab204 = new Room
        {
            Name = "Lab.204",
            Building = "Khu B",
            Capacity = 35,
            RoomType = RoomType.Lab,
            Status = RoomStatus.Active,
            Description = "Phòng máy thực hành và các học phần công nghệ Tòa B",
            ImageUrl = "/images/hinh3.png"
        };

        dbContext.Rooms.AddRange(roomA101, roomLab204);
        await dbContext.SaveChangesAsync();

        // Seed Initial Equipments
        var eqProjector = new Equipment
        {
            Code = "TB-001",
            Name = "Máy chiếu Panasonic 4K",
            Type = "MayChieu",
            RoomId = roomA101.Id,
            Quantity = 1,
            Status = "Active",
            Description = "Máy chiếu độ phân giải cao"
        };

        var eqMic = new Equipment
        {
            Code = "TB-002",
            Name = "Bộ Micro không dây JBL",
            Type = "Mic",
            RoomId = roomA101.Id,
            Quantity = 2,
            Status = "Active",
            Description = "Micro giảng dạy"
        };

        var eqAircon = new Equipment
        {
            Code = "TB-003",
            Name = "Điều hòa Daikin 24000 BTU",
            Type = "DieuHoa",
            RoomId = roomLab204.Id,
            Quantity = 2,
            Status = "Maintenance",
            Description = "Điều hòa phòng Lab"
        };

        dbContext.Equipments.AddRange(eqProjector, eqMic, eqAircon);
        await dbContext.SaveChangesAsync();

        // Seed Sample Issue Reports
        dbContext.EquipmentIssues.AddRange(
            new EquipmentIssue
            {
                RoomId = roomA101.Id,
                EquipmentId = eqProjector.Id,
                UserEmail = "hai.230057@tbd.edu.vn",
                IssueType = "HongThietBi",
                Priority = "Normal",
                Severity = "Medium",
                Description = "Máy chiếu chập chập tín hiệu hình ảnh khi kết nối HDMI.",
                Status = "Pending",
                CreatedAt = DateTime.UtcNow.AddHours(-3)
            },
            new EquipmentIssue
            {
                RoomId = roomLab204.Id,
                EquipmentId = eqAircon.Id,
                UserEmail = "giangvien@tbd.edu.vn",
                IssueType = "DienNuoc",
                Priority = "Urgent",
                Severity = "High",
                Description = "Điều hòa phòng Lab 204 bị chảy nước cần xử lý gấp.",
                Status = "InProgress",
                AssignedTo = "Nguyễn Văn Kỹ Thuật",
                CreatedAt = DateTime.UtcNow.AddDays(-1)
            }
        );

        // Seed Sample Notifications
        dbContext.Notifications.AddRange(
            new Notification
            {
                UserId = admin.Id,
                Title = "Yêu cầu đặt phòng mới",
                Message = "Có 1 yêu cầu đặt phòng Hội trường TBD đang chờ bạn phê duyệt.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddMinutes(-30)
            },
            new Notification
            {
                UserId = admin.Id,
                Title = "Báo cáo sự cố thiết bị",
                Message = "Điều hòa phòng Lab.204 báo sự cố chảy nước cần phân công kỹ thuật viên.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow.AddHours(-2)
            }
        );

        await dbContext.SaveChangesAsync();
    }
}
