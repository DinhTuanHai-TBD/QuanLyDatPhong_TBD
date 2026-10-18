using System.Text.Json;
using QuanLyDatPhong_TBD.Infrastructure.Policies;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Application.Bookings;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Domain.Enums;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Infrastructure.Bookings;

internal sealed class BookingService : IBookingService
{
    private readonly ApplicationDbContext _dbContext;

    private readonly BookingPolicyStore _policies;

    public BookingService(ApplicationDbContext dbContext, BookingPolicyStore policies)
    {
        _dbContext = dbContext;
        _policies = policies;
    }

    private static Dictionary<int, string>? _cachedRoomDict;
    private static DateTime _roomDictCachedTime = DateTime.MinValue;
    private static readonly object _roomLock = new();


    private async Task<Dictionary<int, string>> GetCachedRoomsDictAsync(CancellationToken cancellationToken)
    {
        lock (_roomLock)
        {
            if (_cachedRoomDict != null && DateTime.UtcNow - _roomDictCachedTime < TimeSpan.FromMinutes(30))
            {
                return _cachedRoomDict;
            }
        }

        var dict = await _dbContext.Rooms
            .AsNoTracking()
            .ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

        lock (_roomLock)
        {
            _cachedRoomDict = dict;
            _roomDictCachedTime = DateTime.UtcNow;
        }

        return dict;
    }

    public async Task<IReadOnlyList<BookingDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var list = await _dbContext.Bookings
            .AsNoTracking()
            .OrderByDescending(booking => booking.StartTime)
            .ToListAsync(cancellationToken);

        var roomDict = await GetCachedRoomsDictAsync(cancellationToken);

