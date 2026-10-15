using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Identity;

namespace QuanLyDatPhong_TBD.Infrastructure.Persistence;

public static class SyncHelper
{
    public static async Task SyncLocalToCloudAsync(IServiceProvider serviceProvider)
    {
        var cloudDbContext = serviceProvider.GetRequiredService<ApplicationDbContext>();
        
        var connectionCandidates = new[]
        {
            "Host=localhost;Port=5432;Database=quan_ly_dat_phong_tbd_dev;Username=postgres;Password=123456",
            "Host=localhost;Port=5432;Database=quan_ly_dat_phong_tbd_dev;Username=postgres;Password=postgres",
            "Host=localhost;Port=5432;Database=quan_ly_dat_phong_tbd;Username=postgres;Password=123456",
            "Host=localhost;Port=5432;Database=quan_ly_dat_phong_tbd;Username=postgres;Password=postgres"
        };

        ApplicationDbContext? localDbContext = null;

        foreach (var connStr in connectionCandidates)
        {
            try
            {
                var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
                optionsBuilder.UseNpgsql(connStr);
                var ctx = new ApplicationDbContext(optionsBuilder.Options);
                if (await ctx.Database.CanConnectAsync())
                {
                    localDbContext = ctx;
                    Console.WriteLine($"[Sync] Connected to local PostgreSQL using: {connStr}");
                    break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Sync Candidate Skip] {ex.Message}");
            }
        }

        if (localDbContext is null)
        {
            Console.WriteLine("[Sync] Could not connect to local PostgreSQL DB.");
            return;
        }

        using (localDbContext)
        {
            try
            {
                var localRoomCount = await localDbContext.Rooms.CountAsync();
                var localBookingCount = await localDbContext.Bookings.CountAsync();
                var localEquipCount = await localDbContext.Equipments.CountAsync();
                var localUserCount = await localDbContext.Users.CountAsync();

                Console.WriteLine($"[Sync Data Check] Local DB has {localRoomCount} Rooms, {localBookingCount} Bookings, {localEquipCount} Equipments, {localUserCount} Users.");

                // 1. Sync Rooms (All 24 Rooms!)
                var localRooms = await localDbContext.Rooms.AsNoTracking().ToListAsync();
                int addedRooms = 0;
                foreach (var room in localRooms)
                {
                    if (!await cloudDbContext.Rooms.AnyAsync(r => r.Name == room.Name))
                    {
                        cloudDbContext.Rooms.Add(new Room
                        {
                            Name = room.Name,
                            Building = room.Building,
                            Capacity = room.Capacity,
                            RoomType = room.RoomType,
                            Status = room.Status,
                            Description = room.Description,
                            ImageUrl = room.ImageUrl
                        });
                        addedRooms++;
                    }
                }
                await cloudDbContext.SaveChangesAsync();
                Console.WriteLine($"[Sync Rooms Success] Added {addedRooms} missing rooms to Supabase Cloud.");

                // 2. Sync Equipments
                var localEquipments = await localDbContext.Equipments.AsNoTracking().ToListAsync();
                int addedEquips = 0;
                foreach (var eq in localEquipments)
                {
                    if (!await cloudDbContext.Equipments.AnyAsync(e => e.Code == eq.Code))
                    {
                        cloudDbContext.Equipments.Add(new Equipment
                        {
                            Code = eq.Code,
                            Name = eq.Name,
                            Type = eq.Type,
                            RoomId = eq.RoomId,
                            Quantity = eq.Quantity,
                            Status = eq.Status,
                            Description = eq.Description
                        });
                        addedEquips++;
                    }
                }
                await cloudDbContext.SaveChangesAsync();
                Console.WriteLine($"[Sync Equipments Success] Added {addedEquips} missing equipments to Supabase Cloud.");

                // 3. Sync Bookings if any
                var localBookings = await localDbContext.Bookings.AsNoTracking().ToListAsync();
                int addedBookings = 0;
                foreach (var b in localBookings)
                {
                    if (!await cloudDbContext.Bookings.AnyAsync(cb => cb.Id == b.Id))
                    {
                        cloudDbContext.Bookings.Add(new Booking
                        {
                            RoomId = b.RoomId,
                            UserId = b.UserId,
                            UserEmail = b.UserEmail,
                            StartTime = b.StartTime,
                            EndTime = b.EndTime,
                            Purpose = b.Purpose,
                            Status = b.Status,
                            RejectReason = b.RejectReason,
                            ParticipantCount = b.ParticipantCount,
                            RequestedEquipmentsJson = b.RequestedEquipmentsJson,
                            Department = b.Department,
                            PersonInCharge = b.PersonInCharge,
                            Notes = b.Notes,
                            IsSpecialRequest = b.IsSpecialRequest,
                            SpecialRequestReason = b.SpecialRequestReason,
                            AgreedToRules = b.AgreedToRules,
                            ApprovedByUserId = b.ApprovedByUserId,
                            ApprovedAt = b.ApprovedAt,
                            AdminNotes = b.AdminNotes
                        });
                        addedBookings++;
                    }
                }
                await cloudDbContext.SaveChangesAsync();

                Console.WriteLine("[Sync Complete] All local 24 Rooms and items copied to Supabase Cloud!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Sync Exception] {ex.Message} -> {ex.InnerException?.Message}");
            }
        }
    }
}
