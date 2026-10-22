using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ResortWithJeena.Services;

public record EmailResult(bool Sent, string? Error = null, bool DevMode = false);

public interface IEmailSender
{
    Task<bool> IsConfiguredAsync();
    Task<bool> DevModeAsync();
    Task<EmailResult> SendAsync(string to, string subject, string htmlBody, string? toName = null);
}

/// <summary>
/// SMTP sender driven entirely by admin settings. When SMTP is not configured (or dev mode is on)
/// every message is written to App_Data/outbox so nothing is lost and no credentials are needed.
/// </summary>
public class EmailService(SettingsService settings, IWebHostEnvironment env, ILogger<EmailService> log) : IEmailSender
{
    public async Task<bool> DevModeAsync() => await settings.GetBoolAsync("email.otpDevMode", true);

    public async Task<bool> IsConfiguredAsync()
    {
        var host = await settings.GetAsync("email.smtpHost");
        return !string.IsNullOrWhiteSpace(host);
    }

    public async Task<EmailResult> SendAsync(string to, string subject, string htmlBody, string? toName = null)
    {
        var devMode = await DevModeAsync();
        var host = await settings.GetAsync("email.smtpHost");

        if (devMode || string.IsNullOrWhiteSpace(host))
        {
            var path = await SaveToOutboxAsync(to, subject, htmlBody);
            log.LogWarning("[DEV MAIL] To: {To} | Subject: {Subject} | Saved: {Path} | Enable SMTP in Admin > Settings > Email / OTP to send real mail.",
                to, subject, path);
            return new EmailResult(false, "SMTP not configured - message written to App_Data/outbox.", true);
        }

        try
        {
            var fromEmail = await settings.GetAsync("email.fromEmail", "no-reply@resortwithjeena.com");
            var fromName = await settings.GetAsync("email.fromName", "Resort");
            var user = await settings.GetAsync("email.smtpUser");
            var pass = await settings.GetAsync("email.smtpPassword");
            var port = await settings.GetIntAsync("email.smtpPort", 587);
            var ssl = await settings.GetBoolAsync("email.enableSsl", true);

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(new MailboxAddress(toName ?? to, to));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var client = new SmtpClient();
            var secure = ssl ? SecureSocketOptions.Auto : SecureSocketOptions.None;
            await client.ConnectAsync(host, port, secure);
            if (!string.IsNullOrWhiteSpace(user))
                await client.AuthenticateAsync(user, pass);
            await client.SendAsync(message);
            await client.DisconnectAsync(true);

            return new EmailResult(true);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Failed to send email to {To}", to);
            await SaveToOutboxAsync(to, "[FAILED] " + subject, htmlBody);
            return new EmailResult(false, ex.Message);
        }
    }

    private async Task<string> SaveToOutboxAsync(string to, string subject, string html)
    {
        var dir = Path.Combine(env.ContentRootPath, "App_Data", "outbox");
        Directory.CreateDirectory(dir);
        var file = Path.Combine(dir, $"{DateTime.UtcNow:yyyyMMdd-HHmmss-fff}-{Sanitize(to)}.html");
        var content = $"<!-- To: {to}\nSubject: {subject}\nDate: {DateTime.UtcNow:R} -->\n{html}";
        await File.WriteAllTextAsync(file, content);
        return file;
    }

    private static string Sanitize(string s) => string.Concat(s.Where(c => char.IsLetterOrDigit(c) || c is '.' or '@' or '-' or '_'));
}
