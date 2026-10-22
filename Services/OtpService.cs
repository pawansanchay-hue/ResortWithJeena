using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Services;

public record OtpIssue(bool Success, string? DevCode, bool EmailSent, string? Error, int ExpiryMinutes);

public class OtpService(AppDbContext db, SettingsService settings, IEmailSender email, ILogger<OtpService> log)
{
    public const int MaxAttempts = 5;

    public async Task<OtpIssue> IssueAsync(string emailAddress, string purpose, string displayName = "")
    {
        var address = emailAddress.Trim().ToLowerInvariant();
        var length = Math.Clamp(await settings.GetIntAsync("email.otpLength", 6), 4, 8);
        var minutes = Math.Clamp(await settings.GetIntAsync("email.otpExpiryMinutes", 10), 1, 120);

        // Invalidate previous live codes for the same purpose.
        var previous = await db.OtpCodes
            .Where(o => o.Email == address && o.Purpose == purpose && o.ConsumedAt == null)
            .ToListAsync();
        foreach (var p in previous) p.ConsumedAt = DateTime.UtcNow;

        var code = GenerateCode(length);
        db.OtpCodes.Add(new OtpCode
        {
            Email = address,
            CodeHash = Hash(code),
            Purpose = purpose,
            ExpiresAt = DateTime.UtcNow.AddMinutes(minutes),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var siteName = await settings.GetAsync("site.name", "Our Resort");
        var greeting = string.IsNullOrWhiteSpace(displayName) ? "Hello" : $"Hello {displayName}";
        var purposeText = purpose == OtpPurposes.ResetPassword
            ? "reset your password"
            : "verify your email address";

        var html = BuildEmail(siteName, greeting, purposeText, code, minutes);

        var result = await email.SendAsync(address, $"{code} is your {siteName} verification code", html, displayName);
        var devMode = await email.DevModeAsync();

        return new OtpIssue(true, devMode || !result.Sent ? code : null, result.Sent, result.Error, minutes);
    }

    public async Task<(bool Ok, string? Error)> VerifyAsync(string emailAddress, string purpose, string code)
    {
        var address = emailAddress.Trim().ToLowerInvariant();
        var supplied = (code ?? "").Trim();

        var row = await db.OtpCodes
            .Where(o => o.Email == address && o.Purpose == purpose && o.ConsumedAt == null)
            .OrderByDescending(o => o.Id)
            .FirstOrDefaultAsync();

        if (row is null) return (false, "No verification code found. Please request a new one.");
        if (row.ExpiresAt < DateTime.UtcNow) return (false, "This code has expired. Please request a new one.");
        if (row.Attempts >= MaxAttempts) return (false, "Too many incorrect attempts. Please request a new code.");

        if (!FixedTimeEquals(row.CodeHash, Hash(supplied)))
        {
            row.Attempts++;
            await db.SaveChangesAsync();
            var left = Math.Max(0, MaxAttempts - row.Attempts);
            return (false, $"That code is not correct. {left} attempt(s) remaining.");
        }

        row.ConsumedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<int> CleanupAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-2);
        var dead = await db.OtpCodes.Where(o => o.CreatedAt < cutoff).ToListAsync();
        if (dead.Count == 0) return 0;
        db.OtpCodes.RemoveRange(dead);
        await db.SaveChangesAsync();
        log.LogInformation("Cleaned up {Count} expired OTP records.", dead.Count);
        return dead.Count;
    }

    private static string GenerateCode(int length)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
            chars[i] = (char)('0' + RandomNumberGenerator.GetInt32(0, 10));
        return new string(chars);
    }

    private static string Hash(string code)
    {
        var bytes = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes("jeena-otp::" + code));
        return Convert.ToHexString(bytes);
    }

    private static bool FixedTimeEquals(string a, string b)
    {
        var ba = System.Text.Encoding.UTF8.GetBytes(a);
        var bb = System.Text.Encoding.UTF8.GetBytes(b);
        return CryptographicOperations.FixedTimeEquals(ba, bb);
    }

    private static string BuildEmail(string siteName, string greeting, string purposeText, string code, int minutes) => $"""
        <!doctype html>
        <html><body style="margin:0;padding:0;background:#f4f1ea;font-family:Segoe UI,Arial,sans-serif;color:#22332c">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.08)">
              <tr><td style="background:#0f5132;padding:26px 32px;color:#fff;font-size:22px;font-weight:600">{siteName}</td></tr>
              <tr><td style="padding:32px">
                <p style="margin:0 0 12px;font-size:17px">{greeting},</p>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6">
                  Use the code below to {purposeText}. It expires in {minutes} minutes.
                </p>
                <div style="text-align:center;margin:0 0 24px">
                  <span style="display:inline-block;letter-spacing:10px;font-size:34px;font-weight:700;color:#0f5132;background:#f0f5f2;border:1px dashed #9dbfae;border-radius:12px;padding:16px 26px 16px 36px">{code}</span>
                </div>
                <p style="margin:0 0 8px;font-size:14px;color:#5c6b64">If you did not request this code you can safely ignore this email.</p>
                <p style="margin:24px 0 0;font-size:13px;color:#8b9a93">This is an automated message, please do not reply.</p>
              </td></tr>
              <tr><td style="background:#f7f4ee;padding:18px 32px;font-size:12px;color:#77857e">
                {siteName} &middot; Automated security notification
              </td></tr>
            </table>
          </td></tr></table>
        </body></html>
        """;
}