        return list.Select(b => MapToDto(b, roomDict.GetValueOrDefault(b.RoomId, "Phòng"))).ToList();
    }

    public async Task<IReadOnlyList<BookingDto>> GetCalendarBookingsAsync(
        string userId,
        bool isManager,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int? roomId = null,
        CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Bookings.AsNoTracking().AsQueryable();

        if (!isManager)
        {
            // Shared room occupancy includes ongoing and historical confirmed bookings.
            query = query.Where(BookingCalendarPolicy.VisibleTo(userId));
        }

        if (startDate.HasValue)
        {
            var startUtc = DateTime.SpecifyKind(startDate.Value, DateTimeKind.Utc);
            query = query.Where(b => b.EndTime >= startUtc);
        }

        if (endDate.HasValue)
        {
            var endUtc = DateTime.SpecifyKind(endDate.Value, DateTimeKind.Utc);
            query = query.Where(b => b.StartTime <= endUtc);
        }

        if (roomId.HasValue)
        {
            query = query.Where(b => b.RoomId == roomId.Value);
        }

        var roomDict = await GetCachedRoomsDictAsync(cancellationToken);

        var list = await query
            .OrderBy(booking => booking.StartTime)
            .ToListAsync(cancellationToken);

        return list.Select(b => MapToDto(b, roomDict.GetValueOrDefault(b.RoomId, "Phòng"))).ToList();
    }

    public async Task<IReadOnlyList<BookingDto>> GetMyBookingsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var list = await _dbContext.Bookings
            .AsNoTracking()
            .Where(booking => booking.UserId == userId)
            .OrderByDescending(booking => booking.StartTime)
            .ToListAsync(cancellationToken);

        var roomDict = await GetCachedRoomsDictAsync(cancellationToken);

        return list.Select(b => MapToDto(b, roomDict.GetValueOrDefault(b.RoomId, "Phòng"))).ToList();
    }

    public async Task<BookingResult> CreateAsync(
        string userId,
        CreateBookingRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.EndTime <= request.StartTime)
        {
            return BookingResult.Failure("Thời gian kết thúc phải sau thời gian bắt đầu.");
        }

        var room = await _dbContext.Rooms
            .SingleOrDefaultAsync(item => item.Id == request.RoomId, cancellationToken);

        if (room is null || !room.IsActive || room.Status != RoomStatus.Active)
        {
            return BookingResult.Failure("Phòng này hiện không thể đặt.");
        }

        var settings = await _policies.GetAsync(cancellationToken);
        var violation = BookingPolicy.Validate(settings, request.RoomId,
            request.StartTime, request.EndTime, DateTime.UtcNow);
        if (violation != null) return BookingResult.Failure(violation);

        var hasConflict = await _dbContext.Bookings.AnyAsync(
            booking => booking.RoomId == request.RoomId
                && (booking.Status == BookingStatus.Pending || booking.Status == BookingStatus.Approved || booking.Status == BookingStatus.Using)
                && request.StartTime < booking.EndTime
                && request.EndTime > booking.StartTime,
            cancellationToken);

        if (hasConflict)
        {
            return BookingResult.Failure("Khoảng thời gian này đã có yêu cầu đặt phòng khác.");
        }

        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        var managerRoleIds = await _dbContext.Roles
            .Where(r => r.Name == "Admin" || r.Name == "Approver" || r.Name == "Manager")
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        var isAdmin = managerRoleIds.Count > 0 && await _dbContext.UserRoles
            .AnyAsync(ur => ur.UserId == userId && managerRoleIds.Contains(ur.RoleId), cancellationToken);

        var facultyRoleId = await _dbContext.Roles
            .Where(r => r.Name == "Faculty")
            .Select(r => r.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var isFaculty = facultyRoleId != null && await _dbContext.UserRoles
            .AnyAsync(ur => ur.UserId == userId && ur.RoleId == facultyRoleId, cancellationToken);

        var userRole = isAdmin ? "Admin" : (isFaculty ? "Faculty" : "User");

        var roleViolation = BookingPolicy.ValidateRoleAndRoomPolicy(
            settings,
            userRole,
            room.RoomType,
            request.StartTime,
            request.EndTime,
            DateTime.UtcNow,
            request.IsSpecialRequest);
        if (roleViolation != null) return BookingResult.Failure(roleViolation);

        // Kiểm tra hạn mức người dùng (User Quotas)
        if (!isAdmin)
        {
            var maxPending = settings.MaxPendingBookingsPerUser > 0 ? settings.MaxPendingBookingsPerUser : 3;
            if (!isFaculty)
            {
                var pendingCount = await _dbContext.Bookings.CountAsync(
                    b => b.UserId == userId && b.Status == BookingStatus.Pending,
                    cancellationToken);
                if (pendingCount >= maxPending)
                {
                    return BookingResult.Failure($"Bạn đã có {pendingCount} yêu cầu đang chờ duyệt (hạn mức tối đa: {maxPending}). Vui lòng đợi quản lý phê duyệt trước khi tạo thêm.");
                }
            }

            var maxWeeklyHours = settings.MaxBookedHoursPerUserPerWeek > 0 ? settings.MaxBookedHoursPerUserPerWeek : 20.0;
            var reqVn = DateTime.SpecifyKind(request.StartTime, DateTimeKind.Utc).AddHours(7);
            int diff = (7 + ((int)reqVn.DayOfWeek - 1)) % 7;
            var weekStartVn = reqVn.Date.AddDays(-diff);
            var weekEndVn = weekStartVn.AddDays(7);
            var weekStartUtc = weekStartVn.AddHours(-7);
            var weekEndUtc = weekEndVn.AddHours(-7);

            var activeWeekBookings = await _dbContext.Bookings
                .Where(b => b.UserId == userId
                    && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Approved || b.Status == BookingStatus.Using)
                    && b.StartTime < weekEndUtc && b.EndTime > weekStartUtc)
                .Select(b => new { b.StartTime, b.EndTime })
                .ToListAsync(cancellationToken);

            double currentHours = activeWeekBookings.Sum(b => (b.EndTime - b.StartTime).TotalHours);
            double requestedHours = (request.EndTime - request.StartTime).TotalHours;
            if (currentHours + requestedHours > maxWeeklyHours)
            {
                return BookingResult.Failure($"Tổng thời lượng đặt phòng trong tuần vượt quá hạn mức tối đa ({maxWeeklyHours} giờ/tuần). Hiện tại bạn đã đặt {currentHours:0.#} giờ.");
            }
        }

        var canAutoApprove = BookingPolicy.CanAutoApprove(settings, userRole, room.RoomType, request.IsSpecialRequest);
        var isAutoApproved = !isAdmin && canAutoApprove;
        var initialStatus = isAdmin || isAutoApproved ? BookingStatus.Approved : BookingStatus.Pending;

        var booking = new Booking
        {
            UserId = userId,
            RoomId = request.RoomId,
            UserEmail = user?.Email,
            StartTime = request.StartTime,
            EndTime = request.EndTime,
            Purpose = request.Purpose?.Trim(),
            ParticipantCount = request.ParticipantCount,
            RequestedEquipmentsJson = request.RequestedEquipments != null ? JsonSerializer.Serialize(request.RequestedEquipments) : null,
            Department = request.Department,
            PersonInCharge = request.PersonInCharge,
            Notes = request.Notes,
            IsSpecialRequest = request.IsSpecialRequest,
            SpecialRequestReason = request.SpecialRequestReason,
            AgreedToRules = isAdmin || request.AgreedToRules,
            Status = initialStatus,
            ApprovedByUserId = isAdmin ? userId : (isAutoApproved ? "SYSTEM_AUTO_APPROVE" : null),
            ApprovedAt = isAdmin || isAutoApproved ? DateTime.UtcNow : null,
            AdminNotes = isAdmin ? "Lịch đặt được duyệt trực tiếp bởi Ban Quản lý." : (isAutoApproved ? "Tự động phê duyệt theo quy định cho Giảng viên." : null)
        };

        _dbContext.Bookings.Add(booking);

        if (isAdmin)
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Đặt phòng & Phê duyệt thành công",
                Message = $"Phòng {room.Name} ({request.StartTime:dd/MM/yyyy HH:mm}) đã được bạn đặt và phê duyệt trực tiếp thành công.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        else if (isAutoApproved)
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Yêu cầu đặt phòng đã được tự động phê duyệt",
                Message = $"Phòng {room.Name} ({request.StartTime:dd/MM/yyyy HH:mm}) đã được hệ thống tự động phê duyệt theo chính sách dành cho Giảng viên.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }
        else
        {
            var requesterTitle = isFaculty ? "Giảng viên" : (isAdmin ? "Quản trị viên" : "Sinh viên");
            var requesterDisplayName = !string.IsNullOrWhiteSpace(user?.FullName) ? $"{user.FullName} ({user.Email})" : (user?.Email ?? "người dùng");

            // 1. Notification for Requester
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Yêu cầu đặt phòng đã được ghi nhận",
                Message = isFaculty 
                    ? $"Yêu cầu đặt phòng {room.Name} ({request.StartTime:dd/MM/yyyy HH:mm}) của Thầy/Cô đã được ghi nhận và ưu tiên xét duyệt."
                    : $"Yêu cầu đặt phòng {room.Name} ({request.StartTime:dd/MM/yyyy HH:mm}) của bạn đang chờ phê duyệt.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });

            // 2. Notification for all Admin, Approver, Manager users
            if (managerRoleIds.Count > 0)
            {
                var approverUserIds = await _dbContext.UserRoles
                    .Where(ur => managerRoleIds.Contains(ur.RoleId))
                    .Select(ur => ur.UserId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var approverId in approverUserIds)
                {
                    _dbContext.Notifications.Add(new Notification
                    {
                        UserId = approverId,
                        Title = isFaculty ? "Yêu cầu đặt phòng từ Giảng viên cần duyệt" : "Yêu cầu đặt phòng mới cần duyệt",
                        Message = $"{requesterTitle} {requesterDisplayName} vừa tạo yêu cầu đặt phòng {room.Name} ({request.StartTime:dd/MM/yyyy HH:mm}).",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return BookingResult.Success(MapToDto(booking, room.Name));
    }

    public async Task<BookingResult> UpdateAsync(
        int bookingId,
        string userId,
        UpdateBookingRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.EndTime <= request.StartTime)
        {
            return BookingResult.Failure("Thời gian kết thúc phải sau thời gian bắt đầu.");
        }

        var booking = await _dbContext.Bookings
            .FirstOrDefaultAsync(b => b.Id == bookingId && b.UserId == userId, cancellationToken);

        if (booking is null)
        {
            return BookingResult.Failure("Không tìm thấy đơn đặt phòng.");
        }

        if (booking.Status != BookingStatus.Pending)
        {
            return BookingResult.Failure("Chỉ được phép chỉnh sửa yêu cầu đặt phòng khi đang ở trạng thái Chờ duyệt.");
        }

        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId, cancellationToken);
        var roomName = room?.Name ?? "Phòng";

        if (room is null || !room.IsActive || room.Status != RoomStatus.Active)
            return BookingResult.Failure("Phòng này hiện không thể đặt.");
        var violation = BookingPolicy.Validate(await _policies.GetAsync(cancellationToken), booking.RoomId,
            request.StartTime, request.EndTime, DateTime.UtcNow);
        if (violation != null) return BookingResult.Failure(violation);

        // Check for conflicts excluding the current booking itself
        var hasConflict = await _dbContext.Bookings.AnyAsync(
            b => b.Id != bookingId
                && b.RoomId == booking.RoomId
                && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Approved)
                && request.StartTime < b.EndTime
                && request.EndTime > b.StartTime,
            cancellationToken);

        if (hasConflict)
        {
            return BookingResult.Failure("Khoảng thời gian sửa đổi bị trùng với lịch đặt phòng khác.");
        }

        booking.StartTime = request.StartTime;
        booking.EndTime = request.EndTime;
        booking.Purpose = request.Purpose?.Trim();
        booking.ParticipantCount = request.ParticipantCount;
        booking.RequestedEquipmentsJson = request.RequestedEquipments != null ? JsonSerializer.Serialize(request.RequestedEquipments) : null;
        booking.Department = request.Department;
        booking.PersonInCharge = request.PersonInCharge;
        booking.Notes = request.Notes;
        if (!string.IsNullOrEmpty(request.SpecialRequestReason))
        {
            booking.SpecialRequestReason = request.SpecialRequestReason;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return BookingResult.Success(MapToDto(booking, roomName));
    }

    public async Task<BookingResult> ApproveAsync(
        int bookingId,
        string adminUserId,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking is null)
        {
            return BookingResult.Failure("Không tìm thấy đơn đặt phòng.");
        }

        if (booking.Status != BookingStatus.Pending) return BookingResult.Failure("Chỉ duyệt đơn đang chờ.");
        var approvalRoom = await _dbContext.Rooms.AsNoTracking().FirstOrDefaultAsync(x => x.Id == booking.RoomId, cancellationToken);
        if (approvalRoom is null || !approvalRoom.IsActive || approvalRoom.Status != RoomStatus.Active)
            return BookingResult.Failure("Phòng này hiện không thể đặt.");
        var violation = BookingPolicy.Validate(await _policies.GetAsync(cancellationToken), booking.RoomId,
            booking.StartTime, booking.EndTime, DateTime.UtcNow, approval: true);
        if (violation != null) return BookingResult.Failure(violation);
        if (await _dbContext.Bookings.AnyAsync(x => x.Id != booking.Id && x.RoomId == booking.RoomId &&
            (x.Status == BookingStatus.Approved || x.Status == BookingStatus.Using) &&
            x.StartTime < booking.EndTime && x.EndTime > booking.StartTime, cancellationToken))
            return BookingResult.Failure("Lịch duyệt bị trùng với lịch đã xác nhận.");

        booking.Status = BookingStatus.Approved;
        booking.ApprovedByUserId = adminUserId;
        booking.ApprovedAt = DateTime.UtcNow;
        if (!string.IsNullOrEmpty(notes))
        {
            booking.AdminNotes = notes;
        }

        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId, cancellationToken);
        var roomName = room?.Name ?? "Phòng";

        // Notification for Student
        if (!string.IsNullOrEmpty(booking.UserId))
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = booking.UserId,
                Title = "Yêu cầu đặt phòng đã được phê duyệt",
                Message = $"Yêu cầu đặt phòng {roomName} ({booking.StartTime:dd/MM/yyyy HH:mm}) của bạn đã được Admin phê duyệt.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return BookingResult.Success(MapToDto(booking, roomName));
    }

    public async Task<BookingResult> CancelAsync(int bookingId, string userId, string reason, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 1000) return BookingResult.Failure("Nhập lý do hủy tối đa 1000 ký tự.");
        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(x => x.Id == bookingId && x.UserId == userId, cancellationToken);
        if (booking == null) return BookingResult.Failure("Không tìm thấy đơn của bạn.");
        if (booking.IsSchoolOverride || (booking.Status != BookingStatus.Pending && booking.Status != BookingStatus.Approved))
            return BookingResult.Failure("Không thể hủy lịch này.");
        var violation = BookingPolicy.ValidateCancellation(await _policies.GetAsync(cancellationToken), booking.StartTime, DateTime.UtcNow);
        if (violation != null) return BookingResult.Failure(violation);
        booking.Status = BookingStatus.Cancelled;
        booking.RejectReason = reason.Trim();
        _dbContext.AuditLogs.Add(new AuditLog { Action = "CancelBooking", ActorUserId = userId,
            TargetType = "Booking", TargetId = bookingId.ToString(), Note = reason.Trim() });
        await _dbContext.SaveChangesAsync(cancellationToken);
        var rooms = await GetCachedRoomsDictAsync(cancellationToken);
        return BookingResult.Success(MapToDto(booking, rooms.GetValueOrDefault(booking.RoomId, "Phòng")));
    }

    public async Task<BookingResult> RejectAsync(
        int bookingId,
        string adminUserId,
        string reason,
        CancellationToken cancellationToken = default)
    {
        var booking = await _dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking is null)
        {
            return BookingResult.Failure("Không tìm thấy đơn đặt phòng.");
        }

        booking.Status = BookingStatus.Rejected;
        booking.RejectReason = reason;
        booking.ApprovedByUserId = adminUserId;
        booking.ApprovedAt = DateTime.UtcNow;

        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == booking.RoomId, cancellationToken);
        var roomName = room?.Name ?? "Phòng";

        // Notification for Student
        if (!string.IsNullOrEmpty(booking.UserId))
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = booking.UserId,
                Title = "Yêu cầu đặt phòng bị từ chối",
                Message = $"Yêu cầu đặt phòng {roomName} ({booking.StartTime:dd/MM/yyyy HH:mm}) đã bị từ chối. Lý do: {reason}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return BookingResult.Success(MapToDto(booking, roomName));
    }

    public async Task ProcessAutoExpirationAndRemindersAsync(CancellationToken cancellationToken)
    {
        try
        {
            var now = DateTime.UtcNow;

            // Idempotent repair of past school schedules affected by the old no-show rule.
            // Preserve the previous reason in AdminNotes for traceability.
            await _dbContext.Bookings
                .Where(BookingCalendarPolicy.RecoverableTimetable(now))
                .ExecuteUpdateAsync(updates => updates
                    .SetProperty(b => b.Status, BookingStatus.Completed)
                    .SetProperty(b => b.AdminNotes, b => (b.AdminNotes ?? "") +
                        "\n[Khôi phục lịch học đã qua]: Sửa lỗi áp dụng quá hạn check-in cho thời khóa biểu. Lý do cũ: " + b.RejectReason)
                    .SetProperty(b => b.RejectReason, (string?)null), cancellationToken);

            // 1. Tự động chuyển các đơn Pending đã quá giờ bắt đầu sang Expired (3)
            var expiredBookings = await _dbContext.Bookings
                .Where(b => !b.IsSchoolOverride && b.Status == BookingStatus.Pending && b.StartTime <= now)
                .ToListAsync(cancellationToken);

            if (expiredBookings.Count > 0)
            {
                var roomDict = await _dbContext.Rooms
                    .AsNoTracking()
                    .ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

                foreach (var eb in expiredBookings)
                {
                    eb.Status = BookingStatus.Expired;
                    eb.RejectReason = "Đơn đặt phòng đã hết hạn do quá thời gian bắt đầu sử dụng mà chưa được duyệt.";

                    var rName = roomDict.GetValueOrDefault(eb.RoomId, "Phòng học");
                    if (!string.IsNullOrEmpty(eb.UserId))
                    {
                        _dbContext.Notifications.Add(new Notification
                        {
                            UserId = eb.UserId,
                            Title = "Yêu cầu đặt phòng đã hết hạn",
                            Message = $"Yêu cầu đặt phòng {rName} ({eb.StartTime:dd/MM/yyyy HH:mm}) của bạn đã hết hạn phê duyệt do đã quá thời gian bắt đầu sử dụng.",
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            var settings = await _policies.GetAsync(cancellationToken);

            // 2. Nhắc nhở Admin theo mốc cấu hình (mặc định 1 tiếng) nếu đơn Pending sắp đến giờ sử dụng
            var reminderHours = settings.ApprovalReminderHours > 0 ? settings.ApprovalReminderHours : 1.0;
            var reminderThreshold = now.AddHours(reminderHours);
            var urgentBookings = await _dbContext.Bookings
                .Where(b => b.Status == BookingStatus.Pending && b.StartTime > now && b.StartTime <= reminderThreshold)
                .ToListAsync(cancellationToken);

            if (urgentBookings.Count > 0)
            {
                var urgentManagerRoleIds = await _dbContext.Roles
                    .Where(r => r.Name == "Admin" || r.Name == "Approver" || r.Name == "Manager")
                    .Select(r => r.Id)
                    .ToListAsync(cancellationToken);

                if (urgentManagerRoleIds.Count > 0)
                {
                    var adminUserIds = await _dbContext.UserRoles
                        .Where(ur => urgentManagerRoleIds.Contains(ur.RoleId))
                        .Select(ur => ur.UserId)
                        .Distinct()
                        .ToListAsync(cancellationToken);

                    var roomDict = await _dbContext.Rooms
                        .AsNoTracking()
                        .ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

                    foreach (var ub in urgentBookings)
                    {
                        var urgentTitle = $"Khẩn cấp: Đơn đặt phòng #{ub.Id} cần duyệt gấp (< {reminderHours:0.#}h)";
                        var alreadyNotified = await _dbContext.Notifications.AnyAsync(
                            n => n.Title == urgentTitle,
                            cancellationToken);

                        if (!alreadyNotified)
                        {
                            var rName = roomDict.GetValueOrDefault(ub.RoomId, "Phòng học");
                            foreach (var adminId in adminUserIds)
                            {
                                _dbContext.Notifications.Add(new Notification
                                {
                                    UserId = adminId,
                                    Title = urgentTitle,
                                    Message = $"Đơn đặt phòng {rName} ({ub.StartTime:dd/MM/yyyy HH:mm}) của sinh viên {ub.UserEmail} chỉ còn dưới {reminderHours:0.#} tiếng nữa sẽ bắt đầu. Vui lòng xem xét phê duyệt.",
                                    IsRead = false,
                                    CreatedAt = DateTime.UtcNow
                                });
                            }
                        }
                    }
                    await _dbContext.SaveChangesAsync(cancellationToken);
                }
            }

            // 3. Tự động thu hồi các đơn Approved đã quá giờ bắt đầu + CheckInGraceMinutes mà chưa Check-in sang Expired (No-show)
            var graceMinutes = settings.CheckInGraceMinutes > 0 ? settings.CheckInGraceMinutes : 15;
            var noShowCutoff = now.AddMinutes(-graceMinutes);
            var noShowBookings = await _dbContext.Bookings
                .Where(BookingCalendarPolicy.NoShow(noShowCutoff))
                .ToListAsync(cancellationToken);

            if (noShowBookings.Count > 0)
            {
                var roomDict = await _dbContext.Rooms
                    .AsNoTracking()
                    .ToDictionaryAsync(r => r.Id, r => r.Name, cancellationToken);

                foreach (var nb in noShowBookings)
                {
                    nb.Status = BookingStatus.Expired;
                    nb.RejectReason = $"Hủy tự động do quá hạn nhận phòng (No-show: không check-in trong vòng {graceMinutes} phút sau giờ bắt đầu).";

                    var rName = roomDict.GetValueOrDefault(nb.RoomId, "Phòng học");
                    if (!string.IsNullOrEmpty(nb.UserId))
                    {
                        _dbContext.Notifications.Add(new Notification
                        {
                            UserId = nb.UserId,
                            Title = "Phòng đã bị thu hồi do quá hạn check-in",
                            Message = $"Đơn đặt phòng {rName} ({nb.StartTime:dd/MM/yyyy HH:mm}) của bạn đã bị hủy tự động do không check-in đúng hạn ({graceMinutes} phút sau giờ bắt đầu).",
                            IsRead = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception)
        {
            // Let the background worker log failures and retry on its next run.
            throw;
        }
    }

    public async Task<BookingResult> CheckInAsync(
        int bookingId,
        string userId,
        bool isManager,
        CancellationToken cancellationToken = default)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null) return BookingResult.Failure("Không tìm thấy đơn đặt phòng.");
        if (!isManager && booking.UserId != userId) return BookingResult.Failure("Bạn không có quyền thực hiện check-in cho đơn này.");
        if (booking.Status != BookingStatus.Approved) return BookingResult.Failure($"Đơn đặt phòng ở trạng thái '{booking.Status}', không thể check-in.");

        var settings = await _policies.GetAsync(cancellationToken);
        var violation = BookingPolicy.ValidateCheckIn(settings, booking.StartTime, DateTime.UtcNow);
        if (violation != null && !isManager) return BookingResult.Failure(violation);

        booking.ActualStartTime = DateTime.UtcNow;
        booking.Status = BookingStatus.Using;

        _dbContext.Notifications.Add(new Notification
        {
            UserId = booking.UserId ?? userId,
            Title = "Nhận phòng (Check-in) thành công",
            Message = $"Bạn đã check-in thành công phòng {booking.Room.Name} lúc {booking.ActualStartTime:HH:mm dd/MM/yyyy}.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return BookingResult.Success(MapToDto(booking, booking.Room.Name));
    }

    public async Task<BookingResult> CheckOutAsync(
        int bookingId,
        string userId,
        bool isManager,
        string? notes,
        CancellationToken cancellationToken = default)
    {
        var booking = await _dbContext.Bookings
            .Include(b => b.Room)
            .FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (booking == null) return BookingResult.Failure("Không tìm thấy đơn đặt phòng.");
        if (!isManager && booking.UserId != userId) return BookingResult.Failure("Bạn không có quyền thực hiện check-out cho đơn này.");
        if (booking.Status != BookingStatus.Using) return BookingResult.Failure($"Đơn đặt phòng chưa ở trạng thái đang sử dụng ({booking.Status}).");

        booking.ActualEndTime = DateTime.UtcNow;
        booking.CheckoutNotes = notes?.Trim();
        booking.Status = BookingStatus.Completed;

        _dbContext.Notifications.Add(new Notification
        {
            UserId = booking.UserId ?? userId,
            Title = "Trả phòng (Check-out) thành công",
            Message = $"Bạn đã hoàn tất sử dụng phòng {booking.Room.Name} lúc {booking.ActualEndTime:HH:mm dd/MM/yyyy}.",
            IsRead = false,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return BookingResult.Success(MapToDto(booking, booking.Room.Name));
    }

    public async Task<BatchScheduleResult> CreateBatchScheduleAsync(
        string userId,
        BatchScheduleRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!TimeSpan.TryParse(request.StartTimeStr, out var startTimeSpan) ||
            !TimeSpan.TryParse(request.EndTimeStr, out var endTimeSpan) ||
            endTimeSpan <= startTimeSpan)
        {
            return new BatchScheduleResult(
                false,
                "Khung giờ học không hợp lệ (Thời gian kết thúc phải sau thời gian bắt đầu).",
                0, 0, 0,
                Array.Empty<BatchScheduleConflict>(),
                Array.Empty<BookingDto>());
        }

        if (request.EndDate.Date < request.StartDate.Date)
        {
            return new BatchScheduleResult(
                false,
                "Ngày kết thúc không được trước ngày bắt đầu.",
                0, 0, 0,
                Array.Empty<BatchScheduleConflict>(),
                Array.Empty<BookingDto>());
        }

        if (request.DaysOfWeek == null || request.DaysOfWeek.Length == 0)
        {
            return new BatchScheduleResult(
                false,
                "Vui lòng chọn ít nhất một thứ trong tuần.",
                0, 0, 0,
                Array.Empty<BatchScheduleConflict>(),
                Array.Empty<BookingDto>());
        }

        var room = await _dbContext.Rooms
            .SingleOrDefaultAsync(r => r.Id == request.RoomId, cancellationToken);
        if (room is null)
        {
            return new BatchScheduleResult(
                false,
                "Phòng học không tồn tại.",
                0, 0, 0,
                Array.Empty<BatchScheduleConflict>(),
                Array.Empty<BookingDto>());
        }

        var user = await _dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        var rangeStart = DateTime.SpecifyKind(request.StartDate.Date.AddHours(-7), DateTimeKind.Utc);
        var rangeEnd = DateTime.SpecifyKind(request.EndDate.Date.AddDays(1).AddHours(-7), DateTimeKind.Utc);

        var existingBookings = await _dbContext.Bookings
            .Where(b => b.RoomId == request.RoomId
                && (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Pending)
                && b.StartTime < rangeEnd
                && b.EndTime > rangeStart)
            .ToListAsync(cancellationToken);

        var conflicts = new List<BatchScheduleConflict>();
        var createdBookings = new List<Booking>();
        int totalGenerated = 0;
        var policy = await _policies.GetAsync(cancellationToken);

        for (var d = request.StartDate.Date; d <= request.EndDate.Date; d = d.AddDays(1))
        {
            int dayOfWeekNum = (int)d.DayOfWeek;
            bool isMatch = request.DaysOfWeek.Contains(dayOfWeekNum) ||
                           (dayOfWeekNum == 0 && request.DaysOfWeek.Contains(7));

            if (!isMatch)
            {
                continue;
            }

            totalGenerated++;

            var sessionStart = DateTime.SpecifyKind(d.Add(startTimeSpan).AddHours(-7), DateTimeKind.Utc);
            var sessionEnd = DateTime.SpecifyKind(d.Add(endTimeSpan).AddHours(-7), DateTimeKind.Utc);
            var ruleError = BookingPolicy.Validate(policy, room.Id, sessionStart, sessionEnd, DateTime.UtcNow, timetable: true);
            if (ruleError != null || !room.IsActive || room.Status != RoomStatus.Active)
            {
                conflicts.Add(new BatchScheduleConflict(d, $"{request.StartTimeStr} - {request.EndTimeStr}", ruleError ?? "Phòng không hoạt động."));
                continue;
            }


            var conflict = existingBookings.FirstOrDefault(b =>
                sessionStart < b.EndTime && sessionEnd > b.StartTime);

            if (conflict != null)
            {
                if (!request.OverrideConflicts)
                {
                    conflicts.Add(new BatchScheduleConflict(
                        d,
                        $"{request.StartTimeStr} - {request.EndTimeStr}",
                        $"Trùng lịch với đơn #{conflict.Id}: {conflict.Purpose ?? conflict.UserEmail} ({conflict.StartTime:HH:mm} - {conflict.EndTime:HH:mm})"));
                    continue;
                }
                else
                {
                    conflict.Status = BookingStatus.Rejected;
                    conflict.RejectReason = $"Điều chỉnh do trùng Thời khóa biểu chính khóa: {request.SubjectName} ({request.ClassCode ?? ""})";
                    conflict.AdminNotes = $"Điều chỉnh ưu tiên theo Thời khóa biểu chính khóa ({request.Semester ?? ""}).";
                }
            }

            var periodText = request.PeriodStart.HasValue && request.PeriodEnd.HasValue
                ? $" (Tiết {request.PeriodStart} - {request.PeriodEnd})"
                : string.Empty;
            var classText = !string.IsNullOrWhiteSpace(request.ClassCode) ? $" - Lớp: {request.ClassCode.Trim()}" : string.Empty;
            var lecturerText = !string.IsNullOrWhiteSpace(request.LecturerName) ? $" - GV: {request.LecturerName.Trim()}" : string.Empty;
            var semesterText = !string.IsNullOrWhiteSpace(request.Semester) ? $"[{request.Semester.Trim()}] " : string.Empty;

            var purpose = $"{semesterText}Lịch học: {request.SubjectName.Trim()}{classText}{periodText}{lecturerText}";

            var newBooking = new Booking
            {
                UserId = userId,
                UserEmail = user?.Email,
                RoomId = request.RoomId,
                StartTime = sessionStart,
                EndTime = sessionEnd,
                Purpose = purpose.Trim(),
                Department = request.Department ?? "Phòng Quản lý Đào tạo & CSVC",
                PersonInCharge = request.LecturerName ?? user?.UserName ?? "Phòng Quản lý Đào tạo",
                Notes = request.Notes,
                AgreedToRules = true,
                Status = BookingStatus.Approved,
                IsSchoolOverride = true,
                ApprovedByUserId = userId,
                ApprovedAt = DateTime.UtcNow,
                AdminNotes = $"Thời khóa biểu chính khóa ({request.Semester ?? "Chính khóa"}). Sắp xếp bởi Phòng Quản lý Đào tạo."
            };

            _dbContext.Bookings.Add(newBooking);
            createdBookings.Add(newBooking);
            existingBookings.Add(newBooking);
        }

        if (totalGenerated == 0)
        {
            return new BatchScheduleResult(
                false,
                "Không có buổi học nào tương ứng với các thứ trong tuần đã chọn.",
                0, 0, 0,
                conflicts,
                Array.Empty<BookingDto>());
        }

        if (createdBookings.Count > 0)
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Nhập thời khóa biểu thành công",
                Message = $"Đã tạo thành công {createdBookings.Count} buổi học cho phòng {room.Name} - Môn: {request.SubjectName} ({request.Semester ?? ""}).",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var dtos = createdBookings.Select(b => MapToDto(b, room.Name)).ToList();

        string resultMessage = createdBookings.Count == totalGenerated
            ? $"Đã nhập thành công toàn bộ {createdBookings.Count} buổi học theo thời khóa biểu."
            : $"Đã nhập thành công {createdBookings.Count}/{totalGenerated} buổi học. Có {conflicts.Count} buổi bị trùng lịch.";

        return new BatchScheduleResult(
            true,
            resultMessage,
            totalGenerated,
            createdBookings.Count,
            conflicts.Count,
            conflicts,
            dtos);
    }

    public async Task<BatchScheduleMultiResult> CreateBatchScheduleMultiAsync(
        string userId,
        BatchScheduleMultiRequest multiRequest,
        CancellationToken cancellationToken = default)
    {
        if (multiRequest.Schedules == null || multiRequest.Schedules.Count == 0)
        {
            return new BatchScheduleMultiResult(
                false,
                "Danh sách học phần trống.",
                0, 0, 0, 0, 0,
                Array.Empty<BatchScheduleConflict>(),
                Array.Empty<BookingDto>());
        }

        var allConflicts = new List<BatchScheduleConflict>();
        var allCreatedBookings = new List<Booking>();
        var roomDict = await _dbContext.Rooms.ToDictionaryAsync(r => r.Id, r => r, cancellationToken);
        var user = await _dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        int totalCourses = multiRequest.Schedules.Count;
        int successCourses = 0;
        int failedCourses = 0;

        var policy = await _policies.GetAsync(cancellationToken);
        foreach (var req in multiRequest.Schedules)
        {
            if (!TimeSpan.TryParse(req.StartTimeStr, out var startTimeSpan) ||
                !TimeSpan.TryParse(req.EndTimeStr, out var endTimeSpan) ||
                endTimeSpan <= startTimeSpan ||
                req.EndDate.Date < req.StartDate.Date ||
                req.DaysOfWeek == null || req.DaysOfWeek.Length == 0)
            {
                failedCourses++;
                continue;
            }

            if (!roomDict.TryGetValue(req.RoomId, out var room))
            {
                failedCourses++;
                continue;
            }

            var overrideConflicts = multiRequest.OverrideConflicts || req.OverrideConflicts;

            var rangeStart = DateTime.SpecifyKind(req.StartDate.Date.AddHours(-7), DateTimeKind.Utc);
            var rangeEnd = DateTime.SpecifyKind(req.EndDate.Date.AddDays(1).AddHours(-7), DateTimeKind.Utc);

            var existingBookings = await _dbContext.Bookings
                .Where(b => b.RoomId == req.RoomId
                    && (b.Status == BookingStatus.Approved || b.Status == BookingStatus.Pending)
                    && b.StartTime < rangeEnd
                    && b.EndTime > rangeStart)
                .ToListAsync(cancellationToken);

            int courseGenerated = 0;
            int courseCreated = 0;

            for (var d = req.StartDate.Date; d <= req.EndDate.Date; d = d.AddDays(1))
            {
                int dayOfWeekNum = (int)d.DayOfWeek;
                bool isMatch = req.DaysOfWeek.Contains(dayOfWeekNum) ||
                               (dayOfWeekNum == 0 && req.DaysOfWeek.Contains(7));

                if (!isMatch)
                {
                    continue;
                }

                courseGenerated++;

                var sessionStart = DateTime.SpecifyKind(d.Add(startTimeSpan).AddHours(-7), DateTimeKind.Utc);
                var sessionEnd = DateTime.SpecifyKind(d.Add(endTimeSpan).AddHours(-7), DateTimeKind.Utc);
                var ruleError = BookingPolicy.Validate(policy, room.Id, sessionStart, sessionEnd, DateTime.UtcNow, timetable: true);
                if (ruleError != null || !room.IsActive || room.Status != RoomStatus.Active)
                {
                    allConflicts.Add(new BatchScheduleConflict(d, $"{req.StartTimeStr} - {req.EndTimeStr}", ruleError ?? "Phòng không hoạt động."));
                    continue;
                }


                var conflict = existingBookings.FirstOrDefault(b =>
                    sessionStart < b.EndTime && sessionEnd > b.StartTime);

                if (conflict != null)
                {
                    if (!overrideConflicts)
                    {
                        allConflicts.Add(new BatchScheduleConflict(
                            d,
                            $"{req.StartTimeStr} - {req.EndTimeStr}",
                            $"Phòng {room.Name} - Môn {req.SubjectName}: Trùng với đơn #{conflict.Id} ({conflict.Purpose ?? conflict.UserEmail})"));
                        continue;
                    }
                    else
                    {
                        conflict.Status = BookingStatus.Rejected;
                        conflict.RejectReason = $"Điều chỉnh do trùng Thời khóa biểu chính khóa: {req.SubjectName} ({req.ClassCode ?? ""})";
                        conflict.AdminNotes = $"Điều chỉnh ưu tiên theo Thời khóa biểu chính khóa ({req.Semester ?? ""}).";
                    }
                }

                var periodText = req.PeriodStart.HasValue && req.PeriodEnd.HasValue
                    ? $" (Tiết {req.PeriodStart} - {req.PeriodEnd})"
                    : string.Empty;
                var classText = !string.IsNullOrWhiteSpace(req.ClassCode) ? $" - Lớp: {req.ClassCode.Trim()}" : string.Empty;
                var lecturerText = !string.IsNullOrWhiteSpace(req.LecturerName) ? $" - GV: {req.LecturerName.Trim()}" : string.Empty;
                var semesterText = !string.IsNullOrWhiteSpace(req.Semester) ? $"[{req.Semester.Trim()}] " : string.Empty;

                var purpose = $"{semesterText}Lịch học: {req.SubjectName.Trim()}{classText}{periodText}{lecturerText}";

                var newBooking = new Booking
                {
                    UserId = userId,
                    UserEmail = user?.Email,
                    RoomId = req.RoomId,
                    StartTime = sessionStart,
                    EndTime = sessionEnd,
                    Purpose = purpose.Trim(),
                    Department = req.Department ?? "Phòng Quản lý Đào tạo & CSVC",
                    PersonInCharge = req.LecturerName ?? user?.UserName ?? "Phòng Quản lý Đào tạo",
                    Notes = req.Notes,
                    AgreedToRules = true,
                    Status = BookingStatus.Approved,
                    IsSchoolOverride = true,
                    ApprovedByUserId = userId,
                    ApprovedAt = DateTime.UtcNow,
                    AdminNotes = $"Thời khóa biểu chính khóa ({req.Semester ?? "Chính khóa"}). Sắp xếp bởi Phòng Quản lý Đào tạo."
                };

                _dbContext.Bookings.Add(newBooking);
                allCreatedBookings.Add(newBooking);
                existingBookings.Add(newBooking);
                courseCreated++;
            }

            if (courseCreated > 0)
            {
                successCourses++;
            }
            else if (courseGenerated > 0)
            {
                failedCourses++;
            }
        }

        if (allCreatedBookings.Count > 0)
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Nhập thời khóa biểu từ file thành công",
                Message = $"Đã nhập thành công {successCourses}/{totalCourses} học phần ({allCreatedBookings.Count} buổi học).",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        var dtos = allCreatedBookings.Select(b => MapToDto(b, roomDict.TryGetValue(b.RoomId, out var r) ? r.Name : "Phòng")).ToList();

        string message = $"Đã xử lý {totalCourses} học phần. Tạo thành công {allCreatedBookings.Count} buổi học." +
            (allConflicts.Count > 0 ? $" Có {allConflicts.Count} buổi bị trùng lịch." : "");

        return new BatchScheduleMultiResult(
            true,
            message,
            totalCourses,
            successCourses,
            failedCourses,
            allCreatedBookings.Count,
            allConflicts.Count,
            allConflicts,
            dtos);
    }

    private static BookingDto MapToDto(Booking b, string roomName)
    {
        string[]? reqEquips = null;
        if (!string.IsNullOrEmpty(b.RequestedEquipmentsJson))
        {
            try { reqEquips = JsonSerializer.Deserialize<string[]>(b.RequestedEquipmentsJson); } catch { }
        }

        return new BookingDto(
            b.Id,
            b.RoomId,
            roomName,
            b.StartTime,
            b.EndTime,
            b.Purpose,
            b.Status,
            b.RejectReason,
            b.ParticipantCount,
            reqEquips,
            b.Department,
            b.PersonInCharge,
            b.Notes,
            b.IsSpecialRequest,
            b.SpecialRequestReason,
            b.AgreedToRules,
            b.UserEmail,
            b.ApprovedByUserId,
            b.ApprovedAt,
            b.AdminNotes,
            b.IsSchoolOverride,
            b.ActualStartTime,
            b.ActualEndTime,
            b.CheckoutNotes);
    }
}
