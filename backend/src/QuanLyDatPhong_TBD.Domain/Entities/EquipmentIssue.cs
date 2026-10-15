using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Domain.Entities;

public class EquipmentIssue
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public Room Room { get; set; } = default!;
    public int? EquipmentId { get; set; }
    public Equipment? Equipment { get; set; }
    public string? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string IssueType { get; set; } = "HongThietBi";
    public string Priority { get; set; } = "Normal";
    public string Severity { get; set; } = "Medium";
    public string Description { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }
    public string Status { get; set; } = "Pending";
    public string? AssignedTo { get; set; }
    public string? AdminNotes { get; set; }
    public string? RepairNotes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
