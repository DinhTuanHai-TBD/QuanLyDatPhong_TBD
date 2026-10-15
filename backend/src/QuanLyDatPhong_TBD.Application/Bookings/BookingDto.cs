using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Application.Bookings;

public sealed record BookingDto(
    int Id,
    int RoomId,
    string RoomName,
    DateTime StartTime,
    DateTime EndTime,
    string? Purpose,
    BookingStatus Status,
    string? RejectReason,
    int? ParticipantCount = null,
    string[]? RequestedEquipments = null,
    string? Department = null,
    string? PersonInCharge = null,
    string? Notes = null,
    bool IsSpecialRequest = false,
    string? SpecialRequestReason = null,
    bool AgreedToRules = true,
    string? UserEmail = null,
    string? ApprovedBy = null,
    DateTime? ApprovedAt = null,
    string? AdminNotes = null,
    bool IsSchoolOverride = false,
    DateTime? ActualStartTime = null,
    DateTime? ActualEndTime = null,
    string? CheckoutNotes = null);
