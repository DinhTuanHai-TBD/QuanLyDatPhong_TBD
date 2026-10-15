namespace QuanLyDatPhong_TBD.Domain.Entities;

public class Equipment
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "General";
    public int? RoomId { get; set; }
    public Room? Room { get; set; }
    public int Quantity { get; set; } = 1;
    public string Status { get; set; } = "Active";
    public DateTime? PurchaseDate { get; set; }
    public DateTime? WarrantyExpiry { get; set; }
    public DateTime? LastMaintenanceDate { get; set; }
    public string? Description { get; set; }
    public string? IssueNotes { get; set; }

    public ICollection<RoomEquipment> RoomEquipments { get; set; } = new List<RoomEquipment>();
    public ICollection<EquipmentIssue> EquipmentIssues { get; set; } = new List<EquipmentIssue>();
}
