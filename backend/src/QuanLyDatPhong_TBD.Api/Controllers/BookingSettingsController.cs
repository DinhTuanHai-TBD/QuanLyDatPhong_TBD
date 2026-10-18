using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;
using QuanLyDatPhong_TBD.Infrastructure.Policies;

namespace QuanLyDatPhong_TBD.Api.Controllers;

public record BookingSettingsDto(
    int MaxAdvanceDays,
    int MinAdvanceMinutes,
    double MaxHoursPerBooking,
    double MinCancelHours,
    string OpenTime,
    string CloseTime,
    int[] WorkingDays,
    ClosedPeriod[] ClosedPeriods,
    int Revision,
    int CheckInGraceMinutes = 15,
    int StudentMaxAdvanceDays = 7,
    double StudentMaxHoursPerBooking = 3.0,
    int FacultyMaxAdvanceDays = 30,
    double FacultyMaxHoursPerBooking = 6.0,
    bool AutoApproveForFaculty = false,
    int MaxPendingBookingsPerUser = 3,
    double MaxBookedHoursPerUserPerWeek = 20.0,
    double ApprovalReminderHours = 1.0);

[ApiController, Authorize, Route("api/booking-settings")]
public class BookingSettingsController(ApplicationDbContext db, BookingPolicyStore store) : ControllerBase
{
    private static BookingSettingsDto ToDto(BookingSetting s) => new(
        s.MaxAdvanceDays,
        s.MinAdvanceMinutes,
        s.MaxHoursPerBooking,
        s.MinCancelHours,
        s.OpenTime.ToString(@"hh\:mm"),
        s.CloseTime.ToString(@"hh\:mm"),
        s.WorkingDays,
        BookingPolicy.Closures(s),
        s.Revision,
        s.CheckInGraceMinutes,
        s.StudentMaxAdvanceDays,
        s.StudentMaxHoursPerBooking,
        s.FacultyMaxAdvanceDays,
        s.FacultyMaxHoursPerBooking,
        s.AutoApproveForFaculty,
        s.MaxPendingBookingsPerUser,
        s.MaxBookedHoursPerUserPerWeek,
        s.ApprovalReminderHours);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken token) => Ok(ToDto(await store.GetAsync(token)));

    [HttpPut, Authorize(Roles = "Admin")]
    public async Task<IActionResult> Save(BookingSettingsDto value, CancellationToken token)
    {
        if (!TimeSpan.TryParseExact(value.OpenTime, @"hh\:mm", null, out var open) ||
            !TimeSpan.TryParseExact(value.CloseTime, @"hh\:mm", null, out var close) || open >= close || close >= TimeSpan.FromDays(1) ||
            value.MaxAdvanceDays is < 1 or > 365 || value.MinAdvanceMinutes < 0 || value.MinAdvanceMinutes > value.MaxAdvanceDays * 1440 ||
            !double.IsFinite(value.MaxHoursPerBooking) || value.MaxHoursPerBooking <= 0 || value.MaxHoursPerBooking > (close - open).TotalHours ||
            !double.IsFinite(value.MinCancelHours) || value.MinCancelHours < 0 || value.MinCancelHours > 8760 ||
            value.WorkingDays == null || value.WorkingDays.Length == 0 || value.WorkingDays.Any(x => x < 0 || x > 6) ||
            value.ClosedPeriods == null || value.ClosedPeriods.Length > 500 ||
            value.ClosedPeriods.Any(x => x == null || x.End <= x.Start || string.IsNullOrWhiteSpace(x.Reason) || x.Reason.Length > 300) ||
            value.CheckInGraceMinutes is < 0 or > 1440 ||
            value.StudentMaxAdvanceDays is < 1 or > 365 ||
            !double.IsFinite(value.StudentMaxHoursPerBooking) || value.StudentMaxHoursPerBooking <= 0 || value.StudentMaxHoursPerBooking > 24 ||
            value.FacultyMaxAdvanceDays is < 1 or > 365 ||
            !double.IsFinite(value.FacultyMaxHoursPerBooking) || value.FacultyMaxHoursPerBooking <= 0 || value.FacultyMaxHoursPerBooking > 24 ||
            value.MaxPendingBookingsPerUser is < 1 or > 100 ||
            !double.IsFinite(value.MaxBookedHoursPerUserPerWeek) || value.MaxBookedHoursPerUserPerWeek <= 0 || value.MaxBookedHoursPerUserPerWeek > 168 ||
            !double.IsFinite(value.ApprovalReminderHours) || value.ApprovalReminderHours <= 0 || value.ApprovalReminderHours > 48)
            return BadRequest(new { message = "Quy định không hợp lệ. Kiểm tra giới hạn, giờ mở/đóng, ngày hoạt động và khoảng nghỉ." });

        var roomIds = value.ClosedPeriods.Where(x => x.RoomId.HasValue).Select(x => x.RoomId!.Value).Distinct().ToArray();
        if (await db.Rooms.CountAsync(x => roomIds.Contains(x.Id), token) != roomIds.Length)
            return BadRequest(new { message = "Phòng bảo trì không tồn tại." });

        var row = await db.BookingSettings.OrderBy(x => x.Id).FirstOrDefaultAsync(token);
        if (row == null) { row = new BookingSetting { Id = 1 }; db.BookingSettings.Add(row); }
        if (row.Revision != value.Revision) return Conflict(new { message = "Quy định đã được admin khác sửa. Tải lại trước khi lưu." });
        var before = ToDto(row);
        row.MaxAdvanceDays = value.MaxAdvanceDays;
        row.MinAdvanceMinutes = value.MinAdvanceMinutes;
        row.MaxHoursPerBooking = value.MaxHoursPerBooking;
        row.MinCancelHours = value.MinCancelHours;
        row.OpenTime = open; row.CloseTime = close;
        row.WorkingDays = value.WorkingDays.Distinct().Order().ToArray();
        row.ClosedPeriodsJson = JsonSerializer.Serialize(value.ClosedPeriods);
        row.CheckInGraceMinutes = value.CheckInGraceMinutes;
        row.StudentMaxAdvanceDays = value.StudentMaxAdvanceDays;
        row.StudentMaxHoursPerBooking = value.StudentMaxHoursPerBooking;
        row.FacultyMaxAdvanceDays = value.FacultyMaxAdvanceDays;
        row.FacultyMaxHoursPerBooking = value.FacultyMaxHoursPerBooking;
        row.AutoApproveForFaculty = value.AutoApproveForFaculty;
        row.MaxPendingBookingsPerUser = value.MaxPendingBookingsPerUser;
        row.MaxBookedHoursPerUserPerWeek = value.MaxBookedHoursPerUserPerWeek;
        row.ApprovalReminderHours = value.ApprovalReminderHours;
        row.Revision++;
        db.AuditLogs.Add(new AuditLog {
            Action = "UpdateBookingSettings", ActorUserId = User.FindFirstValue(ClaimTypes.NameIdentifier),
            ActorUserName = User.Identity?.Name, TargetType = "BookingSettings", TargetId = row.Id.ToString(),
            Note = JsonSerializer.Serialize(new { before, after = ToDto(row) })
        });
        try { await db.SaveChangesAsync(token); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Quy định vừa thay đổi. Tải lại trước khi lưu." }); }
        return Ok(ToDto(row));
    }
}
