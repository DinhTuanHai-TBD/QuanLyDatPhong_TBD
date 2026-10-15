namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BatchScheduleRequest(
    int RoomId,
    string SubjectName,
    string? ClassCode,
    string? LecturerName,
    DateTime StartDate,
    DateTime EndDate,
    int[] DaysOfWeek,
    string StartTimeStr,
    string EndTimeStr,
    int? PeriodStart = null,
    int? PeriodEnd = null,
    string? Semester = null,
    string? Department = null,
    string? Notes = null,
    bool OverrideConflicts = false
);
