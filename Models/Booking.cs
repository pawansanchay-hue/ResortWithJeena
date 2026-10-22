using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResortWithJeena.Models;

public static class BookingStatuses
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string CheckedIn = "CheckedIn";
    public const string CheckedOut = "CheckedOut";
    public const string Cancelled = "Cancelled";

    public static readonly string[] All = [Pending, Confirmed, CheckedIn, CheckedOut, Cancelled];
}

public static class PaymentStatuses
{
    public const string Unpaid = "Unpaid";
    public const string Partial = "Partial";
    public const string Paid = "Paid";
    public const string Refunded = "Refunded";

    public static readonly string[] All = [Unpaid, Partial, Paid, Refunded];
}

public class Booking
{
    public int Id { get; set; }

    [MaxLength(30)] public string BookingCode { get; set; } = "";

    public int? UserId { get; set; }
    public User? User { get; set; }

    [MaxLength(120)] public string GuestName { get; set; } = "";
    [MaxLength(180)] public string GuestEmail { get; set; } = "";
    [MaxLength(30)] public string GuestPhone { get; set; } = "";

    public int RoomId { get; set; }
    public Room? Room { get; set; }

    public DateTime CheckIn { get; set; }
    public DateTime CheckOut { get; set; }

    public int Adults { get; set; } = 2;
    public int Children { get; set; }
    public int RoomCount { get; set; } = 1;
    public int Nights { get; set; }

    [Column(TypeName = "decimal(18,2)")] public decimal RoomAmount { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal FoodAmount { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal TaxAmount { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal DiscountAmount { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal TotalAmount { get; set; }

    [MaxLength(30)] public string Status { get; set; } = BookingStatuses.Pending;
    [MaxLength(30)] public string PaymentStatus { get; set; } = PaymentStatuses.Unpaid;
    [MaxLength(40)] public string? PaymentMethod { get; set; }

    [MaxLength(1000)] public string? SpecialRequest { get; set; }
    [MaxLength(400)] public string? AdminNote { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public List<FoodOrder> FoodOrders { get; set; } = [];
}

public static class FoodOrderTypes
{
    public const string DineIn = "DineIn";
    public const string RoomService = "RoomService";
    public const string Takeaway = "Takeaway";

    public static readonly string[] All = [DineIn, RoomService, Takeaway];
}

public class FoodOrder
{
    public int Id { get; set; }

    [MaxLength(30)] public string OrderCode { get; set; } = "";

    public int? BookingId { get; set; }
    public Booking? Booking { get; set; }

    public int? UserId { get; set; }
    public User? User { get; set; }

    [MaxLength(120)] public string CustomerName { get; set; } = "";
    [MaxLength(180)] public string? Email { get; set; }
    [MaxLength(30)] public string? Phone { get; set; }

    [MaxLength(30)] public string OrderType { get; set; } = FoodOrderTypes.DineIn;

    [Column(TypeName = "decimal(18,2)")] public decimal TotalAmount { get; set; }

    [MaxLength(30)] public string Status { get; set; } = "New";
    [MaxLength(600)] public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<FoodOrderItem> Items { get; set; } = [];
}

public class FoodOrderItem
{
    public int Id { get; set; }
    public int FoodOrderId { get; set; }
    public FoodOrder? FoodOrder { get; set; }

    public int? FoodItemId { get; set; }
    [MaxLength(160)] public string Name { get; set; } = "";
    [Column(TypeName = "decimal(18,2)")] public decimal UnitPrice { get; set; }
    public int Quantity { get; set; } = 1;
}

public class ContactMessage
{
    public int Id { get; set; }
    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(180)] public string Email { get; set; } = "";
    [MaxLength(30)] public string? Phone { get; set; }
    [MaxLength(200)] public string? Subject { get; set; }
    [MaxLength(2000)] public string Message { get; set; } = "";
    public bool IsRead { get; set; }
    public string? Reply { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class NewsletterSubscriber
{
    public int Id { get; set; }
    [MaxLength(180)] public string Email { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
