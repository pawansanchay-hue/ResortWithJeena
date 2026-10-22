using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Dtos;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminBookingsController(AppDbContext db, AuditService audit, IEmailSender email, SettingsService settings) : ControllerBase
{
    // -------------------------------------------------------------- bookings

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings(string? status = null, string? search = null, int? roomId = null,
        int? userId = null, DateTime? from = null, DateTime? to = null, int page = 1, int pageSize = 25)
    {
        var q = db.Bookings.AsNoTracking().Include(b => b.Room).AsQueryable();

        if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(b => b.Status == status);
        if (roomId is > 0) q = q.Where(b => b.RoomId == roomId);
        if (userId is > 0) q = q.Where(b => b.UserId == userId);
        if (from is { } f) q = q.Where(b => b.CheckIn >= f.Date);
        if (to is { } t) q = q.Where(b => b.CheckIn <= t.Date);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(b => b.BookingCode.Contains(s) || b.GuestName.Contains(s)
                          || b.GuestEmail.Contains(s) || b.GuestPhone.Contains(s));
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var total = await q.CountAsync();

        var items = await q.OrderByDescending(b => b.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        var summary = await q.GroupBy(b => b.Status)
            .Select(g => new { Status = g.Key, Count = g.Count(), Amount = g.Sum(x => x.TotalAmount) })
            .ToListAsync();

        return Ok(new
        {
            total, page, pageSize, pages = (int)Math.Ceiling(total / (double)pageSize),
            summary,
            items = items.Select(b => new
            {
                b.Id,
                b.BookingCode,
                b.GuestName,
                b.GuestEmail,
                b.GuestPhone,
                b.UserId,
                b.RoomId,
                roomName = b.Room != null ? b.Room.Name : null,
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
                b.PaymentMethod,
                b.SpecialRequest,
                b.AdminNote,
                createdAt = b.CreatedAt
            })
        });
    }

    [HttpGet("bookings/{id:int}")]
    public async Task<IActionResult> Booking(int id)
    {
        var b = await db.Bookings.AsNoTracking()
            .Include(x => x.Room).Include(x => x.User)
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
            b.UserId,
            userEmail = b.User?.Email,
            b.RoomId,
            roomName = b.Room?.Name,
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
            b.PaymentMethod,
            b.SpecialRequest,
            b.AdminNote,
            createdAt = b.CreatedAt,
            updatedAt = b.UpdatedAt,
            foodOrders = b.FoodOrders.Select(o => new
            {
                o.Id, o.OrderCode, o.OrderType, o.Status, o.TotalAmount, createdAt = o.CreatedAt,
                items = o.Items.Select(i => new { i.Name, i.Quantity, i.UnitPrice })
            })
        });
    }

    [HttpPut("bookings/{id:int}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest req)
    {
        var b = await db.Bookings.Include(x => x.Room).FirstOrDefaultAsync(x => x.Id == id);
        if (b is null) return NotFound(new { message = "Booking not found." });
        if (!BookingStatuses.All.Contains(req.Status))
            return BadRequest(new { message = "Unknown status." });

        var old = b.Status;
        b.Status = req.Status;
        b.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        await audit.LogAsync("Booking status changed", "Booking", b.BookingCode, $"{old} -> {req.Status}");

        await email.SendAsync(b.GuestEmail, $"Your booking {b.BookingCode} is now {b.Status}",
            $"<p>Hello {b.GuestName},</p><p>The status of your reservation <b>{b.BookingCode}</b> has changed from <b>{old}</b> to <b>{b.Status}</b>.</p>",
            b.GuestName);

        return Ok(new { message = $"Booking {b.BookingCode} marked as {b.Status}." });
    }

    [HttpPut("bookings/{id:int}")]
    public async Task<IActionResult> UpdateBooking(int id, [FromBody] Booking input)
    {
        var b = await db.Bookings.FindAsync(id);
        if (b is null) return NotFound(new { message = "Booking not found." });

        b.GuestName = input.GuestName;
        b.GuestEmail = input.GuestEmail.ToLowerInvariant();
        b.GuestPhone = input.GuestPhone;
        b.RoomId = input.RoomId;
        b.CheckIn = input.CheckIn.Date;
        b.CheckOut = input.CheckOut.Date;
        b.Nights = Math.Max(1, (b.CheckOut - b.CheckIn).Days);
        b.Adults = input.Adults;
        b.Children = input.Children;
        b.RoomCount = input.RoomCount;
        b.RoomAmount = input.RoomAmount;
        b.FoodAmount = input.FoodAmount;
        b.TaxAmount = input.TaxAmount;
        b.TotalAmount = input.TotalAmount;
        if (BookingStatuses.All.Contains(input.Status)) b.Status = input.Status;
        if (PaymentStatuses.All.Contains(input.PaymentStatus)) b.PaymentStatus = input.PaymentStatus;
        b.PaymentMethod = input.PaymentMethod;
        b.SpecialRequest = input.SpecialRequest;
        b.AdminNote = input.AdminNote;
        b.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await audit.LogAsync("Booking updated", "Booking", b.BookingCode);
        return Ok(new { message = $"Booking {b.BookingCode} saved." });
    }

    [HttpPost("bookings")]
    public async Task<IActionResult> CreateBooking([FromBody] Booking input)
    {
        var room = await db.Rooms.FindAsync(input.RoomId);
        if (room is null) return BadRequest(new { message = "Choose a valid room." });

        var nights = Math.Max(1, (input.CheckOut.Date - input.CheckIn.Date).Days);
        var taxPercent = await settings.GetDecimalAsync("booking.taxPercent", 12);
        var nightly = room.PricePerNight - Math.Round(room.PricePerNight * room.DiscountPercent / 100m, 2);

        input.Id = 0;
        input.BookingCode = await NextCodeAsync();
        input.CheckIn = input.CheckIn.Date;
        input.CheckOut = input.CheckOut.Date;
        input.Nights = nights;
        if (input.RoomAmount <= 0) input.RoomAmount = nightly * nights * Math.Max(1, input.RoomCount);
        if (input.TaxAmount <= 0) input.TaxAmount = Math.Round((input.RoomAmount + input.FoodAmount) * taxPercent / 100m, 2);
        if (input.TotalAmount <= 0) input.TotalAmount = input.RoomAmount + input.FoodAmount + input.TaxAmount;
        input.GuestEmail = input.GuestEmail.ToLowerInvariant();
        input.CreatedAt = DateTime.UtcNow;

        db.Bookings.Add(input);
        await db.SaveChangesAsync();
        await audit.LogAsync("Booking created", "Booking", input.BookingCode, $"{input.GuestName} / room {room.Name}");
        return Ok(new { message = $"Booking {input.BookingCode} created.", id = input.Id, code = input.BookingCode });
    }

    [HttpDelete("bookings/{id:int}")]
    public async Task<IActionResult> DeleteBooking(int id)
    {
        var b = await db.Bookings.FindAsync(id);
        if (b is null) return NotFound(new { message = "Booking not found." });
        db.Bookings.Remove(b);
        await db.SaveChangesAsync();
        await audit.LogAsync("Booking deleted", "Booking", b.BookingCode);
        return Ok(new { message = "Booking deleted." });
    }

    // ----------------------------------------------------------- food orders

    [HttpGet("food-orders")]
    public async Task<IActionResult> Orders(string? status = null, string? search = null, DateTime? from = null, DateTime? to = null)
    {
        var q = db.FoodOrders.AsNoTracking().Include(o => o.Items).AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(o => o.Status == status);
        if (from is { } f) q = q.Where(o => o.CreatedAt >= f.Date);
        if (to is { } t) q = q.Where(o => o.CreatedAt < t.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(o => o.OrderCode.Contains(s) || o.CustomerName.Contains(s) || (o.Phone != null && o.Phone.Contains(s)));
        }

        var list = await q.OrderByDescending(o => o.CreatedAt).Take(300).ToListAsync();
        return Ok(new
        {
            total = list.Count,
            revenue = list.Where(o => o.Status != "Cancelled").Sum(o => o.TotalAmount),
            items = list.Select(o => new
            {
                o.Id,
                o.OrderCode,
                o.CustomerName,
                o.Email,
                o.Phone,
                o.OrderType,
                o.Status,
                o.TotalAmount,
                o.Notes,
                o.BookingId,
                createdAt = o.CreatedAt,
                items = o.Items.Select(i => new { i.Name, i.Quantity, i.UnitPrice, lineTotal = i.UnitPrice * i.Quantity })
            })
        });
    }

    [HttpPut("food-orders/{id:int}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] StatusUpdateRequest req)
    {
        var o = await db.FoodOrders.FindAsync(id);
        if (o is null) return NotFound(new { message = "Order not found." });
        o.Status = req.Status;
        await db.SaveChangesAsync();
        await audit.LogAsync("Food order status changed", "FoodOrder", o.OrderCode, req.Status);
        return Ok(new { message = $"Order {o.OrderCode} is now {o.Status}." });
    }

    [HttpDelete("food-orders/{id:int}")]
    public async Task<IActionResult> DeleteOrder(int id)
    {
        var o = await db.FoodOrders.FindAsync(id);
        if (o is null) return NotFound(new { message = "Order not found." });
        db.FoodOrders.Remove(o);
        await db.SaveChangesAsync();
        return Ok(new { message = "Order deleted." });
    }

    // -------------------------------------------------------------- messages

    [HttpGet("messages")]
    public async Task<IActionResult> Messages(bool? unreadOnly = null)
    {
        var q = db.ContactMessages.AsNoTracking().AsQueryable();
        if (unreadOnly == true) q = q.Where(m => !m.IsRead);
        var list = await q.OrderByDescending(m => m.CreatedAt).Take(300).ToListAsync();
        return Ok(new
        {
            total = list.Count,
            unread = list.Count(m => !m.IsRead),
            items = list
        });
    }

    [HttpPut("messages/{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id, [FromQuery] bool read = true)
    {
        var m = await db.ContactMessages.FindAsync(id);
        if (m is null) return NotFound(new { message = "Message not found." });
        m.IsRead = read;
        await db.SaveChangesAsync();
        return Ok(new { message = read ? "Marked as read." : "Marked as unread." });
    }

    [HttpPost("messages/{id:int}/reply")]
    public async Task<IActionResult> Reply(int id, [FromBody] ReplyRequest req)
    {
        var m = await db.ContactMessages.FindAsync(id);
        if (m is null) return NotFound(new { message = "Message not found." });
        if (string.IsNullOrWhiteSpace(req.Message)) return BadRequest(new { message = "Write a reply first." });

        var siteName = await settings.GetAsync("site.name");
        var result = await email.SendAsync(m.Email, $"Re: {m.Subject ?? "Your enquiry"} - {siteName}",
            $"<p>Hello {m.Name},</p><p>{req.Message.Replace("\n", "<br/>")}</p><p>Warm regards,<br/>{siteName}</p>", m.Name);

        m.Reply = req.Message;
        m.IsRead = true;
        await db.SaveChangesAsync();
        await audit.LogAsync("Replied to enquiry", "ContactMessage", id, m.Email);

        return Ok(new { message = result.Sent ? "Reply sent." : "Reply saved. SMTP is off so it was written to App_Data/outbox instead." });
    }

    [HttpDelete("messages/{id:int}")]
    public async Task<IActionResult> DeleteMessage(int id)
    {
        var m = await db.ContactMessages.FindAsync(id);
        if (m is null) return NotFound(new { message = "Message not found." });
        db.ContactMessages.Remove(m);
        await db.SaveChangesAsync();
        return Ok(new { message = "Message deleted." });
    }

    // ------------------------------------------------------------ newsletter

    [HttpGet("newsletter")]
    public async Task<IActionResult> Newsletter() => Ok(await db.NewsletterSubscribers.AsNoTracking()
        .OrderByDescending(n => n.CreatedAt).ToListAsync());

    [HttpDelete("newsletter/{id:int}")]
    public async Task<IActionResult> DeleteSubscriber(int id)
    {
        var n = await db.NewsletterSubscribers.FindAsync(id);
        if (n is null) return NotFound(new { message = "Subscriber not found." });
        db.NewsletterSubscribers.Remove(n);
        await db.SaveChangesAsync();
        return Ok(new { message = "Subscriber removed." });
    }

    private async Task<string> NextCodeAsync()
    {
        var prefix = $"JR-{DateTime.UtcNow:yyMM}";
        var count = await db.Bookings.CountAsync(b => b.BookingCode.StartsWith(prefix));
        return $"{prefix}-{1001 + count}";
    }
}

public class ReplyRequest
{
    public string Message { get; set; } = "";
}
