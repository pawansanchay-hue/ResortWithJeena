using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ResortWithJeena.Models;

namespace ResortWithJeena.Services;

public class JwtOptions
{
    public string Key { get; set; } = "";
    public string Issuer { get; set; } = "ResortWithJeena";
    public string Audience { get; set; } = "ResortWithJeena";
    public int ExpiryHours { get; set; } = 12;
    public int RememberMeExpiryDays { get; set; } = 30;
}

public class JwtService(IConfiguration cfg)
{
    public JwtOptions Options { get; } = new()
    {
        Key = cfg["Jwt:Key"] ?? "jeena-resort-development-signing-key-change-me-0123456789",
        Issuer = cfg["Jwt:Issuer"] ?? "ResortWithJeena",
        Audience = cfg["Jwt:Audience"] ?? "ResortWithJeena",
        ExpiryHours = int.TryParse(cfg["Jwt:ExpiryHours"], out var h) ? h : 12,
        RememberMeExpiryDays = int.TryParse(cfg["Jwt:RememberMeExpiryDays"], out var d) ? d : 30
    };

    public (string Token, DateTime ExpiresAtUtc) CreateToken(User user, bool rememberMe)
    {
        var expiry = rememberMe
            ? DateTime.UtcNow.AddDays(Options.RememberMeExpiryDays)
            : DateTime.UtcNow.AddHours(Options.ExpiryHours);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role),
            new("role", user.Role),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Options.Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: Options.Issuer,
            audience: Options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiry,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(token), expiry);
    }

    /// <summary>Short lived token issued between registration and OTP verification.</summary>
    public string CreatePendingToken(string email)
    {
        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Options.Key)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: Options.Issuer,
            audience: Options.Audience,
            claims:
            [
                new Claim(ClaimTypes.Email, email),
                new Claim("purpose", "otp")
            ],
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddMinutes(30),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string? ReadPendingToken(string token)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = Options.Issuer,
                ValidAudience = Options.Audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Options.Key))
            }, out _);
            if (principal.FindFirstValue("purpose") != "otp") return null;
            return principal.FindFirstValue(ClaimTypes.Email);
        }
        catch
        {
            return null;
        }
    }
}
