using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuanLyDatPhong_TBD.Application.Bookings;
using QuanLyDatPhong_TBD.Infrastructure.Common;
using QuanLyDatPhong_TBD.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using QuanLyDatPhong_TBD.Domain.Enums;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Api.Controllers;
using QuanLyDatPhong_TBD.Api.Options;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;
using QuanLyDatPhong_TBD.Infrastructure.Policies;

var passed = 0;
void Check(bool ok, string name) { if (!ok) throw new Exception("FAIL: " + name); Console.WriteLine("PASS: " + name); passed++; }
var calendarLogger = Microsoft.Extensions.Logging.Abstractions.NullLogger<QuanLyDatPhong_TBD.Api.Services.CalendarRequestMiddleware>.Instance;
using var middlewareServices = new ServiceCollection().AddLogging().AddOptions().BuildServiceProvider();
foreach (var clientCancelled in new[] { true, false })
{
    var requestContext = new DefaultHttpContext { RequestServices = middlewareServices };
    requestContext.Request.Method = "GET";
    requestContext.Request.Path = "/api/bookings";
    requestContext.Response.Body = new MemoryStream();
    if (clientCancelled) requestContext.RequestAborted = new CancellationToken(true);
    var middleware = new QuanLyDatPhong_TBD.Api.Services.CalendarRequestMiddleware(
        _ => throw new OperationCanceledException(), calendarLogger);
    await middleware.InvokeAsync(requestContext);
    Check(requestContext.Response.StatusCode == (clientCancelled ? 499 : 503),
        clientCancelled ? "client cancellation is not server failure" : "server cancellation returns failure, not empty calendar");
    if (!clientCancelled)
    {
        requestContext.Response.Body.Position = 0;
        using var failureJson = await JsonDocument.ParseAsync(requestContext.Response.Body);
        Check(failureJson.RootElement.TryGetProperty("message", out _), "calendar failure has readable message");
    }
}
// Reproduce EF relationship fix-up: returning the entity would create a JSON cycle.
var unavailableHealth = new DefaultHttpContext { RequestServices = middlewareServices };
unavailableHealth.Request.Method = "GET";
unavailableHealth.Request.Path = "/api/health/ready";
unavailableHealth.Response.Body = new MemoryStream();
var unavailableConfiguration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
    ["ConnectionStrings:DefaultConnection"] = "Host=127.0.0.1;Port=1;Database=unavailable;Username=unused;Pooling=false"
}).Build();
var readinessMiddleware = new QuanLyDatPhong_TBD.Api.Services.CalendarRequestMiddleware(
    async _ => { await new HealthController().Ready(unavailableConfiguration, default); }, calendarLogger);
await readinessMiddleware.InvokeAsync(unavailableHealth);
Check(unavailableHealth.Response.StatusCode == 503, "unavailable database fails readiness");
Check(new HealthController().Get() is OkObjectResult, "database failure does not fail API liveness");
foreach (var method in new[] { "GET", "POST" })
{
    var ctx = new DefaultHttpContext { RequestServices = middlewareServices };
    ctx.Request.Method = method;
    ctx.Request.Path = "/api/equipments";
    ctx.Response.Body = new MemoryStream();
    var attempts = 0;
    var middleware = new QuanLyDatPhong_TBD.Api.Services.CalendarRequestMiddleware(_ => {
        attempts++;
        throw new DbUpdateException("private payload", new Npgsql.NpgsqlException("SSL handshake", new IOException("connection closed")));
    }, calendarLogger);
    await middleware.InvokeAsync(ctx);
    Check(ctx.Response.StatusCode == 503 && attempts == 1, method + " equipment SSL error handled without replay");
    ctx.Response.Body.Position = 0;
    using var json = await JsonDocument.ParseAsync(ctx.Response.Body);
    Check(json.RootElement.GetProperty("outcomeUnknown").GetBoolean() == (method == "POST"), method + " save uncertainty preserved");
    Check(!json.RootElement.ToString().Contains("private payload"), "database internals not exposed");
}
var issueRoom = new Room { Id = 42, Name = "Test room" };
var savedIssue = new EquipmentIssue { Id = 7, Room = issueRoom, RoomId = 42,
    Status = "Assigned", AssignedTo = "Technician", RepairNotes = "Checking" };
