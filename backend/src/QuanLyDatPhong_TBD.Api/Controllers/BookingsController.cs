using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QuanLyDatPhong_TBD.Application.Bookings;

namespace QuanLyDatPhong_TBD.Api.Controllers;

public record ApproveBookingRequest(string? Notes, string? Reason);
public record CheckoutBookingRequest(string? Notes);

[ApiController]
[Authorize]
[Route("api/bookings")]
public class BookingsController : ControllerBase
{
    private readonly IBookingService _bookingService;

    public BookingsController(IBookingService bookingService)
    {
        _bookingService = bookingService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<BookingDto>>> GetAll(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int? roomId,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isManager = User.IsInRole("Admin") || User.IsInRole("Approver") || User.IsInRole("Manager");
        var bookings = await _bookingService.GetCalendarBookingsAsync(userId, isManager, startDate, endDate, roomId, cancellationToken);
        return Ok(bookings);
    }

    [HttpGet("mine")]
    public async Task<ActionResult<IReadOnlyList<BookingDto>>> GetMine(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        return Ok(await _bookingService.GetMyBookingsAsync(userId, cancellationToken));
    }

    [HttpPost]
    public async Task<ActionResult<BookingDto>> Create(
        CreateBookingRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _bookingService.CreateAsync(userId, request, cancellationToken);
        if (!result.Succeeded)
        {
            return Conflict(new { message = result.Error });
        }

        return CreatedAtAction(nameof(GetMine), result.Booking);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<BookingDto>> Update(
        int id,
        UpdateBookingRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _bookingService.UpdateAsync(id, userId, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Booking);
    }

    [HttpPut("{id:int}/approve")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<ActionResult<BookingDto>> Approve(
        int id,
        [FromBody] ApproveBookingRequest? body,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _bookingService.ApproveAsync(id, userId, body?.Notes ?? body?.Reason, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Booking);
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, [FromBody] ApproveBookingRequest body, CancellationToken token)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized();
        var result = await _bookingService.CancelAsync(id, userId, body.Reason ?? "", token);
        return result.Succeeded ? Ok(result.Booking) : BadRequest(new { message = result.Error });
    }

    [HttpPut("{id:int}/reject")]
    [Authorize(Roles = "Admin,Approver,Manager")]
    public async Task<ActionResult<BookingDto>> Reject(
        int id,
        [FromBody] ApproveBookingRequest? body,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var reason = !string.IsNullOrWhiteSpace(body?.Reason) ? body.Reason : "Không đủ điều kiện phê duyệt.";
        var result = await _bookingService.RejectAsync(id, userId, reason, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Booking);
    }

    [HttpPut("{id:int}/checkin")]
    public async Task<ActionResult<BookingDto>> CheckIn(int id, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isManager = User.IsInRole("Admin") || User.IsInRole("Approver") || User.IsInRole("Manager");
        var result = await _bookingService.CheckInAsync(id, userId, isManager, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Booking);
    }

    [HttpPut("{id:int}/checkout")]
    public async Task<ActionResult<BookingDto>> CheckOut(
        int id,
        [FromBody] CheckoutBookingRequest? body,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var isManager = User.IsInRole("Admin") || User.IsInRole("Approver") || User.IsInRole("Manager");
        var result = await _bookingService.CheckOutAsync(id, userId, isManager, body?.Notes, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return Ok(result.Booking);
    }

    [HttpPost("batch-schedule")]
    [Authorize(Roles = "Admin,Approver,Manager,Staff")]
    public async Task<ActionResult<BatchScheduleResult>> CreateBatchSchedule(
        [FromBody] BatchScheduleRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _bookingService.CreateBatchScheduleAsync(userId, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpPost("batch-schedule-multi")]
    [Authorize(Roles = "Admin,Approver,Manager,Staff")]
    public async Task<ActionResult<BatchScheduleMultiResult>> CreateBatchScheduleMulti(
        [FromBody] BatchScheduleMultiRequest request,
        CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        if (userId is null)
        {
            return Unauthorized();
        }

        var result = await _bookingService.CreateBatchScheduleMultiAsync(userId, request, cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    private string? GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier);
}
