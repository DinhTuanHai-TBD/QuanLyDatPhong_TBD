using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QuanLyDatPhong_TBD.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddExtendedBookingPolicies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StudentMaxAdvanceDays",
                table: "BookingSettings",
                type: "integer",
                nullable: false,
                defaultValue: 7);

            migrationBuilder.AddColumn<double>(
                name: "StudentMaxHoursPerBooking",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 3.0);

            migrationBuilder.AddColumn<int>(
                name: "FacultyMaxAdvanceDays",
                table: "BookingSettings",
                type: "integer",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<double>(
                name: "FacultyMaxHoursPerBooking",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 8.0);

            migrationBuilder.AddColumn<bool>(
                name: "AutoApproveForFaculty",
                table: "BookingSettings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxPendingBookingsPerUser",
                table: "BookingSettings",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<double>(
                name: "MaxBookedHoursPerUserPerWeek",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 20.0);

            migrationBuilder.AddColumn<double>(
                name: "ApprovalReminderHours",
                table: "BookingSettings",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "StudentMaxAdvanceDays",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "StudentMaxHoursPerBooking",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "FacultyMaxAdvanceDays",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "FacultyMaxHoursPerBooking",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "AutoApproveForFaculty",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "MaxPendingBookingsPerUser",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "MaxBookedHoursPerUserPerWeek",
                table: "BookingSettings");

            migrationBuilder.DropColumn(
                name: "ApprovalReminderHours",
                table: "BookingSettings");
        }
    }
}
