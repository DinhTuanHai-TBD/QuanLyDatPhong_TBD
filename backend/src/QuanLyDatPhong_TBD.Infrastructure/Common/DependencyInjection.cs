using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuanLyDatPhong_TBD.Application.Rooms;
using QuanLyDatPhong_TBD.Application.Bookings;
using QuanLyDatPhong_TBD.Application.LegacyImport;
using QuanLyDatPhong_TBD.Application.Notifications;
using QuanLyDatPhong_TBD.Infrastructure.Bookings;
using QuanLyDatPhong_TBD.Infrastructure.LegacyImport;
using QuanLyDatPhong_TBD.Infrastructure.Notifications;
using QuanLyDatPhong_TBD.Infrastructure.Identity;
using QuanLyDatPhong_TBD.Infrastructure.Persistence;
using QuanLyDatPhong_TBD.Infrastructure.Rooms;

namespace QuanLyDatPhong_TBD.Infrastructure.Common;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

        // Bound each connection/query attempt; preserve explicit deployment settings and TLS.
        var connectionOptions = new Npgsql.NpgsqlConnectionStringBuilder(connectionString);
        if (!connectionOptions.ContainsKey("Timeout")) connectionOptions.Timeout = 15;
        if (!connectionOptions.ContainsKey("Command Timeout")) connectionOptions.CommandTimeout = 30;
        if (!connectionOptions.ContainsKey("KeepAlive")) connectionOptions.KeepAlive = 30;

        services.AddDbContext<ApplicationDbContext>(options =>
            options.UseNpgsql(connectionOptions.ConnectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(2),
                    errorCodesToAdd: null);
            })
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning)));

        services
            .AddIdentityCore<ApplicationUser>(options =>
            {
                options.SignIn.RequireConfirmedAccount = false;
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireUppercase = false;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            ;

        services.AddScoped<IRoomReadService, RoomReadService>();
        services.AddScoped<IBookingService, BookingService>();
        services.AddScoped<QuanLyDatPhong_TBD.Infrastructure.Policies.BookingPolicyStore>();
        services.AddScoped<INotificationService, NotificationService>();
        services.Configure<LegacyImportOptions>(configuration.GetSection(LegacyImportOptions.SectionName));
        services.AddScoped<ILegacyDataImportService, LegacyDataImportService>();

        return services;
    }
}
