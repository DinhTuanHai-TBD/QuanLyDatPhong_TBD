namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BatchScheduleMultiResult(
    bool Succeeded,
    string Message,
    int TotalCourses,
    int SuccessCourses,
    int FailedCourses,
    int TotalBookingsCreated,
    int TotalConflicts,
    IReadOnlyList<BatchScheduleConflict> Conflicts,
    IReadOnlyList<BookingDto> CreatedBookings
);
