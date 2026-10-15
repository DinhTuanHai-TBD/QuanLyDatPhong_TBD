using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/equipments")]
public class EquipmentsController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public EquipmentsController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? roomId, CancellationToken cancellationToken)
    {
        var query = _dbContext.Equipments
            .Include(e => e.Room)
            .AsNoTracking()
            .AsQueryable();

        if (roomId.HasValue)
        {
            query = query.Where(e => e.RoomId == roomId.Value || e.RoomId == null);
        }

        var list = await query
            .OrderBy(e => e.Name)
            .Select(e => new
            {
                e.Id,
                e.Code,
                e.Name,
                e.Type,
                e.RoomId,
                RoomName = e.Room != null ? e.Room.Name : null,
                e.Quantity,
                e.Status,
                e.PurchaseDate,
                e.WarrantyExpiry,
                e.LastMaintenanceDate,
                e.Description,
                e.IssueNotes
            })
            .ToListAsync(cancellationToken);

        return Ok(list);
    }

    public record CreateEquipmentRequest(
        string Code,
        string Name,
        string Type,
        int? RoomId,
        int Quantity,
        string Status,
        string? Description);

    [HttpPost]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> Create([FromBody] CreateEquipmentRequest request, CancellationToken cancellationToken)
    {
        var equipment = new Equipment
        {
            Code = request.Code ?? $"TB-{Random.Shared.Next(100, 999)}",
            Name = request.Name,
            Type = request.Type ?? "General",
            RoomId = request.RoomId,
            Quantity = request.Quantity > 0 ? request.Quantity : 1,
            Status = request.Status ?? "Active",
            Description = request.Description
        };

        _dbContext.Equipments.Add(equipment);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(equipment);
    }

    public record UpdateEquipmentRequest(
        string? Code,
        string? Name,
        string? Type,
        int? RoomId,
        int? Quantity,
        string? Status,
        string? Description,
        string? IssueNotes);

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEquipmentRequest request, CancellationToken cancellationToken)
    {
        var equipment = await _dbContext.Equipments.FindAsync(new object[] { id }, cancellationToken);
        if (equipment is null)
        {
            return NotFound(new { message = "Không tìm thấy thiết bị." });
        }

        if (request.Code != null) equipment.Code = request.Code;
        if (request.Name != null) equipment.Name = request.Name;
        if (request.Type != null) equipment.Type = request.Type;
        if (request.RoomId.HasValue) equipment.RoomId = request.RoomId.Value == 0 ? null : request.RoomId;
        if (request.Quantity.HasValue) equipment.Quantity = request.Quantity.Value;
        if (request.Status != null) equipment.Status = request.Status;
        if (request.Description != null) equipment.Description = request.Description;
        if (request.IssueNotes != null) equipment.IssueNotes = request.IssueNotes;

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(equipment);
    }
}
