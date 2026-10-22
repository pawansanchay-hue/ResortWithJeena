using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Data;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

namespace ResortWithJeena.Controllers.Admin;

[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminContentController(AppDbContext db, AuditService audit) : ControllerBase
{
    // -------------------------------------------------------------- carousel

    [HttpGet("carousel")]
    public async Task<IActionResult> Carousel() => Ok(await db.CarouselSlides.AsNoTracking()
        .OrderBy(s => s.SortOrder).ToListAsync());

    [HttpPost("carousel")]
    public async Task<IActionResult> CreateSlide([FromBody] CarouselSlide input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.MediaUrl)) return BadRequest(new { message = "Add an image or video for the slide." });
        if (input.SortOrder == 0)
            input.SortOrder = (await db.CarouselSlides.Select(s => (int?)s.SortOrder).MaxAsync() ?? 0) + 1;
        db.CarouselSlides.Add(input);
        await db.SaveChangesAsync();
        await audit.LogAsync("Carousel slide created", "CarouselSlide", input.Id, input.Title);
        return Ok(new { message = "Slide added to the home carousel.", input.Id });
    }

    [HttpPut("carousel/{id:int}")]
    public async Task<IActionResult> UpdateSlide(int id, [FromBody] CarouselSlide input)
    {
        var s = await db.CarouselSlides.FindAsync(id);
        if (s is null) return NotFound(new { message = "Slide not found." });

        s.Title = input.Title;
        s.Subtitle = input.Subtitle;
        s.MediaType = input.MediaType;
        s.MediaUrl = input.MediaUrl;
        s.PosterUrl = input.PosterUrl;
        s.ButtonText = input.ButtonText;
        s.ButtonLink = input.ButtonLink;
        s.Button2Text = input.Button2Text;
        s.Button2Link = input.Button2Link;
        s.SortOrder = input.SortOrder;
        s.IsActive = input.IsActive;
        await db.SaveChangesAsync();
        await audit.LogAsync("Carousel slide updated", "CarouselSlide", id, s.Title);
        return Ok(new { message = "Slide saved." });
    }

    [HttpDelete("carousel/{id:int}")]
    public async Task<IActionResult> DeleteSlide(int id)
    {
        var s = await db.CarouselSlides.FindAsync(id);
        if (s is null) return NotFound(new { message = "Slide not found." });
        db.CarouselSlides.Remove(s);
        await db.SaveChangesAsync();
        return Ok(new { message = "Slide deleted." });
    }

    // --------------------------------------------------------------- gallery

    [HttpGet("gallery")]
    public async Task<IActionResult> Gallery() => Ok(await db.GalleryItems.AsNoTracking()
        .Include(g => g.Category)
        .OrderBy(g => g.SortOrder)
        .Select(g => new { g.Id, g.Title, g.MediaType, g.Url, g.ThumbnailUrl, g.CategoryId, category = g.Category != null ? g.Category.Name : null, g.SortOrder, g.IsActive })
        .ToListAsync());

    [HttpPost("gallery")]
    public async Task<IActionResult> CreateGallery([FromBody] GalleryItem input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.Url)) return BadRequest(new { message = "Add an image or video URL." });
        if (input.SortOrder == 0)
            input.SortOrder = (await db.GalleryItems.Select(g => (int?)g.SortOrder).MaxAsync() ?? 0) + 1;
        db.GalleryItems.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Added to the gallery.", input.Id });
    }

    [HttpPut("gallery/{id:int}")]
    public async Task<IActionResult> UpdateGallery(int id, [FromBody] GalleryItem input)
    {
        var g = await db.GalleryItems.FindAsync(id);
        if (g is null) return NotFound(new { message = "Gallery item not found." });

        g.Title = input.Title;
        g.MediaType = input.MediaType;
        g.Url = input.Url;
        g.ThumbnailUrl = input.ThumbnailUrl;
        g.CategoryId = input.CategoryId;
        g.SortOrder = input.SortOrder;
        g.IsActive = input.IsActive;
        await db.SaveChangesAsync();
        return Ok(new { message = "Gallery item saved." });
    }

    [HttpDelete("gallery/{id:int}")]
    public async Task<IActionResult> DeleteGallery(int id)
    {
        var g = await db.GalleryItems.FindAsync(id);
        if (g is null) return NotFound(new { message = "Gallery item not found." });
        db.GalleryItems.Remove(g);
        await db.SaveChangesAsync();
        return Ok(new { message = "Gallery item deleted." });
    }

    // ---------------------------------------------------------- testimonials

    [HttpGet("testimonials")]
    public async Task<IActionResult> Testimonials() => Ok(await db.Testimonials.AsNoTracking()
        .OrderBy(t => t.SortOrder).ToListAsync());

    [HttpPost("testimonials")]
    public async Task<IActionResult> CreateTestimonial([FromBody] Testimonial input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.Name)) return BadRequest(new { message = "Guest name is required." });
        input.Rating = Math.Clamp(input.Rating, 1, 5);
        db.Testimonials.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Testimonial added.", input.Id });
    }

    [HttpPut("testimonials/{id:int}")]
    public async Task<IActionResult> UpdateTestimonial(int id, [FromBody] Testimonial input)
    {
        var t = await db.Testimonials.FindAsync(id);
        if (t is null) return NotFound(new { message = "Testimonial not found." });

        t.Name = input.Name;
        t.Designation = input.Designation;
        t.Location = input.Location;
        t.Message = input.Message;
        t.Rating = Math.Clamp(input.Rating, 1, 5);
        t.ImageUrl = input.ImageUrl;
        t.IsActive = input.IsActive;
        t.SortOrder = input.SortOrder;
        await db.SaveChangesAsync();
        return Ok(new { message = "Testimonial saved." });
    }

    [HttpDelete("testimonials/{id:int}")]
    public async Task<IActionResult> DeleteTestimonial(int id)
    {
        var t = await db.Testimonials.FindAsync(id);
        if (t is null) return NotFound(new { message = "Testimonial not found." });
        db.Testimonials.Remove(t);
        await db.SaveChangesAsync();
        return Ok(new { message = "Testimonial deleted." });
    }

    // ------------------------------------------------------------ facilities

    [HttpGet("facilities")]
    public async Task<IActionResult> Facilities() => Ok(await db.Facilities.AsNoTracking()
        .OrderBy(f => f.SortOrder).ToListAsync());

    [HttpPost("facilities")]
    public async Task<IActionResult> CreateFacility([FromBody] Facility input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.Title)) return BadRequest(new { message = "Facility title is required." });
        db.Facilities.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Facility added.", input.Id });
    }

    [HttpPut("facilities/{id:int}")]
    public async Task<IActionResult> UpdateFacility(int id, [FromBody] Facility input)
    {
        var f = await db.Facilities.FindAsync(id);
        if (f is null) return NotFound(new { message = "Facility not found." });

        f.Title = input.Title;
        f.Description = input.Description;
        f.Icon = input.Icon;
        f.ImageUrl = input.ImageUrl;
        f.IsActive = input.IsActive;
        f.SortOrder = input.SortOrder;
        await db.SaveChangesAsync();
        return Ok(new { message = "Facility saved." });
    }

    [HttpDelete("facilities/{id:int}")]
    public async Task<IActionResult> DeleteFacility(int id)
    {
        var f = await db.Facilities.FindAsync(id);
        if (f is null) return NotFound(new { message = "Facility not found." });
        db.Facilities.Remove(f);
        await db.SaveChangesAsync();
        return Ok(new { message = "Facility deleted." });
    }

    // --------------------------------------------------------- page content

    [HttpGet("pages")]
    public async Task<IActionResult> Pages(string? page = null)
    {
        var q = db.PageContents.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(page)) q = q.Where(p => p.PageKey == page);

        var rows = await q.OrderBy(p => p.PageKey).ThenBy(p => p.SortOrder).ToListAsync();
        return Ok(new
        {
            pageKeys = rows.Select(p => p.PageKey).Distinct().OrderBy(x => x).ToList(),
            items = rows
        });
    }

    [HttpPut("pages/{id:int}")]
    public async Task<IActionResult> UpdatePage(int id, [FromBody] PageContent input)
    {
        var p = await db.PageContents.FindAsync(id);
        if (p is null) return NotFound(new { message = "Content block not found." });

        p.Title = input.Title;
        p.Subtitle = input.Subtitle;
        p.Body = input.Body;
        p.Items = input.Items;
        p.ImageUrl = input.ImageUrl;
        p.ButtonText = input.ButtonText;
        p.ButtonLink = input.ButtonLink;
        p.IsVisible = input.IsVisible;
        p.SortOrder = input.SortOrder;
        await db.SaveChangesAsync();
        await audit.LogAsync("Page content updated", "PageContent", id, $"{p.PageKey}/{p.SectionKey}");
        return Ok(new { message = "Content block saved." });
    }

    [HttpPost("pages")]
    public async Task<IActionResult> CreatePage([FromBody] PageContent input)
    {
        input.Id = 0;
        if (string.IsNullOrWhiteSpace(input.PageKey) || string.IsNullOrWhiteSpace(input.SectionKey))
            return BadRequest(new { message = "Page key and section key are required." });
        if (await db.PageContents.AnyAsync(p => p.PageKey == input.PageKey && p.SectionKey == input.SectionKey))
            return Conflict(new { message = "That page/section combination already exists." });

        db.PageContents.Add(input);
        await db.SaveChangesAsync();
        return Ok(new { message = "Content block created.", input.Id });
    }

    [HttpDelete("pages/{id:int}")]
    public async Task<IActionResult> DeletePage(int id)
    {
        var p = await db.PageContents.FindAsync(id);
        if (p is null) return NotFound(new { message = "Content block not found." });
        db.PageContents.Remove(p);
        await db.SaveChangesAsync();
        return Ok(new { message = "Content block deleted." });
    }
}
