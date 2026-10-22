using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Dtos;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

namespace ResortWithJeena.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    JwtService jwt,
    OtpService otp,
    SettingsService settings,
    IEmailSender email,
    ILogger<AuthController> log) : ControllerBase
{
    // ------------------------------------------------------------- register

    [HttpPost("register")]
    [ProducesResponseType(200)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { message = "Please enter your full name." });
        if (req.Password != req.ConfirmPassword)
            return BadRequest(new { message = "The two passwords do not match." });
        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters long." });

        var address = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == address))
            return Conflict(new { message = "An account with this email already exists. Please sign in instead." });

        var requireOtp = await settings.GetBoolAsync("email.requireOtpOnRegister", true);

        var user = new User
        {
            FullName = req.FullName.Trim(),
            Email = address,
            Phone = req.Phone?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = Roles.Customer,
            IsEmailVerified = !requireOtp,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        log.LogInformation("New {Role} registered: {Email}", user.Role, user.Email);

        if (!requireOtp)
        {
            user.LastLoginAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            var (token, expires) = jwt.CreateToken(user, false);
            return Ok(new
            {
                requiresOtp = false,
                message = "Account created. Welcome aboard!",
                token,
                expiresAtUtc = expires,
                user = Summary(user)
            });
        }

        var issue = await otp.IssueAsync(user.Email, OtpPurposes.Register, user.FullName);
        var smtpConfigured = await email.IsConfiguredAsync() && !await email.DevModeAsync();

        return Ok(new
        {
            requiresOtp = true,
            email = user.Email,
            message = smtpConfigured
                ? $"We emailed a {await settings.GetIntAsync("email.otpLength", 6)} digit code to {user.Email}. It expires in {issue.ExpiryMinutes} minutes."
                : $"SMTP is not configured yet, so the code is shown here and printed in the server console. Code: {issue.DevCode}",
            pendingToken = jwt.CreatePendingToken(user.Email),
            devOtp = issue.DevCode,
            smtpConfigured
        });
    }

    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);
        if (user is null) return NotFound(new { message = "No account found for this email." });
        if (!user.IsActive) return StatusCode(403, new { message = "This account has been disabled." });
        if (user.IsEmailVerified) return Ok(new { message = "This email is already verified.", alreadyVerified = true });

        var (ok, error) = await otp.VerifyAsync(address, OtpPurposes.Register, req.Code);
        if (!ok) return BadRequest(new { message = error });

        user.IsEmailVerified = true;
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var (token, expires) = jwt.CreateToken(user, false);
        return Ok(new
        {
            requiresOtp = false,
            message = "Email verified. Welcome to " + await settings.GetAsync("site.name", "the resort") + "!",
            token,
            expiresAtUtc = expires,
            user = Summary(user)
        });
    }

    [HttpPost("resend-otp")]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var purpose = string.IsNullOrWhiteSpace(req.Purpose) ? OtpPurposes.Register : req.Purpose;

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);
        if (user is null) return NotFound(new { message = "No account found for this email." });
        if (purpose == OtpPurposes.Register && user.IsEmailVerified)
            return BadRequest(new { message = "This email is already verified. Please sign in." });

        var issue = await otp.IssueAsync(address, purpose, user.FullName);
        return Ok(new
        {
            message = issue.EmailSent
                ? "A fresh code is on its way to your inbox."
                : "SMTP is not configured, so the code is shown here.",
            devOtp = issue.DevCode,
            expiryMinutes = issue.ExpiryMinutes
        });
    }

    // ---------------------------------------------------------------- login

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);

        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
        {
            log.LogWarning("Failed sign in attempt for {Email}", address);
            return Unauthorized(new { message = "Incorrect email or password." });
        }

        if (!user.IsActive)
            return StatusCode(403, new { message = "This account has been disabled. Please contact the resort." });

        if (!user.IsEmailVerified)
        {
            var issue = await otp.IssueAsync(user.Email, OtpPurposes.Register, user.FullName);
            return StatusCode(403, new
            {
                message = "Your email is not verified yet. We have sent a new code.",
                requiresOtp = true,
                email = user.Email,
                pendingToken = jwt.CreatePendingToken(user.Email),
                devOtp = issue.DevCode
            });
        }

        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var (token, expires) = jwt.CreateToken(user, req.RememberMe);

        // Password login never asks for an OTP - it goes straight to a JWT.
        return Ok(new
        {
            message = $"Welcome back, {user.FullName.Split(' ')[0]}!",
            token,
            expiresAtUtc = expires,
            user = Summary(user)
        });
    }

    // ----------------------------------------------------------- password

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);
        if (user is null)
            return Ok(new { message = "If that email exists in our records, a reset code has been sent." });

        var issue = await otp.IssueAsync(address, OtpPurposes.ResetPassword, user.FullName);
        return Ok(new
        {
            message = issue.EmailSent
                ? "A reset code has been sent to your email."
                : "SMTP is not configured, so the reset code is shown here.",
            devOtp = issue.DevCode,
            expiryMinutes = issue.ExpiryMinutes
        });
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == address);
        if (user is null) return NotFound(new { message = "No account found for this email." });

        var (ok, error) = await otp.VerifyAsync(address, OtpPurposes.ResetPassword, req.Code);
        if (!ok) return BadRequest(new { message = error });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await db.SaveChangesAsync();
        return Ok(new { message = "Password updated. You can sign in now." });
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        var user = await CurrentUserAsync();
        if (user is null) return Unauthorized();
        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Your current password is not correct." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await db.SaveChangesAsync();
        return Ok(new { message = "Password changed successfully." });
    }

    // -------------------------------------------------------------- profile

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await CurrentUserAsync();
        return user is null ? Unauthorized() : Ok(Summary(user));
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] ProfileUpdateRequest req)
    {
        var user = await CurrentUserAsync();
        if (user is null) return Unauthorized();

        user.FullName = req.FullName.Trim();
        user.Phone = req.Phone?.Trim();
        if (!string.IsNullOrWhiteSpace(req.AvatarUrl)) user.AvatarUrl = req.AvatarUrl;
        await db.SaveChangesAsync();
        return Ok(new { message = "Profile updated.", user = Summary(user) });
    }

    // --------------------------------------------------------------- shared

    private async Task<User?> CurrentUserAsync()
    {
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(idClaim, out var id)) return null;
        return await db.Users.FirstOrDefaultAsync(u => u.Id == id);
    }

    public static UserSummary Summary(User u) => new(
        u.Id, u.FullName, u.Email, u.Phone, u.Role,
        u.IsEmailVerified, u.IsActive, u.AvatarUrl, u.CreatedAt, u.LastLoginAt);
}
