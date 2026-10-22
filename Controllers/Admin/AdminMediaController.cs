using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminMediaController(FileStorageService storage, AuditService audit) : ControllerBase
{
    /// <summary>Single file upload. POST multipart/form-data with the file in field 'file' and ?folder=rooms.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(FileStorageService.MaxVideoBytes + 1024 * 1024)]
    public async Task<IActionResult> Upload([FromQuery] string folder = "general")
    {
        var file = Request.Form.Files.FirstOrDefault();
        if (file is null) return BadRequest(new { message = "No file received. Send it as multipart/form-data in the 'file' field." });

        var result = await storage.SaveAsync(file, folder);
        if (!result.Success) return BadRequest(new { message = result.Error });

        await audit.LogAsync("File uploaded", "Media", result.FileName, result.Url);
        return Ok(new { message = "Upload complete.", url = result.Url, size = result.Size, fileName = result.FileName });
    }

    /// <summary>Multiple files in one request (field name: 'files').</summary>
    [HttpPost("upload-many")]
    [RequestSizeLimit(FileStorageService.MaxVideoBytes * 2)]
    public async Task<IActionResult> UploadMany([FromQuery] string folder = "general")
    {
        if (Request.Form.Files.Count == 0) return BadRequest(new { message = "No files received." });

        var results = new List<object>();
        foreach (var file in Request.Form.Files)
        {
            var r = await storage.SaveAsync(file, folder);
            results.Add(new { r.Success, r.Url, r.Error, r.Size, r.FileName, originalName = file.FileName });
        }

        var uploaded = results.Count(r => (bool)r.GetType().GetProperty("Success")!.GetValue(r)!);
        await audit.LogAsync("Files uploaded", "Media", null, $"{uploaded} file(s) to /{folder}");

        return Ok(new { message = $"{uploaded} of {results.Count} file(s) uploaded.", results });
    }

    [HttpGet("media")]
    public IActionResult Media([FromQuery] string? folder = null)
    {
        var items = storage.List(folder);
        return Ok(new
        {
            total = items.Count,
            folders = items.Select(i => i.Folder).Distinct().OrderBy(x => x).ToList(),
            totalBytes = items.Sum(i => i.Size),
            items = items.Select(i => new
            {
                i.Url,
                i.Name,
                i.Folder,
                i.Size,
                i.IsImage,
                i.IsVideo,
                modified = i.ModifiedUtc
            })
        });
    }

    [HttpDelete("media")]
    public async Task<IActionResult> Delete([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return BadRequest(new { message = "Provide the file url to delete." });
        var deleted = storage.Delete(url);
        if (deleted) await audit.LogAsync("File deleted", "Media", null, url);
        return deleted ? Ok(new { message = "File deleted." }) : NotFound(new { message = "That file was not found in the uploads folder." });
    }
}
