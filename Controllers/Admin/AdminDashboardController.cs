using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin/dashboard")]
public class AdminDashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var today = DateTime.UtcNow.Date;
        var monthStart = new DateTime(today.Year, today.Month, 1);
        var last14 = today.AddDays(-13);

        var allBookings = await db.Bookings.AsNoTracking()
            .Include(b => b.Room)
            .Select(b => new
            {
                b.Id, b.BookingCode, b.GuestName, b.GuestEmail, b.GuestPhone, b.RoomId,
                roomName = b.Room != null ? b.Room.Name : null,
                b.CheckIn, b.CheckOut, b.Nights, b.RoomCount, b.Adults, b.Children,
                b.TotalAmount, b.Status, b.PaymentStatus, b.CreatedAt
            }).ToListAsync();

        var live = allBookings.Where(b => b.Status != BookingStatuses.Cancelled).ToList();

        var orders = await db.FoodOrders.AsNoTracking()
            .Select(o => new { o.Id, o.OrderCode, o.CustomerName, o.Status, o.TotalAmount, o.CreatedAt, o.OrderType })
            .ToListAsync();

        var revenuePoints = Enumerable.Range(0, 14).Select(i =>
        {
            var day = last14.AddDays(i);
            var dayBookings = live.Where(b => b.CheckIn.Date == day).ToList();
            return new
            {
                label = day.ToString("dd MMM"),
                date = day,
                total = dayBookings.Sum(b => b.TotalAmount),
                bookings = dayBookings.Count
            };
        }).ToList();

        var roomCount = await db.Rooms.CountAsync();
        var activeRooms = await db.Rooms.CountAsync(r => r.IsActive);
        var totalUnits = await db.Rooms.Where(r => r.IsActive).SumAsync(r => (int?)r.TotalUnits) ?? 0;
        var occupiedUnits = live.Where(b => b.CheckIn <= today && b.CheckOut > today
                                            && (b.Status == BookingStatuses.Confirmed || b.Status == BookingStatuses.CheckedIn))
                                .Sum(b => b.RoomCount);

        return Ok(new
        {
            generatedAt = DateTime.Now,
            cards = new
            {
                totalRevenue = live.Sum(b => b.TotalAmount),
                monthRevenue = live.Where(b => b.CreatedAt >= monthStart).Sum(b => b.TotalAmount),
                todayRevenue = live.Where(b => b.CreatedAt.Date == today).Sum(b => b.TotalAmount),
                totalBookings = allBookings.Count,
                pendingBookings = allBookings.Count(b => b.Status == BookingStatuses.Pending),
                activeStays = allBookings.Count(b => b.Status == BookingStatuses.CheckedIn),
                arrivalsToday = allBookings.Count(b => b.CheckIn.Date == today && b.Status != BookingStatuses.Cancelled),
                departuresToday = allBookings.Count(b => b.CheckOut.Date == today && b.Status != BookingStatuses.Cancelled),
                cancelled = allBookings.Count(b => b.Status == BookingStatuses.Cancelled),
                foodOrders = orders.Count,
                pendingFoodOrders = orders.Count(o => o.Status is "New" or "Preparing"),
                foodRevenue = orders.Where(o => o.Status != "Cancelled").Sum(o => o.TotalAmount),
                totalUsers = await db.Users.CountAsync(),
                newUsersThisMonth = await db.Users.CountAsync(u => u.CreatedAt >= monthStart),
                unreadMessages = await db.ContactMessages.CountAsync(m => !m.IsRead),
                subscribers = await db.NewsletterSubscribers.CountAsync(n => n.IsActive),
                totalRooms = roomCount,
                activeRooms,
                occupancyPercent = totalUnits == 0 ? 0 : Math.Round(occupiedUnits / (double)totalUnits * 100, 1),
                occupiedUnits,
                totalUnits
            },
            revenueTrend = revenuePoints,
            statusSplit = allBookings.GroupBy(b => b.Status)
                .Select(g => new { status = g.Key, count = g.Count(), amount = g.Sum(x => x.TotalAmount) })
                .ToList(),
            recentBookings = allBookings.OrderByDescending(b => b.CreatedAt).Take(8)
                .Select(b => new
                {
                    b.Id, b.BookingCode, b.GuestName, b.GuestEmail, b.roomName,
                    checkIn = b.CheckIn, checkOut = b.CheckOut, b.Nights, b.TotalAmount, b.Status, b.PaymentStatus,
                    createdAt = b.CreatedAt
                }),
            upcomingArrivals = allBookings
                .Where(b => b.CheckIn.Date >= today && b.Status != BookingStatuses.Cancelled)
                .OrderBy(b => b.CheckIn).Take(6)
                .Select(b => new { b.Id, b.BookingCode, b.GuestName, b.roomName, checkIn = b.CheckIn, b.Adults, b.Children, b.Status }),
            recentOrders = orders.OrderByDescending(o => o.CreatedAt).Take(6),
            recentMessages = await db.ContactMessages.AsNoTracking()
                .OrderByDescending(m => m.CreatedAt).Take(5)
                .Select(m => new { m.Id, m.Name, m.Email, m.Subject, m.IsRead, createdAt = m.CreatedAt })
                .ToListAsync(),
            topRooms = live.GroupBy(b => b.roomName)
                .Select(g => new { room = g.Key, bookings = g.Count(), revenue = g.Sum(x => x.TotalAmount) })
                .OrderByDescending(x => x.revenue).Take(5).ToList(),
            recentActivity = await db.AuditLogs.AsNoTracking()
                .OrderByDescending(a => a.CreatedAt).Take(8).ToListAsync()
        });
    }
}
