using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Domain.Entities;

public class Booking
{
    public int Id { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public string? Purpose { get; set; }
    public BookingStatus Status { get; set; } = BookingStatus.Pending;
    public int RoomId { get; set; }
    public Room Room { get; set; } = default!;
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? RejectReason { get; set; }
    public bool IsSchoolOverride { get; set; }
    public string? ApprovedByUserId { get; set; }

    // Richer details matching Frontend specifications
    public int? ParticipantCount { get; set; }
    public string? RequestedEquipmentsJson { get; set; }
    public string? Department { get; set; }
    public string? PersonInCharge { get; set; }
    public string? Notes { get; set; }
    public bool IsSpecialRequest { get; set; }
    public string? SpecialRequestReason { get; set; }
    public bool AgreedToRules { get; set; }
    public DateTime? ActualStartTime { get; set; }
    public DateTime? ActualEndTime { get; set; }
    public string? CheckoutNotes { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? AdminNotes { get; set; }

    public ICollection<EquipmentIssue> EquipmentIssues { get; set; } = new List<EquipmentIssue>();
}
