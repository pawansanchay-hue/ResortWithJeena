using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Controllers;

[ApiController]
[Authorize]
[Route("api/account")]
public class AccountController(AppDbContext db) : ControllerBase
{
    private int? UserId
    {
        get
        {
            var raw = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }
    }

    private string? UserEmail => User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value?.ToLowerInvariant();

    [HttpGet("summary")]
    public async Task<IActionResult> Summary()
    {
        var user = await CurrentUserAsync();
        if (user is null) return Unauthorized();

        var bookings = await MyBookings().ToListAsync();
        var today = DateTime.UtcNow.Date;

        return Ok(new
        {
            user = new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Phone,
                user.Role,
                user.AvatarUrl,
                user.CreatedAt,
                user.IsEmailVerified
            },
            stats = new
            {
                totalBookings = bookings.Count,
                upcoming = bookings.Count(b => b.CheckIn >= today && b.Status != BookingStatuses.Cancelled),
                completed = bookings.Count(b => b.Status == BookingStatuses.CheckedOut),
                cancelled = bookings.Count(b => b.Status == BookingStatuses.Cancelled),
                totalSpent = bookings.Where(b => b.Status != BookingStatuses.Cancelled).Sum(b => b.TotalAmount),
                nightsStayed = bookings.Where(b => b.Status == BookingStatuses.CheckedOut).Sum(b => b.Nights)
            }
        });
    }

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings(string? status = null)
    {
        var q = MyBookings();
        if (!string.IsNullOrWhiteSpace(status) && status != "All")
            q = q.Where(b => b.Status == status);

        var list = await q.OrderByDescending(b => b.CheckIn).ToListAsync();
        return Ok(list.Select(b => new
        {
            b.Id,
            b.BookingCode,
            b.RoomId,
            roomName = b.Room != null ? b.Room.Name : "Room",
            roomImage = b.Room != null ? b.Room.CoverImage : null,
            checkIn = b.CheckIn.ToString("yyyy-MM-dd"),
            checkOut = b.CheckOut.ToString("yyyy-MM-dd"),
            b.Nights,
            b.Adults,
            b.Children,
            b.RoomCount,
            b.RoomAmount,
            b.FoodAmount,
            b.TaxAmount,
            b.TotalAmount,
            b.Status,
            b.PaymentStatus,
            b.SpecialRequest,
            createdAt = b.CreatedAt,
            canCancel = (b.Status == BookingStatuses.Pending || b.Status == BookingStatuses.Confirmed) && b.CheckIn > DateTime.UtcNow.Date
        }));
    }

    [HttpGet("bookings/{id:int}")]
    public async Task<IActionResult> Booking(int id)
    {
        var b = await MyBookings().Include(x => x.Room).ThenInclude(r => r!.Images)
            .Include(x => x.FoodOrders).ThenInclude(f => f.Items)
            .FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound(new { message = "Booking not found." });

        return Ok(new
        {
            b.Id,
            b.BookingCode,
            b.GuestName,
            b.GuestEmail,
            b.GuestPhone,
            roomName = b.Room?.Name,
            roomImage = b.Room?.CoverImage,
            checkIn = b.CheckIn.ToString("yyyy-MM-dd"),
            checkOut = b.CheckOut.ToString("yyyy-MM-dd"),
            b.Nights,
            b.Adults,
            b.Children,
            b.RoomCount,
            b.RoomAmount,
            b.FoodAmount,
            b.TaxAmount,
            b.TotalAmount,
            b.Status,
            b.PaymentStatus,
            b.SpecialRequest,
            foodOrders = b.FoodOrders.Select(o => new
            {
                o.OrderCode,
                o.OrderType,
                o.Status,
                o.TotalAmount,
                createdAt = o.CreatedAt,
                items = o.Items.Select(i => new { i.Name, i.Quantity, i.UnitPrice })
            })
        });
    }

    [HttpPost("bookings/{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id)
    {
        var b = await MyBookings().FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound(new { message = "Booking not found." });
        if (b.Status == BookingStatuses.Cancelled) return BadRequest(new { message = "This booking is already cancelled." });
        if (b.Status is BookingStatuses.CheckedIn or BookingStatuses.CheckedOut)
            return BadRequest(new { message = "Checked-in bookings cannot be cancelled online. Please call the resort." });
        if (b.CheckIn <= DateTime.UtcNow.Date)
            return BadRequest(new { message = "This stay has already started. Please call the resort to make changes." });

        b.Status = BookingStatuses.Cancelled;
        b.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Ok(new { message = $"Booking {b.BookingCode} has been cancelled. Any refundable amount will be processed within 5 working days." });
    }

    [HttpGet("orders")]
    public async Task<IActionResult> Orders()
    {
        var q = db.FoodOrders.AsNoTracking().Include(o => o.Items).AsQueryable();
        if (UserId is { } uid && UserEmail is { } em)
            q = q.Where(o => o.UserId == uid || o.Email == em);
        else if (UserEmail is { } email2)
            q = q.Where(o => o.Email == email2);
        else return Ok(Array.Empty<object>());

        var list = await q.OrderByDescending(o => o.CreatedAt).Take(100).ToListAsync();
        return Ok(list.Select(o => new
        {
            o.Id,
            o.OrderCode,
            o.OrderType,
            o.Status,
            o.TotalAmount,
            o.Notes,
            createdAt = o.CreatedAt,
            items = o.Items.Select(i => new { i.Name, i.Quantity, i.UnitPrice, lineTotal = i.UnitPrice * i.Quantity })
        }));
    }

    private IQueryable<Booking> MyBookings()
    {
        var q = db.Bookings.AsNoTracking().Include(b => b.Room).AsQueryable();
        if (UserId is { } uid && UserEmail is { } em) return q.Where(b => b.UserId == uid || b.GuestEmail == em);
        if (UserEmail is { } emailOnly) return q.Where(b => b.GuestEmail == emailOnly);
        return q.Where(b => false);
    }

    private async Task<User?> CurrentUserAsync()
        => UserId is { } id ? await db.Users.FirstOrDefaultAsync(u => u.Id == id) : null;
}
