namespace QuanLyDatPhong_TBD.Application.Notifications;

public sealed record NotificationDto(
    int Id,
    string Title,
    string Message,
    bool IsRead,
    DateTime CreatedAt);
