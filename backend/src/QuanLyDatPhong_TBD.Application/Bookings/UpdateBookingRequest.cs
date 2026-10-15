namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record UpdateBookingRequest(
    DateTime StartTime,
    DateTime EndTime,
    string? Purpose,
    int ParticipantCount,
    string[]? RequestedEquipments,
    string? Department,
    string? PersonInCharge,
    string? Notes,
    string? SpecialRequestReason);
