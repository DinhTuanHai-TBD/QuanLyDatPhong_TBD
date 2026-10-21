using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using QuanLyDatPhong_TBD.Domain.Entities;
using QuanLyDatPhong_TBD.Infrastructure.Identity;

namespace QuanLyDatPhong_TBD.Infrastructure.Persistence;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Equipment> Equipments => Set<Equipment>();
    public DbSet<RoomEquipment> RoomEquipments => Set<RoomEquipment>();
    public DbSet<EquipmentIssue> EquipmentIssues => Set<EquipmentIssue>();
    public DbSet<UserPenalty> UserPenalties => Set<UserPenalty>();
    public DbSet<BookingSetting> BookingSettings => Set<BookingSetting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<BookingSetting>().Property(x => x.Revision).IsConcurrencyToken();

        builder.Entity<Room>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Building).HasMaxLength(100);
            entity.Property(x => x.ImageUrl).HasColumnType("text");
            entity.Property(x => x.MapImageUrl).HasMaxLength(500);
            entity.Property(x => x.Description).HasMaxLength(1000);
        });

        builder.Entity<Booking>(entity =>
        {
            entity.Property(x => x.Purpose).HasMaxLength(1000);
            entity.Property(x => x.RejectReason).HasMaxLength(1000);
            entity.Property(x => x.Department).HasMaxLength(200);
            entity.Property(x => x.PersonInCharge).HasMaxLength(200);
            entity.Property(x => x.Notes).HasMaxLength(1000);
            entity.Property(x => x.SpecialRequestReason).HasMaxLength(1000);
            entity.Property(x => x.CheckoutNotes).HasMaxLength(1000);
            entity.Property(x => x.AdminNotes).HasMaxLength(1000);

            entity.HasOne(x => x.Room)
                .WithMany(x => x.Bookings)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Equipment>(entity =>
        {
            entity.Property(x => x.Code).HasMaxLength(50);
            entity.Property(x => x.Name).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Type).HasMaxLength(100);
            entity.Property(x => x.Status).HasMaxLength(50);
            entity.Property(x => x.Description).HasMaxLength(1000);
            entity.Property(x => x.IssueNotes).HasMaxLength(1000);

            entity.HasOne(x => x.Room)
                .WithMany(x => x.Equipments)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<EquipmentIssue>(entity =>
        {
            entity.Property(x => x.IssueType).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Priority).HasMaxLength(50);
            entity.Property(x => x.Severity).HasMaxLength(50);
            entity.Property(x => x.Description).HasMaxLength(2000).IsRequired();
            entity.Property(x => x.ImageUrl).HasMaxLength(500);
            entity.Property(x => x.Status).HasMaxLength(50).IsRequired();
            entity.Property(x => x.AssignedTo).HasMaxLength(200);
            entity.Property(x => x.AdminNotes).HasMaxLength(1000);
            entity.Property(x => x.RepairNotes).HasMaxLength(1000);

            entity.HasOne(x => x.Room)
                .WithMany(x => x.EquipmentIssues)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(x => x.Equipment)
                .WithMany(x => x.EquipmentIssues)
                .HasForeignKey(x => x.EquipmentId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(x => x.Booking)
                .WithMany(x => x.EquipmentIssues)
                .HasForeignKey(x => x.BookingId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        builder.Entity<RoomEquipment>(entity =>
        {
            entity.HasIndex(x => new { x.RoomId, x.EquipmentId }).IsUnique();
            entity.HasOne(x => x.Room)
                .WithMany(x => x.RoomEquipments)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(x => x.Equipment)
                .WithMany(x => x.RoomEquipments)
                .HasForeignKey(x => x.EquipmentId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<AuditLog>(entity =>
        {
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ActorUserId).HasMaxLength(450);
            entity.Property(x => x.ActorUserName).HasMaxLength(256);
            entity.Property(x => x.TargetType).HasMaxLength(100);
            entity.Property(x => x.TargetId).HasMaxLength(100);
            entity.Property(x => x.Note).HasColumnType("text");
        });

        builder.Entity<Notification>(entity =>
        {
            entity.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.Title).HasMaxLength(200).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(1000).IsRequired();
            entity.HasIndex(x => new { x.UserId, x.CreatedAt });
        });

        builder.Entity<UserPenalty>(entity =>
        {
            entity.Property(x => x.UserId).HasMaxLength(450).IsRequired();
            entity.Property(x => x.Reason).HasMaxLength(1000);
        });
    }
}
