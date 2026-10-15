namespace QuanLyDatPhong_TBD.Application.Bookings;

public interface IBookingService
{
    Task ProcessAutoExpirationAndRemindersAsync(CancellationToken cancellationToken);
    Task<IReadOnlyList<BookingDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<BookingDto>> GetCalendarBookingsAsync(
        string userId,
        bool isManager,
        DateTime? startDate = null,
        DateTime? endDate = null,
        int? roomId = null,
        CancellationToken cancellationToken = default);
    Task<IReadOnlyList<BookingDto>> GetMyBookingsAsync(string userId, CancellationToken cancellationToken = default);
    Task<BookingResult> CreateAsync(string userId, CreateBookingRequest request, CancellationToken cancellationToken = default);
    Task<BookingResult> UpdateAsync(int bookingId, string userId, UpdateBookingRequest request, CancellationToken cancellationToken = default);
    Task<BookingResult> ApproveAsync(int bookingId, string adminUserId, string? notes, CancellationToken cancellationToken = default);
    Task<BookingResult> CancelAsync(int bookingId, string userId, string reason, CancellationToken cancellationToken);
    Task<BookingResult> RejectAsync(int bookingId, string adminUserId, string reason, CancellationToken cancellationToken = default);
    Task<BookingResult> CheckInAsync(int bookingId, string userId, bool isManager, CancellationToken cancellationToken = default);
    Task<BookingResult> CheckOutAsync(int bookingId, string userId, bool isManager, string? notes, CancellationToken cancellationToken = default);
    Task<BatchScheduleResult> CreateBatchScheduleAsync(string userId, BatchScheduleRequest request, CancellationToken cancellationToken = default);
    Task<BatchScheduleMultiResult> CreateBatchScheduleMultiAsync(string userId, BatchScheduleMultiRequest request, CancellationToken cancellationToken = default);
}
