namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record CreateBookingRequest(
    int RoomId,
    DateTime StartTime,
    DateTime EndTime,
    string? Purpose,
    int? ParticipantCount = null,
    string[]? RequestedEquipments = null,
    string? Department = null,
    string? PersonInCharge = null,
    string? Notes = null,
    bool IsSpecialRequest = false,
    string? SpecialRequestReason = null,
    bool AgreedToRules = true);
