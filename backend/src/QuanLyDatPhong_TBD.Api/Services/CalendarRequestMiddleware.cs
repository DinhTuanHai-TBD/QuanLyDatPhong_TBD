using System.Diagnostics;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace QuanLyDatPhong_TBD.Api.Services;

public sealed class CalendarRequestMiddleware(RequestDelegate next, ILogger<CalendarRequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/api"))
        {
            await next(context);
            return;
        }
        var timer = Stopwatch.StartNew();
        try { await next(context); }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogDebug("API request {TraceId} cancelled by client", context.TraceIdentifier);
            if (!context.Response.HasStarted) context.Response.StatusCode = 499;
        }
        catch (Exception ex) when (!context.Response.HasStarted &&
            (ex is OperationCanceledException or TimeoutException or DbException or DbUpdateException))
        {
            // Log types/codes, not exception messages or SQL that could contain user data.
            var cause = ex;
            var types = new List<string>();
            string? sqlState = null;
            while (true) {
                types.Add(cause.GetType().Name);
                if (cause is PostgresException pg) sqlState = pg.SqlState;
                if (cause.InnerException is null) break;
                cause = cause.InnerException;
            }
            var unavailable = sqlState is null || sqlState.StartsWith("08") || sqlState.StartsWith("53") || sqlState == "57P01";
            logger.LogError("API {Method} {Path} request {TraceId} failed after {ElapsedMs} ms: {Types}; SQLSTATE {SqlState}",
                context.Request.Method, context.Request.Path, context.TraceIdentifier,
                timer.ElapsedMilliseconds, string.Join(" -> ", types), sqlState);
            context.Response.Clear();
            context.Response.StatusCode = unavailable ? 503 : 500;
            var read = HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method);
            await context.Response.WriteAsJsonAsync(new {
                message = read ? "Không thể tải dữ liệu từ máy chủ. Vui lòng thử lại."
                    : "Chưa xác nhận được kết quả lưu. Vui lòng tải lại dữ liệu để kiểm tra trước khi thử lại.",
                code = unavailable ? "DATABASE_UNAVAILABLE" : "DATABASE_ERROR",
                traceId = context.TraceIdentifier,
                outcomeUnknown = !read
            }, CancellationToken.None);
        }
        finally
        {
            if (timer.ElapsedMilliseconds >= 2000)
                logger.LogWarning("Slow API request {TraceId}: {ElapsedMs} ms, HTTP {Status}",
                    context.TraceIdentifier, timer.ElapsedMilliseconds, context.Response.StatusCode);
        }
    }
}
