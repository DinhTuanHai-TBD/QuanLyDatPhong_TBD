using System.Text.Json;

namespace QuanLyDatPhong_TBD.Domain.Entities;

public record ClosedPeriod(int? RoomId, DateTimeOffset Start, DateTimeOffset End, string Reason);

public static class BookingPolicy
{
    public static ClosedPeriod[] Closures(BookingSetting settings) =>
        JsonSerializer.Deserialize<ClosedPeriod[]>(settings.ClosedPeriodsJson) ?? [];

    // All operating dates/times are Vietnam time, independently of server locale.
    public static string? Validate(BookingSetting settings, int roomId, DateTime start, DateTime end,
        DateTime now, bool timetable = false, bool approval = false)
    {
        if (end <= start) return "Giờ kết thúc phải sau giờ bắt đầu.";
        var localStart = DateTime.SpecifyKind(start, DateTimeKind.Utc).AddHours(7);
        var localEnd = DateTime.SpecifyKind(end, DateTimeKind.Utc).AddHours(7);
        if (localStart.Date != localEnd.Date || localStart.TimeOfDay < settings.OpenTime || localEnd.TimeOfDay > settings.CloseTime)
            return $"Giờ hoạt động: {settings.OpenTime:hh\\:mm}–{settings.CloseTime:hh\\:mm} (giờ Việt Nam).";
        if (!settings.WorkingDays.Contains((int)localStart.DayOfWeek)) return "Ngày đã chọn không phải ngày hoạt động.";
        if (Closures(settings).Any(x => (x.RoomId == null || x.RoomId == roomId) && start < x.End.UtcDateTime && end > x.Start.UtcDateTime))
            return "Khoảng thời gian này nằm trong lịch nghỉ hoặc bảo trì.";
        if (!timetable)
        {
            if (start <= now) return "Không thể đặt/duyệt lịch đã bắt đầu.";
            if (!approval && start < now.AddMinutes(settings.MinAdvanceMinutes)) return $"Phải đặt trước ít nhất {settings.MinAdvanceMinutes} phút.";
            if (localStart.Date > now.AddHours(7).Date.AddDays(settings.MaxAdvanceDays)) return $"Chỉ được đặt trước tối đa {settings.MaxAdvanceDays} ngày.";
            if ((end - start).TotalHours > settings.MaxHoursPerBooking) return $"Mỗi lượt đặt tối đa {settings.MaxHoursPerBooking} giờ.";
        }
        return null;
    }

    public static string? ValidateCancellation(BookingSetting settings, DateTime start, DateTime now) =>
        start <= now || start < now.AddHours(settings.MinCancelHours)
            ? $"Phải hủy trước giờ sử dụng ít nhất {settings.MinCancelHours} giờ." : null;

    public static string? ValidateRoleAndRoomPolicy(
        BookingSetting settings,
        string? role,
        Enums.RoomType roomType,
        DateTime start,
        DateTime end,
        DateTime now,
        bool isSpecialRequest = false,
        bool timetable = false)
    {
        if (timetable) return null;

        var isFaculty = string.Equals(role, "Faculty", StringComparison.OrdinalIgnoreCase);
        var isManager = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(role, "Approver", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase);

        var localStart = DateTime.SpecifyKind(start, DateTimeKind.Utc).AddHours(7);
        var nowVN = DateTime.SpecifyKind(now, DateTimeKind.Utc).AddHours(7);

        if (!isFaculty && !isManager)
        {
            // Sinh viên / người dùng thông thường
            if (roomType == Enums.RoomType.LectureHall && !isSpecialRequest)
            {
                return "Hội trường chỉ dành cho Giảng viên hoặc đơn yêu cầu đặc biệt của Khoa/Trường.";
            }

            var studentMaxDays = settings.StudentMaxAdvanceDays > 0 ? settings.StudentMaxAdvanceDays : settings.MaxAdvanceDays;
            if (localStart.Date > nowVN.Date.AddDays(studentMaxDays))
            {
                return $"Sinh viên chỉ được đặt trước tối đa {studentMaxDays} ngày.";
            }

            var studentMaxHours = settings.StudentMaxHoursPerBooking > 0 ? settings.StudentMaxHoursPerBooking : settings.MaxHoursPerBooking;
            if ((end - start).TotalHours > studentMaxHours)
            {
                return $"Sinh viên chỉ được đặt tối đa {studentMaxHours} giờ mỗi lượt.";
            }
        }
        else if (isFaculty)
        {
            // Giảng viên
            var facultyMaxDays = settings.FacultyMaxAdvanceDays > 0 ? settings.FacultyMaxAdvanceDays : settings.MaxAdvanceDays;
            if (localStart.Date > nowVN.Date.AddDays(facultyMaxDays))
            {
                return $"Giảng viên chỉ được đặt trước tối đa {facultyMaxDays} ngày.";
            }

            var facultyMaxHours = settings.FacultyMaxHoursPerBooking > 0 ? settings.FacultyMaxHoursPerBooking : settings.MaxHoursPerBooking;
            if ((end - start).TotalHours > facultyMaxHours)
            {
                return $"Mỗi lượt đặt của Giảng viên tối đa {facultyMaxHours} giờ.";
            }
        }

        return null;
    }

    public static bool CanAutoApprove(
        BookingSetting settings,
        string? role,
        Enums.RoomType roomType,
        bool isSpecialRequest)
    {
        if (!settings.AutoApproveForFaculty) return false;
        var isFaculty = string.Equals(role, "Faculty", StringComparison.OrdinalIgnoreCase);
        if (!isFaculty) return false;
        if (roomType == Enums.RoomType.LectureHall) return false;
        if (isSpecialRequest) return false;
        return true;
    }

    public static string? ValidateCheckIn(BookingSetting settings, DateTime start, DateTime now)
    {
        if (now < start.AddMinutes(-15))
        {
            return "Chưa đến thời gian mở check-in (mở trước 15 phút).";
        }
        if (now > start.AddMinutes(settings.CheckInGraceMinutes))
        {
            return $"Đã quá hạn check-in ({settings.CheckInGraceMinutes} phút sau giờ bắt đầu).";
        }
        return null;
    }
}

