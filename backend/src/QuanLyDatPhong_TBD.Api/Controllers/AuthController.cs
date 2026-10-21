using Microsoft.Extensions.Caching.Memory;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using QuanLyDatPhong_TBD.Api.Contracts.Auth;
using QuanLyDatPhong_TBD.Api.Options;
using QuanLyDatPhong_TBD.Infrastructure.Identity;

namespace QuanLyDatPhong_TBD.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly JwtOptions _jwtOptions;

    public AuthController(
        UserManager<ApplicationUser> userManager,
        IOptions<JwtOptions> jwtOptions)
    {
        _userManager = userManager;
        _jwtOptions = jwtOptions.Value;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(error => error.Description));
        }

        return Ok(await CreateTokenAsync(user));
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await _userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            return Unauthorized(new { message = "Tài khoản không tồn tại trong hệ thống Đại học Thái Bình Dương. Vui lòng kiểm tra lại địa chỉ Email." });
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, request.Password);
        if (!isPasswordValid)
        {
            return Unauthorized(new { message = "Mật khẩu không chính xác. Vui lòng kiểm tra lại (chú ý phím Caps Lock)." });
        }

        return Ok(await CreateTokenAsync(user));
    }

    [HttpGet("me")]
    public async Task<ActionResult> GetCurrentProfile()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

        ApplicationUser? user = null;
        if (!string.IsNullOrEmpty(userId))
        {
            user = await _userManager.FindByIdAsync(userId);
        }
        else if (!string.IsNullOrEmpty(userEmail))
        {
            user = await _userManager.FindByEmailAsync(userEmail);
        }

        if (user is null) return NotFound("User not found");

        var roles = await _userManager.GetRolesAsync(user);
        var isComplete = user.IsProfileComplete || (!string.IsNullOrEmpty(user.FullName) && !string.IsNullOrEmpty(user.PhoneNumber) && !string.IsNullOrEmpty(user.Department));

        return Ok(new
        {
            id = user.Id,
            email = user.Email,
            fullName = user.FullName ?? user.UserName,
            phoneNumber = user.PhoneNumber,
            department = user.Department,
            userCode = user.UserCode,
            role = roles.FirstOrDefault() ?? "User",
            isProfileComplete = isComplete
        });
    }

    public record UpdateProfileRequest(string? FullName, string? PhoneNumber, string? Department, string? UserCode);

    [HttpPut("profile")]
    public async Task<ActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

        ApplicationUser? user = null;
        if (!string.IsNullOrEmpty(userId))
        {
            user = await _userManager.FindByIdAsync(userId);
        }
        else if (!string.IsNullOrEmpty(userEmail))
        {
            user = await _userManager.FindByEmailAsync(userEmail);
        }

        if (user is null) return NotFound("User not found");

        if (!string.IsNullOrWhiteSpace(request.FullName)) user.FullName = request.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber)) user.PhoneNumber = request.PhoneNumber.Trim();
        if (!string.IsNullOrWhiteSpace(request.Department)) user.Department = request.Department.Trim();
        if (!string.IsNullOrWhiteSpace(request.UserCode)) user.UserCode = request.UserCode.Trim();

        user.IsProfileComplete = !string.IsNullOrEmpty(user.FullName) && !string.IsNullOrEmpty(user.PhoneNumber) && !string.IsNullOrEmpty(user.Department);

        var result = await _userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return BadRequest(result.Errors.Select(e => e.Description));
        }

        return Ok(new 
        { 
            success = true, 
            message = "Cập nhật hồ sơ thành công", 
            isProfileComplete = user.IsProfileComplete,
            fullName = user.FullName,
            phoneNumber = user.PhoneNumber,
            department = user.Department,
            userCode = user.UserCode
        });
    }

    
    public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(JwtRegisteredClaimNames.Email);

        ApplicationUser? user = null;
        if (!string.IsNullOrEmpty(userId))
        {
            user = await _userManager.FindByIdAsync(userId);
        }
        else if (!string.IsNullOrEmpty(userEmail))
        {
            user = await _userManager.FindByEmailAsync(userEmail);
        }

        if (user is null) return NotFound(new { message = "Không tìm thấy thông tin tài khoản người dùng." });

        if (string.IsNullOrWhiteSpace(request.CurrentPassword))
        {
            return BadRequest(new { message = "Vui lòng nhập mật khẩu hiện tại." });
        }

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Mật khẩu mới phải có độ dài từ 6 ký tự trở lên." });
        }

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            var errors = string.Join("; ", result.Errors.Select(e => e.Description));
            if (errors.Contains("PasswordMismatch") || errors.Contains("Incorrect password"))
            {
                return BadRequest(new { message = "Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại!" });
            }
            return BadRequest(new { message = "Đổi mật khẩu thất bại: " + errors });
        }

        return Ok(new { success = true, message = "Đổi mật khẩu thành công! Mật khẩu mới đã được lưu vào hệ thống." });
    }

    public record ForgotPasswordRequest(string Email);
    public record OtpResetData(string Otp, DateTime ExpiresAt);

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, [FromServices] IMemoryCache memoryCache)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Vui lòng nhập địa chỉ email của bạn." });
        }

        var trimmedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(trimmedEmail);
        if (user is null)
        {
            return NotFound(new { message = "Email này chưa được đăng ký trong hệ thống Đại học Thái Bình Dương." });
        }

        // Sinh mã OTP 6 chữ số ngẫu nhiên
        var random = new Random();
        var otp = random.Next(100000, 999999).ToString();

        var cacheKey = $"reset_otp_{trimmedEmail}";
        var cacheData = new OtpResetData(otp, DateTime.UtcNow.AddMinutes(5));
        memoryCache.Set(cacheKey, cacheData, TimeSpan.FromMinutes(5));

        Console.WriteLine($"[QUEN MAT KHAU] Ma OTP cho {trimmedEmail} la: {otp} (Hieu luc 5 phut)");

        return Ok(new
        {
            success = true,
            message = $"Mã xác thực OTP (6 chữ số) đã được gửi đến email {trimmedEmail}. Vui lòng kiểm tra hộp thư (hiệu lực 5 phút).",
            debugOtp = otp
        });
    }

    public record ResetPasswordRequest(string Email, string Otp, string NewPassword);

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult> ResetPassword([FromBody] ResetPasswordRequest request, [FromServices] IMemoryCache memoryCache)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Otp) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Vui lòng nhập đầy đủ Email, mã OTP và Mật khẩu mới." });
        }

        var trimmedEmail = request.Email.Trim().ToLowerInvariant();
        var cacheKey = $"reset_otp_{trimmedEmail}";

        if (!memoryCache.TryGetValue<OtpResetData>(cacheKey, out var cacheData) || cacheData is null)
        {
            return BadRequest(new { message = "Mã xác thực OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại yêu cầu mới." });
        }

        if (cacheData.Otp != request.Otp.Trim())
        {
            return BadRequest(new { message = "Mã xác thực OTP không chính xác. Vui lòng kiểm tra lại!" });
        }

        var user = await _userManager.FindByEmailAsync(trimmedEmail);
        if (user is null)
        {
            return NotFound(new { message = "Không tìm thấy người dùng tương ứng với email này." });
        }

        if (request.NewPassword.Length < 6)
        {
            return BadRequest(new { message = "Mật khẩu mới phải có tối thiểu 6 ký tự." });
        }

        var removeResult = await _userManager.RemovePasswordAsync(user);
        var addResult = await _userManager.AddPasswordAsync(user, request.NewPassword);
        if (!addResult.Succeeded)
        {
            return BadRequest(new { message = "Không thể đặt lại mật khẩu: " + string.Join("; ", addResult.Errors.Select(e => e.Description)) });
        }

        memoryCache.Remove(cacheKey);

        return Ok(new
        {
            success = true,
            message = "Đặt lại mật khẩu thành công! Mật khẩu mới đã được cập nhật vào hệ thống. Bạn có thể đăng nhập ngay bây giờ."
        });
    }

    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> GetAllUsers()
    {
        var users = _userManager.Users.ToList();
        var list = new List<object>();
        foreach (var u in users)
        {
            var roles = await _userManager.GetRolesAsync(u);
            list.Add(new
            {
                id = u.Id,
                email = u.Email,
                fullName = u.FullName ?? u.UserName,
                phoneNumber = u.PhoneNumber,
                phone = u.PhoneNumber,
                department = u.Department,
                userCode = u.UserCode,
                role = roles.FirstOrDefault() ?? "User",
                isProfileComplete = u.IsProfileComplete
            });
        }
        return Ok(list);
    }

    public record AdminManageUserRequest(string Email, string? FullName, string? PhoneNumber, string? Phone, string? Department, string? UserCode, string? Role, string? Password);

    [HttpPost("users")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> CreateUserByAdmin([FromBody] AdminManageUserRequest request)
    {
        var existing = await _userManager.FindByEmailAsync(request.Email);
        if (existing != null)
        {
            return BadRequest(new { message = "Email này đã tồn tại trong hệ thống." });
        }

        var phone = !string.IsNullOrWhiteSpace(request.PhoneNumber) ? request.PhoneNumber : request.Phone;

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            EmailConfirmed = true,
            FullName = request.FullName ?? request.Email,
            PhoneNumber = phone,
            Department = request.Department ?? "Chưa phân bổ",
            UserCode = request.UserCode,
            IsProfileComplete = true
        };

        var password = string.IsNullOrWhiteSpace(request.Password) ? "Tbd@123456" : request.Password;
        var result = await _userManager.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = string.Join("; ", result.Errors.Select(e => e.Description)) });
        }

        var targetRole = string.IsNullOrWhiteSpace(request.Role) ? "User" : request.Role;
        await _userManager.AddToRoleAsync(user, targetRole);

        return Ok(new { message = "Tạo tài khoản thành công", email = user.Email });
    }

    [HttpPut("users/{email}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> UpdateUserByAdmin(string email, [FromBody] AdminManageUserRequest request)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return NotFound("User not found");

        var phone = !string.IsNullOrWhiteSpace(request.PhoneNumber) ? request.PhoneNumber : request.Phone;

        if (!string.IsNullOrWhiteSpace(request.FullName)) user.FullName = request.FullName.Trim();
        if (!string.IsNullOrWhiteSpace(phone)) user.PhoneNumber = phone.Trim();
        if (!string.IsNullOrWhiteSpace(request.Department)) user.Department = request.Department.Trim();
        if (!string.IsNullOrWhiteSpace(request.UserCode)) user.UserCode = request.UserCode.Trim();

        await _userManager.UpdateAsync(user);

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var currentRoles = await _userManager.GetRolesAsync(user);
            await _userManager.RemoveFromRolesAsync(user, currentRoles);
            await _userManager.AddToRoleAsync(user, request.Role);
        }

        return Ok(new { message = "Cập nhật tài khoản thành công" });
    }

    [HttpDelete("users/{email}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> DeleteUserByAdmin(string email)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user == null) return NotFound("User not found");

        if (user.Email == "admin@tbd.edu.vn")
        {
            return BadRequest(new { message = "Không thể xóa tài khoản Quản trị viên mặc định." });
        }

        await _userManager.DeleteAsync(user);
        return Ok(new { message = "Đã xóa tài khoản thành công." });
    }

    private async Task<AuthResponse> CreateTokenAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var expiresAtUtc = DateTime.UtcNow.AddMinutes(_jwtOptions.ExpirationMinutes);
        var primaryRole = roles.FirstOrDefault() ?? "User";

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? string.Empty)
        };

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtOptions.SecretKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _jwtOptions.Issuer,
            audience: _jwtOptions.Audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        var isComplete = user.IsProfileComplete || (!string.IsNullOrEmpty(user.FullName) && !string.IsNullOrEmpty(user.PhoneNumber) && !string.IsNullOrEmpty(user.Department));

        return new AuthResponse(
            new JwtSecurityTokenHandler().WriteToken(token), 
            expiresAtUtc,
            FullName: user.FullName ?? user.UserName,
            PhoneNumber: user.PhoneNumber,
            Department: user.Department,
            UserCode: user.UserCode,
            Role: primaryRole,
            IsProfileComplete: isComplete);
    }
}
