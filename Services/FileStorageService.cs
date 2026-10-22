namespace ResortWithJeena.Services;

public record UploadResult(bool Success, string? Url, string? Error, long Size, string? FileName);

public record MediaItem(string Url, string Name, string Folder, long Size, bool IsImage, bool IsVideo, DateTime ModifiedUtc);

/// <summary>Saves admin uploads (images, video, docs) under wwwroot/uploads.</summary>
public class FileStorageService(IWebHostEnvironment env, ILogger<FileStorageService> log)
{
    private static readonly HashSet<string> ImageExt = new(StringComparer.OrdinalIgnoreCase)
        { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico" };

    private static readonly HashSet<string> VideoExt = new(StringComparer.OrdinalIgnoreCase)
        { ".mp4", ".webm", ".ogg", ".ogv", ".mov", ".m4v" };

    private static readonly HashSet<string> DocExt = new(StringComparer.OrdinalIgnoreCase)
        { ".pdf", ".txt", ".csv", ".doc", ".docx", ".xls", ".xlsx" };

    public const long MaxImageBytes = 20 * 1024 * 1024;   // 20 MB
    public const long MaxVideoBytes = 300 * 1024 * 1024;  // 300 MB
    public const long MaxDocBytes = 30 * 1024 * 1024;     // 30 MB

    public string WebRoot => env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");

    public async Task<UploadResult> SaveAsync(IFormFile file, string folder = "general")
    {
        if (file is null || file.Length == 0)
            return new UploadResult(false, null, "No file was uploaded.", 0, null);

        var ext = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(ext))
            return new UploadResult(false, null, "The file has no extension.", file.Length, file.FileName);

        long limit;
        string kind;
        if (ImageExt.Contains(ext)) { limit = MaxImageBytes; kind = "image"; }
        else if (VideoExt.Contains(ext)) { limit = MaxVideoBytes; kind = "video"; }
        else if (DocExt.Contains(ext)) { limit = MaxDocBytes; kind = "document"; }
        else return new UploadResult(false, null, $"Unsupported file type '{ext}'. Allowed: images, mp4/webm video, pdf/csv.", file.Length, file.FileName);

        if (file.Length > limit)
            return new UploadResult(false, null, $"File is too large for a {kind} ({file.Length / 1024 / 1024} MB). Limit is {limit / 1024 / 1024} MB.", file.Length, file.FileName);

        var safeFolder = new string((folder ?? "general").Where(char.IsLetterOrDigit).ToArray());
        if (string.IsNullOrWhiteSpace(safeFolder)) safeFolder = "general";

        var relativeDir = Path.Combine("uploads", safeFolder);
        var absoluteDir = Path.Combine(WebRoot, relativeDir);
        Directory.CreateDirectory(absoluteDir);

        var name = $"{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid().ToString("N")[..8]}{ext.ToLowerInvariant()}";
        var absolutePath = Path.Combine(absoluteDir, name);

        try
        {
            await using var stream = new FileStream(absolutePath, FileMode.Create);
            await file.CopyToAsync(stream);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Upload failed for {File}", file.FileName);
            return new UploadResult(false, null, "Could not save the file: " + ex.Message, file.Length, file.FileName);
        }

        var url = "/" + Path.Combine(relativeDir, name).Replace('\\', '/');
        log.LogInformation("Stored upload {Url} ({Size} bytes)", url, file.Length);
        return new UploadResult(true, url, null, file.Length, name);
    }

    public bool Delete(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase)) return false;
        try
        {
            var path = Path.Combine(WebRoot, url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
            if (File.Exists(path)) { File.Delete(path); return true; }
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Could not delete {Url}", url);
        }
        return false;
    }

    public List<MediaItem> List(string? folder = null)
    {
        var root = Path.Combine(WebRoot, "uploads");
        if (!Directory.Exists(root)) return [];

        var dirs = string.IsNullOrWhiteSpace(folder)
            ? Directory.GetDirectories(root)
            : [Path.Combine(root, folder)];

        var items = new List<MediaItem>();
        foreach (var dir in dirs.Where(Directory.Exists))
        {
            var folderName = Path.GetFileName(dir);
            foreach (var file in Directory.GetFiles(dir))
            {
                var info = new FileInfo(file);
                if (info.Name.StartsWith('.')) continue;
                items.Add(new MediaItem(
                    "/uploads/" + folderName + "/" + info.Name,
                    info.Name,
                    folderName,
                    info.Length,
                    ImageExt.Contains(info.Extension),
                    VideoExt.Contains(info.Extension),
                    info.LastWriteTimeUtc));
            }
        }
        return [.. items.OrderByDescending(i => i.ModifiedUtc)];
    }
}
