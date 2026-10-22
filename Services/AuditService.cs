using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Services;

/// <summary>Writes a lightweight audit trail entry for admin actions.</summary>
public class AuditService(AppDbContext db, IHttpContextAccessor accessor)
{
    public async Task LogAsync(string action, string? entity = null, object? entityId = null, string? details = null)
    {
        try
        {
            var email = accessor.HttpContext?.User?.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value
                        ?? accessor.HttpContext?.User?.Identity?.Name;

            db.AuditLogs.Add(new AuditLog
            {
                UserEmail = email,
                Action = action,
                Entity = entity,
                EntityId = entityId?.ToString(),
                Details = details is { Length: > 1000 } ? details[..1000] : details,
                CreatedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
        catch
        {
            // Audit logging must never break the request.
        }
    }
}
