using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Models;

namespace ResortWithJeena.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomImage> RoomImages => Set<RoomImage>();
    public DbSet<FoodItem> FoodItems => Set<FoodItem>();

    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<FoodOrder> FoodOrders => Set<FoodOrder>();
    public DbSet<FoodOrderItem> FoodOrderItems => Set<FoodOrderItem>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<NewsletterSubscriber> NewsletterSubscribers => Set<NewsletterSubscriber>();

    public DbSet<Setting> Settings => Set<Setting>();
    public DbSet<PageContent> PageContents => Set<PageContent>();
    public DbSet<CarouselSlide> CarouselSlides => Set<CarouselSlide>();
    public DbSet<GalleryItem> GalleryItems => Set<GalleryItem>();
    public DbSet<Testimonial> Testimonials => Set<Testimonial>();
    public DbSet<Facility> Facilities => Set<Facility>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<User>().HasIndex(x => x.Email).IsUnique();

        b.Entity<OtpCode>().HasIndex(x => new { x.Email, x.Purpose });
        b.Entity<OtpCode>().HasIndex(x => x.ExpiresAt);

        b.Entity<Category>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Room>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Setting>().HasIndex(x => x.Key).IsUnique();

        b.Entity<PageContent>().HasIndex(x => new { x.PageKey, x.SectionKey }).IsUnique();
        b.Entity<Booking>().HasIndex(x => x.BookingCode).IsUnique();
        b.Entity<FoodOrder>().HasIndex(x => x.OrderCode).IsUnique();

        b.Entity<Room>()
            .HasOne(x => x.Category)
            .WithMany(c => c.Rooms)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<FoodItem>()
            .HasOne(x => x.Category)
            .WithMany(c => c.FoodItems)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<RoomImage>()
            .HasOne(x => x.Room)
            .WithMany(r => r.Images)
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<Booking>()
            .HasOne(x => x.Room)
            .WithMany(r => r.Bookings)
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<Booking>()
            .HasOne(x => x.User)
            .WithMany(u => u.Bookings)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<FoodOrder>()
            .HasOne(x => x.Booking)
            .WithMany(f => f.FoodOrders)
            .HasForeignKey(x => x.BookingId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<FoodOrder>()
            .HasOne(x => x.User)
            .WithMany(u => u.FoodOrders)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.SetNull);

        b.Entity<FoodOrderItem>()
            .HasOne(x => x.FoodOrder)
            .WithMany(f => f.Items)
            .HasForeignKey(x => x.FoodOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<GalleryItem>()
            .HasOne(x => x.Category)
            .WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
