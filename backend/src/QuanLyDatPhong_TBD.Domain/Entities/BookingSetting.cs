namespace QuanLyDatPhong_TBD.Domain.Entities;

public class BookingSetting
{
    public int Id { get; set; }
    public TimeSpan OpenTime { get; set; } = new(7, 0, 0);
    public TimeSpan CloseTime { get; set; } = new(20, 0, 0);
    public int MinAdvanceMinutes { get; set; } = 30;
    public int MaxAdvanceDays { get; set; } = 14;
    public double MaxHoursPerBooking { get; set; } = 4;
    public double MinCancelHours { get; set; } = 2;
    public int[] WorkingDays { get; set; } = [1, 2, 3, 4, 5, 6];
    public string ClosedPeriodsJson { get; set; } = "[]";
    public int Revision { get; set; }
    public int CheckInGraceMinutes { get; set; } = 15;

    // Extended policies for items 7 to 11
    public int StudentMaxAdvanceDays { get; set; } = 7;
    public double StudentMaxHoursPerBooking { get; set; } = 3.0;
    public int FacultyMaxAdvanceDays { get; set; } = 30;
    public double FacultyMaxHoursPerBooking { get; set; } = 8.0;
    public bool AutoApproveForFaculty { get; set; } = true;
    public int MaxPendingBookingsPerUser { get; set; } = 3;
    public double MaxBookedHoursPerUserPerWeek { get; set; } = 20.0;
    public double ApprovalReminderHours { get; set; } = 1.0;
}
