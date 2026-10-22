using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ResortWithJeena.Data;
using ResortWithJeena.Models;
using ResortWithJeena.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------- database
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=(localdb)\\MSSQLLocalDB;Initial Catalog=Resortwithjeena;Integrated Security=True;Encrypt=True;TrustServerCertificate=True";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString, sql =>
    {
        sql.EnableRetryOnFailure(3);
        sql.CommandTimeout(0);
    }));

// ------------------------------------------------------------------ uploads
builder.Services.Configure<FormOptions>(o =>
{
    o.ValueLengthLimit = int.MaxValue;
    o.MultipartBodyLengthLimit = FileStorageService.MaxVideoBytes + (10 * 1024 * 1024);
    o.MultipartHeadersLengthLimit = int.MaxValue;
});

builder.WebHost.ConfigureKestrel(k =>
{
    k.Limits.MaxRequestBodySize = FileStorageService.MaxVideoBytes + (10 * 1024 * 1024);
});

// --------------------------------------------------------------------- auth
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? "jeena-resort-development-signing-key-change-me-0123456789";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "ResortWithJeena";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "ResortWithJeena";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;   // local development over http
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddHttpContextAccessor();

// ----------------------------------------------------------------- services
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<OtpService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddSingleton<FileStorageService>();
builder.Services.AddSingleton<JwtService>();
builder.Services.AddScoped<IEmailSender, EmailService>();

// -------------------------------------------------------------------- mvc
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    o.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.Never;
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .SetIsOriginAllowed(_ => true)
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// ------------------------------------------------------------ create and seed
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = services.GetRequiredService<AppDbContext>();

        // Set RESORT_RESET_DB=1 to drop and rebuild the database (useful to restore the demo data).
        if (Environment.GetEnvironmentVariable("RESORT_RESET_DB") == "1")
        {
            logger.LogWarning("RESORT_RESET_DB=1 - dropping the existing database before seeding.");
            await db.Database.EnsureDeletedAsync();
        }

        await DbSeeder.SeedAsync(db, app.Configuration, logger);
        await services.GetRequiredService<OtpService>().CleanupAsync();
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Database initialisation failed. Check that SQL Server LocalDB is running and the connection string is correct.");
        throw;
    }
}

// -------------------------------------------------------------- middleware
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Unhandled error on {Method} {Path}", context.Request.Method, context.Request.Path);
        if (!context.Response.HasStarted)
        {
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { message = "Something went wrong on the server. " + ex.Message });
        }
    }
});

app.UseCors();

// The admin panel lives in a folder (/admin/). Because the SPA fallback endpoint
// (MapFallbackToFile with its "{*path:nonfile}" pattern) claims any path that is not
// a real file, static files never get a chance to serve the folder's default
// document. Serve the admin shell explicitly instead.
app.Use(async (ctx, next) =>
{
    var path = ctx.Request.Path.Value ?? "";

    if (path.Equals("/admin", StringComparison.OrdinalIgnoreCase))
    {
        ctx.Response.Redirect("/admin/");
        return;
    }

    if (path.Equals("/admin/", StringComparison.OrdinalIgnoreCase))
    {
        var wwwroot = app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot");
        ctx.Response.Headers.CacheControl = "no-cache,no-store,must-revalidate";
        ctx.Response.ContentType = "text/html; charset=utf-8";
        await ctx.Response.SendFileAsync(Path.Combine(wwwroot, "admin", "index.html"));
        return;
    }

    await next();
});

app.UseDefaultFiles();
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Keep the front end fresh while developing; media can cache longer.
        var path = ctx.File.Name;
        var isMedia = path.EndsWith(".svg") || path.EndsWith(".png") || path.EndsWith(".jpg")
                   || path.EndsWith(".jpeg") || path.EndsWith(".webp") || path.EndsWith(".mp4");
        ctx.Context.Response.Headers.CacheControl = isMedia && !path.Contains("logo")
            ? "public,max-age=86400"
            : "no-cache,no-store,must-revalidate";
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Friendly JSON for unknown API routes, otherwise hand over to the static site.
app.MapFallback("/api/{**slug}", () => Results.NotFound(new { message = "That API endpoint does not exist." }));
app.MapFallbackToFile("index.html");

app.Logger.LogInformation("""

    ============================================================
      Jeena Resort website is starting
      Public site : {Url}
      Admin panel : {AdminUrl}
    ============================================================

    """,
    "http://localhost:5080", "http://localhost:5080/admin/");

app.Run();
