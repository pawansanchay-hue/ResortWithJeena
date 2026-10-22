using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ResortWithJeena.Models;

/// <summary>Category kinds. Rooms and Food are the two required ones.</summary>
public static class CategoryTypes
{
    public const string Room = "Room";
    public const string Food = "Food";
    public const string Gallery = "Gallery";
    public const string Blog = "Blog";

    public static readonly string[] All = [Room, Food, Gallery, Blog];
}

public class Category
{
    public int Id { get; set; }

    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(140)] public string Slug { get; set; } = "";
    [MaxLength(20)] public string Type { get; set; } = CategoryTypes.Room;
    [MaxLength(1000)] public string? Description { get; set; }
    [MaxLength(400)] public string? ImageUrl { get; set; }
    [MaxLength(120)] public string? Icon { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    public List<Room> Rooms { get; set; } = [];
    public List<FoodItem> FoodItems { get; set; } = [];
}

public class Room
{
    public int Id { get; set; }

    [MaxLength(160)] public string Name { get; set; } = "";
    [MaxLength(180)] public string Slug { get; set; } = "";

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    [MaxLength(400)] public string? ShortDescription { get; set; }
    public string? Description { get; set; }

    [Column(TypeName = "decimal(18,2)")] public decimal PricePerNight { get; set; }
    public int DiscountPercent { get; set; }

    [MaxLength(60)] public string? RoomSize { get; set; }
    [MaxLength(60)] public string? BedType { get; set; }

    public int MaxAdults { get; set; } = 2;
    public int MaxChildren { get; set; } = 1;
    public int TotalUnits { get; set; } = 1;

    /// <summary>Comma separated or JSON array of amenity labels.</summary>
    [MaxLength(2000)] public string? Amenities { get; set; }

    [MaxLength(400)] public string? CoverImage { get; set; }

    public bool IsFeatured { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<RoomImage> Images { get; set; } = [];
    public List<Booking> Bookings { get; set; } = [];
}

public class RoomImage
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public Room? Room { get; set; }

    [MaxLength(400)] public string ImageUrl { get; set; } = "";
    [MaxLength(200)] public string? Caption { get; set; }
    public int SortOrder { get; set; }
}

public class FoodItem
{
    public int Id { get; set; }

    [MaxLength(160)] public string Name { get; set; } = "";

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    [MaxLength(1000)] public string? Description { get; set; }

    [Column(TypeName = "decimal(18,2)")] public decimal Price { get; set; }
    [Column(TypeName = "decimal(18,2)")] public decimal? DiscountPrice { get; set; }

    [MaxLength(400)] public string? ImageUrl { get; set; }

    public bool IsVeg { get; set; } = true;
    [MaxLength(20)] public string? SpiceLevel { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsAvailable { get; set; } = true;
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
