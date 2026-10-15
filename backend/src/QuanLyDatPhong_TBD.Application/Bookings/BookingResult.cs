namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BookingResult(bool Succeeded, BookingDto? Booking, string? Error)
{
    public static BookingResult Success(BookingDto booking) => new(true, booking, null);
    public static BookingResult Failure(string error) => new(false, null, error);
}
