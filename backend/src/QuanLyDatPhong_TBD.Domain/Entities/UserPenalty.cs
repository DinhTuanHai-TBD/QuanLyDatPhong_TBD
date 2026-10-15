namespace QuanLyDatPhong_TBD.Domain.Entities;

public class UserPenalty
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime? BannedUntil { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
