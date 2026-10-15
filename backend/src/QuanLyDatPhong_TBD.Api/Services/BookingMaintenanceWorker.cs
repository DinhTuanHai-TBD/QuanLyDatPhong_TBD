using QuanLyDatPhong_TBD.Application.Bookings;

namespace QuanLyDatPhong_TBD.Api.Services;

// Run once per API instance, sequentially, outside HTTP request lifetimes.
public sealed class BookingMaintenanceWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<BookingMaintenanceWorker> logger,
    IConfiguration configuration) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("BookingMaintenance:Enabled", true)) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var bookings = scope.ServiceProvider.GetRequiredService<IBookingService>();
                await bookings.ProcessAutoExpirationAndRemindersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Booking maintenance failed; retrying in five minutes.");
            }

            try { await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
