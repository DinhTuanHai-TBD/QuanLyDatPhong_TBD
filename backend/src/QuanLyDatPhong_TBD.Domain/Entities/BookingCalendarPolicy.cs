using System.Linq.Expressions;
using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Domain.Entities;

public static class BookingCalendarPolicy
{
    public static Expression<Func<Booking, bool>> VisibleTo(string userId) => b =>
        b.Status == BookingStatus.Approved || b.Status == BookingStatus.Using ||
        b.Status == BookingStatus.Completed || b.UserId == userId;

    public static Expression<Func<Booking, bool>> NoShow(DateTime cutoff) => b =>
        !b.IsSchoolOverride && b.Status == BookingStatus.Approved &&
        b.ActualStartTime == null && b.StartTime <= cutoff;

    // Repair only ended timetables expired by the old no-show worker.
    // Never reopen a current/future slot, or undo an intentional cancellation.
    public static Expression<Func<Booking, bool>> RecoverableTimetable(DateTime now) => b =>
        b.IsSchoolOverride && b.Status == BookingStatus.Expired &&
        b.ActualStartTime == null && b.EndTime <= now && b.RejectReason != null &&
        b.RejectReason.StartsWith("Hủy tự động do quá hạn nhận phòng (No-show: không check-in trong vòng ") &&
        b.RejectReason.EndsWith(" phút sau giờ bắt đầu).");
}