issueRoom.EquipmentIssues.Add(savedIssue);
var cycleDetected = false;
try { JsonSerializer.Serialize(savedIssue); } catch (JsonException) { cycleDetected = true; }
Check(cycleDetected, "issue entity reproduces circular JSON failure");
using var issueJson = JsonDocument.Parse(JsonSerializer.Serialize(
    IssuesController.ToUpdateResponse(savedIssue), new JsonSerializerOptions(JsonSerializerDefaults.Web)));
Check(issueJson.RootElement.GetProperty("status").GetString() == "Assigned" &&
    issueJson.RootElement.GetProperty("repairNotes").GetString() == "Checking",
    "saved issue response serializes status and notes");
Check(!issueJson.RootElement.TryGetProperty("room", out _) &&
    issueJson.RootElement.GetProperty("roomName").GetString() == "Test room",
    "saved issue response excludes navigation graph");
var policy = new BookingSetting();
var now = new DateTime(2026, 9, 14, 0, 0, 0, DateTimeKind.Utc); // Monday 07:00 VN
string? Validate(DateTime start, DateTime end, bool timetable = false, bool approval = false) => BookingPolicy.Validate(policy, 1, start, end, now, timetable, approval);
Check(Validate(now.AddHours(1), now.AddHours(5)) == null, "4-hour booking accepted");
Check(Validate(now.AddHours(1), now.AddHours(6)) != null, "over 4 hours rejected");
Check(Validate(now.AddMinutes(29), now.AddHours(1)) != null, "minimum notice enforced");
Check(Validate(now.AddMinutes(30), now.AddHours(1)) == null, "exact minimum notice accepted");
Check(Validate(now.AddDays(15), now.AddDays(15).AddHours(1)) != null, "15 days exceeds 14-day horizon");
Check(Validate(now.AddDays(14), now.AddDays(14).AddHours(1)) == null, "14-day date boundary accepted");
Check(Validate(now.AddHours(12), now.AddHours(13)) == null, "ending exactly 20:00 accepted");
Check(Validate(now.AddHours(12), now.AddHours(13).AddMinutes(1)) != null, "after 20:00 rejected");
Check(Validate(now.AddDays(1).AddMinutes(-1), now.AddDays(1).AddHours(1)) != null, "before 07:00 rejected");
Check(Validate(now.AddDays(6), now.AddDays(6).AddHours(1)) != null, "Sunday closed");
Check(BookingPolicy.ValidateCancellation(policy, now.AddHours(2), now) == null, "cancel exact 2-hour boundary accepted");
Check(BookingPolicy.ValidateCancellation(policy, now.AddHours(2).AddSeconds(-1), now) != null, "late cancellation rejected");
Check(Validate(now.AddDays(28), now.AddDays(28).AddHours(8), timetable: true) == null, "timetable bypasses personal duration/horizon");
Check(Validate(now.AddMinutes(10), now.AddHours(1), approval: true) == null, "approval does not reapply creation notice");
policy.ClosedPeriodsJson = JsonSerializer.Serialize(new[] { new ClosedPeriod(1, now.AddHours(1), now.AddHours(3), "Maintenance") });
Check(Validate(now.AddHours(2), now.AddHours(4)) != null, "room maintenance blocks overlap");
Check(Validate(now.AddHours(3), now.AddHours(4)) == null, "maintenance end boundary is available");
Check(BookingPolicy.Validate(policy, 2, now.AddHours(2), now.AddHours(4), now) == null, "other rooms unaffected");
policy.ClosedPeriodsJson = JsonSerializer.Serialize(new[] { new ClosedPeriod(null, now, now.AddDays(1), "Holiday") });
Check(Validate(now.AddHours(1), now.AddHours(2), timetable: true) != null, "global closure applies to timetable");
Check(typeof(BookingSettingsController).GetMethod("Save")!.GetCustomAttributes(typeof(AuthorizeAttribute), true)
    .Cast<AuthorizeAttribute>().Any(x => x.Roles == "Admin"), "settings write restricted to Admin");

