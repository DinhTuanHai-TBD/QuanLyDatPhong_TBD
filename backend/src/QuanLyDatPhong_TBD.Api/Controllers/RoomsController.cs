using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuanLyDatPhong_TBD.Application.Rooms;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Domain.Enums;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Route("api/rooms")]
public class RoomsController : ControllerBase
{
    private readonly IRoomReadService _roomReadService;
    private readonly ApplicationDbContext _dbContext;

    public RoomsController(IRoomReadService roomReadService, ApplicationDbContext dbContext)
    {
        _roomReadService = roomReadService;
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoomDto>>> GetActiveRooms(CancellationToken cancellationToken)
    {
        var rooms = await _roomReadService.GetActiveRoomsAsync(cancellationToken);
        return Ok(rooms);
    }

    public record RoomRequest(
        string Name,
        string? Building,
        int Capacity,
        string? RoomType,
        string? Status,
        string? ImageUrl,
        string? Description);

    [HttpPost]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> CreateRoom([FromBody] RoomRequest request, CancellationToken cancellationToken)
    {
        var roomType = Enum.TryParse<RoomType>(request.RoomType, true, out var parsedType) ? parsedType : RoomType.Classroom;
        var status = Enum.TryParse<RoomStatus>(request.Status, true, out var parsedStatus) ? parsedStatus : RoomStatus.Active;

        var room = new Room
        {
            Name = request.Name,
            Building = request.Building ?? "Khu A",
            Capacity = request.Capacity > 0 ? request.Capacity : 40,
            RoomType = roomType,
            Status = status,
            ImageUrl = request.ImageUrl,
            Description = request.Description,
            IsActive = status != RoomStatus.Closed
        };

        _dbContext.Rooms.Add(room);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(room);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> UpdateRoom(int id, [FromBody] RoomRequest request, CancellationToken cancellationToken)
    {
        var room = await _dbContext.Rooms.FindAsync(new object[] { id }, cancellationToken);
        if (room == null) return NotFound("Room not found");

        room.Name = request.Name;
        if (request.Building != null) room.Building = request.Building;
        if (request.Capacity > 0) room.Capacity = request.Capacity;
        if (request.RoomType != null && Enum.TryParse<RoomType>(request.RoomType, true, out var parsedType))
        {
            room.RoomType = parsedType;
        }
        if (request.Status != null && Enum.TryParse<RoomStatus>(request.Status, true, out var parsedStatus))
        {
            room.Status = parsedStatus;
            room.IsActive = parsedStatus != RoomStatus.Closed;
        }
        if (request.ImageUrl != null) room.ImageUrl = request.ImageUrl;
        if (request.Description != null) room.Description = request.Description;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(room);
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> DeleteRoom(int id, CancellationToken cancellationToken)
    {
        var room = await _dbContext.Rooms.FindAsync(new object[] { id }, cancellationToken);
        if (room == null) return NotFound("Room not found");

        _dbContext.Rooms.Remove(room);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Đã xóa phòng học thành công" });
    }
}
