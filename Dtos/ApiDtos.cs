using System.ComponentModel.DataAnnotations;
using ResortWithJeena.Models;

namespace ResortWithJeena.Dtos;

public class RegisterRequest
{
    [Required, MaxLength(120)] public string FullName { get; set; } = "";
    [Required, EmailAddress, MaxLength(180)] public string Email { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }
    [Required, MinLength(6), MaxLength(100)] public string Password { get; set; } = "";
    [Required, MaxLength(100)] public string ConfirmPassword { get; set; } = "";
}

public record RegisterResponse(
    bool RequiresOtp,
    string Email,
    string Message,
    string? PendingToken,
    string? DevOtp,
    bool SmtpConfigured);

public class VerifyOtpRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required, MaxLength(12)] public string Code { get; set; } = "";
    public string? PendingToken { get; set; }
}

public class LoginRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required] public string Password { get; set; } = "";
    public bool RememberMe { get; set; }
}

public class ResendOtpRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [MaxLength(30)] public string Purpose { get; set; } = OtpPurposes.Register;
}

public class ForgotPasswordRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
}

public class ResetPasswordRequest
{
    [Required, EmailAddress] public string Email { get; set; } = "";
    [Required] public string Code { get; set; } = "";
    [Required, MinLength(6), MaxLength(100)] public string NewPassword { get; set; } = "";
}

public class ChangePasswordRequest
{
    [Required] public string CurrentPassword { get; set; } = "";
    [Required, MinLength(6), MaxLength(100)] public string NewPassword { get; set; } = "";
}

public class ProfileUpdateRequest
{
    [Required, MaxLength(120)] public string FullName { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }
    [MaxLength(400)] public string? AvatarUrl { get; set; }
}

public record AuthResponse(
    string Token,
    DateTime ExpiresAtUtc,
    UserSummary User);

public record UserSummary(
    int Id,
    string FullName,
    string Email,
    string? Phone,
    string Role,
    bool IsEmailVerified,
    bool IsActive,
    string? AvatarUrl,
    DateTime CreatedAt,
    DateTime? LastLoginAt);

public class CreateBookingRequest
{
    [Required] public int RoomId { get; set; }
    [Required] public DateTime CheckIn { get; set; }
    [Required] public DateTime CheckOut { get; set; }
    [Range(1, 20)] public int Adults { get; set; } = 2;
    [Range(0, 20)] public int Children { get; set; }
    [Range(1, 10)] public int RoomCount { get; set; } = 1;

    [Required, MaxLength(120)] public string GuestName { get; set; } = "";
    [Required, EmailAddress, MaxLength(180)] public string GuestEmail { get; set; } = "";
    [Required, MaxLength(30)] public string GuestPhone { get; set; } = "";

    [MaxLength(1000)] public string? SpecialRequest { get; set; }
    [MaxLength(40)] public string? PaymentMethod { get; set; }

    /// <summary>Optional pre-selected food items added to the booking.</summary>
    public List<BookingFoodSelection>? FoodItems { get; set; }
}

public class BookingFoodSelection
{
    public int FoodItemId { get; set; }
    [Range(1, 50)] public int Quantity { get; set; } = 1;
}

public class CreateFoodOrderRequest
{
    [Required, MaxLength(120)] public string CustomerName { get; set; } = "";
    [EmailAddress, MaxLength(180)] public string? Email { get; set; }
    [MaxLength(30)] public string? Phone { get; set; }
    [MaxLength(30)] public string OrderType { get; set; } = FoodOrderTypes.DineIn;
    [MaxLength(600)] public string? Notes { get; set; }
    [MaxLength(30)] public string? BookingCode { get; set; }
    [MinLength(1)] public List<BookingFoodSelection> Items { get; set; } = [];
}

public class ContactRequest
{
    [Required, MaxLength(120)] public string Name { get; set; } = "";
    [Required, EmailAddress, MaxLength(180)] public string Email { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }
    [MaxLength(200)] public string? Subject { get; set; }
    [Required, MaxLength(2000)] public string Message { get; set; } = "";
}

public class NewsletterRequest
{
    [Required, EmailAddress, MaxLength(180)] public string Email { get; set; } = "";
}

public class SettingUpdateRequest
{
    public Dictionary<string, string?> Values { get; set; } = [];
}

public class StatusUpdateRequest
{
    [Required] public string Status { get; set; } = "";
}

public class UserAdminUpdateRequest
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
    public bool? IsEmailVerified { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
}
