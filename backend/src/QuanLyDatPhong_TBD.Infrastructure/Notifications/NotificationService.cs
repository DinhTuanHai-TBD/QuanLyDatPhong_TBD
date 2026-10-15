using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Application.Notifications;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Infrastructure.Notifications;

internal sealed class NotificationService : INotificationService
{
    private readonly ApplicationDbContext _dbContext;

    public NotificationService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<NotificationDto>> GetMineAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        return await _dbContext.Notifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId)
            .OrderByDescending(notification => notification.CreatedAt)
            .Select(notification => new NotificationDto(
                notification.Id,
                notification.Title,
                notification.Message,
                notification.IsRead,
                notification.CreatedAt))
            .ToListAsync(cancellationToken);
    }
}
