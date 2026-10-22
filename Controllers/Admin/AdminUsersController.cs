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
public class AdminUsersController(AppDbContext db, AuditService audit) : ControllerBase
{
    [HttpGet("users")]
    public async Task<IActionResult> Users(string? search = null, string? role = null, string? status = null,
        int page = 1, int pageSize = 25)
    {
        var q = db.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            q = q.Where(u => u.FullName.Contains(s) || u.Email.Contains(s) || (u.Phone != null && u.Phone.Contains(s)));
        }
        if (!string.IsNullOrWhiteSpace(role) && role != "All") q = q.Where(u => u.Role == role);
        if (status == "active") q = q.Where(u => u.IsActive);
        if (status == "disabled") q = q.Where(u => !u.IsActive);
        if (status == "unverified") q = q.Where(u => !u.IsEmailVerified);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        var total = await q.CountAsync();

        var users = await q.OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var ids = users.Select(u => u.Id).ToList();

        var bookingStats = await db.Bookings.AsNoTracking()
            .Where(b => b.UserId != null && ids.Contains(b.UserId.Value))
            .GroupBy(b => b.UserId!.Value)
            .Select(g => new { UserId = g.Key, Count = g.Count(), Spent = g.Where(x => x.Status != BookingStatuses.Cancelled).Sum(x => x.TotalAmount) })
            .ToDictionaryAsync(x => x.UserId, x => x);

        return Ok(new
        {
            total, page, pageSize, pages = (int)Math.Ceiling(total / (double)pageSize),
            roles = Roles.All,
            items = users.Select(u => new
            {
                u.Id,
                u.FullName,
                u.Email,
                u.Phone,
                u.Role,
                u.IsEmailVerified,
                u.IsActive,
                u.AvatarUrl,
                u.CreatedAt,
                u.LastLoginAt,
                bookings = bookingStats.GetValueOrDefault(u.Id)?.Count ?? 0,
                spent = bookingStats.GetValueOrDefault(u.Id)?.Spent ?? 0
            })
        });
    }

    [HttpGet("users/{id:int}")]
    public async Task<IActionResult> UserDetail(int id)
    {
        var u = await db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (u is null) return NotFound(new { message = "User not found." });

        return Ok(new
        {
            u.Id, u.FullName, u.Email, u.Phone, u.Role, u.IsEmailVerified, u.IsActive,
            u.AvatarUrl, u.CreatedAt, u.LastLoginAt,
            bookings = await db.Bookings.AsNoTracking().Include(b => b.Room)
                .Where(b => b.UserId == id || b.GuestEmail == u.Email)
                .OrderByDescending(b => b.CreatedAt).Take(50)
                .Select(b => new { b.Id, b.BookingCode, room = b.Room != null ? b.Room.Name : null, b.Status, b.TotalAmount, checkIn = b.CheckIn, checkOut = b.CheckOut })
                .ToListAsync(),
            orders = await db.FoodOrders.AsNoTracking()
                .Where(o => o.UserId == id || o.Email == u.Email)
                .OrderByDescending(o => o.CreatedAt).Take(50)
                .Select(o => new { o.Id, o.OrderCode, o.Status, o.TotalAmount, createdAt = o.CreatedAt })
                .ToListAsync()
        });
    }

    [HttpPost("users")]
    public async Task<IActionResult> Create([FromBody] AdminCreateUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.FullName))
            return BadRequest(new { message = "Name and email are required." });
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            return BadRequest(new { message = "Provide a password of at least 6 characters." });

        var address = req.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == address))
            return Conflict(new { message = "An account with this email already exists." });

        var user = new User
        {
            FullName = req.FullName.Trim(),
            Email = address,
            Phone = req.Phone?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = Roles.All.Contains(req.Role) ? req.Role : Roles.Customer,
            IsEmailVerified = req.IsEmailVerified,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();
        await audit.LogAsync("User created", "User", user.Id, user.Email);
        return Ok(new { message = $"{user.Role} account created for {user.Email}.", user.Id });
    }

    [HttpPut("users/{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UserAdminUpdateRequest req)
    {
        var u = await db.Users.FindAsync(id);
        if (u is null) return NotFound(new { message = "User not found." });

        if (!string.IsNullOrWhiteSpace(req.FullName)) u.FullName = req.FullName.Trim();
        if (req.Phone is not null) u.Phone = req.Phone.Trim();

        if (!string.IsNullOrWhiteSpace(req.Role))
        {
            if (!Roles.All.Contains(req.Role)) return BadRequest(new { message = "Unknown role." });
            if (u.Role == Roles.Admin && req.Role != Roles.Admin && await AdminCountAsync() <= 1)
                return BadRequest(new { message = "This is the only administrator - promote another user first." });
            u.Role = req.Role;
        }

        if (req.IsActive is { } active)
        {
            if (!active && u.Role == Roles.Admin && await AdminCountAsync() <= 1)
                return BadRequest(new { message = "You cannot disable the only administrator account." });
            u.IsActive = active;
        }
        if (req.IsEmailVerified is { } verified) u.IsEmailVerified = verified;

        await db.SaveChangesAsync();
        await audit.LogAsync("User updated", "User", id, $"{u.Email} role={u.Role} active={u.IsActive}");
        return Ok(new { message = "User saved." });
    }

    [HttpPost("users/{id:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] AdminResetPasswordRequest? req)
    {
        var u = await db.Users.FindAsync(id);
        if (u is null) return NotFound(new { message = "User not found." });

        var password = string.IsNullOrWhiteSpace(req?.NewPassword) ? GeneratePassword() : req!.NewPassword!;
        u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password);
        await db.SaveChangesAsync();
        await audit.LogAsync("User password reset", "User", id, u.Email);

        return Ok(new { message = "Password reset.", password, hint = "Share this with the user and ask them to change it after signing in." });
    }

    [HttpDelete("users/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var u = await db.Users.FindAsync(id);
        if (u is null) return NotFound(new { message = "User not found." });
        if (u.Role == Roles.Admin && await AdminCountAsync() <= 1)
            return BadRequest(new { message = "You cannot delete the only administrator account." });
        if (await db.Bookings.AnyAsync(b => b.UserId == id))
            return BadRequest(new { message = "This user has bookings. Disable the account instead of deleting it." });

        db.Users.Remove(u);
        await db.SaveChangesAsync();
        await audit.LogAsync("User deleted", "User", id, u.Email);
        return Ok(new { message = "User deleted." });
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> AuditLogs(int take = 100) => Ok(await db.AuditLogs.AsNoTracking()
        .OrderByDescending(a => a.CreatedAt).Take(Math.Clamp(take, 1, 500)).ToListAsync());

    private Task<int> AdminCountAsync() => db.Users.CountAsync(u => u.Role == Roles.Admin && u.IsActive);

    private static string GeneratePassword()
    {
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string symbols = "@#$%&*!";
        var all = upper + lower + digits + symbols;
        var rnd = Random.Shared;
        var chars = new List<char>
        {
            upper[rnd.Next(upper.Length)],
            lower[rnd.Next(lower.Length)],
            digits[rnd.Next(digits.Length)],
            symbols[rnd.Next(symbols.Length)]
        };
        while (chars.Count < 10) chars.Add(all[rnd.Next(all.Length)]);
        return new string([.. chars.OrderBy(_ => rnd.Next())]);
    }
}

public class AdminCreateUserRequest
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string Password { get; set; } = "";
    public string Role { get; set; } = Roles.Customer;
    public bool IsEmailVerified { get; set; } = true;
}

public class AdminResetPasswordRequest
{
    public string? NewPassword { get; set; }
}
