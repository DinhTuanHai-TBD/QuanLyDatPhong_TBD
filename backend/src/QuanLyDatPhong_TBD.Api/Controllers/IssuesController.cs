using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/issues")]
public class IssuesController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public IssuesController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private string? GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

    private string? GetUserEmail() =>
        User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken cancellationToken)
    {
        var isManager = User.IsInRole("Admin") || User.IsInRole("Approver") || User.IsInRole("Manager");
        var userId = GetUserId();
        var userEmail = GetUserEmail();

        var query = _dbContext.EquipmentIssues
            .Include(i => i.Room)
            .Include(i => i.Equipment)
            .AsNoTracking()
            .AsQueryable();

        // Non-managers only see their own reported issues
        if (!isManager)
        {
            query = query.Where(i => (userId != null && i.UserId == userId) || (userEmail != null && i.UserEmail == userEmail));
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(i => i.Status == status);
        }

        var list = await query
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.RoomId,
                RoomName = i.Room.Name,
                i.EquipmentId,
                EquipmentName = i.Equipment != null ? i.Equipment.Name : null,
                i.UserId,
                i.UserEmail,
                i.IssueType,
                i.Priority,
                i.Severity,
                i.Description,
                i.ImageUrl,
                i.BookingId,
                i.Status,
                i.AssignedTo,
                i.AdminNotes,
                i.RepairNotes,
                i.CreatedAt,
                i.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(list);
    }

    [HttpGet("mine")]
    [HttpGet("my")]
    public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var userEmail = GetUserEmail();

        if (string.IsNullOrEmpty(userId) && string.IsNullOrEmpty(userEmail))
        {
            return Unauthorized();
        }

        var list = await _dbContext.EquipmentIssues
            .Include(i => i.Room)
            .Include(i => i.Equipment)
            .AsNoTracking()
            .Where(i => (userId != null && i.UserId == userId) || (userEmail != null && i.UserEmail == userEmail))
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.RoomId,
                RoomName = i.Room.Name,
                i.EquipmentId,
                EquipmentName = i.Equipment != null ? i.Equipment.Name : null,
                i.UserId,
                i.UserEmail,
                i.IssueType,
                i.Priority,
                i.Severity,
                i.Description,
                i.ImageUrl,
                i.BookingId,
                i.Status,
                i.AssignedTo,
                i.AdminNotes,
                i.RepairNotes,
                i.CreatedAt,
                i.UpdatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(list);
    }

    public record CreateIssueRequest(
        int RoomId,
        int? EquipmentId,
        string IssueType,
        string Priority,
        string Description,
        string? ImageUrl,
        int? BookingId);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIssueRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var userEmail = GetUserEmail();

        var room = await _dbContext.Rooms.FindAsync(new object[] { request.RoomId }, cancellationToken);
        if (room is null)
        {
            return NotFound(new { message = "Không tìm thấy phòng học." });
        }

        var issue = new EquipmentIssue
        {
            RoomId = request.RoomId,
            EquipmentId = request.EquipmentId,
            UserId = userId,
            UserEmail = userEmail,
            IssueType = request.IssueType ?? "HongThietBi",
            Priority = request.Priority ?? "Normal",
            Description = request.Description,
            ImageUrl = request.ImageUrl,
            BookingId = request.BookingId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.EquipmentIssues.Add(issue);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 1. Notification for reporter
        if (!string.IsNullOrEmpty(userId))
        {
            _dbContext.Notifications.Add(new Notification
            {
                UserId = userId,
                Title = "Báo cáo sự cố đã được ghi nhận",
                Message = $"Báo cáo sự cố [{issue.IssueType}] tại {room.Name} của bạn đã được gửi thành công đến Ban Quản lý.",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        // 2. Notification for Admins/Managers
        var managerRoleIds = await _dbContext.Roles
            .Where(r => r.Name == "Admin" || r.Name == "Approver" || r.Name == "Manager")
            .Select(r => r.Id)
            .ToListAsync(cancellationToken);

        if (managerRoleIds.Count > 0)
        {
            var managerUserIds = await _dbContext.UserRoles
                .Where(ur => managerRoleIds.Contains(ur.RoleId))
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var mId in managerUserIds)
            {
                if (mId != userId)
                {
                    _dbContext.Notifications.Add(new Notification
                    {
                        UserId = mId,
                        Title = "Báo cáo sự cố mới cần xử lý",
                        Message = $"Người dùng {userEmail ?? "người dùng"} vừa báo cáo sự cố [{issue.IssueType}] tại {room.Name}: {issue.Description}",
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            issue.Id,
            issue.RoomId,
            RoomName = room.Name,
            issue.IssueType,
            issue.Priority,
            issue.Description,
            issue.Status,
            issue.CreatedAt
        });
    }

    public record UpdateIssueStatusRequest(
        string Status,
        string? AssignedTo,
        string? RepairNotes,
        string? AdminNotes);

    // Return only scalar values: tracked Room navigation links back to this issue.
    public static object ToUpdateResponse(EquipmentIssue issue) => new
    {
        issue.Id, issue.RoomId, RoomName = issue.Room?.Name,
        issue.EquipmentId, EquipmentName = issue.Equipment?.Name,
        issue.UserId, issue.UserEmail, issue.IssueType, issue.Priority,
        issue.Severity, issue.Description, issue.ImageUrl, issue.BookingId,
        issue.Status, issue.AssignedTo, issue.AdminNotes, issue.RepairNotes,
        issue.CreatedAt, issue.UpdatedAt
    };

    [HttpPatch("{id:int}")]
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateIssueStatusRequest request, CancellationToken cancellationToken)
    {
        var issue = await _dbContext.EquipmentIssues
            .Include(i => i.Room)
            .Include(i => i.Equipment)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (issue is null)
        {
            return NotFound(new { message = "Không tìm thấy báo cáo sự cố." });
        }

        if (!string.IsNullOrEmpty(request.Status)) issue.Status = request.Status;
        if (request.AssignedTo != null) issue.AssignedTo = request.AssignedTo;
        if (request.RepairNotes != null) issue.RepairNotes = request.RepairNotes;
        if (request.AdminNotes != null) issue.AdminNotes = request.AdminNotes;
        issue.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrEmpty(issue.UserId))
        {
            var roomName = issue.Room?.Name ?? "phòng học";
            var statusText = request.Status switch
            {
                "Pending" => "Chờ tiếp nhận",
                "Assigned" => "Đã phân công",
                "Fixing" => "Đang xử lý",
                "Rejected" => "Từ chối báo cáo",
                "Received" => "Đã tiếp nhận",
                "InProgress" => "Đang xử lý / Đang sửa chữa",
                "Resolved" => "Đã khắc phục xong",
                "Closed" => "Đã đóng",
                _ => request.Status
            };

            var notes = !string.IsNullOrEmpty(request.RepairNotes) ? $" Ghi chú: {request.RepairNotes}" :
                        !string.IsNullOrEmpty(request.AdminNotes) ? $" Ghi chú: {request.AdminNotes}" : "";

            _dbContext.Notifications.Add(new Notification
            {
                UserId = issue.UserId,
                Title = $"Cập nhật xử lý sự cố #{issue.Id}",
                Message = $"Báo cáo sự cố [{issue.IssueType}] tại {roomName} đã chuyển sang trạng thái: {statusText}.{notes}",
                IsRead = false,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok(ToUpdateResponse(issue));
    }
}
