namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BatchScheduleConflict(
    DateTime Date,
    string TimeRange,
    string ConflictReason
);

public sealed record BatchScheduleResult(
    bool Succeeded,
    string Message,
    int TotalGenerated,
    int SuccessCount,
    int ConflictCount,
    IReadOnlyList<BatchScheduleConflict> Conflicts,
    IReadOnlyList<BookingDto> CreatedBookings
);
