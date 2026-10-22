using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Dtos;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

namespace ResortWithJeena.Controllers;

[ApiController]
[Route("api/public")]
public class PublicController(
    AppDbContext db,
    SettingsService settings,
    IEmailSender email,
    ILogger<PublicController> log) : ControllerBase
{
    // ----------------------------------------------------------- site chrome

    /// <summary>Everything the shell of the site needs in one round trip.</summary>
    [HttpGet("bootstrap")]
    public async Task<IActionResult> Bootstrap()
    {
        var all = await settings.AllAsync();
        var pub = all
            .Where(kv => !kv.Key.StartsWith("email.", StringComparison.OrdinalIgnoreCase))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        return Ok(new
        {
            settings = pub,
            mapEmbedUrl = await settings.MapEmbedUrlAsync(),
            pages = await db.PageContents.AsNoTracking()
                .OrderBy(p => p.SortOrder)
                .Select(p => new { p.Id, p.PageKey, p.SectionKey, p.Title, p.Subtitle, p.Body, p.Items, p.ImageUrl, p.ButtonText, p.ButtonLink, p.IsVisible, p.SortOrder })
                .ToListAsync(),
            carousel = await CarouselSlidesAsync(),
            categories = await db.Categories.AsNoTracking().Where(c => c.IsActive)
                .OrderBy(c => c.SortOrder)
                .Select(c => new { c.Id, c.Name, c.Slug, c.Type, c.Description, c.ImageUrl, c.Icon, c.SortOrder })
                .ToListAsync(),
            facilities = await db.Facilities.AsNoTracking().Where(f => f.IsActive)
                .OrderBy(f => f.SortOrder)
                .Select(f => new { f.Id, f.Title, f.Description, f.Icon, f.ImageUrl })
                .ToListAsync(),
            testimonials = await db.Testimonials.AsNoTracking().Where(t => t.IsActive)
                .OrderBy(t => t.SortOrder)
                .Select(t => new { t.Id, t.Name, t.Designation, t.Location, t.Message, t.Rating, t.ImageUrl })
                .ToListAsync()
        });
    }

    [HttpGet("settings")]
    public async Task<IActionResult> PublicSettings()
    {
        var all = await settings.AllAsync();
        return Ok(all.Where(kv => !kv.Key.StartsWith("email.", StringComparison.OrdinalIgnoreCase))
                     .ToDictionary(kv => kv.Key, kv => kv.Value));
    }

    [HttpGet("map")]
    public async Task<IActionResult> Map() => Ok(new
    {
        enabled = await settings.GetBoolAsync("site.mapEnabled", true),
        embedUrl = await settings.MapEmbedUrlAsync(),
        query = await settings.GetAsync("site.mapQuery"),
        address = await settings.GetAsync("site.address")
    });

    [HttpGet("content/{pageKey}")]
    public async Task<IActionResult> PageContentFor(string pageKey) => Ok(await db.PageContents.AsNoTracking()
        .Where(p => p.PageKey == pageKey)
        .OrderBy(p => p.SortOrder)
        .Select(p => new { p.Id, p.PageKey, p.SectionKey, p.Title, p.Subtitle, p.Body, p.Items, p.ImageUrl, p.ButtonText, p.ButtonLink, p.IsVisible })
        .ToListAsync());

    [HttpGet("carousel")]
    public async Task<IActionResult> Carousel() => Ok(await CarouselSlidesAsync());

    private async Task<object> CarouselSlidesAsync() => await db.CarouselSlides.AsNoTracking()
        .Where(s => s.IsActive)
        .OrderBy(s => s.SortOrder)
        .Select(s => new { s.Id, s.Title, s.Subtitle, s.MediaType, s.MediaUrl, s.PosterUrl, s.ButtonText, s.ButtonLink, s.Button2Text, s.Button2Link })
        .ToListAsync();

    [HttpGet("facilities")]
    public async Task<IActionResult> Facilities() => Ok(await db.Facilities.AsNoTracking()
        .Where(f => f.IsActive).OrderBy(f => f.SortOrder)
        .Select(f => new { f.Id, f.Title, f.Description, f.Icon, f.ImageUrl }).ToListAsync());

    [HttpGet("testimonials")]
    public async Task<IActionResult> Testimonials() => Ok(await db.Testimonials.AsNoTracking()
        .Where(t => t.IsActive).OrderBy(t => t.SortOrder)
        .Select(t => new { t.Id, t.Name, t.Designation, t.Location, t.Message, t.Rating, t.ImageUrl }).ToListAsync());

    [HttpGet("gallery")]
    public async Task<IActionResult> Gallery(string? type = null)
    {
        var q = db.GalleryItems.AsNoTracking().Where(g => g.IsActive);
        if (!string.IsNullOrWhiteSpace(type))
            q = q.Where(g => g.Category != null && g.Category.Type == type);

        return Ok(await q.OrderBy(g => g.SortOrder)
            .Select(g => new
            {
                g.Id,
                g.Title,
                g.MediaType,
                g.Url,
                g.ThumbnailUrl,
                categoryId = g.CategoryId,
                category = g.Category != null ? g.Category.Name : null
            }).ToListAsync());
    }

    // ------------------------------------------------------------ categories

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(string? type = null)
    {
        var q = db.Categories.AsNoTracking().Where(c => c.IsActive);
        if (!string.IsNullOrWhiteSpace(type)) q = q.Where(c => c.Type == type);

        var list = await q.OrderBy(c => c.SortOrder).Select(c => new
        {
            c.Id,
            c.Name,
            c.Slug,
            c.Type,
            c.Description,
            c.ImageUrl,
            c.Icon,
            roomCount = c.Rooms.Count(r => r.IsActive),
            foodCount = c.FoodItems.Count(f => f.IsAvailable)
        }).ToListAsync();

        return Ok(list);
    }

    // ----------------------------------------------------------------- rooms

    [HttpGet("rooms")]
    public async Task<IActionResult> Rooms(int? categoryId = null, string? category = null, string? search = null,
        bool? featured = null, decimal? maxPrice = null, string? sort = null, int page = 1, int pageSize = 24)
    {
        var q = db.Rooms.AsNoTracking().Where(r => r.IsActive);

        if (categoryId is > 0) q = q.Where(r => r.CategoryId == categoryId);
        else if (!string.IsNullOrWhiteSpace(category)) q = q.Where(r => r.Category != null && r.Category.Slug == category);
        if (featured == true) q = q.Where(r => r.IsFeatured);
        if (maxPrice is > 0) q = q.Where(r => r.PricePerNight <= maxPrice);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(r => r.Name.Contains(s) || (r.ShortDescription != null && r.ShortDescription.Contains(s))
                          || (r.Description != null && r.Description.Contains(s)));
        }

        q = sort switch
        {
            "price_asc" => q.OrderBy(r => r.PricePerNight),
            "price_desc" => q.OrderByDescending(r => r.PricePerNight),
            "name" => q.OrderBy(r => r.Name),
            _ => q.OrderBy(r => r.SortOrder).ThenBy(r => r.Id)
        };

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 60);
        var total = await q.CountAsync();

        var items = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var ids = items.Select(r => r.Id).ToList();

        var bookedNow = await db.Bookings.AsNoTracking()
            .Where(b => ids.Contains(b.RoomId)
                        && b.Status != BookingStatuses.Cancelled
                        && b.Status != BookingStatuses.CheckedOut
                        && b.CheckIn <= DateTime.UtcNow.Date && b.CheckOut > DateTime.UtcNow.Date)
            .GroupBy(b => b.RoomId)
            .Select(g => new { RoomId = g.Key, Count = g.Sum(x => x.RoomCount) })
            .ToDictionaryAsync(x => x.RoomId, x => x.Count);

        var images = await db.RoomImages.AsNoTracking()
            .Where(i => ids.Contains(i.RoomId))
            .OrderBy(i => i.SortOrder)
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            pages = (int)Math.Ceiling(total / (double)pageSize),
            items = items.Select(r => RoomDto(r, images.Where(i => i.RoomId == r.Id).Select(i => i.ImageUrl).ToList(),
                Math.Max(0, r.TotalUnits - bookedNow.GetValueOrDefault(r.Id))))
        });
    }

    [HttpGet("rooms/{slug}")]
    public async Task<IActionResult> Room(string slug)
    {
        var r = await db.Rooms.AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.Images)
            .FirstOrDefaultAsync(x => x.Slug == slug && x.IsActive);

        if (r is null)
        {
            var byId = int.TryParse(slug, out var id)
                ? await db.Rooms.AsNoTracking().Include(x => x.Category).Include(x => x.Images)
                    .FirstOrDefaultAsync(x => x.Id == id && x.IsActive)
                : null;
            if (byId is null) return NotFound(new { message = "Room not found." });
            r = byId;
        }

        var related = await db.Rooms.AsNoTracking()
            .Where(x => x.IsActive && x.Id != r.Id && (x.CategoryId == r.CategoryId))
            .OrderBy(x => x.SortOrder).Take(3)
            .Select(x => new { x.Id, x.Name, x.Slug, x.PricePerNight, x.DiscountPercent, x.CoverImage, x.ShortDescription })
            .ToListAsync();

        var booked = await db.Bookings.AsNoTracking()
            .Where(b => b.RoomId == r.Id && b.Status != BookingStatuses.Cancelled && b.Status != BookingStatuses.CheckedOut
                        && b.CheckIn <= DateTime.UtcNow.Date && b.CheckOut > DateTime.UtcNow.Date)
            .SumAsync(b => (int?)b.RoomCount) ?? 0;

        var dto = RoomDto(r, r.Images.OrderBy(i => i.SortOrder).Select(i => i.ImageUrl).ToList(),
            Math.Max(0, r.TotalUnits - booked));

        return Ok(new
        {
            room = dto,
            category = r.Category is null ? null : new { r.Category.Id, r.Category.Name, r.Category.Slug, r.Category.Description },
            images = r.Images.OrderBy(i => i.SortOrder).Select(i => new { i.ImageUrl, i.Caption }),
            related,
            reviews = await db.Testimonials.AsNoTracking().Where(t => t.IsActive)
                .OrderBy(t => t.SortOrder).Take(3)
                .Select(t => new { t.Name, t.Rating, t.Message, t.ImageUrl, t.Location }).ToListAsync()
        });
    }

    // ---------------------------------------------------------- availability

    [HttpGet("availability")]
    public async Task<IActionResult> Availability(int? roomId, DateTime? checkIn, DateTime? checkOut, int adults = 2, int children = 0)
    {
        var start = (checkIn ?? DateTime.UtcNow.Date.AddDays(1)).Date;
        var end = (checkOut ?? start.AddDays(1)).Date;
        var minNights = await settings.GetIntAsync("booking.minNights", 1);
        var maxNights = await settings.GetIntAsync("booking.maxNights", 30);
        var nights = (end - start).Days;

        if (nights < minNights || nights > maxNights)
            return BadRequest(new { message = $"Stay must be between {minNights} and {maxNights} nights." });

        var roomsQ = db.Rooms.AsNoTracking().Include(r => r.Category).Where(r => r.IsActive);
        if (roomId is > 0) roomsQ = roomsQ.Where(r => r.Id == roomId);
        var rooms = await roomsQ.OrderBy(r => r.SortOrder).ToListAsync();

        var ids = rooms.Select(r => r.Id).ToList();
        var booked = await db.Bookings.AsNoTracking()
            .Where(b => ids.Contains(b.RoomId) && b.Status != BookingStatuses.Cancelled && b.Status != BookingStatuses.CheckedOut
                        && b.CheckIn < end && b.CheckOut > start)
            .GroupBy(b => b.RoomId)
            .Select(g => new { RoomId = g.Key, Count = g.Sum(x => x.RoomCount) })
            .ToDictionaryAsync(x => x.RoomId, x => x.Count);

        var taxPercent = await settings.GetDecimalAsync("booking.taxPercent", 12);

        var result = rooms
            .Where(r => r.MaxAdults >= adults && r.MaxChildren >= children)
            .Select(r =>
            {
                var remaining = Math.Max(0, r.TotalUnits - booked.GetValueOrDefault(r.Id));
                var nightly = NightlyRate(r);
                var sub = nightly * nights;
                var tax = Math.Round(sub * taxPercent / 100m, 2);
                return new
                {
                    roomId = r.Id,
                    r.Name,
                    r.Slug,
                    r.CoverImage,
                    category = r.Category?.Name,
                    maxAdults = r.MaxAdults,
                    maxChildren = r.MaxChildren,
                    totalUnits = r.TotalUnits,
                    availableUnits = remaining,
                    nightlyRate = nightly,
                    nights,
                    subtotal = sub,
                    tax,
                    taxPercent,
                    total = sub + tax,
                    isAvailable = remaining > 0 && r.TotalUnits > 0
                };
            })
            .OrderBy(x => x.nightlyRate)
            .ToList();

        return Ok(new { checkIn = start, checkOut = end, nights, adults, children, taxPercent, rooms = result });
    }

    // -------------------------------------------------------------- bookings

    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest req)
    {
        var room = await db.Rooms.Include(r => r.Category).FirstOrDefaultAsync(r => r.Id == req.RoomId && r.IsActive);
        if (room is null) return BadRequest(new { message = "Please choose a valid room." });

        var minNights = await settings.GetIntAsync("booking.minNights", 1);
        var maxNights = await settings.GetIntAsync("booking.maxNights", 30);
        var nights = (req.CheckOut.Date - req.CheckIn.Date).Days;
        if (nights < minNights) return BadRequest(new { message = $"Minimum stay is {minNights} night(s)." });
        if (nights > maxNights) return BadRequest(new { message = $"Maximum stay is {maxNights} nights. Contact us for longer stays." });
        if (req.CheckIn.Date < DateTime.UtcNow.Date) return BadRequest(new { message = "Check-in date cannot be in the past." });
        if (req.CheckOut.Date <= req.CheckIn.Date) return BadRequest(new { message = "Check-out must be after check-in." });
        if (req.RoomCount < 1) return BadRequest(new { message = "At least one room is required." });
        if (req.Adults + req.Children > room.MaxAdults * req.RoomCount + room.MaxChildren * req.RoomCount)
            return BadRequest(new { message = $"{room.Name} comfortably hosts {room.MaxAdults} adults and {room.MaxChildren} children per room." });

        var bookedCount = await db.Bookings
            .Where(b => b.RoomId == room.Id && b.Status != BookingStatuses.Cancelled && b.Status != BookingStatuses.CheckedOut
                        && b.CheckIn < req.CheckOut.Date && b.CheckOut > req.CheckIn.Date)
            .SumAsync(b => (int?)b.RoomCount) ?? 0;

        var remaining = room.TotalUnits - bookedCount;
        if (remaining < req.RoomCount)
            return Conflict(new { message = remaining <= 0
                ? $"{room.Name} is fully booked for those dates. Try different dates or another room."
                : $"Only {remaining} unit(s) of {room.Name} left for those dates." });

        var taxPercent = await settings.GetDecimalAsync("booking.taxPercent", 12);
        var nightly = NightlyRate(room);
        var roomAmount = nightly * nights * req.RoomCount;

        var foodAmount = 0m;
        var selectedFood = new List<(FoodItem Item, int Qty)>();
        if (req.FoodItems is { Count: > 0 })
        {
            var ids = req.FoodItems.Select(f => f.FoodItemId).Distinct().ToList();
            var foods = await db.FoodItems.Where(f => ids.Contains(f.Id) && f.IsAvailable).ToListAsync();
            foreach (var sel in req.FoodItems)
            {
                var item = foods.FirstOrDefault(f => f.Id == sel.FoodItemId);
                if (item is null) continue;
                var qty = Math.Clamp(sel.Quantity, 1, 50);
                selectedFood.Add((item, qty));
                foodAmount += (item.DiscountPrice ?? item.Price) * qty;
            }
        }

        var tax = Math.Round((roomAmount + foodAmount) * taxPercent / 100m, 2);
        var user = await ResolveUserAsync();

        var booking = new Booking
        {
            BookingCode = await NextBookingCodeAsync(),
            UserId = user?.Id,
            GuestName = req.GuestName.Trim(),
            GuestEmail = req.GuestEmail.Trim().ToLowerInvariant(),
            GuestPhone = req.GuestPhone.Trim(),
            RoomId = room.Id,
            CheckIn = req.CheckIn.Date,
            CheckOut = req.CheckOut.Date,
            Adults = req.Adults,
            Children = req.Children,
            RoomCount = req.RoomCount,
            Nights = nights,
            RoomAmount = roomAmount,
            FoodAmount = foodAmount,
            TaxAmount = tax,
            TotalAmount = roomAmount + foodAmount + tax,
            Status = BookingStatuses.Pending,
            PaymentStatus = PaymentStatuses.Unpaid,
            PaymentMethod = req.PaymentMethod,
            SpecialRequest = req.SpecialRequest,
            CreatedAt = DateTime.UtcNow
        };
        db.Bookings.Add(booking);
        await db.SaveChangesAsync();

        if (selectedFood.Count > 0)
        {
            var order = new FoodOrder
            {
                OrderCode = await NextFoodOrderCodeAsync(),
                BookingId = booking.Id,
                UserId = user?.Id,
                CustomerName = booking.GuestName,
                Email = booking.GuestEmail,
                Phone = booking.GuestPhone,
                OrderType = FoodOrderTypes.RoomService,
                Notes = "Pre-booked with reservation " + booking.BookingCode,
                CreatedAt = DateTime.UtcNow,
                Items = [.. selectedFood.Select(s => new FoodOrderItem
                {
                    FoodItemId = s.Item.Id,
                    Name = s.Item.Name,
                    UnitPrice = s.Item.DiscountPrice ?? s.Item.Price,
                    Quantity = s.Qty
                })]
            };
            order.TotalAmount = order.Items.Sum(i => i.UnitPrice * i.Quantity);
            db.FoodOrders.Add(order);
            await db.SaveChangesAsync();
        }

        await SendBookingEmailsAsync(booking, room);

        var confirmation = await settings.GetAsync("booking.confirmationMessage",
            "Thank you! Your reservation request has been received.");

        return Ok(new
        {
            message = confirmation,
            booking = BookingDto(booking, room.Name, room.CoverImage),
            advancePercent = await settings.GetIntAsync("booking.advancePercent", 30),
            paymentInstructions = await settings.GetAsync("booking.paymentInstructions")
        });
    }

    [HttpGet("bookings/{code}")]
    public async Task<IActionResult> LookupBooking(string code, [FromQuery] string? guestEmail = null)
    {
        var q = db.Bookings.Include(b => b.Room).AsNoTracking().Where(b => b.BookingCode == code);
        if (!string.IsNullOrWhiteSpace(guestEmail)) q = q.Where(b => b.GuestEmail == guestEmail.Trim().ToLowerInvariant());
        else if (!(User.Identity?.IsAuthenticated ?? false)) return Unauthorized(new { message = "Sign in or provide the booking email to view this reservation." });

        var b = await q.FirstOrDefaultAsync();
        return b is null ? NotFound(new { message = "No booking found with that reference." })
                         : Ok(BookingDto(b, b.Room?.Name ?? "", b.Room?.CoverImage));
    }

    // ------------------------------------------------------------- food

    [HttpGet("food")]
    public async Task<IActionResult> Food(int? categoryId = null, string? category = null, bool? featured = null,
        string? search = null, bool? veg = null, string? sort = null)
    {
        var q = db.FoodItems.AsNoTracking().Include(f => f.Category).Where(f => f.IsAvailable);
        if (categoryId is > 0) q = q.Where(f => f.CategoryId == categoryId);
        else if (!string.IsNullOrWhiteSpace(category)) q = q.Where(f => f.Category != null && f.Category.Slug == category);
        if (featured == true) q = q.Where(f => f.IsFeatured);
        if (veg == true) q = q.Where(f => f.IsVeg);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(f => f.Name.Contains(s) || (f.Description != null && f.Description.Contains(s)));
        }

        q = sort switch
        {
            "price_asc" => q.OrderBy(f => f.DiscountPrice ?? f.Price),
            "price_desc" => q.OrderByDescending(f => f.DiscountPrice ?? f.Price),
            "name" => q.OrderBy(f => f.Name),
            _ => q.OrderBy(f => f.CategoryId).ThenBy(f => f.SortOrder)
        };

        var items = await q.ToListAsync();
        return Ok(items.Select(f => new
        {
            f.Id,
            f.Name,
            f.Description,
            f.Price,
            f.DiscountPrice,
            finalPrice = f.DiscountPrice ?? f.Price,
            f.ImageUrl,
            f.IsVeg,
            f.SpiceLevel,
            f.IsFeatured,
            categoryId = f.CategoryId,
            category = f.Category?.Name,
            categorySlug = f.Category?.Slug
        }));
    }

    [HttpPost("food-orders")]
    public async Task<IActionResult> CreateFoodOrder([FromBody] CreateFoodOrderRequest req)
    {
        if (!await settings.GetBoolAsync("booking.enableFoodOrdering", true))
            return StatusCode(403, new { message = "Online food ordering is currently switched off." });
        if (req.Items.Count == 0) return BadRequest(new { message = "Please add at least one dish to your order." });

        var ids = req.Items.Select(i => i.FoodItemId).Distinct().ToList();
        var foods = await db.FoodItems.Where(f => ids.Contains(f.Id)).ToListAsync();
        if (foods.Count == 0) return BadRequest(new { message = "None of the selected dishes are available." });

        Booking? booking = null;
        if (!string.IsNullOrWhiteSpace(req.BookingCode))
            booking = await db.Bookings.FirstOrDefaultAsync(b => b.BookingCode == req.BookingCode.Trim());

        var user = await ResolveUserAsync();
        var order = new FoodOrder
        {
            OrderCode = await NextFoodOrderCodeAsync(),
            BookingId = booking?.Id,
            UserId = user?.Id ?? booking?.UserId,
            CustomerName = req.CustomerName.Trim(),
            Email = req.Email?.Trim().ToLowerInvariant() ?? booking?.GuestEmail,
            Phone = req.Phone?.Trim() ?? booking?.GuestPhone,
            OrderType = FoodOrderTypes.All.Contains(req.OrderType) ? req.OrderType : FoodOrderTypes.RoomService,
            Notes = req.Notes,
            Status = "New",
            CreatedAt = DateTime.UtcNow
        };

        foreach (var sel in req.Items)
        {
            var item = foods.FirstOrDefault(f => f.Id == sel.FoodItemId);
            if (item is null) continue;
            order.Items.Add(new FoodOrderItem
            {
                FoodItemId = item.Id,
                Name = item.Name,
                UnitPrice = item.DiscountPrice ?? item.Price,
                Quantity = Math.Clamp(sel.Quantity, 1, 50)
            });
        }
        if (order.Items.Count == 0) return BadRequest(new { message = "None of the selected dishes are available." });

        order.TotalAmount = order.Items.Sum(i => i.UnitPrice * i.Quantity);
        db.FoodOrders.Add(order);
        await db.SaveChangesAsync();

        var siteName = await settings.GetAsync("site.name");
        if (!string.IsNullOrWhiteSpace(order.Email))
            await email.SendAsync(order.Email!, $"Order {order.OrderCode} confirmed - {siteName}",
                OrderEmail(siteName, order), order.CustomerName);

        return Ok(new
        {
            message = $"Order {order.OrderCode} received. Our kitchen will start on it shortly.",
            order = new
            {
                order.Id,
                order.OrderCode,
                order.OrderType,
                order.TotalAmount,
                order.Status,
                items = order.Items.Select(i => new { i.Name, i.Quantity, i.UnitPrice, lineTotal = i.UnitPrice * i.Quantity })
            }
        });
    }

    // ------------------------------------------------------------ messages

    [HttpPost("contact")]
    public async Task<IActionResult> Contact([FromBody] ContactRequest req)
    {
        db.ContactMessages.Add(new ContactMessage
        {
            Name = req.Name.Trim(),
            Email = req.Email.Trim().ToLowerInvariant(),
            Phone = req.Phone?.Trim(),
            Subject = req.Subject?.Trim(),
            Message = req.Message.Trim(),
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var siteName = await settings.GetAsync("site.name");
        var to = await settings.GetAsync("email.fromEmail");
        if (!string.IsNullOrWhiteSpace(to))
            await email.SendAsync(to, $"New website enquiry from {req.Name}",
                $"<h3>New enquiry</h3><p><b>Name:</b> {req.Name}<br/><b>Email:</b> {req.Email}<br/><b>Phone:</b> {req.Phone}<br/><b>Subject:</b> {req.Subject}</p><p>{req.Message}</p>");

        log.LogInformation("Contact message received from {Email}", req.Email);
        return Ok(new { message = "Thank you for writing to us. Our reservations desk will reply shortly." });
    }

    [HttpPost("newsletter")]
    public async Task<IActionResult> Newsletter([FromBody] NewsletterRequest req)
    {
        var address = req.Email.Trim().ToLowerInvariant();
        var existing = await db.NewsletterSubscribers.FirstOrDefaultAsync(n => n.Email == address);
        if (existing is not null)
        {
            existing.IsActive = true;
            await db.SaveChangesAsync();
            return Ok(new { message = "You are already on the list - thanks for staying subscribed!" });
        }

        db.NewsletterSubscribers.Add(new NewsletterSubscriber { Email = address, CreatedAt = DateTime.UtcNow });
        await db.SaveChangesAsync();
        return Ok(new { message = "Subscribed. Look out for our seasonal offers." });
    }

    // --------------------------------------------------------------- helpers

    private static decimal NightlyRate(Room r)
    {
        var rate = r.PricePerNight;
        if (r.DiscountPercent > 0) rate -= Math.Round(rate * r.DiscountPercent / 100m, 2);
        return rate;
    }

    private static object RoomDto(Room r, List<string> images, int availableUnits) => new
    {
        r.Id,
        r.Name,
        r.Slug,
        categoryId = r.CategoryId,
        category = r.Category?.Name,
        r.ShortDescription,
        r.Description,
        r.PricePerNight,
        r.DiscountPercent,
        finalPrice = NightlyRate(r),
        r.RoomSize,
        r.BedType,
        r.MaxAdults,
        r.MaxChildren,
        r.TotalUnits,
        amenities = string.IsNullOrWhiteSpace(r.Amenities)
            ? Array.Empty<string>()
            : r.Amenities.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
        r.CoverImage,
        images,
        r.IsFeatured,
        availableUnits,
        isAvailable = availableUnits > 0
    };

    private static object BookingDto(Booking b, string roomName, string? roomImage) => new
    {
        b.Id,
        b.BookingCode,
        b.GuestName,
        b.GuestEmail,
        b.GuestPhone,
        b.RoomId,
        roomName,
        roomImage,
        checkIn = b.CheckIn.ToString("yyyy-MM-dd"),
        checkOut = b.CheckOut.ToString("yyyy-MM-dd"),
        b.Adults,
        b.Children,
        b.RoomCount,
        b.Nights,
        b.RoomAmount,
        b.FoodAmount,
        b.TaxAmount,
        b.TotalAmount,
        b.Status,
        b.PaymentStatus,
        b.PaymentMethod,
        b.SpecialRequest,
        createdAt = b.CreatedAt
    };

    private async Task<User?> ResolveUserAsync()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        var idClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(idClaim, out var id) ? await db.Users.FirstOrDefaultAsync(u => u.Id == id) : null;
    }

    private async Task<string> NextBookingCodeAsync()
    {
        var prefix = $"JR-{DateTime.UtcNow:yyMM}";
        var count = await db.Bookings.CountAsync(b => b.BookingCode.StartsWith(prefix));
        return $"{prefix}-{1001 + count}";
    }

    private async Task<string> NextFoodOrderCodeAsync()
    {
        var prefix = $"FO-{DateTime.UtcNow:yyMM}";
        var count = await db.FoodOrders.CountAsync(b => b.OrderCode.StartsWith(prefix));
        return $"{prefix}-{2001 + count}";
    }

    private async Task SendBookingEmailsAsync(Booking b, Room room)
    {
        var siteName = await settings.GetAsync("site.name");
        var body = BookingEmail(siteName, b, room.Name);

        await email.SendAsync(b.GuestEmail, $"Booking {b.BookingCode} received - {siteName}", body, b.GuestName);

        if (await settings.GetBoolAsync("email.sendBookingCopyToAdmin", true))
        {
            var to = await settings.GetAsync("email.fromEmail");
            if (!string.IsNullOrWhiteSpace(to))
                await email.SendAsync(to, $"[New booking] {b.BookingCode} - {room.Name}", body);
        }
    }

    private static string BookingEmail(string siteName, Booking b, string roomName) => $"""
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#22332c;max-width:620px">
          <h2 style="color:#0f5132;margin:0 0 4px">Reservation {b.BookingCode}</h2>
          <p style="color:#6b7b74;margin:0 0 20px">{siteName}</p>
          <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
            <tr><td style="background:#f7f4ee"><b>Guest</b></td><td>{b.GuestName} ({b.GuestEmail}, {b.GuestPhone})</td></tr>
            <tr><td style="background:#f7f4ee"><b>Room</b></td><td>{roomName} x {b.RoomCount}</td></tr>
            <tr><td style="background:#f7f4ee"><b>Check-in</b></td><td>{b.CheckIn:ddd, dd MMM yyyy}</td></tr>
            <tr><td style="background:#f7f4ee"><b>Check-out</b></td><td>{b.CheckOut:ddd, dd MMM yyyy} ({b.Nights} night(s))</td></tr>
            <tr><td style="background:#f7f4ee"><b>Guests</b></td><td>{b.Adults} adult(s), {b.Children} child(ren)</td></tr>
            <tr><td style="background:#f7f4ee"><b>Room amount</b></td><td>{b.RoomAmount:N2}</td></tr>
            <tr><td style="background:#f7f4ee"><b>Food amount</b></td><td>{b.FoodAmount:N2}</td></tr>
            <tr><td style="background:#f7f4ee"><b>Taxes</b></td><td>{b.TaxAmount:N2}</td></tr>
            <tr><td style="background:#e8f1ec"><b>Total</b></td><td><b>{b.TotalAmount:N2}</b></td></tr>
          </table>
          <p style="font-size:13px;color:#6b7b74">Status: <b>{b.Status}</b>. Our team will confirm your reservation shortly.</p>
        </div>
        """;

    private static string OrderEmail(string siteName, FoodOrder o) => $"""
        <div style="font-family:Segoe UI,Arial,sans-serif;color:#22332c;max-width:620px">
          <h2 style="color:#0f5132;margin:0 0 4px">Order {o.OrderCode}</h2>
          <p style="color:#6b7b74;margin:0 0 20px">{siteName} &middot; {o.OrderType}</p>
          <ul>
            {string.Join("", o.Items.Select(i => $"<li>{i.Quantity} x {i.Name} - {i.UnitPrice * i.Quantity:N2}</li>"))}
          </ul>
          <p><b>Total: {o.TotalAmount:N2}</b></p>
        </div>
        """;
}
