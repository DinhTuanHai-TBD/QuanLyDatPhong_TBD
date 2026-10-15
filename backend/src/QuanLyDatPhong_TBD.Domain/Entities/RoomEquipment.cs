namespace QuanLyDatPhong_TBD.Domain.Entities;

public class RoomEquipment
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public Room Room { get; set; } = default!;
    public int EquipmentId { get; set; }
    public Equipment Equipment { get; set; } = default!;
    public int Quantity { get; set; }
}
