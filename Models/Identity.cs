using System.ComponentModel.DataAnnotations;

namespace ResortWithJeena.Models;

/// <summary>Role names used across the application.</summary>
public static class Roles
{
    public const string Admin = "Admin";
    public const string Staff = "Staff";
    public const string Customer = "Customer";

    public static readonly string[] All = [Admin, Staff, Customer];
}

public class User
{
    public int Id { get; set; }

    [MaxLength(120)] public string FullName { get; set; } = "";
    [MaxLength(180)] public string Email { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }

    [MaxLength(200)] public string PasswordHash { get; set; } = "";

    [MaxLength(20)] public string Role { get; set; } = Roles.Customer;

    public bool IsEmailVerified { get; set; }
    public bool IsActive { get; set; } = true;

    [MaxLength(400)] public string? AvatarUrl { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public List<Booking> Bookings { get; set; } = [];
    public List<FoodOrder> FoodOrders { get; set; } = [];
}

/// <summary>One-time codes used for registration verification and password reset.</summary>
public class OtpCode
{
    public int Id { get; set; }

    [MaxLength(180)] public string Email { get; set; } = "";
    [MaxLength(120)] public string CodeHash { get; set; } = "";
    [MaxLength(30)] public string Purpose { get; set; } = OtpPurposes.Register;

    public DateTime ExpiresAt { get; set; }
    public DateTime? ConsumedAt { get; set; }
    public int Attempts { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class OtpPurposes
{
    public const string Register = "Register";
    public const string ResetPassword = "ResetPassword";
}

/// <summary>Lightweight audit trail shown in the admin panel.</summary>
public class AuditLog
{
    public int Id { get; set; }
    [MaxLength(180)] public string? UserEmail { get; set; }
    [MaxLength(60)] public string Action { get; set; } = "";
    [MaxLength(60)] public string? Entity { get; set; }
    [MaxLength(40)] public string? EntityId { get; set; }
    [MaxLength(1000)] public string? Details { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
