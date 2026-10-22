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
[Route("api/admin/settings")]
public class AdminSettingsController(
    AppDbContext db,
    SettingsService settings,
    IEmailSender email,
    AuditService audit) : ControllerBase
{
    /// <summary>Every setting with the metadata the admin UI needs to render itself.</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var rows = await db.Settings.AsNoTracking().OrderBy(s => s.Group).ThenBy(s => s.SortOrder).ToListAsync();

        return Ok(new
        {
            groups = rows.GroupBy(r => r.Group)
                .Select(g => new
                {
                    name = g.Key,
                    order = Array.IndexOf(SettingGroups.All, g.Key) is var i && i >= 0 ? i : 99,
                    items = g.Select(s => new
                    {
                        s.Id,
                        s.Key,
                        value = s.Value,
                        s.Label,
                        s.Group,
                        s.InputType,
                        options = string.IsNullOrWhiteSpace(s.Options)
                            ? Array.Empty<string>()
                            : s.Options.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                        s.Hint,
                        s.SortOrder,
                        isSecret = s.InputType == "password"
                    })
                })
                .OrderBy(g => g.order).ThenBy(g => g.name),
            mapPreview = await settings.MapEmbedUrlAsync()
        });
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] SettingUpdateRequest req)
    {
        if (req.Values.Count == 0) return BadRequest(new { message = "Nothing to save." });

        await settings.SetManyAsync(req.Values);

        var keys = string.Join(", ", req.Values.Keys.Take(12));
        await audit.LogAsync("Settings updated", "Setting", null, keys + (req.Values.Count > 12 ? $" (+{req.Values.Count - 12} more)" : ""));

        return Ok(new { message = $"{req.Values.Count} setting(s) saved. The public site updates immediately.", values = req.Values });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Setting input)
    {
        if (string.IsNullOrWhiteSpace(input.Key)) return BadRequest(new { message = "A setting key is required." });
        if (await db.Settings.AnyAsync(s => s.Key == input.Key))
            return Conflict(new { message = $"The setting '{input.Key}' already exists." });

        input.Id = 0;
        db.Settings.Add(input);
        await db.SaveChangesAsync();
        settings.Invalidate();
        return Ok(new { message = "Setting created.", input.Id });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var s = await db.Settings.FindAsync(id);
        if (s is null) return NotFound(new { message = "Setting not found." });
        db.Settings.Remove(s);
        await db.SaveChangesAsync();
        settings.Invalidate();
        return Ok(new { message = "Setting removed." });
    }

    [HttpPost("test-email")]
    public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.To)) return BadRequest(new { message = "Enter an email address to send the test to." });

        var siteName = await settings.GetAsync("site.name");
        var result = await email.SendAsync(req.To, $"{siteName} - SMTP test message",
            $"<h3>SMTP is working</h3><p>This test was sent from the {siteName} admin panel.</p><p>Sent at {DateTime.Now:g}</p>");

        return Ok(new
        {
            sent = result.Sent,
            devMode = result.DevMode,
            message = result.Sent
                ? $"Test email delivered to {req.To}."
                : result.DevMode
                    ? "Developer mode is ON, so nothing was actually emailed. The message was written to App_Data/outbox and logged to the server console. Turn off Developer mode and fill in the SMTP details to send real mail."
                    : "Could not send: " + result.Error
        });
    }

    /// <summary>Cards and copy for the settings screen header.</summary>
    [HttpGet("status")]
    public async Task<IActionResult> Status() => Ok(new
    {
        smtpConfigured = await email.IsConfiguredAsync(),
        developerMode = await email.DevModeAsync(),
        uploadedMediaCount = (await settings.AllAsync()).Count(kv => kv.Key.StartsWith("hero.") && kv.Value?.StartsWith("/uploads/") == true),
        settingCount = (await settings.AllAsync()).Count,
        databaseProvider = db.Database.ProviderName
    });
}

public class TestEmailRequest
{
    public string To { get; set; } = "";
}
