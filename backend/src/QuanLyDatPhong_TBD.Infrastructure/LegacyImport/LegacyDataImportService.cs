using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using QuanLyDatPhong_TBD.Application.LegacyImport;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Domain.Enums;
using QuanLyDatPhong_TBD.Infrastructure.Identity;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Infrastructure.LegacyImport;

internal sealed class LegacyDataImportService : ILegacyDataImportService
{
    private readonly ApplicationDbContext _db;
    private readonly LegacyImportOptions _options;

    public LegacyDataImportService(ApplicationDbContext db, IOptions<LegacyImportOptions> options)
    {
        _db = db;
        _options = options.Value;
    }

    public async Task<LegacyImportSummary> ImportAsync(CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.SqlServerConnection)) return Fail("Chưa cấu hình kết nối SQL Server cũ.");

        try
        {
            await using var source = new SqlConnection(_options.SqlServerConnection);
            await source.OpenAsync(cancellationToken);

            var users = await QueryAsync(source, "SELECT Id,UserName,NormalizedUserName,Email,NormalizedEmail,EmailConfirmed,PasswordHash,SecurityStamp,ConcurrencyStamp,PhoneNumber,PhoneNumberConfirmed,TwoFactorEnabled,LockoutEnd,LockoutEnabled,AccessFailedCount FROM AspNetUsers", r => new OldUser(Text(r,"Id")!, Text(r,"UserName"), Text(r,"NormalizedUserName"), Text(r,"Email"), Text(r,"NormalizedEmail"), Bool(r,"EmailConfirmed"), Text(r,"PasswordHash"), Text(r,"SecurityStamp"), Text(r,"ConcurrencyStamp"), Text(r,"PhoneNumber"), Bool(r,"PhoneNumberConfirmed"), Bool(r,"TwoFactorEnabled"), Offset(r,"LockoutEnd"), Bool(r,"LockoutEnabled"), Int(r,"AccessFailedCount")), cancellationToken);
            var roles = await QueryAsync(source, "SELECT Id,Name,NormalizedName,ConcurrencyStamp FROM AspNetRoles", r => new OldRole(Text(r,"Id")!, Text(r,"Name"), Text(r,"NormalizedName"), Text(r,"ConcurrencyStamp")), cancellationToken);
            var userRoles = await QueryAsync(source, "SELECT UserId,RoleId FROM AspNetUserRoles", r => (UserId: Text(r,"UserId")!, RoleId: Text(r,"RoleId")!), cancellationToken);
            var rooms = await QueryAsync(source, "SELECT Id,Name,Building,Capacity,RoomType,Status,ImageUrl,MapImageUrl,Description,IsActive FROM Rooms", r => new OldRoom(Int(r,"Id"), Text(r,"Name")!, Text(r,"Building"), Int(r,"Capacity"), Int(r,"RoomType"), Int(r,"Status"), Text(r,"ImageUrl"), Text(r,"MapImageUrl"), Text(r,"Description"), Bool(r,"IsActive")), cancellationToken);
            var equipment = await QueryAsync(source, "SELECT Id,Name,Description FROM Equipments", r => new OldEquipment(Int(r,"Id"), Text(r,"Name")!, Text(r,"Description")), cancellationToken);
            var roomEquipment = await QueryAsync(source, "SELECT RoomId,EquipmentId,Quantity FROM RoomEquipments", r => (RoomId: Int(r,"RoomId"), EquipmentId: Int(r,"EquipmentId"), Quantity: Int(r,"Quantity")), cancellationToken);
            var bookings = await QueryAsync(source, "SELECT StartTime,EndTime,Purpose,Status,RoomId,UserId,RejectReason,IsSchoolOverride,ApprovedByUserId FROM Bookings", r => new OldBooking(Date(r,"StartTime")!.Value, Date(r,"EndTime")!.Value, Text(r,"Purpose"), Int(r,"Status"), Int(r,"RoomId"), Text(r,"UserId"), Text(r,"RejectReason"), Bool(r,"IsSchoolOverride"), Text(r,"ApprovedByUserId")), cancellationToken);
            var penalties = await QueryAsync(source, "SELECT UserId,BannedUntil,Reason,CreatedAt FROM UserPenalties", r => new OldPenalty(Text(r,"UserId")!, Date(r,"BannedUntil"), Text(r,"Reason"), Date(r,"CreatedAt")!.Value), cancellationToken);
            var logs = await QueryAsync(source, "SELECT Action,ActorUserId,ActorUserName,TargetType,TargetId,Note,CreatedAt FROM AuditLogs", r => new OldLog(Text(r,"Action")!, Text(r,"ActorUserId"), Text(r,"ActorUserName"), Text(r,"TargetType"), Text(r,"TargetId"), Text(r,"Note"), Date(r,"CreatedAt")!.Value), cancellationToken);

            var targetUsers = await _db.Users.ToListAsync(cancellationToken);
            var usersByEmail = targetUsers.Where(x => x.NormalizedEmail is not null).ToDictionary(x => x.NormalizedEmail!, StringComparer.OrdinalIgnoreCase);
            var userMap = new Dictionary<string, string>();
            var addedUsers = 0;
            foreach (var old in users)
            {
                if (old.NormalizedEmail is not null && usersByEmail.TryGetValue(old.NormalizedEmail, out var found)) { userMap[old.Id] = found.Id; continue; }
                var user = new ApplicationUser { Id = old.Id, UserName = old.UserName, NormalizedUserName = old.NormalizedUserName, Email = old.Email, NormalizedEmail = old.NormalizedEmail, EmailConfirmed = old.EmailConfirmed, PasswordHash = old.PasswordHash, SecurityStamp = old.SecurityStamp, ConcurrencyStamp = old.ConcurrencyStamp, PhoneNumber = old.PhoneNumber, PhoneNumberConfirmed = old.PhoneNumberConfirmed, TwoFactorEnabled = old.TwoFactorEnabled, LockoutEnd = old.LockoutEnd, LockoutEnabled = old.LockoutEnabled, AccessFailedCount = old.AccessFailedCount };
                _db.Users.Add(user); userMap[old.Id] = user.Id; addedUsers++;
            }

            var targetRoles = await _db.Roles.ToListAsync(cancellationToken);
            var rolesByName = targetRoles.Where(x => x.NormalizedName is not null).ToDictionary(x => x.NormalizedName!, StringComparer.OrdinalIgnoreCase);
            var roleMap = new Dictionary<string, string>();
            var addedRoles = 0;
            foreach (var old in roles)
            {
                if (old.NormalizedName is not null && rolesByName.TryGetValue(old.NormalizedName, out var found)) { roleMap[old.Id] = found.Id; continue; }
                var role = new IdentityRole { Id = old.Id, Name = old.Name, NormalizedName = old.NormalizedName, ConcurrencyStamp = old.ConcurrencyStamp };
                _db.Roles.Add(role); roleMap[old.Id] = role.Id; addedRoles++;
            }
            await _db.SaveChangesAsync(cancellationToken);

            var currentUserRoles = await _db.UserRoles.ToListAsync(cancellationToken);
            foreach (var old in userRoles)
                if (userMap.TryGetValue(old.UserId, out var userId) && roleMap.TryGetValue(old.RoleId, out var roleId) && !currentUserRoles.Any(x => x.UserId == userId && x.RoleId == roleId)) _db.UserRoles.Add(new IdentityUserRole<string> { UserId = userId, RoleId = roleId });

            var roomMap = new Dictionary<int, int>(); var addedRooms = 0;
            foreach (var old in rooms)
            {
                var found = await _db.Rooms.SingleOrDefaultAsync(x => x.Name == old.Name, cancellationToken);
                if (found is not null) { roomMap[old.Id] = found.Id; continue; }
                var room = new Room { Name = old.Name, Building = old.Building, Capacity = old.Capacity, RoomType = (RoomType)old.RoomType, Status = (RoomStatus)old.Status, ImageUrl = string.IsNullOrWhiteSpace(old.ImageUrl) ? $"/images/hinh{Math.Clamp(old.Id, 1, 5)}.png" : old.ImageUrl.Replace("~/", "/"), MapImageUrl = old.MapImageUrl, Description = old.Description, IsActive = old.IsActive };
                _db.Rooms.Add(room); await _db.SaveChangesAsync(cancellationToken); roomMap[old.Id] = room.Id; addedRooms++;
            }

            var equipmentMap = new Dictionary<int, int>(); var addedEquipment = 0;
            foreach (var old in equipment)
            {
                var found = await _db.Equipments.SingleOrDefaultAsync(x => x.Name == old.Name, cancellationToken);
                if (found is not null) { equipmentMap[old.Id] = found.Id; continue; }
                var item = new Equipment { Name = old.Name, Description = old.Description };
                _db.Equipments.Add(item); await _db.SaveChangesAsync(cancellationToken); equipmentMap[old.Id] = item.Id; addedEquipment++;
            }

            var addedRoomEquipment = 0;
            foreach (var old in roomEquipment)
                if (roomMap.TryGetValue(old.RoomId, out var roomId) && equipmentMap.TryGetValue(old.EquipmentId, out var equipmentId) && !await _db.RoomEquipments.AnyAsync(x => x.RoomId == roomId && x.EquipmentId == equipmentId, cancellationToken)) { _db.RoomEquipments.Add(new RoomEquipment { RoomId = roomId, EquipmentId = equipmentId, Quantity = old.Quantity }); addedRoomEquipment++; }

            var addedBookings = 0;
            foreach (var old in bookings)
                if (roomMap.TryGetValue(old.RoomId, out var roomId) && !await _db.Bookings.AnyAsync(x => x.RoomId == roomId && x.StartTime == old.StartTime && x.EndTime == old.EndTime && x.Purpose == old.Purpose, cancellationToken)) { _db.Bookings.Add(new Booking { RoomId = roomId, UserId = old.UserId is not null && userMap.TryGetValue(old.UserId, out var uid) ? uid : old.UserId, StartTime = old.StartTime, EndTime = old.EndTime, Purpose = old.Purpose, Status = (BookingStatus)old.Status, RejectReason = old.RejectReason, IsSchoolOverride = old.IsSchoolOverride, ApprovedByUserId = old.ApprovedByUserId is not null && userMap.TryGetValue(old.ApprovedByUserId, out var aid) ? aid : old.ApprovedByUserId }); addedBookings++; }

            foreach (var old in penalties) _db.UserPenalties.Add(new UserPenalty { UserId = userMap.TryGetValue(old.UserId, out var uid) ? uid : old.UserId, BannedUntil = old.BannedUntil, Reason = old.Reason, CreatedAt = old.CreatedAt });
            foreach (var old in logs) _db.AuditLogs.Add(new AuditLog { Action = old.Action, ActorUserId = old.ActorUserId is not null && userMap.TryGetValue(old.ActorUserId, out var uid) ? uid : old.ActorUserId, ActorUserName = old.ActorUserName, TargetType = old.TargetType, TargetId = old.TargetId, Note = old.Note, CreatedAt = old.CreatedAt });
            await _db.SaveChangesAsync(cancellationToken);
            return new LegacyImportSummary(true, "Đã import dữ liệu cũ.", addedUsers, addedRoles, addedRooms, addedEquipment, addedBookings, addedRoomEquipment, penalties.Count, logs.Count);
        }
        catch (Exception error) { return Fail($"Không thể import: {error.Message}"); }
    }

    private static LegacyImportSummary Fail(string message) => new(false, message, 0, 0, 0, 0, 0, 0, 0, 0);
    private static async Task<List<T>> QueryAsync<T>(SqlConnection connection, string sql, Func<SqlDataReader, T> mapper, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(sql, connection); await using var reader = await command.ExecuteReaderAsync(cancellationToken); var result = new List<T>();
        while (await reader.ReadAsync(cancellationToken)) result.Add(mapper(reader)); return result;
    }
    private static string? Text(SqlDataReader r, string name) => r[name] is DBNull ? null : Convert.ToString(r[name]);
    private static int Int(SqlDataReader r, string name) => Convert.ToInt32(r[name]);
    private static bool Bool(SqlDataReader r, string name) => r[name] is not DBNull && Convert.ToBoolean(r[name]);
    private static DateTime? Date(SqlDataReader r, string name) => r[name] is DBNull ? null : Convert.ToDateTime(r[name]);
    private static DateTimeOffset? Offset(SqlDataReader r, string name) => r[name] is DBNull ? null : (DateTimeOffset)r[name];
    private sealed record OldUser(string Id,string? UserName,string? NormalizedUserName,string? Email,string? NormalizedEmail,bool EmailConfirmed,string? PasswordHash,string? SecurityStamp,string? ConcurrencyStamp,string? PhoneNumber,bool PhoneNumberConfirmed,bool TwoFactorEnabled,DateTimeOffset? LockoutEnd,bool LockoutEnabled,int AccessFailedCount);
    private sealed record OldRole(string Id,string? Name,string? NormalizedName,string? ConcurrencyStamp);
    private sealed record OldRoom(int Id,string Name,string? Building,int Capacity,int RoomType,int Status,string? ImageUrl,string? MapImageUrl,string? Description,bool IsActive);
    private sealed record OldEquipment(int Id,string Name,string? Description);
    private sealed record OldBooking(DateTime StartTime,DateTime EndTime,string? Purpose,int Status,int RoomId,string? UserId,string? RejectReason,bool IsSchoolOverride,string? ApprovedByUserId);
    private sealed record OldPenalty(string UserId,DateTime? BannedUntil,string? Reason,DateTime CreatedAt);
    private sealed record OldLog(string Action,string? ActorUserId,string? ActorUserName,string? TargetType,string? TargetId,string? Note,DateTime CreatedAt);
}
