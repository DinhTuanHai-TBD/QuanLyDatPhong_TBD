using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Domain.Entities;

public class Room
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Building { get; set; }
    public int Capacity { get; set; }
    public RoomType RoomType { get; set; } = RoomType.Classroom;
    public RoomStatus Status { get; set; } = RoomStatus.Active;
    public string? ImageUrl { get; set; }
    public string? MapImageUrl { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;

    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    public ICollection<RoomEquipment> RoomEquipments { get; set; } = new List<RoomEquipment>();
    public ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();
    public ICollection<EquipmentIssue> EquipmentIssues { get; set; } = new List<EquipmentIssue>();
}
