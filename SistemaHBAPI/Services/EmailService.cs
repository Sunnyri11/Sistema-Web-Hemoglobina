using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Text;

namespace SistemaHB.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(string emailDestino, string asunto, string mensajeHtml)
        {
            var email = new MimeMessage();

            // Configurar Emisor
            var nombreEmisor = _configuration["EmailSettings:SenderName"];
            var correoEmisor = _configuration["EmailSettings:SenderEmail"];
            email.From.Add(new MailboxAddress(nombreEmisor, correoEmisor));

            // Configurar Receptor
            email.To.Add(MailboxAddress.Parse(emailDestino));

            // Configurar Asunto y Cuerpo (HTML)
            email.Subject = asunto;
            email.Body = new TextPart(TextFormat.Html) { Text = mensajeHtml };

            // Enviar correo mediante SMTP
            using var smtp = new SmtpClient();

            var servidor = _configuration["EmailSettings:SmtpServer"];
            var puerto = int.Parse(_configuration["EmailSettings:Port"] ?? "587");

            // Conexión segura usando STARTTLS
            await smtp.ConnectAsync(servidor, puerto, SecureSocketOptions.StartTls);

            // Autenticación
            var usuario = _configuration["EmailSettings:Username"];
            var password = _configuration["EmailSettings:Password"];
            await smtp.AuthenticateAsync(usuario, password);

            // Envío y desconexión
            await smtp.SendAsync(email);
            await smtp.DisconnectAsync(true);
        }
    }
}