// Item 7: Role and Room policies
Check(BookingPolicy.ValidateRoleAndRoomPolicy(policy, "User", RoomType.LectureHall, now.AddHours(1), now.AddHours(2), now, false) != null, "Student cannot book LectureHall directly");
Check(BookingPolicy.ValidateRoleAndRoomPolicy(policy, "User", RoomType.LectureHall, now.AddHours(1), now.AddHours(2), now, true) == null, "Student can book LectureHall with special request");
Check(BookingPolicy.ValidateRoleAndRoomPolicy(policy, "User", RoomType.Classroom, now.AddHours(1), now.AddHours(4).AddMinutes(1), now) != null, "Student over 3 hours rejected");
Check(BookingPolicy.ValidateRoleAndRoomPolicy(policy, "Faculty", RoomType.Classroom, now.AddHours(1), now.AddHours(7), now) == null, "Faculty 6-hour booking accepted");
Check(BookingPolicy.ValidateRoleAndRoomPolicy(policy, "Faculty", RoomType.LectureHall, now.AddHours(1), now.AddHours(7), now) == null, "Faculty can book LectureHall");

// Item 8: Auto-approval
Check(BookingPolicy.CanAutoApprove(policy, "Faculty", RoomType.Classroom, false), "Faculty booking normal room auto-approves");
Check(!BookingPolicy.CanAutoApprove(policy, "Faculty", RoomType.Classroom, true), "Faculty special request requires manual review");
Check(!BookingPolicy.CanAutoApprove(policy, "Faculty", RoomType.LectureHall, false), "LectureHall requires manual review");
Check(!BookingPolicy.CanAutoApprove(policy, "User", RoomType.Classroom, false), "Student requires manual review");

// Item 10: Reminder hours
Check(policy.ApprovalReminderHours == 1.0, "Approval reminder defaults to 1 hour");

// Item 11: Check-in policy validation
Check(BookingPolicy.ValidateCheckIn(policy, now.AddHours(1), now) != null, "Check-in too early rejected");
Check(BookingPolicy.ValidateCheckIn(policy, now.AddMinutes(10), now) == null, "Check-in within 15 min window accepted");
Check(BookingPolicy.ValidateCheckIn(policy, now.AddMinutes(-16), now) != null, "Check-in after 15 min grace rejected (no-show)");

