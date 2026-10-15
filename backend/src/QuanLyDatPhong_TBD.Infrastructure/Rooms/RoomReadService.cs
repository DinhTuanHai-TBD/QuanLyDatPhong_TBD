using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Application.Rooms;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Infrastructure.Rooms;

internal sealed class RoomReadService : IRoomReadService
{
    private readonly ApplicationDbContext _dbContext;

    public RoomReadService(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<RoomDto>> GetActiveRoomsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Rooms
            .AsNoTracking()
            .Where(room => room.IsActive)
            .OrderBy(room => room.Name)
            .Select(room => new RoomDto(
                room.Id,
                room.Name,
                room.Building,
                room.Capacity,
                room.RoomType,
                room.Status,
                room.ImageUrl,
                room.MapImageUrl,
                room.Description,
                room.IsActive))
            .ToListAsync(cancellationToken);
    }
}
