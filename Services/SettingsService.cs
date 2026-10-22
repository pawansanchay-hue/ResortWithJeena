using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;

namespace ResortWithJeena.Services;

/// <summary>Reads and writes the admin editable settings, with a small in-memory cache.</summary>
public class SettingsService(AppDbContext db)
{
    private Dictionary<string, string?>? _cache;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<Dictionary<string, string?>> AllAsync(bool force = false)
    {
        if (_cache is not null && !force) return _cache;
        await _gate.WaitAsync();
        try
        {
            if (_cache is not null && !force) return _cache;
            _cache = await db.Settings.AsNoTracking()
                .ToDictionaryAsync(s => s.Key, s => s.Value, StringComparer.OrdinalIgnoreCase);
        }
        finally { _gate.Release(); }
        return _cache;
    }

    public async Task<string> GetAsync(string key, string fallback = "")
        => (await AllAsync()).TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v! : fallback;

    public async Task<string?> GetRawAsync(string key)
        => (await AllAsync()).TryGetValue(key, out var v) ? v : null;

    public async Task<bool> GetBoolAsync(string key, bool fallback = false)
    {
        var v = await GetRawAsync(key);
        if (string.IsNullOrWhiteSpace(v)) return fallback;
        return v.Trim().ToLowerInvariant() is "true" or "1" or "yes" or "on";
    }

    public async Task<decimal> GetDecimalAsync(string key, decimal fallback = 0)
        => decimal.TryParse(await GetRawAsync(key), out var d) ? d : fallback;

    public async Task<int> GetIntAsync(string key, int fallback = 0)
        => int.TryParse(await GetRawAsync(key), out var i) ? i : fallback;

    public async Task SetAsync(string key, string? value)
    {
        var row = await db.Settings.FirstOrDefaultAsync(s => s.Key == key);
        if (row is null)
        {
            row = new Setting { Key = key, Group = SettingGroups.General, Label = key };
            db.Settings.Add(row);
        }
        row.Value = value;
        await db.SaveChangesAsync();
        Invalidate();
    }

    public async Task SetManyAsync(IEnumerable<KeyValuePair<string, string?>> values)
    {
        var list = values.ToList();
        if (list.Count == 0) return;
        var keys = list.Select(v => v.Key).ToList();
        var rows = await db.Settings.Where(s => keys.Contains(s.Key)).ToListAsync();
        foreach (var kv in list)
        {
            var row = rows.FirstOrDefault(r => r.Key.Equals(kv.Key, StringComparison.OrdinalIgnoreCase));
            if (row is null)
            {
                row = new Setting { Key = kv.Key, Group = SettingGroups.General, Label = kv.Key };
                db.Settings.Add(row);
                rows.Add(row);
            }
            row.Value = kv.Value;
        }
        await db.SaveChangesAsync();
        Invalidate();
    }

    public void Invalidate() => _cache = null;

    /// <summary>Keyless Google Maps embed so the site works with no API key.</summary>
    public async Task<string> MapEmbedUrlAsync()
    {
        var custom = await GetAsync("site.mapEmbedUrl");
        if (!string.IsNullOrWhiteSpace(custom)) return custom;
        var q = await GetAsync("site.mapQuery", "Kasauli, Himachal Pradesh, India");
        return $"https://www.google.com/maps?q={Uri.EscapeDataString(q)}&output=embed";
    }
}
