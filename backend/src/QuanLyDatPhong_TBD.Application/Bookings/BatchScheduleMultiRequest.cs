namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BatchScheduleMultiRequest(
    IReadOnlyList<BatchScheduleRequest> Schedules,
    bool OverrideConflicts = false
);