// Calendar access and no-show regressions; these checks do not connect to a database.
var studentCalendar = BookingCalendarPolicy.VisibleTo("student-viewer").Compile();
foreach (var status in Enum.GetValues<BookingStatus>())
{
    var otherBooking = new Booking { UserId = "other-user", Status = status };
    Check(studentCalendar(otherBooking) == (status is BookingStatus.Approved or BookingStatus.Using or BookingStatus.Completed or BookingStatus.Pending),
        $"Student calendar visibility for another user's {status} booking");
    otherBooking.UserId = "student-viewer";
    Check(studentCalendar(otherBooking), $"Own {status} booking remains visible");
}
var noShowRule = BookingCalendarPolicy.NoShow(now.AddMinutes(-15)).Compile();
var oldBooking = new Booking {
    UserId = "other-user", Status = BookingStatus.Approved,
    StartTime = now.AddHours(-2), EndTime = now.AddHours(-1), IsSchoolOverride = true
};
Check(!noShowRule(oldBooking), "Past official timetable is exempt from no-show expiration");
oldBooking.IsSchoolOverride = false;
Check(noShowRule(oldBooking), "Ordinary booking still expires without check-in");
oldBooking.ActualStartTime = oldBooking.StartTime;
Check(!noShowRule(oldBooking), "Checked-in booking does not expire as no-show");
oldBooking.ActualStartTime = null;
oldBooking.IsSchoolOverride = true;
oldBooking.Status = BookingStatus.Expired;
oldBooking.RejectReason = "Hủy tự động do quá hạn nhận phòng (No-show: không check-in trong vòng 15 phút sau giờ bắt đầu).";
var recoverTimetable = BookingCalendarPolicy.RecoverableTimetable(now).Compile();
Check(recoverTimetable(oldBooking), "Past timetable incorrectly expired by old worker is recoverable");
oldBooking.EndTime = now.AddHours(1);
Check(!recoverTimetable(oldBooking), "Recovery does not reopen an ongoing or future slot");
oldBooking.EndTime = now;
Check(recoverTimetable(oldBooking), "Timetable ending exactly now is recoverable");
oldBooking.IsSchoolOverride = false;
Check(!recoverTimetable(oldBooking), "Ordinary expired booking is never recovered");
oldBooking.IsSchoolOverride = true;
oldBooking.Status = BookingStatus.Cancelled;
Check(!recoverTimetable(oldBooking), "Intentional cancellation is never recovered");
oldBooking.Status = BookingStatus.Rejected;
Check(!recoverTimetable(oldBooking), "Rejected timetable is never recovered");
oldBooking.Status = BookingStatus.Expired;
oldBooking.RejectReason = "Hết hạn do quản trị viên xử lý";
Check(!recoverTimetable(oldBooking), "Other expiration reasons are not recovered");
oldBooking.RejectReason = null;
Check(!recoverTimetable(oldBooking), "Missing expiration reason requires manual review");
oldBooking.Status = BookingStatus.Completed;
Check(!recoverTimetable(oldBooking) && studentCalendar(oldBooking), "Recovered timetable is visible and recovery is idempotent");
using (var translationDb = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
    .UseNpgsql("Host=localhost;Database=translation_only;Username=unused;Password=unused").Options))
{
    Check(translationDb.Bookings.Where(BookingCalendarPolicy.VisibleTo("student-viewer")).ToQueryString().Contains("WHERE"),
        "Calendar visibility translates to PostgreSQL");
    Check(translationDb.Bookings.Where(BookingCalendarPolicy.NoShow(now)).ToQueryString().Contains("WHERE"),
        "No-show exclusion translates to PostgreSQL");
    Check(translationDb.Bookings.Where(BookingCalendarPolicy.RecoverableTimetable(now)).ToQueryString().Contains("WHERE"),
        "Recovery predicate translates to PostgreSQL");
}

