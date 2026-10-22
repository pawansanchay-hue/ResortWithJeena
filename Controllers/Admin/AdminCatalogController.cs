using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminCatalogController(AppDbContext db) : ControllerBase
{
    // ------------------------------------------------------------ categories

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(string? type = null)
    {
        var q = db.Categories.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(c => c.Type == type);
        return Ok(await q.OrderBy(c => c.Type).ThenBy(c => c.SortOrder).Select(c => new
        {
            c.Id,
            c.Name,
            c.Slug,
            c.Type,
            c.Description,
            c.ImageUrl,
            c.Icon,
            c.SortOrder,
            c.IsActive,
            rooms = c.Rooms.Count,
            food = c.FoodItems.Count
        }).ToListAsync());
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] Category input)
    {
        input.Id = 0;
        input.Name = input.Name.Trim();
        if (string.IsNullOrWhiteSpace(input.Name)) return BadRequest(new { message = "Category name is required." });
        input.Slug = await UniqueSlugAsync<Category>(input.Slug, input.Name);
        db.Categories.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Category created.", input.Id });
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] Category input)
    {
        var c = await db.Categories.FindAsync(id);
        if (c is null) return NotFound(new { message = "Category not found." });

        c.Name = string.IsNullOrWhiteSpace(input.Name) ? c.Name : input.Name.Trim();
        c.Slug = await UniqueSlugAsync<Category>(input.Slug, c.Name, id);
        c.Type = input.Type;
        c.Description = input.Description;
        c.ImageUrl = input.ImageUrl;
        c.Icon = input.Icon;
        c.SortOrder = input.SortOrder;
        c.IsActive = input.IsActive;
        await db.SaveChangesAsync();
        return Ok(new { message = "Category updated." });
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var c = await db.Categories.FindAsync(id);
        if (c is null) return NotFound(new { message = "Category not found." });
        db.Categories.Remove(c);
        await db.SaveChangesAsync();
        return Ok(new { message = "Category deleted. Linked items were kept and unlinked." });
    }

    // ----------------------------------------------------------------- rooms

    [HttpGet("rooms")]
    public async Task<IActionResult> Rooms(string? search = null, int? categoryId = null, string? status = null)
    {
        var q = db.Rooms.AsNoTracking().Include(r => r.Category).Include(r => r.Images).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(r => r.Name.Contains(search));
        if (categoryId is > 0) q = q.Where(r => r.CategoryId == categoryId);
        if (status == "active") q = q.Where(r => r.IsActive);
        if (status == "inactive") q = q.Where(r => !r.IsActive);
        if (status == "featured") q = q.Where(r => r.IsFeatured);

        var rooms = await q.OrderBy(r => r.SortOrder).ThenBy(r => r.Id).ToListAsync();
        var ids = rooms.Select(r => r.Id).ToList();

        var bookingCounts = await db.Bookings.AsNoTracking()
            .Where(b => ids.Contains(b.RoomId))
            .GroupBy(b => b.RoomId)
            .Select(g => new { RoomId = g.Key, Count = g.Count(), Revenue = g.Where(x => x.Status != BookingStatuses.Cancelled).Sum(x => x.TotalAmount) })
            .ToDictionaryAsync(x => x.RoomId, x => x);

        return Ok(rooms.Select(r => new
        {
            r.Id,
            r.Name,
            r.Slug,
            r.CategoryId,
            category = r.Category?.Name,
            r.ShortDescription,
            r.Description,
            r.PricePerNight,
            r.DiscountPercent,
            r.RoomSize,
            r.BedType,
            r.MaxAdults,
            r.MaxChildren,
            r.TotalUnits,
            r.Amenities,
            r.CoverImage,
            r.IsFeatured,
            r.IsActive,
            r.SortOrder,
            r.CreatedAt,
            bookings = bookingCounts.GetValueOrDefault(r.Id)?.Count ?? 0,
            revenue = bookingCounts.GetValueOrDefault(r.Id)?.Revenue ?? 0,
            images = r.Images.OrderBy(i => i.SortOrder).Select(i => new { i.Id, i.ImageUrl, i.Caption, i.SortOrder })
        }));
    }

    [HttpGet("rooms/{id:int}")]
    public async Task<IActionResult> Room(int id)
    {
        var r = await db.Rooms.AsNoTracking().Include(x => x.Images).FirstOrDefaultAsync(x => x.Id == id);
        return r is null ? NotFound(new { message = "Room not found." }) : Ok(r);
    }

    [HttpPost("rooms")]
    public async Task<IActionResult> CreateRoom([FromBody] Room input)
    {
        input.Id = 0;
        input.Images = [];
        input.Name = input.Name.Trim();
        if (string.IsNullOrWhiteSpace(input.Name)) return BadRequest(new { message = "Room name is required." });
        input.Slug = await UniqueSlugAsync<Room>(input.Slug, input.Name);
        if (input.CoverImage is null) input.CoverImage = "/assets/room-1.svg";
        db.Rooms.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Room created.", id = input.Id, slug = input.Slug });
    }

    [HttpPut("rooms/{id:int}")]
    public async Task<IActionResult> UpdateRoom(int id, [FromBody] Room input)
    {
        var r = await db.Rooms.FindAsync(id);
        if (r is null) return NotFound(new { message = "Room not found." });

        r.Name = string.IsNullOrWhiteSpace(input.Name) ? r.Name : input.Name.Trim();
        r.Slug = await UniqueSlugAsync<Room>(input.Slug, r.Name, id);
        r.CategoryId = input.CategoryId;
        r.ShortDescription = input.ShortDescription;
        r.Description = input.Description;
        r.PricePerNight = input.PricePerNight;
        r.DiscountPercent = Math.Clamp(input.DiscountPercent, 0, 90);
        r.RoomSize = input.RoomSize;
        r.BedType = input.BedType;
        r.MaxAdults = Math.Max(1, input.MaxAdults);
        r.MaxChildren = Math.Max(0, input.MaxChildren);
        r.TotalUnits = Math.Max(1, input.TotalUnits);
        r.Amenities = input.Amenities;
        r.CoverImage = input.CoverImage;
        r.IsFeatured = input.IsFeatured;
        r.IsActive = input.IsActive;
        r.SortOrder = input.SortOrder;
        await db.SaveChangesAsync();
        return Ok(new { message = "Room updated." });
    }

    [HttpDelete("rooms/{id:int}")]
    public async Task<IActionResult> DeleteRoom(int id)
    {
        var r = await db.Rooms.FindAsync(id);
        if (r is null) return NotFound(new { message = "Room not found." });
        if (await db.Bookings.AnyAsync(b => b.RoomId == id))
            return BadRequest(new { message = "This room has bookings and cannot be deleted. Mark it inactive instead." });

        db.Rooms.Remove(r);
        await db.SaveChangesAsync();
        return Ok(new { message = "Room deleted." });
    }

    // ---------------------------------------------------------- room images

    [HttpPost("rooms/{id:int}/images")]
    public async Task<IActionResult> AddRoomImage(int id, [FromBody] RoomImage input)
    {
        if (!await db.Rooms.AnyAsync(r => r.Id == id)) return NotFound(new { message = "Room not found." });
        if (string.IsNullOrWhiteSpace(input.ImageUrl)) return BadRequest(new { message = "An image URL is required." });

        var next = await db.RoomImages.Where(i => i.RoomId == id).Select(i => (int?)i.SortOrder).MaxAsync() ?? -1;
        var img = new RoomImage { RoomId = id, ImageUrl = input.ImageUrl, Caption = input.Caption, SortOrder = next + 1 };
        db.RoomImages.Add(img);
        await db.SaveChangesAsync();

        var first = await db.RoomImages.Where(i => i.RoomId == id).OrderBy(i => i.SortOrder).FirstAsync();
        var room = await db.Rooms.FindAsync(id);
        if (room is not null && string.IsNullOrWhiteSpace(room.CoverImage)) room.CoverImage = first.ImageUrl;
        await db.SaveChangesAsync();

        return Ok(new { message = "Image added to the room gallery.", img.Id, img.ImageUrl });
    }

    [HttpDelete("rooms/{id:int}/images/{imageId:int}")]
    public async Task<IActionResult> DeleteRoomImage(int id, int imageId)
    {
        var img = await db.RoomImages.FirstOrDefaultAsync(i => i.Id == imageId && i.RoomId == id);
        if (img is null) return NotFound(new { message = "Image not found." });
        db.RoomImages.Remove(img);
        await db.SaveChangesAsync();
        return Ok(new { message = "Image removed." });
    }

    [HttpPut("rooms/{id:int}/images")]
    public async Task<IActionResult> ReorderRoomImages(int id, [FromBody] List<RoomImage> ordered)
    {
        var images = await db.RoomImages.Where(i => i.RoomId == id).ToListAsync();
        var i = 0;
        foreach (var o in ordered)
        {
            var match = images.FirstOrDefault(x => x.Id == o.Id);
            if (match is not null) { match.SortOrder = i++; match.Caption = o.Caption ?? match.Caption; }
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Gallery order saved." });
    }

    // ------------------------------------------------------------ food items

    [HttpGet("food")]
    public async Task<IActionResult> Food(string? search = null, int? categoryId = null, string? status = null)
    {
        var q = db.FoodItems.AsNoTracking().Include(f => f.Category).AsQueryable();
        if (!string.IsNullOrWhiteSpace(search)) q = q.Where(f => f.Name.Contains(search));
        if (categoryId is > 0) q = q.Where(f => f.CategoryId == categoryId);
        if (status == "available") q = q.Where(f => f.IsAvailable);
        if (status == "hidden") q = q.Where(f => !f.IsAvailable);
        if (status == "featured") q = q.Where(f => f.IsFeatured);

        return Ok(await q.OrderBy(f => f.CategoryId).ThenBy(f => f.SortOrder).Select(f => new
        {
            f.Id,
            f.Name,
            f.Description,
            f.Price,
            f.DiscountPrice,
            f.ImageUrl,
            f.IsVeg,
            f.SpiceLevel,
            f.IsFeatured,
            f.IsAvailable,
            f.SortOrder,
            f.CategoryId,
            category = f.Category != null ? f.Category.Name : null
        }).ToListAsync());
    }

    [HttpPost("food")]
    public async Task<IActionResult> CreateFood([FromBody] FoodItem input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.Name)) return BadRequest(new { message = "Dish name is required." });
        input.Name = input.Name.Trim();
        if (string.IsNullOrWhiteSpace(input.ImageUrl)) input.ImageUrl = "/assets/food-1.svg";
        db.FoodItems.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Dish added to the menu.", input.Id });
    }

    [HttpPut("food/{id:int}")]
    public async Task<IActionResult> UpdateFood(int id, [FromBody] FoodItem input)
    {
        var f = await db.FoodItems.FindAsync(id);
        if (f is null) return NotFound(new { message = "Dish not found." });

        f.Name = string.IsNullOrWhiteSpace(input.Name) ? f.Name : input.Name.Trim();
        f.Description = input.Description;
        f.CategoryId = input.CategoryId;
        f.Price = input.Price;
        f.DiscountPrice = input.DiscountPrice;
        f.ImageUrl = input.ImageUrl;
        f.IsVeg = input.IsVeg;
        f.SpiceLevel = input.SpiceLevel;
        f.IsFeatured = input.IsFeatured;
        f.IsAvailable = input.IsAvailable;
        f.SortOrder = input.SortOrder;
        await db.SaveChangesAsync();
        return Ok(new { message = "Dish updated." });
    }

    [HttpDelete("food/{id:int}")]
    public async Task<IActionResult> DeleteFood(int id)
    {
        var f = await db.FoodItems.FindAsync(id);
        if (f is null) return NotFound(new { message = "Dish not found." });
        db.FoodItems.Remove(f);
        await db.SaveChangesAsync();
        return Ok(new { message = "Dish removed from the menu." });
    }

    // ---------------------------------------------------------------- shared

    private async Task<string> UniqueSlugAsync<T>(string? provided, string fallback, int? ignoreId = null) where T : class
    {
        var baseSlug = Slugify(string.IsNullOrWhiteSpace(provided) ? fallback : provided);
        if (string.IsNullOrWhiteSpace(baseSlug)) baseSlug = "item";

        var slug = baseSlug;
        var n = 2;
        while (await SlugExistsAsync<T>(slug, ignoreId)) slug = $"{baseSlug}-{n++}";
        return slug;
    }

    private async Task<bool> SlugExistsAsync<T>(string slug, int? ignoreId) where T : class
    {
        if (typeof(T) == typeof(Category))
        {
            var q = db.Categories.Where(c => c.Slug == slug);
            if (ignoreId is { } id) q = q.Where(c => c.Id != id);
            return await q.AnyAsync();
        }
        var q2 = db.Rooms.Where(r => r.Slug == slug);
        if (ignoreId is { } id2) q2 = q2.Where(r => r.Id != id2);
        return await q2.AnyAsync();
    }

    private static string Slugify(string value)
    {
        var chars = value.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-')
            .ToArray();
        var slug = new string(chars);
        while (slug.Contains("--")) slug = slug.Replace("--", "-");
        return slug.Trim('-');
    }
}
