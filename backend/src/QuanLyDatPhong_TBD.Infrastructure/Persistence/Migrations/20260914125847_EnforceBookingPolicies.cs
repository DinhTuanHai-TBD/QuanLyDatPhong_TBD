using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuanLyDatPhong_TBD.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnforceBookingPolicies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ClosedPeriodsJson",
                table: "BookingSettings",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<double>(
                name: "MaxHoursPerBooking",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 4.0);

            migrationBuilder.AddColumn<double>(
                name: "MinCancelHours",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 2.0);

            migrationBuilder.AddColumn<int>(
                name: "Revision",
                table: "BookingSettings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int[]>(
                name: "WorkingDays",
                table: "BookingSettings",
                type: "integer[]",
                nullable: false,
                defaultValue: new[] { 1, 2, 3, 4, 5, 6 });

            migrationBuilder.AlterColumn<string>(
                name: "Note",
                table: "AuditLogs",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000,
                oldNullable: true);
            migrationBuilder.Sql("""
                UPDATE "BookingSettings" SET "OpenTime" = TIME '07:00', "CloseTime" = TIME '20:00';
                INSERT INTO "BookingSettings" ("OpenTime", "CloseTime", "MinAdvanceMinutes", "MaxAdvanceDays", "CheckInGraceMinutes", "ClosedPeriodsJson", "MaxHoursPerBooking", "MinCancelHours", "Revision", "WorkingDays")
                SELECT TIME '07:00', TIME '20:00', 30, 14, 15, '[]', 4, 2, 0, ARRAY[1,2,3,4,5,6]
                WHERE NOT EXISTS (SELECT 1 FROM "BookingSettings");
                """);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ClosedPeriodsJson",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "MaxHoursPerBooking",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "MinCancelHours",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "WorkingDays",
                table: "BookingSettings");

            migrationBuilder.AlterColumn<string>(
                name: "Note",
                table: "AuditLogs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);
        }
    }
}
