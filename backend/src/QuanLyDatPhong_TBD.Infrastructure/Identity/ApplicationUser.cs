using Microsoft.AspNetCore.Identity;

namespace QuanLyDatPhong_TBD.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string? FullName { get; set; }
    public string? Department { get; set; }
    public string? UserCode { get; set; }
    public bool IsProfileComplete { get; set; } = false;
}
