using System;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Api.Data;
using QuanLyDatPhong_TBD.Api.Models;

namespace QuanLyDatPhong_TBD.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class IssuesController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;

        public IssuesController(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Lấy danh sách sự cố do chính người dùng hiện tại gửi
        /// Endpoint: GET /api/issues/mine hoặc GET /api/issues/my
        /// </summary>
        [HttpGet("mine")]
        [HttpGet("my")]
        public async Task<IActionResult> GetMine(CancellationToken cancellationToken)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

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
                    RoomName = i.Room != null ? i.Room.Name : null,
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

        /// <summary>
        /// Lấy danh sách sự cố. Nếu không phải Admin/Manager thì tự động lọc theo tài khoản người gửi.
        /// Endpoint: GET /api/issues
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll(CancellationToken cancellationToken)
        {
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "";
            var isAdminOrManager = userRole.Equals("Admin", StringComparison.OrdinalIgnoreCase) ||
                                   userRole.Equals("Manager", StringComparison.OrdinalIgnoreCase) ||
                                   userRole.Equals("Approver", StringComparison.OrdinalIgnoreCase);

            var query = _dbContext.EquipmentIssues
                .Include(i => i.Room)
                .Include(i => i.Equipment)
                .AsNoTracking()
                .AsQueryable();

            if (!isAdminOrManager)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
                var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

                if (string.IsNullOrEmpty(userId) && string.IsNullOrEmpty(userEmail))
                {
                    return Unauthorized();
                }

                query = query.Where(i => (userId != null && i.UserId == userId) || (userEmail != null && i.UserEmail == userEmail));
            }

            var list = await query
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new
                {
                    i.Id,
                    i.RoomId,
                    RoomName = i.Room != null ? i.Room.Name : null,
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

        /// <summary>
        /// Lấy chi tiết một sự cố theo ID
        /// Endpoint: GET /api/issues/{id}
        /// </summary>
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id, CancellationToken cancellationToken)
        {
            var issue = await _dbContext.EquipmentIssues
                .Include(i => i.Room)
                .Include(i => i.Equipment)
                .AsNoTracking()
                .Where(i => i.Id == id)
                .Select(i => new
                {
                    i.Id,
                    i.RoomId,
                    RoomName = i.Room != null ? i.Room.Name : null,
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
                .FirstOrDefaultAsync(cancellationToken);

            if (issue == null)
            {
                return NotFound(new { message = $"Không tìm thấy sự cố với ID = {id}" });
            }

            return Ok(issue);
        }

        /// <summary>
        /// Gửi báo cáo sự cố mới
        /// Endpoint: POST /api/issues
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateIssueDto dto, CancellationToken cancellationToken)
        {
            if (dto == null || dto.RoomId <= 0 || string.IsNullOrWhiteSpace(dto.IssueType))
            {
                return BadRequest(new { message = "Thông tin sự cố không hợp lệ. Vui lòng chọn phòng và loại sự cố." });
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub) ?? "";
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email) ?? "";

            var issue = new EquipmentIssue
            {
                RoomId = dto.RoomId,
                EquipmentId = dto.EquipmentId,
                UserId = userId,
                UserEmail = userEmail,
                IssueType = dto.IssueType,
                Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Medium" : dto.Priority,
                Severity = dto.Severity,
                Description = dto.Description ?? "",
                ImageUrl = dto.ImageUrl,
                BookingId = dto.BookingId,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _dbContext.EquipmentIssues.Add(issue);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return CreatedAtAction(nameof(GetById), new { id = issue.Id }, issue);
        }

        /// <summary>
        /// Cập nhật tiến độ / trạng thái xử lý sự cố (hỗ trợ cả PUT, PATCH và /status)
        /// Endpoint: PUT /api/issues/{id} hoặc PATCH /api/issues/{id}
        /// </summary>
        [HttpPut("{id:int}")]
        [HttpPatch("{id:int}")]
        [HttpPut("{id:int}/status")]
        [HttpPatch("{id:int}/status")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateIssueDto dto, CancellationToken cancellationToken)
        {
            var issue = await _dbContext.EquipmentIssues
                .Include(i => i.Room)
                .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

            if (issue == null)
            {
                return NotFound(new { message = $"Không tìm thấy sự cố với ID = {id}" });
            }

            var previousStatus = issue.Status;
            var isStatusChanged = !string.IsNullOrEmpty(dto.Status) && dto.Status != previousStatus;
            var isNotesChanged = (!string.IsNullOrEmpty(dto.RepairNotes) && dto.RepairNotes != issue.RepairNotes) ||
                                 (!string.IsNullOrEmpty(dto.AdminNotes) && dto.AdminNotes != issue.AdminNotes);

            if (!string.IsNullOrEmpty(dto.Status)) issue.Status = dto.Status;
            if (!string.IsNullOrEmpty(dto.Priority)) issue.Priority = dto.Priority;
            if (!string.IsNullOrEmpty(dto.Severity)) issue.Severity = dto.Severity;
            if (!string.IsNullOrEmpty(dto.AssignedTo)) issue.AssignedTo = dto.AssignedTo;
            if (dto.AdminNotes != null) issue.AdminNotes = dto.AdminNotes;
            if (dto.RepairNotes != null) issue.RepairNotes = dto.RepairNotes;
            issue.UpdatedAt = DateTime.UtcNow;

            // Khi Quản lý cập nhật trạng thái hoặc ghi chú sửa chữa, tự động thêm một bản ghi vào bảng Notifications cho người gửi
            if ((isStatusChanged || isNotesChanged) && (!string.IsNullOrEmpty(issue.UserId) || !string.IsNullOrEmpty(issue.UserEmail)))
            {
                var roomName = issue.Room != null ? issue.Room.Name : $"Phòng #{issue.RoomId}";
                var statusText = issue.Status switch
                {
                    "Pending" => "Chờ tiếp nhận",
                    "Assigned" => "Đã phân công",
                    "Fixing" => "Đang sửa chữa",
                    "InProgress" => "Đang sửa chữa",
                    "Received" => "Đã tiếp nhận",
                    "Resolved" => "Đã khắc phục",
                    "Rejected" => "Không xử lý",
                    "Closed" => "Đã đóng",
                    _ => issue.Status
                };

                var notes = !string.IsNullOrWhiteSpace(issue.RepairNotes)
                    ? issue.RepairNotes
                    : (!string.IsNullOrWhiteSpace(issue.AdminNotes) ? issue.AdminNotes : "Tiến độ đã được ghi nhận");

                var notification = new Notification
                {
                    UserId = !string.IsNullOrEmpty(issue.UserId) ? issue.UserId : issue.UserEmail,
                    UserEmail = issue.UserEmail,
                    Title = $"Cập nhật xử lý sự cố #{issue.Id}",
                    Message = $"Báo cáo sự cố [{issue.IssueType}] tại {roomName} đã chuyển sang trạng thái: {statusText}. Ghi chú: {notes}",
                    Type = "issue",
                    IsRead = false,
                    CreatedAt = DateTime.UtcNow
                };

                _dbContext.Notifications.Add(notification);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Cập nhật sự cố thành công", issue });
        }
    }

    public class CreateIssueDto
    {
        public int RoomId { get; set; }
        public int? EquipmentId { get; set; }
        public string IssueType { get; set; } = string.Empty;
        public string? Priority { get; set; }
        public string? Severity { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public int? BookingId { get; set; }
    }

    public class UpdateIssueDto
    {
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public string? Severity { get; set; }
        public string? AssignedTo { get; set; }
        public string? AdminNotes { get; set; }
        public string? RepairNotes { get; set; }
    }
}