if (args.Any(x => x is "--inspect-db" or "--migrate" or "--database" or "--calendar-inspect" or "--calendar-api-check" or "--calendar-performance"))
{
    var config = JsonDocument.Parse(File.ReadAllText("backend/src/QuanLyDatPhong_TBD.Api/appsettings.Development.json"));
    var connection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection") ??
        config.RootElement.GetProperty("ConnectionStrings").GetProperty("DefaultConnection").GetString()!;
    var services = new ServiceCollection();
    services.AddLogging();
    services.AddInfrastructure(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
        ["ConnectionStrings:DefaultConnection"] = connection
    }).Build());
    await using var provider = services.BuildServiceProvider();
    await using var scope = provider.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    if (args.Contains("--calendar-performance"))
    {
        var sample = await db.Bookings.AsNoTracking().OrderByDescending(b => b.StartTime).FirstAsync();
        await db.Database.OpenConnectionAsync();
        foreach (var days in new[] { 1, 7, 30 })
        foreach (var oneRoom in new[] { false, true })
        {
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM \"Bookings\" WHERE \"EndTime\" >= @start AND \"StartTime\" <= @end" +
                (oneRoom ? " AND \"RoomId\" = @room" : "") + " ORDER BY \"StartTime\"";
            var startParameter = command.CreateParameter(); startParameter.ParameterName = "start"; startParameter.Value = sample.StartTime.Date.AddDays(1-days); command.Parameters.Add(startParameter);
            var endParameter = command.CreateParameter(); endParameter.ParameterName = "end"; endParameter.Value = sample.StartTime.Date.AddDays(1); command.Parameters.Add(endParameter);
            if (oneRoom) { var roomParameter = command.CreateParameter(); roomParameter.ParameterName = "room"; roomParameter.Value = sample.RoomId; command.Parameters.Add(roomParameter); }
            Console.WriteLine($"Calendar plan: {days} days, oneRoom={oneRoom}");
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) Console.WriteLine(reader.GetString(0));
        }
        await db.Database.CloseConnectionAsync();
    }
    if (args.Contains("--calendar-api-check"))
    {
        var sample = await db.Bookings.AsNoTracking()
            .Where(b => b.IsSchoolOverride && b.Status == BookingStatus.Completed)
            .OrderByDescending(b => b.EndTime).FirstAsync();
        var apiConfiguration = new ConfigurationBuilder()
            .AddJsonFile(Path.GetFullPath("backend/src/QuanLyDatPhong_TBD.Api/appsettings.json"))
            .AddJsonFile(Path.GetFullPath("backend/src/QuanLyDatPhong_TBD.Api/appsettings.Development.json"))
            .AddEnvironmentVariables().Build();
        var jwt = apiConfiguration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()!;
        // Synthetic Student subject: no real account impersonation and no writes.
        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(jwt.Issuer, jwt.Audience,
            [new Claim(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub, "calendar-diagnostic-no-account"),
             new Claim(ClaimTypes.Role, "Student")],
            expires: DateTime.UtcNow.AddMinutes(2),
            signingCredentials: new Microsoft.IdentityModel.Tokens.SigningCredentials(
                new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(jwt.SecretKey)),
                Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256));
        using var client = new HttpClient { BaseAddress = new Uri(Environment.GetEnvironmentVariable("CALENDAR_API_URL") ?? "http://localhost:5250"), Timeout = TimeSpan.FromSeconds(30) };
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer",
            new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().WriteToken(token));
        client.DefaultRequestHeaders.Add("ngrok-skip-browser-warning", "true");
        var from = Uri.EscapeDataString(sample.StartTime.Date.ToString("O"));
        var until = Uri.EscapeDataString(sample.EndTime.Date.AddDays(1).ToString("O"));
        using var response = await client.GetAsync($"/api/bookings?startDate={from}&endDate={until}");
        Check(response.IsSuccessStatusCode, "Running API accepts authenticated Student calendar request");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Check(body.RootElement.EnumerateArray().Any(b => b.GetProperty("id").GetInt32() == sample.Id),
            "Running API returns historical completed timetable to Student");
    }
    if (args.Contains("--calendar-inspect"))
    {
        var inspectionTime = DateTime.UtcNow;
        var summary = await db.Bookings.AsNoTracking().Where(b => b.IsSchoolOverride)
            .GroupBy(b => b.Status).Select(g => new { Status = g.Key, Count = g.Count() }).ToListAsync();
        foreach (var row in summary) Console.WriteLine($"Timetable {row.Status}: {row.Count}");
        Console.WriteLine($"Recoverable past timetables: {await db.Bookings.CountAsync(BookingCalendarPolicy.RecoverableTimetable(inspectionTime))}");
        Console.WriteLine($"Past timetables visible to students: {await db.Bookings.Where(BookingCalendarPolicy.VisibleTo("calendar-diagnostic-no-account")).CountAsync(b => b.IsSchoolOverride && b.EndTime < inspectionTime)}");
    }
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToArray();
    Console.WriteLine("Pending migrations: " + string.Join(", ", pending));
    if (args.Contains("--migrate"))
    {
        if (pending.Any(x => !x.EndsWith("_EnforceBookingPolicies") && !x.EndsWith("_AddExtendedBookingPolicies")))
            throw new Exception("Unrelated migrations pending; refusing automatic apply.");
        await db.Database.MigrateAsync();
        Console.WriteLine("Policy migration applied (no application seed).");
    }
    if (args.Contains("--database"))
    {
        if (pending.Length != 0) throw new Exception("Apply migration before database tests.");
        await using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            var store = new BookingPolicyStore(db);
            var initial = await store.GetAsync(default);
            var controller = new BookingSettingsController(db, store) {
                ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext {
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "policy-transaction-test"),
                        new Claim(ClaimTypes.Role, "Admin")], "test")) } }
            };
            var dto = new BookingSettingsDto(14, 30, 2, 2, "07:00", "20:00", [1,2,3,4,5,6], [], initial.Revision);
            Check(await controller.Save(dto, default) is OkObjectResult, "API save writes settings + audit atomically");
            var updated = await store.GetAsync(default);
            Check(updated.MaxHoursPerBooking == 2 && updated.Revision == initial.Revision + 1, "reload reads persisted change");
            Check(BookingPolicy.Validate(updated, 1, now.AddHours(1), now.AddHours(4), now) != null, "persisted 2-hour limit rejects 3-hour booking");
            Check(await controller.Save(dto, default) is ConflictObjectResult, "stale settings revision rejected");
            Check(await controller.Save(dto with { OpenTime = "20:00", CloseTime = "07:00" }, default) is BadRequestObjectResult, "invalid hours rejected");
            Check(await db.AuditLogs.AnyAsync(x => x.ActorUserId == "policy-transaction-test" && x.Action == "UpdateBookingSettings"), "settings change has audit record");
            var user = new ApplicationUser { UserName = "policy-test-" + Guid.NewGuid().ToString("N"), Email = "policy-test@example.invalid" };
            var room = new Room { Name = "POLICY_TRANSACTION_TEST", IsActive = true, Status = RoomStatus.Active, Capacity = 30, RoomType = RoomType.Classroom };
            var lectureHall = new Room { Name = "POLICY_HALL_TEST", IsActive = true, Status = RoomStatus.Active, Capacity = 100, RoomType = RoomType.LectureHall };
            db.Users.Add(user); db.Rooms.Add(room); db.Rooms.Add(lectureHall); await db.SaveChangesAsync();

            var facultyRole = await db.Roles.FirstOrDefaultAsync(r => r.Name == "Faculty");
            if (facultyRole == null) { facultyRole = new IdentityRole("Faculty"); db.Roles.Add(facultyRole); await db.SaveChangesAsync(); }
            var facultyUser = new ApplicationUser { UserName = "policy-faculty-" + Guid.NewGuid().ToString("N"), Email = "policy-faculty@example.invalid" };
            db.Users.Add(facultyUser); await db.SaveChangesAsync();
            db.UserRoles.Add(new IdentityUserRole<string> { UserId = facultyUser.Id, RoleId = facultyRole.Id });
            await db.SaveChangesAsync();

            var bookings = scope.ServiceProvider.GetRequiredService<IBookingService>();
            var start = DateTime.UtcNow.Date.AddDays(2).AddHours(1);
            while (start.DayOfWeek == DayOfWeek.Sunday) start = start.AddDays(1);
            Check(!(await bookings.CreateAsync(user.Id, new(room.Id, start, start.AddHours(3), "Policy test"))).Succeeded,
                "create service rejects duration from DB policy");
            var created = await bookings.CreateAsync(user.Id, new(room.Id, start, start.AddHours(1), "Policy test"));
            Check(created.Succeeded, "valid booking saved in transaction");
            var id = created.Booking!.Id;
            var duplicate = await bookings.CreateAsync(user.Id, new(room.Id, start, start.AddHours(1), "Duplicate test"));
            Check(!duplicate.Succeeded, "server rejects existing overlapping booking");
            Check(!(await bookings.UpdateAsync(id, user.Id, new(start, start.AddHours(3), "Policy test", 1, null, null, null, null, null))).Succeeded,
                "edit service rejects excessive duration");
            var trackedPolicy = await db.BookingSettings.OrderBy(x => x.Id).FirstAsync();
            trackedPolicy.MaxHoursPerBooking = 0.5; await db.SaveChangesAsync();
            Check(!(await bookings.ApproveAsync(id, user.Id, null)).Succeeded, "approval enforces changed policy");
            trackedPolicy.MaxHoursPerBooking = 2; await db.SaveChangesAsync();
            Check((await bookings.ApproveAsync(id, user.Id, null)).Succeeded, "valid approval succeeds");
            trackedPolicy.MinCancelHours = 200; await db.SaveChangesAsync();
            Check(!(await bookings.CancelAsync(id, user.Id, "Test", default)).Succeeded, "cancellation enforces DB cutoff");
            trackedPolicy.MinCancelHours = 2; await db.SaveChangesAsync();
            Check((await bookings.CancelAsync(id, user.Id, "Test", default)).Succeeded, "valid cancellation succeeds");

            // Database test for Auto-approval (Faculty)
            var facStart = start.AddDays(1);
            while (facStart.DayOfWeek == DayOfWeek.Sunday) facStart = facStart.AddDays(1);
            var facCreated = await bookings.CreateAsync(facultyUser.Id, new(room.Id, facStart, facStart.AddHours(1), "Faculty Auto-approve test"));
            Check(facCreated.Succeeded && facCreated.Booking!.Status == BookingStatus.Approved, "Faculty normal room booking is auto-approved");

            // Faculty booking LectureHall requires manual approval
            var facHall = await bookings.CreateAsync(facultyUser.Id, new(lectureHall.Id, facStart.AddHours(2), facStart.AddHours(3), "Faculty Hall test"));
            Check(facHall.Succeeded && facHall.Booking!.Status == BookingStatus.Pending, "Faculty LectureHall booking remains Pending");

            // Database test for Check-in and Check-out
            var checkinRes = await bookings.CheckInAsync(facCreated.Booking!.Id, facultyUser.Id, isManager: true);
            Check(checkinRes.Succeeded && checkinRes.Booking!.Status == BookingStatus.Using, "Check-in succeeds and status changes to Using");
            var checkoutRes = await bookings.CheckOutAsync(facCreated.Booking!.Id, facultyUser.Id, isManager: true, "Finished using");
            Check(checkoutRes.Succeeded && checkoutRes.Booking!.Status == BookingStatus.Completed, "Check-out succeeds and status changes to Completed");

            // Database test for User Quota (MaxPendingBookingsPerUser)
            trackedPolicy.MaxPendingBookingsPerUser = 1; await db.SaveChangesAsync();
            var qStart1 = start.AddDays(2);
            while (qStart1.DayOfWeek == DayOfWeek.Sunday) qStart1 = qStart1.AddDays(1);
            var q1 = await bookings.CreateAsync(user.Id, new(room.Id, qStart1, qStart1.AddHours(1), "Quota test 1"));
            Check(q1.Succeeded, "First pending booking created within quota");
            var q2 = await bookings.CreateAsync(user.Id, new(room.Id, qStart1.AddHours(2), qStart1.AddHours(3), "Quota test 2"));
            Check(!q2.Succeeded && q2.Error!.Contains("đang chờ duyệt"), "Exceeding pending quota is rejected with clear message");
        }
        finally { await transaction.RollbackAsync(); Console.WriteLine("Database test changes rolled back."); }
    }
}
Console.WriteLine($"{passed} checks passed.");
