using QuanLyDatPhong_TBD.Domain.Enums;

namespace QuanLyDatPhong_TBD.Application.Rooms;

public sealed record RoomDto(
    int Id,
    string Name,
    string? Building,
    int Capacity,
    RoomType RoomType,
    RoomStatus Status,
    string? ImageUrl,
    string? MapImageUrl,
    string? Description,
    bool IsActive);
