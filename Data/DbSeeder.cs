using Microsoft.EntityFrameworkCore;
using ResortWithJeena.Models;

namespace ResortWithJeena.Data;

/// <summary>
/// Creates and populates the database on first run. Everything seeded here is editable
/// from the admin panel, so nothing needs a code change later.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration cfg, ILogger logger)
    {
        await db.Database.EnsureCreatedAsync();

        var changed = false;
        changed |= await SeedAdminAsync(db, cfg, logger);
        changed |= await SeedSettingsAsync(db);
        changed |= await SeedPageContentAsync(db);
        changed |= await SeedCatalogAsync(db);
        changed |= await SeedDemoAsync(db);

        if (changed) await db.SaveChangesAsync();
        logger.LogInformation("Database seed check complete.");
    }

    // ------------------------------------------------------------------ admin

    private static async Task<bool> SeedAdminAsync(AppDbContext db, IConfiguration cfg, ILogger log)
    {
        var email = (cfg["Seed:AdminEmail"] ?? "admin@resortwithjeena.com").Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email)) return false;

        var password = cfg["Seed:AdminPassword"] ?? "Admin@123";
        db.Users.Add(new User
        {
            FullName = "Resort Administrator",
            Email = email,
            Phone = "+91 98765 43210",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = Roles.Admin,
            IsEmailVerified = true,
            IsActive = true
        });

        log.LogWarning("Seeded admin account {Email} with password {Password} - change it after first login.", email, password);
        return true;
    }

    // --------------------------------------------------------------- settings

    private static async Task<bool> SeedSettingsAsync(AppDbContext db)
    {
        var existing = await db.Settings.Select(s => s.Key).ToListAsync();
        var set = new HashSet<string>(existing, StringComparer.OrdinalIgnoreCase);

        var rows = new List<Setting>();
        var order = 0;
        void S(string key, string? value, string label, string group,
               string input = "text", string? options = null, string? hint = null, int? sort = null)
        {
            if (set.Contains(key)) return;
            rows.Add(new Setting
            {
                Key = key,
                Value = value,
                Label = label,
                Group = group,
                InputType = input,
                Options = options,
                Hint = hint,
                SortOrder = sort ?? order++
            });
        }

        // ---- General
        S("site.name", "Jeena Resort & Spa", "Site name", SettingGroups.General);
        S("site.tagline", "Where Elegance Meets Nature", "Tagline", SettingGroups.General);
        S("site.logo", "/assets/logo.svg", "Logo (light backgrounds)", SettingGroups.General, "image",
          hint: "Replaces the brand mark on the public site header.");
        S("site.logoLight", "/assets/logo-light.svg", "Logo (dark backgrounds)", SettingGroups.General, "image");
        S("site.favicon", "/assets/favicon.svg", "Favicon", SettingGroups.General, "image");
        S("site.shortAbout", "A boutique hillside resort with 42 rooms, an award winning spa and a farm-to-table kitchen.",
          "Short description", SettingGroups.General, "textarea");
        S("site.phone", "+91 98765 43210", "Primary phone", SettingGroups.General);
        S("site.phone2", "+91 98765 43211", "Secondary phone", SettingGroups.General);
        S("site.email", "info@resortwithjeena.com", "Public email", SettingGroups.General);
        S("site.address", "Jeena Hills Road, Kasauli, Himachal Pradesh 173204, India", "Full address", SettingGroups.General, "textarea");
        S("site.mapQuery", "Kasauli, Himachal Pradesh, India", "Google map location (text query)", SettingGroups.General,
          hint: "Used to build the keyless Google Maps embed. Any address or 'lat,lng' works.");
        S("site.mapEmbedUrl", "", "Custom Google Maps embed URL (optional)", SettingGroups.General, "url",
          hint: "Leave empty to auto-generate from the location above. Paste a full https://www.google.com/maps/embed?pb=... URL to override.");
        S("site.mapEnabled", "true", "Show Google map", SettingGroups.General, "checkbox");
        S("site.checkInTime", "2:00 PM", "Check-in time", SettingGroups.General);
        S("site.checkOutTime", "11:00 AM", "Check-out time", SettingGroups.General);
        S("site.workingHours", "Reception open 24 x 7", "Working hours", SettingGroups.General);
        S("site.copyright", "© 2026 Jeena Resort & Spa. All rights reserved.", "Copyright line", SettingGroups.General);

        // ---- Theme
        S("theme.primaryColor", "#c8a24a", "Primary colour", SettingGroups.Theme, "color");
        S("theme.secondaryColor", "#0f5132", "Secondary colour", SettingGroups.Theme, "color");
        S("theme.accentColor", "#e2703a", "Accent colour", SettingGroups.Theme, "color");
        S("theme.bodyBackground", "#ffffff", "Page background", SettingGroups.Theme, "color");
        S("theme.sectionBackground", "#f7f4ee", "Alternate section background", SettingGroups.Theme, "color");
        S("theme.cardBackground", "#ffffff", "Card background", SettingGroups.Theme, "color");
        S("theme.textColor", "#4a4a4a", "Body text colour", SettingGroups.Theme, "color");
        S("theme.headingColor", "#12261f", "Heading colour", SettingGroups.Theme, "color");
        S("theme.navBackground", "#ffffff", "Header background", SettingGroups.Theme, "color");
        S("theme.navTextColor", "#12261f", "Header text colour", SettingGroups.Theme, "color");
        S("theme.footerBackground", "#0b1f18", "Footer background", SettingGroups.Theme, "color");
        S("theme.footerTextColor", "#cfe0d9", "Footer text colour", SettingGroups.Theme, "color");
        S("theme.buttonTextColor", "#ffffff", "Button text colour", SettingGroups.Theme, "color");
        S("theme.borderRadius", "14", "Corner radius (px)", SettingGroups.Theme, "number");
        S("theme.fontFamily", "'Segoe UI', system-ui, sans-serif", "Font family", SettingGroups.Theme, "select",
          "'Segoe UI', system-ui, sans-serif|Georgia, 'Times New Roman', serif|'Trebuchet MS', sans-serif|Verdana, Geneva, sans-serif");
        S("theme.animationsEnabled", "true", "Enable scroll animations", SettingGroups.Theme, "checkbox");
        S("theme.backgroundImage", "", "Site background image (optional)", SettingGroups.Theme, "image");
        S("theme.backgroundImageOpacity", "0.08", "Background image opacity", SettingGroups.Theme, "number");

        // ---- Hero
        S("hero.enabled", "true", "Show hero section", SettingGroups.Hero, "checkbox");
        S("hero.backgroundType", "Carousel", "Hero background", SettingGroups.Hero, "select", "Carousel|Video|Image");
        S("hero.videoUrl", "https://www.youtube.com/embed/aqz-KE-bpKQ", "Hero video URL", SettingGroups.Hero, "video",
          hint: "Upload an MP4 or paste a YouTube embed URL. Used when the hero background is set to Video.");
        S("hero.videoAutoplay", "true", "Autoplay hero video", SettingGroups.Hero, "checkbox");
        S("hero.backgroundImage", "/assets/hero.svg", "Hero fallback image", SettingGroups.Hero, "image");
        S("hero.overlayColor", "#04140f", "Hero overlay colour", SettingGroups.Hero, "color");
        S("hero.overlayOpacity", "0.45", "Hero overlay opacity (0-1)", SettingGroups.Hero, "number");
        S("hero.slideInterval", "6000", "Carousel slide interval (ms)", SettingGroups.Hero, "number");
        S("hero.scrollDownText", "Explore", "Scroll hint text", SettingGroups.Hero);

        // ---- Home section visibility
        S("home.showAbout", "true", "About section", SettingGroups.Home, "checkbox");
        S("home.showFacilities", "true", "Facilities section", SettingGroups.Home, "checkbox");
        S("home.showRooms", "true", "Rooms section", SettingGroups.Home, "checkbox");
        S("home.showFood", "true", "Food & dining section", SettingGroups.Home, "checkbox");
        S("home.showStats", "true", "Statistics strip", SettingGroups.Home, "checkbox");
        S("home.showTestimonials", "true", "Testimonials section", SettingGroups.Home, "checkbox");
        S("home.showGallery", "true", "Gallery section", SettingGroups.Home, "checkbox");
        S("home.showVideo", "true", "Video highlight section", SettingGroups.Home, "checkbox");
        S("home.showCta", "true", "Call to action band", SettingGroups.Home, "checkbox");
        S("home.showContactMap", "true", "Contact + Google map section", SettingGroups.Home, "checkbox");
        S("home.showNewsletter", "true", "Newsletter strip", SettingGroups.Home, "checkbox");
        S("home.roomsToShow", "6", "Rooms shown on home", SettingGroups.Home, "number");
        S("home.foodToShow", "6", "Dishes shown on home", SettingGroups.Home, "number");
        S("home.videoUrl", "https://www.youtube.com/embed/aqz-KE-bpKQ", "Home video highlight URL", SettingGroups.Home, "video");
        S("home.statsYears", "18", "Years of hospitality", SettingGroups.Home, "number");
        S("home.statsRooms", "42", "Rooms & suites", SettingGroups.Home, "number");
        S("home.statsGuests", "25000", "Happy guests", SettingGroups.Home, "number");
        S("home.statsAwards", "12", "Awards won", SettingGroups.Home, "number");

        // ---- Booking
        S("booking.currency", "INR", "Currency code", SettingGroups.Booking);
        S("booking.currencySymbol", "₹", "Currency symbol", SettingGroups.Booking);
        S("booking.taxPercent", "12", "Tax %", SettingGroups.Booking, "number");
        S("booking.advancePercent", "30", "Advance payment %", SettingGroups.Booking, "number");
        S("booking.minNights", "1", "Minimum nights", SettingGroups.Booking, "number");
        S("booking.maxNights", "30", "Maximum nights", SettingGroups.Booking, "number");
        S("booking.maxGuestsPerRoom", "4", "Max guests per room", SettingGroups.Booking, "number");
        S("booking.enableFoodOrdering", "true", "Allow food ordering", SettingGroups.Booking, "checkbox");
        S("booking.enableGuestBooking", "true", "Allow booking without an account", SettingGroups.Booking, "checkbox");
        S("booking.confirmationMessage", "Thank you! Your reservation request has been received. Our team will confirm it within 2 hours.",
          "Confirmation message", SettingGroups.Booking, "textarea");
        S("booking.paymentInstructions", "Pay the advance amount at the resort or via the UPI ID shared over email after confirmation.",
          "Payment instructions", SettingGroups.Booking, "textarea");

        // ---- Email / OTP
        S("email.requireOtpOnRegister", "true", "Require OTP verification on registration", SettingGroups.Email, "checkbox");
        S("email.otpDevMode", "true", "Developer mode (log OTP, no real email)", SettingGroups.Email, "checkbox",
          hint: "When ON, OTP codes are written to the server console and returned by the API so you can test without SMTP. Turn OFF once SMTP is configured.");
        S("email.otpExpiryMinutes", "10", "OTP validity (minutes)", SettingGroups.Email, "number");
        S("email.otpLength", "6", "OTP length", SettingGroups.Email, "number");
        S("email.smtpHost", "", "SMTP host", SettingGroups.Email, hint: "e.g. smtp.gmail.com");
        S("email.smtpPort", "587", "SMTP port", SettingGroups.Email, "number");
        S("email.smtpUser", "", "SMTP username", SettingGroups.Email);
        S("email.smtpPassword", "", "SMTP password / app password", SettingGroups.Email, "password");
        S("email.enableSsl", "true", "Use STARTTLS / SSL", SettingGroups.Email, "checkbox");
        S("email.fromEmail", "no-reply@resortwithjeena.com", "From address", SettingGroups.Email);
        S("email.fromName", "Jeena Resort & Spa", "From name", SettingGroups.Email);
        S("email.sendBookingCopyToAdmin", "true", "Email a copy of each booking to the resort", SettingGroups.Email, "checkbox");

        // ---- SEO
        S("seo.title", "Jeena Resort & Spa | Boutique Hillside Resort in Kasauli", "Default page title", SettingGroups.Seo);
        S("seo.description", "Book luxury rooms, suites and villas at Jeena Resort & Spa. Award winning spa, farm-to-table dining and breathtaking valley views.",
          "Meta description", SettingGroups.Seo, "textarea");
        S("seo.keywords", "resort, kasauli resort, luxury rooms, spa, hotel booking, hillside resort", "Meta keywords", SettingGroups.Seo);
        S("seo.ogImage", "/assets/hero.svg", "Social share image", SettingGroups.Seo, "image");

        // ---- Social
        S("social.facebook", "https://facebook.com/", "Facebook", SettingGroups.Social, "url");
        S("social.instagram", "https://instagram.com/", "Instagram", SettingGroups.Social, "url");
        S("social.twitter", "https://twitter.com/", "X / Twitter", SettingGroups.Social, "url");
        S("social.youtube", "https://youtube.com/", "YouTube", SettingGroups.Social, "url");
        S("social.whatsapp", "+919876543210", "WhatsApp number", SettingGroups.Social);
        S("social.tripadvisor", "", "TripAdvisor", SettingGroups.Social, "url");

        if (rows.Count == 0) return false;
        db.Settings.AddRange(rows);
        return true;
    }

    // ----------------------------------------------------------- page content

    private static async Task<bool> SeedPageContentAsync(AppDbContext db)
    {
        if (await db.PageContents.AnyAsync()) return false;

        var rows = new List<PageContent>();
        var order = 0;
        void P(string page, string section, string? title, string? subtitle, string? body = null,
               string? image = null, string? items = null, string? btn = null, string? link = null)
        {
            rows.Add(new PageContent
            {
                PageKey = page,
                SectionKey = section,
                Title = title,
                Subtitle = subtitle,
                Body = body,
                ImageUrl = image,
                Items = items,
                ButtonText = btn,
                ButtonLink = link,
                SortOrder = order++
            });
        }

        P("index", "about", "Welcome to Jeena Resort",
          "A quiet hillside retreat built for slow mornings and golden evenings.",
          "Tucked between pine ridges and tea gardens, Jeena Resort & Spa pairs warm Himachali hospitality with contemporary comfort. Every room opens to the valley, every meal is cooked with produce from our own kitchen garden, and every evening ends with the sound of the hills.",
          "/assets/about.svg",
          "[{\"title\":\"Valley View Rooms\",\"text\":\"All 42 rooms face the valley with private balconies.\"},{\"title\":\"Farm Kitchen\",\"text\":\"Seasonal produce grown on site, cooked to order.\"},{\"title\":\"Himalayan Spa\",\"text\":\"Signature therapies using local herbs and oils.\"},{\"title\":\"Guided Trails\",\"text\":\"Sunrise walks and forest treks with our naturalists.\"}]",
          "Discover our story", "/about.html");

        P("index", "rooms", "Rooms & Suites", "Choose the space that fits your escape.", null, null, null, "View all rooms", "/rooms.html");
        P("index", "food", "Dining & Cuisine", "Himachali classics, tandoor favourites and continental plates.", null, null, null, "Explore the menu", "/food.html");
        P("index", "facilities", "Resort Facilities", "Everything you need for an unhurried stay.");
        P("index", "testimonials", "Guest Stories", "What our guests say after checking out.");
        P("index", "gallery", "Moments at Jeena", "A glimpse of the resort through the seasons.", null, null, null, "Open gallery", "/gallery.html");
        P("index", "video", "Take a Look Around", "Two minutes inside Jeena Resort & Spa.");
        P("index", "cta", "Ready for your escape?", "Book direct for the best rates, free cancellation and a complimentary welcome drink.",
          null, null, null, "Check availability", "/booking.html");
        P("index", "contact", "Find Us", "We are three hours from Chandigarh and a world away from the noise.");

        P("rooms", "header", "Our Rooms & Suites", "42 rooms, suites, villas and cottages - each with a valley view.");
        P("food", "header", "Restaurant & Menu", "Breakfast to midnight snacks, served in the dining hall, on the terrace or in your room.");
        P("gallery", "header", "Gallery", "Photos and films from around the resort.");
        P("about", "header", "About Jeena Resort", "Family run since 2008, quietly reimagined in 2024.");
        P("about", "story", "Our Story",
          "It started with a family home on the ridge.",
          "The Jeena family built their home on this ridge in 1992. Guests kept asking to stay, so in 2008 six rooms opened to travellers. Today the resort has grown to 42 keys, a spa, two restaurants and an organic garden - but the family still cooks, hosts and walks the property every day.",
          "/assets/about.svg");
        P("about", "mission", "Our Mission", "Comfort that respects the mountains.",
          "We run a low-waste kitchen, heat water with solar, refuse single use plastic and employ 80% of our team from the surrounding villages. Luxury, we believe, should leave the valley better than we found it.");
        P("about", "team", "The People Behind Jeena", "Hosts, chefs, naturalists and therapists.",
          null, null,
          "[{\"name\":\"Pawan Singh Jeena\",\"role\":\"Founder & Host\",\"image\":\"/assets/person-1.svg\"},{\"name\":\"Ritika Jeena\",\"role\":\"General Manager\",\"image\":\"/assets/person-2.svg\"},{\"name\":\"Chef Arvind Rawat\",\"role\":\"Executive Chef\",\"image\":\"/assets/person-3.svg\"},{\"name\":\"Meera Bisht\",\"role\":\"Spa Director\",\"image\":\"/assets/person-4.svg\"}]");
        P("contact", "header", "Contact Us", "Tell us what you need - we reply within a few hours.");
        P("contact", "form", "Send us a message", "Fill in the form and our reservations desk will get back to you.");
        P("booking", "header", "Book Your Stay", "Real-time availability across every room type.");
        P("my-account", "header", "My Account", "Your reservations, food orders and profile.");
        P("login", "header", "Welcome Back", "Sign in to manage your bookings.");
        P("register", "header", "Create Your Account", "One account for bookings, dining and faster checkout.");
        P("footer", "about", "About the resort",
          "A 42 key boutique resort in the Kasauli hills with a Himalayan spa, farm-to-table restaurant and panoramic valley views.");
        P("footer", "newsletterTitle", "Join the Jeena list", "Seasonal offers, festival packages and quiet-week deals.");

        db.PageContents.AddRange(rows);
        return true;
    }

    // --------------------------------------------------------------- catalogue

    private static async Task<bool> SeedCatalogAsync(AppDbContext db)
    {
        if (await db.Categories.AnyAsync()) return false;

        var roomCats = new (string Name, string Slug, string Icon, string Desc)[]
        {
            ("Deluxe Rooms", "deluxe-rooms", "bed", "Comfortable rooms with valley facing balconies."),
            ("Super Deluxe Rooms", "super-deluxe-rooms", "sparkle", "Larger rooms with sitting area and premium amenities."),
            ("Executive Suites", "executive-suites", "crown", "Separate living room, bathtub and panoramic windows."),
            ("Family Suites", "family-suites", "users", "Two bedrooms, ideal for families travelling together."),
            ("Private Villas", "private-villas", "home", "Standalone villas with private lawn and plunge pool."),
            ("Garden Cottages", "garden-cottages", "leaf", "Cottages set inside the organic kitchen garden.")
        };

        var foodCats = new (string Name, string Slug, string Icon, string Desc)[]
        {
            ("Breakfast", "breakfast", "sun", "Served 7:00 am to 10:30 am."),
            ("Starters", "starters", "flame", "Vegetarian and non-vegetarian appetisers."),
            ("Main Course", "main-course", "bowl", "Indian and continental mains."),
            ("Tandoori", "tandoori", "flame", "Clay oven specialities."),
            ("Desserts", "desserts", "cake", "House made sweets and ice creams."),
            ("Beverages", "beverages", "cup", "Teas, coffees, mocktails and shakes.")
        };

        var cats = new List<Category>();
        var so = 0;
        foreach (var c in roomCats)
            cats.Add(new Category { Name = c.Name, Slug = c.Slug, Type = CategoryTypes.Room, Icon = c.Icon, Description = c.Desc, SortOrder = so++ });
        so = 0;
        foreach (var c in foodCats)
            cats.Add(new Category { Name = c.Name, Slug = c.Slug, Type = CategoryTypes.Food, Icon = c.Icon, Description = c.Desc, SortOrder = so++ });
        cats.Add(new Category { Name = "Resort", Slug = "resort", Type = CategoryTypes.Gallery, Icon = "camera", SortOrder = 0 });
        cats.Add(new Category { Name = "Rooms", Slug = "rooms-gallery", Type = CategoryTypes.Gallery, Icon = "bed", SortOrder = 1 });
        cats.Add(new Category { Name = "Dining", Slug = "dining-gallery", Type = CategoryTypes.Gallery, Icon = "bowl", SortOrder = 2 });
        cats.Add(new Category { Name = "Nature", Slug = "nature-gallery", Type = CategoryTypes.Gallery, Icon = "leaf", SortOrder = 3 });

        db.Categories.AddRange(cats);
        await db.SaveChangesAsync();

        int RoomCat(string slug) => cats.First(c => c.Slug == slug).Id;
        int FoodCat(string slug) => cats.First(c => c.Slug == slug).Id;

        var rooms = new List<Room>
        {
            new() { Name = "Deluxe Valley Room", Slug = "deluxe-valley-room", CategoryId = RoomCat("deluxe-rooms"),
                ShortDescription = "Cosy room with a private balcony overlooking the pine valley.",
                Description = "Our Deluxe Valley Room is the perfect base for a short escape. Wake up to bird song, sip your morning chai on the balcony and watch the mist roll through the pines. The room has a queen bed, writing desk, rain shower and a mini bar stocked with local juices.",
                PricePerNight = 6500, DiscountPercent = 10, RoomSize = "280 sq ft", BedType = "Queen", MaxAdults = 2, MaxChildren = 1, TotalUnits = 8,
                Amenities = "Valley balcony,Air conditioning,Free Wi-Fi,Rain shower,Mini bar,Tea & coffee maker,Room service,LED TV",
                CoverImage = "/assets/room-1.svg", IsFeatured = true, SortOrder = 1 },

            new() { Name = "Super Deluxe Room", Slug = "super-deluxe-room", CategoryId = RoomCat("super-deluxe-rooms"),
                ShortDescription = "Extra space with a sitting nook and panoramic windows.",
                Description = "A generous 380 sq ft room with a king bed, a window-side sofa and floor to ceiling glass framing the valley. Ideal for couples who like to spread out and stay a while.",
                PricePerNight = 8900, DiscountPercent = 15, RoomSize = "380 sq ft", BedType = "King", MaxAdults = 3, MaxChildren = 1, TotalUnits = 10,
                Amenities = "Panoramic windows,Sitting area,Air conditioning,Free Wi-Fi,Bathtub,Mini bar,Smart TV,Room service",
                CoverImage = "/assets/room-2.svg", IsFeatured = true, SortOrder = 2 },

            new() { Name = "Executive Suite", Slug = "executive-suite", CategoryId = RoomCat("executive-suites"),
                ShortDescription = "Suite with separate living room, bathtub and work desk.",
                Description = "Built for longer stays and slower working days. The Executive Suite offers a separate living room, a proper work desk with fast Wi-Fi, a deep soaking tub and a private terrace that catches the afternoon sun.",
                PricePerNight = 13500, DiscountPercent = 10, RoomSize = "560 sq ft", BedType = "King", MaxAdults = 3, MaxChildren = 2, TotalUnits = 6,
                Amenities = "Separate living room,Private terrace,Soaking bathtub,Work desk,Fast Wi-Fi,Espresso machine,Pillow menu,Airport transfer",
                CoverImage = "/assets/room-3.svg", IsFeatured = true, SortOrder = 3 },

            new() { Name = "Family Suite", Slug = "family-suite", CategoryId = RoomCat("family-suites"),
                ShortDescription = "Two bedrooms and a shared lounge for the whole family.",
                Description = "Two connected bedrooms, two bathrooms and a central lounge with board games, a movie projector and a fridge full of snacks. Kids get their own space and so do you.",
                PricePerNight = 16900, DiscountPercent = 5, RoomSize = "720 sq ft", BedType = "King + 2 Twin", MaxAdults = 4, MaxChildren = 3, TotalUnits = 5,
                Amenities = "Two bedrooms,Two bathrooms,Kids welcome kit,Board games,Projector,Refrigerator,Balcony,Connecting rooms",
                CoverImage = "/assets/room-4.svg", IsFeatured = true, SortOrder = 4 },

            new() { Name = "Private Villa", Slug = "private-villa", CategoryId = RoomCat("private-villas"),
                ShortDescription = "Standalone villa with lawn, plunge pool and butler service.",
                Description = "The last word in privacy. A standalone three bedroom villa with its own manicured lawn, heated plunge pool, outdoor dining deck and dedicated butler. Perfect for celebrations and family reunions.",
                PricePerNight = 32000, DiscountPercent = 0, RoomSize = "1800 sq ft", BedType = "3 Kings", MaxAdults = 6, MaxChildren = 3, TotalUnits = 2,
                Amenities = "Private plunge pool,Dedicated butler,Private lawn,Outdoor dining,BBQ setup,Bonfire pit,Cab service,Chef on request",
                CoverImage = "/assets/room-5.svg", IsFeatured = true, SortOrder = 5 },

            new() { Name = "Garden Cottage", Slug = "garden-cottage", CategoryId = RoomCat("garden-cottages"),
                ShortDescription = "Cottage inside the organic garden, steps from the spa.",
                Description = "A single storey cottage surrounded by kitchen garden beds, apple trees and a herb maze. Pick your own salad, then walk two minutes to the spa for an evening massage.",
                PricePerNight = 11500, DiscountPercent = 10, RoomSize = "480 sq ft", BedType = "King", MaxAdults = 2, MaxChildren = 2, TotalUnits = 4,
                Amenities = "Garden access,Outdoor shower,Air conditioning,Free Wi-Fi,Herbal tea tray,Hammock,Spa access,Room service",
                CoverImage = "/assets/room-6.svg", SortOrder = 6 }
        };

        var imgSuffix = new[] { "", "-b", "-c" };
        var i = 0;
        foreach (var r in rooms)
        {
            r.Images = [.. imgSuffix.Select((s, idx) => new RoomImage
            {
                ImageUrl = $"/assets/room-{(i % 6) + 1}{s}.svg",
                Caption = idx == 0 ? r.Name : $"{r.Name} - view {idx + 1}",
                SortOrder = idx
            })];
            i++;
        }
        db.Rooms.AddRange(rooms);

        var foods = new List<FoodItem>
        {
            new() { Name = "Himachali Siddu Platter", CategoryId = FoodCat("breakfast"), Description = "Steamed wheat buns with walnut chutney, ghee and local honey.", Price = 380, IsVeg = true, SpiceLevel = "Mild", ImageUrl = "/assets/food-1.svg", IsFeatured = true, SortOrder = 1 },
            new() { Name = "Farmhouse Breakfast Board", CategoryId = FoodCat("breakfast"), Description = "Eggs your way, garden salad, house bread, preserves and cold pressed juice.", Price = 520, IsVeg = false, SpiceLevel = "Mild", ImageUrl = "/assets/food-2.svg", IsFeatured = true, SortOrder = 2 },
            new() { Name = "Paneer Tikka Angara", CategoryId = FoodCat("starters"), Description = "Clay oven cottage cheese in a smoky chilli marinade with mint chutney.", Price = 490, DiscountPrice = 440, IsVeg = true, SpiceLevel = "Medium", ImageUrl = "/assets/food-3.svg", IsFeatured = true, SortOrder = 3 },
            new() { Name = "Tandoori Chicken Half", CategoryId = FoodCat("starters"), Description = "Overnight yoghurt marinade, charcoal grilled, served with pickled onion.", Price = 640, IsVeg = false, SpiceLevel = "Medium", ImageUrl = "/assets/food-4.svg", SortOrder = 4 },
            new() { Name = "Trout with Lemon Butter", CategoryId = FoodCat("main-course"), Description = "Line caught Himalayan trout, lemon butter sauce, seasonal greens.", Price = 880, IsVeg = false, SpiceLevel = "Mild", ImageUrl = "/assets/food-5.svg", IsFeatured = true, SortOrder = 5 },
            new() { Name = "Jeena Thali", CategoryId = FoodCat("main-course"), Description = "Five curries, dal, rice, raita, salad, pickles and dessert.", Price = 950, IsVeg = true, SpiceLevel = "Medium", ImageUrl = "/assets/food-6.svg", IsFeatured = true, SortOrder = 6 },
            new() { Name = "Madra & Rajma Chawal", CategoryId = FoodCat("main-course"), Description = "Slow cooked chickpeas in yoghurt gravy with red rice.", Price = 520, IsVeg = true, SpiceLevel = "Mild", ImageUrl = "/assets/food-1.svg", SortOrder = 7 },
            new() { Name = "Butter Chicken", CategoryId = FoodCat("tandoori"), Description = "House favourite - tomato, fenugreek and white butter.", Price = 720, IsVeg = false, SpiceLevel = "Mild", ImageUrl = "/assets/food-2.svg", IsFeatured = true, SortOrder = 8 },
            new() { Name = "Tandoori Mushroom", CategoryId = FoodCat("tandoori"), Description = "Button mushrooms stuffed with cheese and herbs.", Price = 480, IsVeg = true, SpiceLevel = "Medium", ImageUrl = "/assets/food-3.svg", SortOrder = 9 },
            new() { Name = "Gulab Jamun with Rabri", CategoryId = FoodCat("desserts"), Description = "Warm milk dumplings soaked in cardamom syrup, chilled rabri.", Price = 320, IsVeg = true, ImageUrl = "/assets/food-4.svg", IsFeatured = true, SortOrder = 10 },
            new() { Name = "Apple Crumble", CategoryId = FoodCat("desserts"), Description = "Local orchard apples, oat crumble, vanilla ice cream.", Price = 340, IsVeg = true, ImageUrl = "/assets/food-5.svg", SortOrder = 11 },
            new() { Name = "Masala Chai Pot", CategoryId = FoodCat("beverages"), Description = "Kangra tea brewed with ginger, cardamom and clove. Serves two.", Price = 240, IsVeg = true, ImageUrl = "/assets/food-6.svg", IsFeatured = true, SortOrder = 12 },
            new() { Name = "Blueberry Lassi", CategoryId = FoodCat("beverages"), Description = "Thick yoghurt blended with wild Himalayan blueberries.", Price = 280, IsVeg = true, ImageUrl = "/assets/food-1.svg", SortOrder = 13 },
            new() { Name = "Aperol Valley Spritz", CategoryId = FoodCat("beverages"), Description = "Signature mocktail with orange, rosemary and sparkling water.", Price = 360, IsVeg = true, ImageUrl = "/assets/food-2.svg", SortOrder = 14 }
        };
        db.FoodItems.AddRange(foods);

        var facilities = new List<Facility>
        {
            new() { Title = "Himalayan Spa", Description = "Six treatment rooms, steam, sauna and signature herb therapies.", Icon = "spa", ImageUrl = "/assets/facility-1.svg", SortOrder = 1 },
            new() { Title = "Infinity Pool", Description = "Temperature controlled pool with valley facing sun deck.", Icon = "pool", ImageUrl = "/assets/facility-2.svg", SortOrder = 2 },
            new() { Title = "Multi Cuisine Restaurant", Description = "Farm to table dining, indoors or on the terrace.", Icon = "bowl", ImageUrl = "/assets/facility-3.svg", SortOrder = 3 },
            new() { Title = "Bonfire & Live Music", Description = "Evening bonfires with folk musicians on weekends.", Icon = "flame", ImageUrl = "/assets/facility-4.svg", SortOrder = 4 },
            new() { Title = "Guided Forest Trails", Description = "Sunrise walks and birding with our resident naturalist.", Icon = "leaf", ImageUrl = "/assets/facility-5.svg", SortOrder = 5 },
            new() { Title = "Conference Hall", Description = "80 seat hall with projector, audio and high speed internet.", Icon = "users", ImageUrl = "/assets/facility-6.svg", SortOrder = 6 },
            new() { Title = "Kids Play Zone", Description = "Indoor and outdoor play area with trained attendants.", Icon = "star", ImageUrl = "/assets/facility-1.svg", SortOrder = 7 },
            new() { Title = "Travel Desk", Description = "Airport transfers, sightseeing cabs and trek permits.", Icon = "car", ImageUrl = "/assets/facility-2.svg", SortOrder = 8 }
        };
        db.Facilities.AddRange(facilities);

        var testimonials = new List<Testimonial>
        {
            new() { Name = "Ananya Sharma", Designation = "Travel Blogger", Location = "Mumbai", Rating = 5, ImageUrl = "/assets/person-2.svg", Message = "The valley view from our balcony was unreal, and the spa is genuinely world class. We extended our stay twice.", SortOrder = 1 },
            new() { Name = "Rahul Verma", Designation = "Software Engineer", Location = "Bengaluru", Rating = 5, ImageUrl = "/assets/person-1.svg", Message = "Worked remotely for a week from the Executive Suite. Fast Wi-Fi, quiet, and the trout at dinner became a daily ritual.", SortOrder = 2 },
            new() { Name = "Priya & Nikhil", Designation = "Honeymooners", Location = "Delhi", Rating = 5, ImageUrl = "/assets/person-3.svg", Message = "They decorated our room with flowers and local candles. Small touches that made the trip memorable.", SortOrder = 3 },
            new() { Name = "The Rathore Family", Designation = "Family of five", Location = "Jaipur", Rating = 4, ImageUrl = "/assets/person-4.svg", Message = "The family suite was perfect - the kids had their own room and the play zone kept them busy for hours.", SortOrder = 4 }
        };
        db.Testimonials.AddRange(testimonials);

        var aboutCat = cats.First(c => c.Slug == "resort").Id;
        var roomGCat = cats.First(c => c.Slug == "rooms-gallery").Id;
        var diningCat = cats.First(c => c.Slug == "dining-gallery").Id;
        var natureCat = cats.First(c => c.Slug == "nature-gallery").Id;

        var gallery = new List<GalleryItem>
        {
            new() { Title = "Resort at dusk", CategoryId = aboutCat, Url = "/assets/gallery-1.svg", SortOrder = 1 },
            new() { Title = "Infinity pool", CategoryId = aboutCat, Url = "/assets/gallery-2.svg", SortOrder = 2 },
            new() { Title = "Deluxe valley room", CategoryId = roomGCat, Url = "/assets/gallery-3.svg", SortOrder = 3 },
            new() { Title = "Executive suite terrace", CategoryId = roomGCat, Url = "/assets/room-3.svg", SortOrder = 4 },
            new() { Title = "Terrace dinner setup", CategoryId = diningCat, Url = "/assets/gallery-4.svg", SortOrder = 5 },
            new() { Title = "Jeena thali", CategoryId = diningCat, Url = "/assets/food-6.svg", SortOrder = 6 },
            new() { Title = "Pine ridge trail", CategoryId = natureCat, Url = "/assets/gallery-5.svg", SortOrder = 7 },
            new() { Title = "Apple orchard walk", CategoryId = natureCat, Url = "/assets/gallery-6.svg", SortOrder = 8 },
            new() { Title = "Resort tour film", CategoryId = aboutCat, MediaType = "YouTube", Url = "https://www.youtube.com/embed/aqz-KE-bpKQ", ThumbnailUrl = "/assets/gallery-1.svg", SortOrder = 9 }
        };
        db.GalleryItems.AddRange(gallery);

        var slides = new List<CarouselSlide>
        {
            new() { Title = "Wake Up Above the Clouds", Subtitle = "42 valley facing rooms and suites in the Kasauli hills.", MediaType = "Image", MediaUrl = "/assets/hero.svg", ButtonText = "Book Your Stay", ButtonLink = "/booking.html", Button2Text = "Explore Rooms", Button2Link = "/rooms.html", SortOrder = 1 },
            new() { Title = "A Spa Inspired by the Himalayas", Subtitle = "Herbal therapies, steam and sauna in our six room spa.", MediaType = "Image", MediaUrl = "/assets/hero-2.svg", ButtonText = "View Facilities", ButtonLink = "/about.html", Button2Text = "Contact Us", Button2Link = "/contact.html", SortOrder = 2 },
            new() { Title = "Farm to Table, Every Single Day", Subtitle = "Himachali classics and continental plates from our kitchen garden.", MediaType = "Image", MediaUrl = "/assets/hero-3.svg", ButtonText = "See the Menu", ButtonLink = "/food.html", Button2Text = "Order in Room", Button2Link = "/food.html", SortOrder = 3 },
            new() { Title = "Watch the Resort Film", Subtitle = "Two minutes inside Jeena Resort & Spa.", MediaType = "YouTube", MediaUrl = "https://www.youtube.com/embed/aqz-KE-bpKQ", PosterUrl = "/assets/hero-4.svg", ButtonText = "Book Now", ButtonLink = "/booking.html", SortOrder = 4 }
        };
        db.CarouselSlides.AddRange(slides);

        // Persist now so the demo data pass below can query these rows.
        await db.SaveChangesAsync();
        return true;
    }

    // ------------------------------------------------------------------- demo

    private static async Task<bool> SeedDemoAsync(AppDbContext db)
    {
        if (await db.Bookings.AnyAsync()) return false;

        var rooms = await db.Rooms.OrderBy(r => r.Id).ToListAsync();
        var foods = await db.FoodItems.OrderBy(f => f.Id).Take(6).ToListAsync();
        if (rooms.Count == 0) return false;

        var customers = new (string Name, string Email, string Phone)[]
        {
            ("Ananya Sharma", "ananya@example.com", "+91 98111 22334"),
            ("Rahul Verma", "rahul@example.com", "+91 98222 33445"),
            ("Priya Nair", "priya@example.com", "+91 98333 44556"),
            ("Imran Qureshi", "imran@example.com", "+91 98444 55667"),
            ("Sneha Kulkarni", "sneha@example.com", "+91 98555 66778"),
            ("Dev Malhotra", "dev@example.com", "+91 98666 77889")
        };

        var today = DateTime.UtcNow.Date;
        var rnd = new Random(20261018);
        var statuses = new[] { BookingStatuses.Confirmed, BookingStatuses.Pending, BookingStatuses.CheckedIn, BookingStatuses.CheckedOut, BookingStatuses.Cancelled };
        var bookings = new List<Booking>();

        for (var i = 0; i < 26; i++)
        {
            var cust = customers[i % customers.Length];
            var room = rooms[i % rooms.Count];
            var startOffset = -60 + i * 5;
            var checkIn = today.AddDays(startOffset);
            var nights = 1 + rnd.Next(4);
            var checkOut = checkIn.AddDays(nights);
            var roomCount = 1 + rnd.Next(2);
            var roomAmount = room.PricePerNight * nights * roomCount * (1 - room.DiscountPercent / 100m);
            var foodAmount = rnd.Next(0, 6) * 350m;
            var tax = Math.Round((roomAmount + foodAmount) * 0.12m, 2);
            var status = statuses[i % statuses.Length];
            var pay = status switch
            {
                BookingStatuses.Confirmed => PaymentStatuses.Partial,
                BookingStatuses.CheckedIn => PaymentStatuses.Partial,
                BookingStatuses.CheckedOut => PaymentStatuses.Paid,
                BookingStatuses.Cancelled => PaymentStatuses.Refunded,
                _ => PaymentStatuses.Unpaid
            };

            bookings.Add(new Booking
            {
                BookingCode = $"JR-{today:yyMM}-{1000 + i}",
                GuestName = cust.Name,
                GuestEmail = cust.Email,
                GuestPhone = cust.Phone,
                RoomId = room.Id,
                CheckIn = checkIn,
                CheckOut = checkOut,
                Adults = 1 + rnd.Next(3),
                Children = rnd.Next(0, 3),
                RoomCount = roomCount,
                Nights = nights,
                RoomAmount = Math.Round(roomAmount, 2),
                FoodAmount = foodAmount,
                TaxAmount = tax,
                TotalAmount = Math.Round(roomAmount + foodAmount + tax, 2),
                Status = status,
                PaymentStatus = pay,
                PaymentMethod = i % 3 == 0 ? "UPI" : i % 3 == 1 ? "Card" : "Cash at resort",
                SpecialRequest = i % 5 == 0 ? "Please arrange a valley facing room on a higher floor." : null,
                CreatedAt = checkIn.AddDays(-7)
            });
        }
        db.Bookings.AddRange(bookings);
        await db.SaveChangesAsync();

        var orders = new List<FoodOrder>();
        for (var i = 0; i < 14; i++)
        {
            var b = bookings[i % bookings.Count];
            var items = foods.Skip(rnd.Next(0, 3)).Take(1 + rnd.Next(3)).ToList();
            var order = new FoodOrder
            {
                OrderCode = $"FO-{today:yyMM}-{2000 + i}",
                BookingId = b.Id,
                CustomerName = b.GuestName,
                Email = b.GuestEmail,
                Phone = b.GuestPhone,
                OrderType = i % 3 == 0 ? FoodOrderTypes.RoomService : i % 3 == 1 ? FoodOrderTypes.DineIn : FoodOrderTypes.Takeaway,
                Status = i % 4 == 0 ? "New" : i % 4 == 1 ? "Preparing" : i % 4 == 2 ? "Served" : "Billed",
                Notes = i % 6 == 0 ? "Less spicy please." : null,
                CreatedAt = b.CheckIn.AddHours(19),
                Items = [.. items.Select(f => new FoodOrderItem
                {
                    FoodItemId = f.Id,
                    Name = f.Name,
                    UnitPrice = f.DiscountPrice ?? f.Price,
                    Quantity = 1 + rnd.Next(2)
                })]
            };
            order.TotalAmount = order.Items.Sum(x => x.UnitPrice * x.Quantity);
            orders.Add(order);
        }
        db.FoodOrders.AddRange(orders);

        db.ContactMessages.AddRange(
            new ContactMessage { Name = "Karan Bedi", Email = "karan@example.com", Phone = "+91 99001 11223", Subject = "Wedding enquiry", Message = "We are looking at a 60 guest wedding in November. Could you share the lawn packages?", CreatedAt = today.AddDays(-4) },
            new ContactMessage { Name = "Lata Menon", Email = "lata@example.com", Phone = "+91 99002 22334", Subject = "Pet friendly?", Message = "Do you allow small dogs in the garden cottages?", IsRead = true, CreatedAt = today.AddDays(-9) });

        db.NewsletterSubscribers.AddRange(
            new NewsletterSubscriber { Email = "ananya@example.com", CreatedAt = today.AddDays(-20) },
            new NewsletterSubscriber { Email = "rahul@example.com", CreatedAt = today.AddDays(-11) });

        await db.SaveChangesAsync();
        return true;
    }
}
