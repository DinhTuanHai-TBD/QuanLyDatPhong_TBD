namespace QuanLyDatPhong_TBD.Api.Contracts.Auth;

public sealed record AuthResponse(
    string AccessToken, 
    DateTime ExpiresAtUtc, 
    string? FullName = null, 
    string? PhoneNumber = null, 
    string? Department = null, 
    string? UserCode = null, 
    string? Role = null, 
    bool IsProfileComplete = true);
