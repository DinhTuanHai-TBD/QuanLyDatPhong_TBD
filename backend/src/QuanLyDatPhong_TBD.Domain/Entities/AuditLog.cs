namespace QuanLyDatPhong_TBD.Domain.Entities;

public class AuditLog
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? ActorUserId { get; set; }
    public string? ActorUserName { get; set; }
    public string? TargetType { get; set; }
    public string? TargetId { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
