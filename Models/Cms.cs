using System.ComponentModel.DataAnnotations;

namespace ResortWithJeena.Models;

/// <summary>
/// Editable key/value website configuration (texts, colours, logo, video, toggles, SMTP ...).
/// The admin settings screen renders itself from these rows, so new settings only need a seed entry.
/// </summary>
public class Setting
{
    public int Id { get; set; }

    [MaxLength(120)] public string Key { get; set; } = "";
    [MaxLength(4000)] public string? Value { get; set; }

    [MaxLength(60)] public string Group { get; set; } = "General";
    [MaxLength(160)] public string? Label { get; set; }

    /// <summary>text | textarea | color | number | checkbox | image | video | url | password | select</summary>
    [MaxLength(20)] public string InputType { get; set; } = "text";

    /// <summary>Pipe separated options for select inputs.</summary>
    [MaxLength(1000)] public string? Options { get; set; }

    [MaxLength(600)] public string? Hint { get; set; }
    public int SortOrder { get; set; }
}

public static class SettingGroups
{
    public const string General = "General";
    public const string Theme = "Theme";
    public const string Hero = "Hero";
    public const string Home = "Home Sections";
    public const string Booking = "Booking";
    public const string Email = "Email / OTP";
    public const string Seo = "SEO";
    public const string Social = "Social Links";

    public static readonly string[] All = [General, Theme, Hero, Home, Booking, Email, Seo, Social];
}

/// <summary>Per-page, per-section editable text blocks ("change text of the whole website").</summary>
public class PageContent
{
    public int Id { get; set; }

    [MaxLength(60)] public string PageKey { get; set; } = "";
    [MaxLength(60)] public string SectionKey { get; set; } = "";

    [MaxLength(200)] public string? Title { get; set; }
    [MaxLength(300)] public string? Subtitle { get; set; }
    public string? Body { get; set; }
    [MaxLength(3000)] public string? Items { get; set; }
    [MaxLength(400)] public string? ImageUrl { get; set; }
    [MaxLength(200)] public string? ButtonText { get; set; }
    [MaxLength(400)] public string? ButtonLink { get; set; }

    public bool IsVisible { get; set; } = true;
    public int SortOrder { get; set; }
}

public class CarouselSlide
{
    public int Id { get; set; }

    [MaxLength(200)] public string? Title { get; set; }
    [MaxLength(300)] public string? Subtitle { get; set; }

    /// <summary>Image | Video | YouTube</summary>
    [MaxLength(20)] public string MediaType { get; set; } = "Image";

    [MaxLength(600)] public string? MediaUrl { get; set; }
    [MaxLength(600)] public string? PosterUrl { get; set; }

    [MaxLength(80)] public string? ButtonText { get; set; }
    [MaxLength(400)] public string? ButtonLink { get; set; }
    [MaxLength(80)] public string? Button2Text { get; set; }
    [MaxLength(400)] public string? Button2Link { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class GalleryItem
{
    public int Id { get; set; }

    [MaxLength(200)] public string? Title { get; set; }

    public int? CategoryId { get; set; }
    public Category? Category { get; set; }

    /// <summary>Image | Video | YouTube</summary>
    [MaxLength(20)] public string MediaType { get; set; } = "Image";
    [MaxLength(600)] public string Url { get; set; } = "";
    [MaxLength(600)] public string? ThumbnailUrl { get; set; }

    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

public class Testimonial
{
    public int Id { get; set; }
    [MaxLength(120)] public string Name { get; set; } = "";
    [MaxLength(120)] public string? Designation { get; set; }
    [MaxLength(120)] public string? Location { get; set; }
    [MaxLength(1200)] public string Message { get; set; } = "";
    public int Rating { get; set; } = 5;
    [MaxLength(400)] public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}

public class Facility
{
    public int Id { get; set; }
    [MaxLength(160)] public string Title { get; set; } = "";
    [MaxLength(600)] public string? Description { get; set; }
    [MaxLength(120)] public string? Icon { get; set; }
    [MaxLength(400)] public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
