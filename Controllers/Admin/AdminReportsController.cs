using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin/reports")]
public class AdminReportsController(AppDbContext db) : ControllerBase
{
    // --------------------------------------------------------------- summary

    [HttpGet("summary")]
    public async Task<IActionResult> Summary(DateTime? from = null, DateTime? to = null)
    {
        var (start, end) = Range(from, to);
        var bookings = await db.Bookings.AsNoTracking()
            .Where(b => b.CreatedAt >= start && b.CreatedAt < end).ToListAsync();
        var orders = await db.FoodOrders.AsNoTracking()
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end).ToListAsync();

        var live = bookings.Where(b => b.Status != BookingStatuses.Cancelled).ToList();
        var staying = bookings.Count(b => b.Status == BookingStatuses.CheckedIn);
        var roomNights = live.Sum(b => b.Nights * b.RoomCount);
        var capacity = Math.Max(1, (await db.Rooms.Where(r => r.IsActive).SumAsync(r => (int?)r.TotalUnits) ?? 0) * Math.Max(1, (end - start).Days));

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            days = (end - start).Days,
            bookings = new
            {
                total = bookings.Count,
                confirmed = bookings.Count(b => b.Status == BookingStatuses.Confirmed),
                pending = bookings.Count(b => b.Status == BookingStatuses.Pending),
                checkedIn = staying,
                checkedOut = bookings.Count(b => b.Status == BookingStatuses.CheckedOut),
                cancelled = bookings.Count(b => b.Status == BookingStatuses.Cancelled),
                roomNights,
                averageStay = live.Count == 0 ? 0 : Math.Round(live.Average(b => b.Nights), 1),
                averageValue = live.Count == 0 ? 0 : Math.Round(live.Average(b => b.TotalAmount), 2)
            },
            revenue = new
            {
                total = live.Sum(b => b.TotalAmount),
                room = live.Sum(b => b.RoomAmount),
                food = live.Sum(b => b.FoodAmount),
                tax = live.Sum(b => b.TaxAmount),
                foodOrders = orders.Where(o => o.Status != "Cancelled").Sum(o => o.TotalAmount),
                collected = bookings.Where(b => b.PaymentStatus == PaymentStatuses.Paid).Sum(b => b.TotalAmount),
                pending = bookings.Where(b => b.PaymentStatus is PaymentStatuses.Unpaid or PaymentStatuses.Partial).Sum(b => b.TotalAmount),
                refunded = bookings.Where(b => b.PaymentStatus == PaymentStatuses.Refunded).Sum(b => b.TotalAmount)
            },
            occupancy = new
            {
                percent = Math.Round(roomNights / (double)capacity * 100, 1),
                roomNights,
                capacityNights = capacity
            },
            guests = new
            {
                adults = live.Sum(b => b.Adults),
                children = live.Sum(b => b.Children),
                newUsers = await db.Users.CountAsync(u => u.CreatedAt >= start && u.CreatedAt < end)
            },
            foodOrders = new
            {
                total = orders.Count,
                served = orders.Count(o => o.Status == "Served" || o.Status == "Billed"),
                pending = orders.Count(o => o.Status == "New" || o.Status == "Preparing"),
                averageValue = orders.Count == 0 ? 0 : Math.Round(orders.Average(o => o.TotalAmount), 2)
            },
            enquiries = await db.ContactMessages.CountAsync(m => m.CreatedAt >= start && m.CreatedAt < end)
        });
    }

    // --------------------------------------------------------------- revenue

    [HttpGet("revenue")]
    public async Task<IActionResult> Revenue(DateTime? from = null, DateTime? to = null, string groupBy = "day")
    {
        var (start, end) = Range(from, to);
        var bookings = await db.Bookings.AsNoTracking()
            .Where(b => b.CheckIn >= start && b.CheckIn < end && b.Status != BookingStatuses.Cancelled)
            .Select(b => new { b.CheckIn, b.RoomAmount, b.FoodAmount, b.TaxAmount, b.TotalAmount, b.RoomId, b.Nights, b.RoomCount, b.PaymentStatus })
            .ToListAsync();
        var orders = await db.FoodOrders.AsNoTracking()
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end && o.Status != "Cancelled")
            .Select(o => new { o.CreatedAt, o.TotalAmount })
            .ToListAsync();

        var points = groupBy == "month"
            ? bookings.GroupBy(b => new DateTime(b.CheckIn.Year, b.CheckIn.Month, 1)).OrderBy(g => g.Key)
                .Select(g => new
                {
                    label = g.Key.ToString("MMM yyyy"),
                    date = g.Key,
                    room = g.Sum(x => x.RoomAmount),
                    food = g.Sum(x => x.FoodAmount),
                    tax = g.Sum(x => x.TaxAmount),
                    total = g.Sum(x => x.TotalAmount),
                    bookings = g.Count()
                }).ToList<object>()
            : bookings.GroupBy(b => b.CheckIn.Date).OrderBy(g => g.Key)
                .Select(g => new
                {
                    label = g.Key.ToString("dd MMM"),
                    date = g.Key,
                    room = g.Sum(x => x.RoomAmount),
                    food = g.Sum(x => x.FoodAmount),
                    tax = g.Sum(x => x.TaxAmount),
                    total = g.Sum(x => x.TotalAmount),
                    bookings = g.Count()
                }).ToList<object>();

        var byRoom = await db.Bookings.AsNoTracking()
            .Where(b => b.CheckIn >= start && b.CheckIn < end && b.Status != BookingStatuses.Cancelled)
            .GroupBy(b => new { b.RoomId, Name = b.Room!.Name })
            .Select(g => new
            {
                room = g.Key.Name,
                bookings = g.Count(),
                nights = g.Sum(x => x.Nights * x.RoomCount),
                revenue = g.Sum(x => x.TotalAmount)
            })
            .OrderByDescending(x => x.revenue).ToListAsync();

        var byStatus = bookings.GroupBy(b => b.PaymentStatus)
            .Select(g => new { label = g.Key, value = g.Sum(x => x.TotalAmount) }).ToList();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            groupBy,
            totalRevenue = bookings.Sum(b => b.TotalAmount) + orders.Sum(o => o.TotalAmount),
            bookingRevenue = bookings.Sum(b => b.TotalAmount),
            onlineFoodRevenue = orders.Sum(o => o.TotalAmount),
            points,
            topRooms = byRoom,
            statusSplit = byStatus
        });
    }

    // -------------------------------------------------------------- bookings

    [HttpGet("bookings")]
    public async Task<IActionResult> Bookings(DateTime? from = null, DateTime? to = null, string? status = null, int? roomId = null)
    {
        var (start, end) = Range(from, to);
        var q = db.Bookings.AsNoTracking().Include(b => b.Room).AsQueryable();

        q = q.Where(b => b.CheckIn >= start && b.CheckIn < end);
        if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(b => b.Status == status);
        if (roomId is > 0) q = q.Where(b => b.RoomId == roomId);

        var rows = await q.OrderBy(b => b.CheckIn)
            .Select(b => new
            {
                b.Id,
                b.BookingCode,
                guest = b.GuestName,
                email = b.GuestEmail,
                phone = b.GuestPhone,
                room = b.Room != null ? b.Room.Name : "",
                checkIn = b.CheckIn,
                checkOut = b.CheckOut,
                b.Nights,
                b.RoomCount,
                guests = b.Adults + b.Children,
                b.RoomAmount,
                b.FoodAmount,
                b.TaxAmount,
                b.TotalAmount,
                b.Status,
                b.PaymentStatus,
                createdAt = b.CreatedAt
            }).ToListAsync();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            count = rows.Count,
            totals = new
            {
                roomAmount = rows.Sum(r => r.RoomAmount),
                foodAmount = rows.Sum(r => r.FoodAmount),
                tax = rows.Sum(r => r.TaxAmount),
                total = rows.Sum(r => r.TotalAmount),
                nights = rows.Sum(r => r.Nights * r.RoomCount)
            },
            rows
        });
    }

    // ------------------------------------------------------------------ food

    [HttpGet("food")]
    public async Task<IActionResult> Food(DateTime? from = null, DateTime? to = null)
    {
        var (start, end) = Range(from, to);
        var orders = await db.FoodOrders.AsNoTracking().Include(o => o.Items)
            .Where(o => o.CreatedAt >= start && o.CreatedAt < end).ToListAsync();

        var live = orders.Where(o => o.Status != "Cancelled").ToList();
        var items = live.SelectMany(o => o.Items)
            .GroupBy(i => i.Name)
            .Select(g => new
            {
                name = g.Key,
                quantity = g.Sum(x => x.Quantity),
                revenue = g.Sum(x => x.UnitPrice * x.Quantity)
            })
            .OrderByDescending(x => x.revenue).ToList();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            orderCount = orders.Count,
            revenue = live.Sum(o => o.TotalAmount),
            averageOrder = live.Count == 0 ? 0 : Math.Round(live.Average(o => o.TotalAmount), 2),
            byType = live.GroupBy(o => o.OrderType).Select(g => new { type = g.Key, count = g.Count(), revenue = g.Sum(x => x.TotalAmount) }).ToList(),
            byStatus = orders.GroupBy(o => o.Status).Select(g => new { status = g.Key, count = g.Count() }).ToList(),
            topItems = items.Take(25),
            totalItemsSold = items.Sum(i => i.quantity)
        });
    }

    // ------------------------------------------------------------- occupancy

    [HttpGet("occupancy")]
    public async Task<IActionResult> Occupancy(DateTime? from = null, DateTime? to = null)
    {
        var (start, end) = Range(from, to);
        var rooms = await db.Rooms.AsNoTracking().Where(r => r.IsActive)
            .Select(r => new { r.Id, r.Name, r.TotalUnits, r.CategoryId }).ToListAsync();

        var bookings = await db.Bookings.AsNoTracking()
            .Where(b => b.Status != BookingStatuses.Cancelled && b.Status != BookingStatuses.CheckedOut
                        && b.CheckIn < end && b.CheckOut > start)
            .Select(b => new { b.RoomId, b.CheckIn, b.CheckOut, b.RoomCount }).ToListAsync();

        var days = Math.Max(1, (end - start).Days);
        var perRoom = rooms.Select(r =>
        {
            var nights = 0;
            foreach (var b in bookings.Where(x => x.RoomId == r.Id))
            {
                var s = b.CheckIn < start ? start : b.CheckIn;
                var e = b.CheckOut > end ? end : b.CheckOut;
                var n = (e - s).Days;
                if (n > 0) nights += n * b.RoomCount;
            }
            var capacity = r.TotalUnits * days;
            return new
            {
                room = r.Name,
                units = r.TotalUnits,
                roomNights = nights,
                capacityNights = capacity,
                occupancy = capacity == 0 ? 0 : Math.Round(nights / (double)capacity * 100, 1)
            };
        }).OrderByDescending(x => x.occupancy).ToList();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            days,
            averageOccupancy = perRoom.Count == 0 ? 0 : Math.Round(perRoom.Average(x => x.occupancy), 1),
            rooms = perRoom
        });
    }

    // ----------------------------------------------------------------- users

    [HttpGet("users")]
    public async Task<IActionResult> Users(DateTime? from = null, DateTime? to = null)
    {
        var (start, end) = Range(from, to);
        var users = await db.Users.AsNoTracking().Where(u => u.CreatedAt >= start && u.CreatedAt < end)
            .OrderBy(u => u.CreatedAt)
            .Select(u => new
            {
                u.Id, u.FullName, u.Email, u.Phone, u.Role, u.IsEmailVerified, u.IsActive,
                createdAt = u.CreatedAt, lastLoginAt = u.LastLoginAt
            }).ToListAsync();

        return Ok(new
        {
            from = start,
            to = end.AddDays(-1),
            total = users.Count,
            verified = users.Count(u => u.IsEmailVerified),
            byRole = users.GroupBy(u => u.Role).Select(g => new { role = g.Key, count = g.Count() }).ToList(),
            rows = users
        });
    }

    // ------------------------------------------------------------------ csv

    [HttpGet("export")]
    public async Task<IActionResult> Export(string type = "bookings", DateTime? from = null, DateTime? to = null)
    {
        var (start, end) = Range(from, to);
        var sb = new StringBuilder();
        string fileName;

        switch (type.ToLowerInvariant())
        {
            case "food":
            {
                fileName = $"food-orders-{start:yyyyMMdd}-{end:yyyyMMdd}.csv";
                sb.AppendLine("Order Code,Date,Customer,Phone,Type,Status,Items,Total");
                var orders = await db.FoodOrders.AsNoTracking().Include(o => o.Items)
                    .Where(o => o.CreatedAt >= start && o.CreatedAt < end).OrderBy(o => o.CreatedAt).ToListAsync();
                foreach (var o in orders)
                {
                    var items = string.Join(" | ", o.Items.Select(i => $"{i.Quantity}x {i.Name}"));
                    sb.AppendLine($"{o.OrderCode},{o.CreatedAt:yyyy-MM-dd HH:mm},{Csv(o.CustomerName)},{Csv(o.Phone)},{o.OrderType},{o.Status},{Csv(items)},{o.TotalAmount:0.00}");
                }
                break;
            }
            case "users":
            {
                fileName = $"users-{start:yyyyMMdd}-{end:yyyyMMdd}.csv";
                sb.AppendLine("Id,Name,Email,Phone,Role,Email Verified,Active,Registered,Last Login");
                var users = await db.Users.AsNoTracking()
                    .Where(u => u.CreatedAt >= start && u.CreatedAt < end).OrderBy(u => u.CreatedAt).ToListAsync();
                foreach (var u in users)
                    sb.AppendLine($"{u.Id},{Csv(u.FullName)},{u.Email},{Csv(u.Phone)},{u.Role},{u.IsEmailVerified},{u.IsActive},{u.CreatedAt:yyyy-MM-dd},{u.LastLoginAt:yyyy-MM-dd HH:mm}");
                break;
            }
            case "revenue":
            {
                fileName = $"revenue-{start:yyyyMMdd}-{end:yyyyMMdd}.csv";
                sb.AppendLine("Month,Room Revenue,Food Revenue,Tax,Total");
                var bookings = await db.Bookings.AsNoTracking()
                    .Where(b => b.CheckIn >= start && b.CheckIn < end && b.Status != BookingStatuses.Cancelled)
                    .Select(b => new { b.CheckIn, b.RoomAmount, b.FoodAmount, b.TaxAmount, b.TotalAmount }).ToListAsync();
                foreach (var g in bookings.GroupBy(b => new DateTime(b.CheckIn.Year, b.CheckIn.Month, 1)).OrderBy(g => g.Key))
                    sb.AppendLine($"{g.Key:MMM yyyy},{g.Sum(x => x.RoomAmount):0.00},{g.Sum(x => x.FoodAmount):0.00},{g.Sum(x => x.TaxAmount):0.00},{g.Sum(x => x.TotalAmount):0.00}");
                break;
            }
            default:
            {
                fileName = $"bookings-{start:yyyyMMdd}-{end:yyyyMMdd}.csv";
                sb.AppendLine("Booking Code,Guest,Email,Phone,Room,Check In,Check Out,Nights,Rooms,Adults,Children,Room Amount,Food Amount,Tax,Total,Status,Payment");
                var rows = await db.Bookings.AsNoTracking().Include(b => b.Room)
                    .Where(b => b.CheckIn >= start && b.CheckIn < end).OrderBy(b => b.CheckIn).ToListAsync();
                foreach (var b in rows)
                    sb.AppendLine($"{b.BookingCode},{Csv(b.GuestName)},{b.GuestEmail},{Csv(b.GuestPhone)},{Csv(b.Room?.Name)},{b.CheckIn:yyyy-MM-dd},{b.CheckOut:yyyy-MM-dd},{b.Nights},{b.RoomCount},{b.Adults},{b.Children},{b.RoomAmount:0.00},{b.FoodAmount:0.00},{b.TaxAmount:0.00},{b.TotalAmount:0.00},{b.Status},{b.PaymentStatus}");
                break;
            }
        }

        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv", fileName);
    }

    private static (DateTime Start, DateTime End) Range(DateTime? from, DateTime? to)
    {
        var start = (from ?? DateTime.UtcNow.Date.AddDays(-29)).Date;
        var end = (to ?? DateTime.UtcNow.Date).Date.AddDays(1);
        if (end <= start) end = start.AddDays(1);
        return (start, end);
    }

    private static string Csv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var v = value.Replace("\"", "\"\"");
        return v.Contains(',') || v.Contains('"') || v.Contains('\n') ? $"\"{v}\"" : v;
    }
}
