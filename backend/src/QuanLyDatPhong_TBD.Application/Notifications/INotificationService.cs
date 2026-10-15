namespace QuanLyDatPhong_TBD.Application.Notifications;

public interface INotificationService
{
    Task<IReadOnlyList<NotificationDto>> GetMineAsync(
        string userId,
        CancellationToken cancellationToken = default);
}
