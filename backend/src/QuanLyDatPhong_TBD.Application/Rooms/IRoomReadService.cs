namespace QuanLyDatPhong_TBD.Application.Rooms;

public interface IRoomReadService
{
    Task<IReadOnlyList<RoomDto>> GetActiveRoomsAsync(CancellationToken cancellationToken = default);
}
